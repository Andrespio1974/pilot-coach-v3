"""
Carga, acceso e indexacion de los escenarios MASTER-AERO-DOC-V17C.

Los archivos JSON viven en knowledge_base/escenarios/json/.
Expone:
- list_scenarios(): lista compacta para el frontend
- get_scenario(id): JSON completo para el agente
- ingest_scenarios_to_chroma(): indexa todos los escenarios en ChromaDB
"""

import json
from functools import lru_cache
from pathlib import Path

SCENARIOS_DIR = Path(__file__).parent.parent / "knowledge_base" / "escenarios" / "json"
CHROMA_PATH = Path(__file__).parent.parent / "data" / "chroma"
SCENARIOS_COLLECTION = "pilot-coach-scenarios"


@lru_cache(maxsize=1)
def _load_all() -> dict:
    """Carga todos los escenarios en un dict {id: scenario_dict}."""
    scenarios = {}
    if not SCENARIOS_DIR.exists():
        return scenarios
    for jf in sorted(SCENARIOS_DIR.glob("*.json")):
        data = json.loads(jf.read_text(encoding="utf-8"))
        scenarios[data["id"]] = data
    return scenarios


def list_scenarios() -> list[dict]:
    """Resumen de los escenarios disponibles para el frontend."""
    return [
        {
            "id": s["id"],
            "title": s["title"],
            "competency_code": s["competency"]["code"],
            "competency_name": s["competency"]["name"],
            "primary_ob_code": s["primary_ob"]["code"],
            "primary_ob_name": s["primary_ob"]["name"],
        }
        for s in _load_all().values()
    ]


def get_scenario(scenario_id: str) -> dict | None:
    """Devuelve el escenario completo o None si no existe."""
    return _load_all().get(scenario_id)


def _build_searchable_text(scenario: dict) -> str:
    """Texto que se indexa en ChromaDB para busqueda semantica."""
    parts = [
        f"# {scenario['title']}",
        "",
        f"Competency: {scenario['competency']['code']} - {scenario['competency']['name']}",
        f"Primary OB: {scenario['primary_ob']['code']} - {scenario['primary_ob']['name']}",
        "",
        "## Context",
        scenario["context"],
        "",
        "## Operational Expectations",
        *[f"- {e}" for e in scenario["operational_expectations"]],
        "",
        "## Sequence of Events",
        *[f"- {ev['event']} [{ev['ob']}]" for ev in scenario["sequence_of_events"]],
        "",
        "## Key Points",
        *[f"- {p}" for p in scenario["key_points"]],
    ]
    return "\n".join(parts)


def ingest_scenarios_to_chroma() -> int:
    """
    Indexa los escenarios JSON en ChromaDB (idempotente).
    Borra la coleccion si existe y la recrea con el contenido actual.
    Devuelve el numero de escenarios indexados.
    """
    import chromadb

    CHROMA_PATH.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))

    existing = [c.name for c in client.list_collections()]
    if SCENARIOS_COLLECTION in existing:
        client.delete_collection(SCENARIOS_COLLECTION)

    collection = client.create_collection(
        name=SCENARIOS_COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )

    scenarios = _load_all()
    if not scenarios:
        return 0

    documents, ids, metadatas = [], [], []
    for sid, scenario in scenarios.items():
        documents.append(_build_searchable_text(scenario))
        ids.append(sid)
        metadatas.append({
            "id": sid,
            "title": scenario["title"],
            "competency_code": scenario["competency"]["code"],
            "competency_name": scenario["competency"]["name"],
            "primary_ob_code": scenario["primary_ob"]["code"],
            "primary_ob_name": scenario["primary_ob"]["name"],
        })

    collection.add(documents=documents, ids=ids, metadatas=metadatas)
    return len(scenarios)
