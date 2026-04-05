"""
Crea usuarios iniciales en la base de datos (SQLite o PostgreSQL).
Lee DATABASE_URL del .env — funciona tanto en local como en Railway.

Uso:
    python scripts/create_users.py
    python scripts/create_users.py --list        # solo lista usuarios existentes
"""

import argparse
import sys
from pathlib import Path

import bcrypt
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Cargar .env desde la raíz del proyecto (override para que DATABASE_URL local
# no sea sobreescrita por variables del entorno de shell)
ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env", override=True)

import os
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/pilot_coach.db")

# Railway expone URLs postgres:// pero SQLAlchemy requiere postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

USERS_TO_CREATE = [
    {
        "nombre":        "Jaime Ferrer",
        "email":         "jferrer@alphapio.com",
        "password":      "pilot1234",
        "rol":           "piloto",
    },
    {
        "nombre":        "Jaime Ferrer",
        "email":         "jaimeferrer57@outlook.es",
        "password":      "coach1234",
        "rol":           "instructor",
    },
]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def list_users(conn):
    result = conn.execute(text("SELECT id, nombre, email, rol FROM users ORDER BY id"))
    rows = result.fetchall()
    if not rows:
        print("  (sin usuarios)")
        return
    for row in rows:
        print(f"  id={row[0]:<4} {row[2]:<38} {row[3]:<12} {row[1]}")


def create_users(conn):
    created = 0
    skipped = 0
    for u in USERS_TO_CREATE:
        result = conn.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": u["email"]},
        )
        if result.fetchone():
            print(f"  SKIP  {u['email']} — ya existe")
            skipped += 1
            continue

        pw_hash = hash_password(u["password"])
        conn.execute(
            text("""
                INSERT INTO users (nombre, email, password_hash, rol)
                VALUES (:nombre, :email, :password_hash, :rol)
            """),
            {
                "nombre":        u["nombre"],
                "email":         u["email"],
                "password_hash": pw_hash,
                "rol":           u["rol"],
            },
        )
        print(f"  OK    {u['email']} ({u['rol']})")
        created += 1

    return created, skipped


def main():
    parser = argparse.ArgumentParser(description="Crea usuarios en la BD de Pilot Coach")
    parser.add_argument("--list", action="store_true", help="Solo listar usuarios existentes")
    args = parser.parse_args()

    is_sqlite = "sqlite" in DATABASE_URL
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False} if is_sqlite else {},
    )

    db_label = "SQLite (local)" if is_sqlite else "PostgreSQL (Railway)"
    print(f"\nConectando a: {db_label}")
    print(f"URL: {DATABASE_URL[:60]}{'...' if len(DATABASE_URL) > 60 else ''}\n")

    with engine.begin() as conn:
        if args.list:
            print("── Usuarios existentes ────────────────────────────────")
            list_users(conn)
        else:
            print("── Creando usuarios ───────────────────────────────────")
            created, skipped = create_users(conn)

            print(f"\n── Resultado: {created} creados, {skipped} omitidos")
            print("\n── Usuarios en la base de datos ───────────────────────")
            list_users(conn)

    print()


if __name__ == "__main__":
    main()
