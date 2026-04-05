# Pilot Coach V3

## Descripcion
Asistente de coaching para pilotos basado en el libro de Jaime Ferrer Vives.

## Stack
- Backend: Python + FastAPI
- RAG: ChromaDB
- Frontend: React + Vite
- Deploy: Railway (backend) + Vercel (frontend)
- LLM: Claude API

## Usuarios
- Piloto: conversa con el agente, ve su historial
- Instructor: ve historial de todos sus pilotos

## Estado actual
- [x] Estructura de carpetas creada
- [x] Dependencias Python instaladas
- [x] Repositorio GitHub conectado
- [x] Libro procesado en knowledge_base/ (2 archivos .txt, 342,949 palabras, 205+137 imágenes descritas)
- [x] RAG indexado en ChromaDB (789 chunks, colección "pilot-coach-v3", data/chroma/)
- [x] Backend FastAPI (backend/main.py, agent.py, database.py, auth.py, prompts.py)
- [x] Frontend React + Vite (frontend/src/)
- [ ] Deploy Railway + Vercel

## Backend — arrancar
```bash
python -m uvicorn backend.main:app --port 8000 --reload
```
Docs: http://localhost:8000/docs

## Usuarios demo (se crean solos al arrancar)
- piloto@demo.com / piloto123 (rol: piloto)
- instructor@demo.com / instructor123 (rol: instructor)

## Variables de entorno (.env)
ANTHROPIC_API_KEY=tu_clave
SECRET_KEY=clave_jwt
DATABASE_URL=sqlite:///./data/pilot_coach.db

## Metodologia
- Framework 4-MAT
- Estilo socratico con preguntas
- Tono calido y acogedor
- Detecta idioma automaticamente
