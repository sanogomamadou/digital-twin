# 🤖 Digital Twin Backend — FastAPI + LangGraph + Llama 3

Python backend powering the Digital Twin Platform with:
- **LLM-driven layout editing** via natural language prompts (Llama 3 local)
- **KPI data import** — CSV/Excel with auto column detection
- **NLQ analytics** — ask questions, get answers + dynamic charts
- **Agent architecture** — LangGraph agents for each feature

## 🚀 Quick Start

### 1. Install Ollama + pull Llama 3

```bash
# Download Ollama from https://ollama.com
# Then pull the model:
ollama pull llama3.2
ollama serve        # starts on http://localhost:11434
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
# .env was already created from .env.example
# Default config uses Ollama — no changes needed
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

Open http://localhost:5173 — backend status shows as **"● Backend: Llama 3 online"**

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
# Use local Llama (default) — free, private
USE_OLLAMA=true
OLLAMA_MODEL=llama3.2

# Or use OpenAI (optional)
USE_OLLAMA=false
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

> **Mock Mode**: If Ollama is not running, the backend automatically falls back to intelligent rule-based responses — the app still works perfectly for demos.

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
└── services/
    ├── llm_service.py       ← Ollama/OpenAI wrapper
    └── data_service.py      ← Pandas data processing
```
