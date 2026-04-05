"""
Agente coach: RAG sobre ChromaDB + Claude API con metodología 4-MAT.
"""

import os
from pathlib import Path

import chromadb
from anthropic import Anthropic
from dotenv import load_dotenv

from .prompts import SYSTEM_PROMPT, build_rag_context

load_dotenv(Path(__file__).parent.parent / ".env")

CHROMA_PATH = Path(__file__).parent.parent / "data" / "chroma"
COLLECTION_NAME = "pilot-coach-v3"
RAG_N_RESULTS = 5          # chunks a recuperar por consulta
MAX_HISTORY_TURNS = 10     # turnos de conversación a mantener en contexto
CLAUDE_MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 2048


def _get_collection() -> chromadb.Collection:
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    return client.get_collection(COLLECTION_NAME)


def retrieve_context(query: str) -> list[str]:
    """Busca en ChromaDB los chunks más relevantes para la consulta."""
    try:
        collection = _get_collection()
        results = collection.query(
            query_texts=[query],
            n_results=RAG_N_RESULTS,
            include=["documents"],
        )
        return results["documents"][0] if results["documents"] else []
    except Exception:
        return []


def build_messages_for_claude(
    history: list[dict],
    user_message: str,
    rag_chunks: list[str],
) -> list[dict]:
    """
    Construye la lista de mensajes para la API de Claude.
    history: lista de {"rol": "user"|"assistant", "contenido": str}
    """
    messages = []

    # Historial previo (últimos N turnos)
    for turn in history[-(MAX_HISTORY_TURNS * 2):]:
        messages.append({
            "role": turn["rol"],
            "content": turn["contenido"],
        })

    # Mensaje actual del usuario, con contexto RAG inyectado
    rag_block = build_rag_context(rag_chunks)
    content = user_message
    if rag_block:
        content = f"{rag_block}\n\n## Pregunta del piloto\n\n{user_message}"

    messages.append({"role": "user", "content": content})
    return messages


def chat(
    user_message: str,
    history: list[dict],
    pilot_name: str = "",
) -> str:
    """
    Genera la respuesta del coach.

    Args:
        user_message: Mensaje del piloto.
        history: Historial previo [{rol, contenido}, ...].
        pilot_name: Nombre del piloto para personalizar el prompt.

    Returns:
        Respuesta del coach como string.
    """
    # 1. Recuperar contexto RAG
    rag_chunks = retrieve_context(user_message)

    # 2. Construir mensajes
    messages = build_messages_for_claude(history, user_message, rag_chunks)

    # 3. Personalizar system prompt con el nombre del piloto
    system = SYSTEM_PROMPT
    if pilot_name:
        system += f"\n\nEl piloto con quien estás hablando se llama **{pilot_name}**."

    # 4. Llamar a Claude
    client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=MAX_TOKENS,
        system=system,
        messages=messages,
    )

    return response.content[0].text
