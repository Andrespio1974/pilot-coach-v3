"""
Agente coach.

Dos modos:
- COACHING (default): RAG sobre el libro de Jaime Ferrer + estilo socrático 4-MAT.
- SCENARIO: simulación de toma de decisiones sobre un escenario MASTER-AERO-DOC-V17C.
"""

import os
from pathlib import Path

import chromadb
from anthropic import Anthropic
from dotenv import load_dotenv

from .prompts import (
    SYSTEM_PROMPT,
    build_rag_context,
    build_scenario_system_prompt,
)
from .scenarios import get_scenario

load_dotenv(Path(__file__).parent.parent / ".env")

CHROMA_PATH = Path(__file__).parent.parent / "data" / "chroma"
BOOK_COLLECTION = "pilot-coach-v3"
RAG_N_RESULTS = 5
MAX_HISTORY_TURNS = 10
CLAUDE_MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 2048
SCENARIO_MAX_TOKENS = 3072  # mayor — la tarjeta de cierre es larga


def _get_collection(name: str) -> chromadb.Collection:
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    return client.get_collection(name)


def retrieve_context(query: str) -> list[str]:
    """Busca chunks relevantes del libro para Modo Coaching."""
    try:
        collection = _get_collection(BOOK_COLLECTION)
        results = collection.query(
            query_texts=[query],
            n_results=RAG_N_RESULTS,
            include=["documents"],
        )
        return results["documents"][0] if results["documents"] else []
    except Exception:
        return []


def _build_messages(history: list[dict], user_message: str, extra_user_prefix: str = "") -> list[dict]:
    """Construye la lista de mensajes para la API de Claude (roles user/assistant)."""
    messages = []
    for turn in history[-(MAX_HISTORY_TURNS * 2):]:
        messages.append({"role": turn["rol"], "content": turn["contenido"]})

    content = user_message
    if extra_user_prefix:
        content = f"{extra_user_prefix}\n\n## Pregunta del piloto\n\n{user_message}"
    messages.append({"role": "user", "content": content})
    return messages


def _chat_coaching(user_message: str, history: list[dict], pilot_name: str) -> str:
    rag_chunks = retrieve_context(user_message)
    rag_block = build_rag_context(rag_chunks)
    messages = _build_messages(history, user_message, extra_user_prefix=rag_block)

    system = SYSTEM_PROMPT
    if pilot_name:
        system += f"\n\nEl piloto con quien estás hablando se llama **{pilot_name}**."

    client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=MAX_TOKENS,
        system=system,
        messages=messages,
    )
    return response.content[0].text


def _chat_scenario(user_message: str, history: list[dict], pilot_name: str, scenario_id: str) -> str:
    scenario = get_scenario(scenario_id)
    if scenario is None:
        raise ValueError(f"Escenario no encontrado: {scenario_id}")

    system = build_scenario_system_prompt(scenario)
    if pilot_name:
        system += f"\n\nEl piloto con quien estás trabajando se llama **{pilot_name}**."

    messages = _build_messages(history, user_message)

    client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=SCENARIO_MAX_TOKENS,
        system=system,
        messages=messages,
    )
    return response.content[0].text


def chat(
    user_message: str,
    history: list[dict],
    pilot_name: str = "",
    mode: str = "coaching",
    scenario_id: str | None = None,
) -> str:
    """
    Genera la respuesta del coach.

    Args:
        user_message: Mensaje del piloto.
        history: Historial previo [{rol, contenido}, ...].
        pilot_name: Nombre del piloto.
        mode: "coaching" (RAG sobre libro) o "scenario" (simulación).
        scenario_id: Requerido si mode == "scenario".
    """
    if mode == "scenario":
        if not scenario_id:
            raise ValueError("scenario_id requerido en mode=scenario")
        return _chat_scenario(user_message, history, pilot_name, scenario_id)

    return _chat_coaching(user_message, history, pilot_name)
