# 🏦 DueSight — AI Due Diligence Desk

> Five specialist AI agents research any company and produce a complete investment memo — in minutes, with mandatory human sign-off before anything is finalized.

[![Python](https://img.shields.io/badge/Python-3.11+-blue?style=flat-square&logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-green?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-1.2+-6D5EF5?style=flat-square)](https://langchain-ai.github.io/langgraph)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

---

## 🚀 Live Demo

**App:** (https://duesight-five.vercel.app/)
**API Docs:** (https://duesight-3hu1.onrender.com/docs)

---

## 🧩 The Problem

Evaluating a company — for investment, competitive research, or a case study — normally means hours of manual work: searching the company, digging up competitors, checking funding history, assessing risks, then writing it all up into a coherent memo.

**DueSight compresses that into a 3–5 minute, reviewed workflow.** Type a company name. A team of five specialist AI agents researches it end-to-end and drafts a full investment memo. A human always reviews and signs off before it's considered final — the system augments judgment, it doesn't replace it.

---

## ✨ How It Works

```
User enters a company name
        │
        ▼
 📋 Planner       → builds the research plan
        │
        ▼
 🔍 Researcher    → live web search: company overview, funding, team
        │
        ▼
 ⚔️  Competitor    → finds & compares top competitors
        │
        ▼
 ⚠️  Risk          → builds a categorized risk register
        │
        ▼
 📄 Report         → compiles an 8-section investment memo
        │
        ▼
 ⏸️  Human Review  → PIPELINE PAUSES — you approve or send back
        │              (rejected → loops back to Planner with your notes)
        ▼
 🛡️  Reviewer      → AI scores the memo 0–10
        │              (below 7 → auto-revises, up to 3 loops)
        ▼
 ✅ Final memo streamed live, cost & tokens shown
```

---

## 🏗️ System Architecture

```
Browser (Next.js)
    │
    ├── POST /register → bcrypt hash → PostgreSQL (Neon)
    ├── POST /login    → JWT token
    │
    └── WebSocket /ws/task?token=xxx
            │
            ├── JWT verified before connection accepted
            ├── Case row created in Postgres (status="running")
            │
            └── LangGraph StateGraph (Redis checkpointer)
                    │
                    ├── planner → researcher → competitor → risk → report
                    │
                    ├── human_review  ◄── BREAKPOINT (interrupt_before)
                    │       │              state saved to Redis, execution
                    │       │              pauses until POST /approve fires
                    │       ├── approved → reviewer
                    │       └── rejected → planner (with your notes)
                    │
                    └── reviewer → score ≥7 exits, <7 loops back (max 3x)
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **AI Orchestration** | LangGraph (StateGraph, breakpoints, checkpointing) |
| **LLM** | Groq — Llama 3.3 70B |
| **Web Search** | Tavily Search API |
| **Backend** | FastAPI, native WebSocket |
| **Agent Memory** | Redis (`AsyncRedisSaver`) |
| **Database** | PostgreSQL (Neon — persistent, survives redeploys) |
| **Auth** | JWT (python-jose) + bcrypt |
| **Reliability** | Tenacity retry/backoff, `/health` endpoint |
| **Observability** | Custom `CostTracker` — per-run token + USD cost |
| **Frontend** | Next.js 14 (App Router), Framer Motion, Tailwind |
| **Deployment** | Railway (API + Redis), Vercel (frontend), Neon (Postgres) |

---

## 📁 Project Structure

```
agent-platform/                 # Backend
├── main_api.py                 # FastAPI app, WebSocket, HITL orchestration
├── app_orchestrator.py         # LangGraph pipeline + 5 agent nodes
├── auth.py                     # JWT creation + bcrypt hashing
├── models.py                   # SQLAlchemy tables + Pydantic schemas
├── database.py                 # DB engine + session
├── requirements.txt
├── Dockerfile
└── railway.toml

agent-frontend/                 # Frontend
├── app/
│   ├── page.tsx                # Login / register
│   ├── dashboard/page.tsx      # Main case dashboard
│   └── globals.css             # Design system
└── lib/api.ts                  # API calls + WebSocket client
```

---

## ⚡ Quick Start

### Prerequisites
Python 3.11+, Node.js 18+, Docker (for Redis), API keys: [Groq](https://console.groq.com), [Tavily](https://tavily.com)

### Backend
```bash
git clone https://github.com/mohini198/agent-platform.git
cd agent-platform
python -m venv venv && venv\Scripts\activate     # Windows
pip install -r requirements.txt

cp .env.example .env      # add your keys + DATABASE_URL

docker run -d -p 6379:6379 --name redis-agent redis:alpine
python main_api.py
```

### Frontend
```bash
git clone https://github.com/mohini198/agent-frontend.git
cd agent-frontend
npm install
npm run dev
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/register` | Create account |
| `POST` | `/login` | Get JWT token |
| `GET`  | `/history?token=` | Past case history |
| `POST` | `/approve/{thread_id}` | Human sign-off decision |
| `WS`   | `/ws/task?token=` | Live agent pipeline stream |
| `GET`  | `/health` | Liveness check (keeps container warm) |

---

## 🧠 Key Engineering Decisions

**Why LangGraph over sequential function calls?**
The pipeline needs cycles (Reviewer → Planner) and mid-execution pauses (the human-review breakpoint). Plain sequential code can't checkpoint and resume from an arbitrary point the way a graph with a persistence layer can.

**Why does the pipeline pause for a human?**
`interrupt_before=["human_review"]` at compile time makes LangGraph halt execution and save full state to Redis before that node runs. A separate `POST /approve` endpoint injects the decision via `aupdate_state()` and the graph resumes — no re-running of prior steps.

**Why Postgres instead of SQLite?**
Railway's container filesystem is ephemeral — a SQLite file gets wiped on every redeploy, silently deleting all user accounts. Switching to a managed Postgres instance (Neon) decouples data from the app container's lifecycle entirely.

**How is cost controlled?**
A `loop_count` field caps revision cycles at 3 regardless of score, and a `CostTracker` LangChain callback reports exact token usage and USD cost per case.

---

## 🏢 Comparable Real-World Systems

| Company | System | Shared Pattern |
|---|---|---|
| Salesforce | Agentforce | Multi-agent orchestration |
| Harvey AI | Legal research agents | Domain-specific research pipeline |
| Cognition | Devin | Self-reflection / revision loops |

---

## 👤 Author

**Mohini** — [@mohini198](https://github.com/mohini198)

## 📄 License

MIT
