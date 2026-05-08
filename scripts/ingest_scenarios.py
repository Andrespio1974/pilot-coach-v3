"""
Ingesta CLI de escenarios MASTER-AERO-DOC-V17C en ChromaDB.

Uso (desde la raiz del proyecto):
    python scripts/ingest_scenarios.py

La logica esta en backend/scenarios.py y se llama tambien al arrancar el
backend (FastAPI startup), asi que normalmente NO necesitas correr esto a
mano. Util si quieres re-indexar sin reiniciar el servidor.
"""

import sys
from pathlib import Path

# Permitir importar el modulo backend al correr el script directamente
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.scenarios import (  # noqa: E402
    SCENARIOS_COLLECTION,
    CHROMA_PATH,
    ingest_scenarios_to_chroma,
)


def main():
    n = ingest_scenarios_to_chroma()
    print(f"Coleccion: '{SCENARIOS_COLLECTION}'")
    print(f"Escenarios indexados: {n}")
    print(f"Base de datos: {CHROMA_PATH}")


if __name__ == "__main__":
    main()
