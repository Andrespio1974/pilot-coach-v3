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
- [ ] Libro procesado en knowledge_base/
- [ ] RAG indexado
- [ ] Backend FastAPI
- [ ] Frontend React
- [ ] Deploy Railway + Vercel

## Variables de entorno (.env)
ANTHROPIC_API_KEY=tu_clave
SECRET_KEY=clave_jwt
DATABASE_URL=sqlite:///./data/pilot_coach.db

## Metodologia
- Framework 4-MAT
- Estilo socratico con preguntas
- Tono calido y acogedor
- Detecta idioma automaticamente
