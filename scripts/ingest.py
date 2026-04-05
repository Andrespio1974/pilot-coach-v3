"""
Ingesta RAG: lee los .txt de knowledge_base/, divide en chunks y los indexa en ChromaDB.
"""

import re
from pathlib import Path
import chromadb

KNOWLEDGE_BASE = Path(__file__).parent.parent / "knowledge_base"
CHROMA_PATH = Path(__file__).parent.parent / "data" / "chroma"
COLLECTION_NAME = "pilot-coach-v3"
CHUNK_SIZE = 500    # palabras
OVERLAP = 50        # palabras


def chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    """Divide el texto en chunks de chunk_size palabras con overlap."""
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        if end >= len(words):
            break
        start += chunk_size - overlap
    return chunks


def clean_text(text: str) -> str:
    """Limpieza básica del texto antes de chunking."""
    # Colapsar líneas en blanco excesivas
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Quitar espacios al inicio/fin
    return text.strip()


def main():
    # Asegurar que el directorio de ChromaDB existe
    CHROMA_PATH.mkdir(parents=True, exist_ok=True)

    client = chromadb.PersistentClient(path=str(CHROMA_PATH))

    # Borrar colección existente para re-indexar limpio
    existing = [c.name for c in client.list_collections()]
    if COLLECTION_NAME in existing:
        client.delete_collection(COLLECTION_NAME)
        print(f"Colección '{COLLECTION_NAME}' eliminada para re-indexar.")

    collection = client.create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )

    txt_files = sorted(KNOWLEDGE_BASE.glob("*.txt"))
    if not txt_files:
        print(f"No se encontraron archivos .txt en {KNOWLEDGE_BASE}")
        return

    total_chunks = 0

    for txt_path in txt_files:
        print(f"\nLeyendo: {txt_path.name}")
        raw = txt_path.read_text(encoding="utf-8")
        text = clean_text(raw)
        word_count = len(text.split())
        print(f"  Palabras totales: {word_count:,}")

        chunks = chunk_text(text, CHUNK_SIZE, OVERLAP)
        print(f"  Chunks generados: {len(chunks)}")

        # Preparar datos para ChromaDB
        ids = [f"{txt_path.stem}__chunk_{i:04d}" for i in range(len(chunks))]
        metadatas = [
            {
                "source": txt_path.name,
                "chunk_index": i,
                "chunk_size_words": len(c.split()),
            }
            for i, c in enumerate(chunks)
        ]

        # Insertar en lotes de 100 para no saturar memoria
        batch_size = 100
        for batch_start in range(0, len(chunks), batch_size):
            batch_end = batch_start + batch_size
            collection.add(
                documents=chunks[batch_start:batch_end],
                ids=ids[batch_start:batch_end],
                metadatas=metadatas[batch_start:batch_end],
            )

        total_chunks += len(chunks)
        print(f"  Indexados en ChromaDB: {len(chunks)} chunks")

    print(f"\n{'='*50}")
    print(f"Coleccion: '{COLLECTION_NAME}'")
    print(f"Archivos procesados: {len(txt_files)}")
    print(f"Total chunks indexados: {total_chunks:,}")
    print(f"Base de datos en: {CHROMA_PATH}")

    # Verificacion final
    final_count = collection.count()
    print(f"Verificacion ChromaDB: {final_count:,} documentos en la coleccion")


if __name__ == "__main__":
    main()
