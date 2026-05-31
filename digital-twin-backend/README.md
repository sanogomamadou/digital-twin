# 🤖 Digital Twin Backend — FastAPI + LangGraph + Groq

Python backend powering the Digital Twin Platform with:
- **LLM-driven layout editing** via natural language prompts (Groq API)
- **KPI data import** — CSV/Excel with auto column detection
- **NLQ analytics** — ask questions, get answers + dynamic charts
- **Agent architecture** — LangGraph agents for each feature

## 🚀 Quick Start

### 1. Get Groq API Key

```bash
# Get your API key from https://console.groq.com
# You'll need to set it in the .env file later
```

### 2. Setup Python environment

```bash
cd digital-twin-backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure environment

```bash
# Configure the environment variables with your Groq API key
cat .env
```

### 4. Start backend

```bash
python main.py
# or
uvicorn main:app --reload --port 8000
```

### 5. Start frontend (separate terminal)

```bash
cd ../digital-twin-ui
npm run dev
```

Open http://localhost:5173 — backend status shows as **"● Backend: Groq online"**

---

## 📚 API Documentation

Once running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## 🤖 Agents

### Layout Agent (`agents/layout_agent.py`)
**Prompt → Layout Actions**

```bash
POST /layout/prompt
{
  "prompt": "Add 2 conveyor belts next to the shipping dock",
  "currentState": { ... }
}
# → { "actions": [...], "explanation": "...", "newState": { ... } }
```

### NLQ Analytics Agent (`agents/nlq_agent.py`)
**Question → Answer + Chart**

```bash
POST /analytics/query
{
  "question": "Show me the temperature trend for the last 24h",
  "timeRange": "24h"
}
# → { "answer": "...", "chart": { "chartType": "AreaChart", ... }, "rawData": [...] }
```

### Chart Agent (`agents/chart_agent.py`)
**Data + Prompt → Best Chart Config**

```bash
POST /analytics/chart
{
  "prompt": "Compare production throughput across all stations",
  "data": [...]
}
# → { "chartType": "BarChart", "series": [...], ... }
```

---

## 📥 KPI Data Import

```bash
POST /kpis/import
Content-Type: multipart/form-data

file=@data.csv
component_id=cnc_machine_1
kpi_name=Machine Temperature
unit=°C
```

**Supported formats:** `.csv`, `.xlsx`, `.xls`

**Auto-detects:** timestamp column, value column, unit column

---

## 🗄️ Database

PostgreSQL database.

Tables:
- `layout_states` — saved 2D/3D layouts
- `kpi_data` — all imported + real-time KPI readings
- `query_history` — all NLQ queries with answers + chart configs

---

## 🔧 LLM Configuration

In `.env`:

```env
# ── LLM — Groq API ──────────────────────────────────────────────────
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile
```

> **Mock Mode**: If Groq API is not available, the backend automatically falls back to intelligent rule-based responses — the app still works perfectly for demos.

---

## 📁 Structure

```
digital-twin-backend/
├── main.py                  ← FastAPI app entry point
├── requirements.txt
├── .env                     ← your config (gitignored)
├── .env.example
├── agents/
│   ├── layout_agent.py      ← NL → layout actions (LangGraph)
│   ├── nlq_agent.py         ← NLQ → answer + chart (LangGraph)
│   └── chart_agent.py       ← data → chart config
├── routers/
│   ├── layout.py
│   ├── kpis.py
│   └── analytics.py
├── models/
│   └── schemas.py           ← Pydantic v2 schemas
├── db/
│   ├── database.py          ← SQLAlchemy setup
│   └── crud.py              ← DB operations
├── services/
│   ├── llm_service.py         ← Groq LLM wrapper
│   └── data_service.py      ← Pandas data processing
```
