"""
SQLite database setup con SQLAlchemy.
Tablas: users, sessions, messages
"""

import os
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import (
    Column, DateTime, ForeignKey, Integer, String, Text,
    create_engine, event, inspect, text,
)
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env", override=True)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/pilot_coach.db")

# Railway inyecta postgres:// pero SQLAlchemy 2.x solo acepta postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Asegurar que el directorio existe para SQLite
if DATABASE_URL.startswith("sqlite:///"):
    db_path = Path(DATABASE_URL.replace("sqlite:///", ""))
    db_path.parent.mkdir(parents=True, exist_ok=True)

_is_sqlite = "sqlite" in DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
)

# Habilitar WAL mode y foreign keys solo en SQLite
if _is_sqlite:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    rol = Column(String(20), nullable=False, default="piloto")  # piloto | instructor

    sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")


class ChatSession(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    fecha = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    titulo = Column(String(200), nullable=True)
    mode = Column(String(20), nullable=False, default="coaching")  # coaching | scenario
    scenario_id = Column(String(80), nullable=True)  # ID del escenario si mode=scenario

    user = relationship("User", back_populates="sessions")
    messages = relationship("Message", back_populates="session", cascade="all, delete-orphan",
                            order_by="Message.timestamp")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    rol = Column(String(20), nullable=False)  # user | assistant
    contenido = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    session = relationship("ChatSession", back_populates="messages")


def create_tables():
    Base.metadata.create_all(bind=engine)
    _migrate_sessions_add_mode()


def _migrate_sessions_add_mode():
    """Añade mode/scenario_id a sessions si la tabla ya existe sin esas columnas."""
    inspector = inspect(engine)
    if "sessions" not in inspector.get_table_names():
        return
    columns = {c["name"] for c in inspector.get_columns("sessions")}
    with engine.begin() as conn:
        if "mode" not in columns:
            conn.execute(text("ALTER TABLE sessions ADD COLUMN mode VARCHAR(20) NOT NULL DEFAULT 'coaching'"))
        if "scenario_id" not in columns:
            conn.execute(text("ALTER TABLE sessions ADD COLUMN scenario_id VARCHAR(80)"))


def get_db():
    """Dependency para FastAPI."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
