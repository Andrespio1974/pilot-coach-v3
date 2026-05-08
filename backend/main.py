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
from .scenarios import get_scenario, ingest_scenarios_to_chroma, list_scenarios

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
    _ingest_scenarios_safe()


def _ingest_scenarios_safe():
    """Indexa escenarios al arrancar. Best-effort: no bloquea el servidor si falla."""
    try:
        n = ingest_scenarios_to_chroma()
        print(f"[startup] Escenarios indexados en ChromaDB: {n}")
    except Exception as e:
        print(f"[startup] Aviso: ingesta de escenarios fallo: {e}")


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
    mode: Optional[str] = None  # "coaching" | "scenario", solo al crear sesión
    scenario_id: Optional[str] = None  # solo si mode=="scenario"


class ChatResponse(BaseModel):
    respuesta: str
    session_id: int
    mode: str
    scenario_id: Optional[str] = None


class SessionOut(BaseModel):
    id: int
    user_id: int
    fecha: datetime
    titulo: Optional[str]
    total_mensajes: int
    mode: str = "coaching"
    scenario_id: Optional[str] = None

    class Config:
        from_attributes = True


class ScenarioOut(BaseModel):
    id: str
    title: str
    competency_code: str
    competency_name: str
    primary_ob_code: str
    primary_ob_name: str


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
        # Validar mode/scenario_id al crear sesión
        mode = (payload.mode or "coaching").lower()
        if mode not in ("coaching", "scenario"):
            raise HTTPException(status_code=400, detail="mode inválido")
        scenario_id = payload.scenario_id if mode == "scenario" else None
        if mode == "scenario":
            if not scenario_id or get_scenario(scenario_id) is None:
                raise HTTPException(status_code=400, detail="scenario_id inválido o no existe")

        session = ChatSession(
            user_id=current_user.id,
            mode=mode,
            scenario_id=scenario_id,
        )
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

    # Generar respuesta del agente (modo coaching o scenario)
    try:
        respuesta = agent_chat(
            user_message=payload.mensaje,
            history=history,
            pilot_name=current_user.nombre,
            mode=session.mode,
            scenario_id=session.scenario_id,
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

    # Actualizar título de sesión
    if not session.titulo and len(history) == 0:
        if session.mode == "scenario" and session.scenario_id:
            sc = get_scenario(session.scenario_id)
            if sc:
                session.titulo = f"[Escenario] {sc['title'][:60]}"
        else:
            words = payload.mensaje.split()[:8]
            session.titulo = " ".join(words) + ("..." if len(payload.mensaje.split()) > 8 else "")

    db.commit()

    return ChatResponse(
        respuesta=respuesta,
        session_id=session.id,
        mode=session.mode,
        scenario_id=session.scenario_id,
    )


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
                mode=s.mode or "coaching",
                scenario_id=s.scenario_id,
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
            mode=s.mode or "coaching",
            scenario_id=s.scenario_id,
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


# ── Scenarios ───────────────────────────────────────────────────────────────

@app.get("/scenarios", response_model=list[ScenarioOut], tags=["Scenarios"])
def get_scenarios_list(current_user: User = Depends(get_current_user)):
    """Lista los escenarios MASTER-AERO-DOC-V17C disponibles."""
    return [ScenarioOut(**s) for s in list_scenarios()]


# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "version": app.version}
