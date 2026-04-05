"""
FastAPI — Pilot Coach V3
Endpoints: /auth/login, /chat, /sessions, /sessions/{id}/messages
"""

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
import anthropic as anthropic_sdk
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .auth import (
    create_access_token,
    get_current_user,
    hash_password,
    require_instructor,
    verify_password,
)
from .database import ChatSession, Message, User, create_tables, get_db
from .agent import chat as agent_chat

load_dotenv(Path(__file__).parent.parent / ".env")

# ── Inicialización ──────────────────────────────────────────────────────────

app = FastAPI(
    title="Pilot Coach V3",
    description="Asistente de coaching para pilotos basado en Jaime Ferrer Vives",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    create_tables()
    _seed_demo_users()


def _seed_demo_users():
    """Crea usuarios de demo si la BD está vacía."""
    db = next(get_db())
    try:
        if db.query(User).count() == 0:
            users = [
                User(
                    nombre="Carlos Aviador",
                    email="piloto@demo.com",
                    password_hash=hash_password("piloto123"),
                    rol="piloto",
                ),
                User(
                    nombre="Ana Instructora",
                    email="instructor@demo.com",
                    password_hash=hash_password("instructor123"),
                    rol="instructor",
                ),
            ]
            db.add_all(users)
            db.commit()
    finally:
        db.close()


# ── Schemas Pydantic ────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    nombre: str
    rol: str


class ChatRequest(BaseModel):
    mensaje: str
    session_id: Optional[int] = None  # None = nueva sesión


class ChatResponse(BaseModel):
    respuesta: str
    session_id: int


class SessionOut(BaseModel):
    id: int
    user_id: int
    fecha: datetime
    titulo: Optional[str]
    total_mensajes: int

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    id: int
    session_id: int
    rol: str
    contenido: str
    timestamp: datetime

    class Config:
        from_attributes = True


class RegisterRequest(BaseModel):
    nombre: str
    email: str
    password: str
    rol: str = "piloto"


# ── Auth ────────────────────────────────────────────────────────────────────

@app.post("/auth/login", response_model=LoginResponse, tags=["Auth"])
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
        )
    token = create_access_token({"sub": str(user.id), "rol": user.rol})
    return LoginResponse(
        access_token=token,
        user_id=user.id,
        nombre=user.nombre,
        rol=user.rol,
    )


@app.post("/auth/register", response_model=LoginResponse, tags=["Auth"])
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    if payload.rol not in ("piloto", "instructor"):
        raise HTTPException(status_code=400, detail="Rol inválido")
    user = User(
        nombre=payload.nombre,
        email=payload.email,
        password_hash=hash_password(payload.password),
        rol=payload.rol,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id), "rol": user.rol})
    return LoginResponse(
        access_token=token,
        user_id=user.id,
        nombre=user.nombre,
        rol=user.rol,
    )


# ── Chat ────────────────────────────────────────────────────────────────────

@app.post("/chat", response_model=ChatResponse, tags=["Chat"])
def chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Obtener o crear sesión
    if payload.session_id:
        session = db.query(ChatSession).filter(
            ChatSession.id == payload.session_id,
            ChatSession.user_id == current_user.id,
        ).first()
        if not session:
            raise HTTPException(status_code=404, detail="Sesión no encontrada")
    else:
        session = ChatSession(user_id=current_user.id)
        db.add(session)
        db.commit()
        db.refresh(session)

    # Cargar historial de la sesión
    prev_messages = (
        db.query(Message)
        .filter(Message.session_id == session.id)
        .order_by(Message.timestamp)
        .all()
    )
    history = [{"rol": m.rol, "contenido": m.contenido} for m in prev_messages]

    # Guardar mensaje del usuario
    user_msg = Message(
        session_id=session.id,
        rol="user",
        contenido=payload.mensaje,
    )
    db.add(user_msg)
    db.commit()

    # Generar respuesta del agente
    try:
        respuesta = agent_chat(
            user_message=payload.mensaje,
            history=history,
            pilot_name=current_user.nombre,
        )
    except anthropic_sdk.BadRequestError as e:
        raise HTTPException(status_code=503, detail=f"Error de API: {e.message}")
    except anthropic_sdk.APIStatusError as e:
        raise HTTPException(status_code=503, detail=f"Error del servicio LLM: {e.message}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

    # Guardar respuesta del agente
    assistant_msg = Message(
        session_id=session.id,
        rol="assistant",
        contenido=respuesta,
    )
    db.add(assistant_msg)

    # Actualizar título de sesión con las primeras palabras del primer mensaje
    if not session.titulo and len(history) == 0:
        words = payload.mensaje.split()[:8]
        session.titulo = " ".join(words) + ("..." if len(payload.mensaje.split()) > 8 else "")

    db.commit()

    return ChatResponse(respuesta=respuesta, session_id=session.id)


# ── Sessions ────────────────────────────────────────────────────────────────

@app.get("/sessions", response_model=list[SessionOut], tags=["Sessions"])
def get_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.fecha.desc())
        .all()
    )
    result = []
    for s in sessions:
        result.append(
            SessionOut(
                id=s.id,
                user_id=s.user_id,
                fecha=s.fecha,
                titulo=s.titulo,
                total_mensajes=len(s.messages),
            )
        )
    return result


@app.get("/sessions/{session_id}/messages", response_model=list[MessageOut], tags=["Sessions"])
def get_session_messages(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    messages = (
        db.query(Message)
        .filter(Message.session_id == session_id)
        .order_by(Message.timestamp)
        .all()
    )
    return [
        MessageOut(
            id=m.id,
            session_id=m.session_id,
            rol=m.rol,
            contenido=m.contenido,
            timestamp=m.timestamp,
        )
        for m in messages
    ]


# ── Instructor — historial de todos sus pilotos ─────────────────────────────

@app.get("/instructor/sessions", response_model=list[SessionOut], tags=["Instructor"])
def get_all_sessions(
    instructor: User = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    """Devuelve todas las sesiones de todos los pilotos (solo instructores)."""
    sessions = (
        db.query(ChatSession)
        .join(User)
        .filter(User.rol == "piloto")
        .order_by(ChatSession.fecha.desc())
        .all()
    )
    return [
        SessionOut(
            id=s.id,
            user_id=s.user_id,
            fecha=s.fecha,
            titulo=s.titulo,
            total_mensajes=len(s.messages),
        )
        for s in sessions
    ]


@app.get("/instructor/sessions/{session_id}/messages", response_model=list[MessageOut], tags=["Instructor"])
def get_pilot_session_messages(
    session_id: int,
    instructor: User = Depends(require_instructor),
    db: Session = Depends(get_db),
):
    """Devuelve los mensajes de cualquier sesión de piloto (solo instructores)."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    messages = (
        db.query(Message)
        .filter(Message.session_id == session_id)
        .order_by(Message.timestamp)
        .all()
    )
    return [
        MessageOut(
            id=m.id,
            session_id=m.session_id,
            rol=m.rol,
            contenido=m.contenido,
            timestamp=m.timestamp,
        )
        for m in messages
    ]


# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "version": app.version}
