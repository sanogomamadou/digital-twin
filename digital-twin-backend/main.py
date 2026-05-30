import os
import asyncio
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

from db.database import create_tables
from routers import layout, kpis, analytics, twins, share, auth
from routers.stream import router as stream_router, kpi_broadcaster, manager
from routers.data_source import router as source_router, get_source_state

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s — %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Digital Twin Platform API",
    description=(
        "FastAPI backend · LLM layout editing · Single-source KPI import · "
        "Column→component assignment · NLQ analytics · Real-time WebSocket streaming"
    ),
    version="2.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── Global error handler — always return JSON, never HTML ───────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}: {str(exc)}"},
    )

# ─── CORS ─────────────────────────────────────────────────────────────────────
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(layout.router)
app.include_router(kpis.router)
app.include_router(analytics.router)
app.include_router(twins.router)
app.include_router(share.router)
app.include_router(stream_router)         # WebSocket + /stream/status
app.include_router(source_router)         # /source/upload, /source/assign, etc.

# ─── Connector registry ───────────────────────────────────────────────────────
_connectors = []


async def _start_connectors():
    from connectors.postgres_connector import PostgresConnector
    from connectors.mqtt_connector import MqttConnector, MQTT_ENABLED
    from connectors.rest_connector import RestConnector, REST_ENABLED
    from routers.data_source import get_all_user_states, register_active_connector

    states = get_all_user_states()
    if not states:
        return

    for user_id_str, state in states.items():
        try:
            user_id = int(user_id_str)
        except ValueError:
            continue
            
        saved_assignments = state.get("assignments", {})
        domain = state.get("domain", "factory")
        telemetry_db_url = state.get("telemetry_db_url") or os.getenv(
            "TELEMETRY_DB_URL",
            "postgresql://postgres:postgrespassword@localhost:5433/telemetry_db",
        )
        telemetry_table = state.get("telemetry_table") or f"{domain}_data"

        pc = PostgresConnector({
            "user_id": user_id,
            "assignments": saved_assignments,
            "domain": domain,
            "db_url": telemetry_db_url,
            "table_name": telemetry_table,
            "poll_interval": 2.0,
        })
        _connectors.append(pc)
        register_active_connector(user_id, pc)
        await pc.start()
        logger.info(f"🐘 Postgres connector started for user {user_id} — domain='{domain}', table='{telemetry_table}', assignments={len(saved_assignments)}")

    if MQTT_ENABLED:
        mqtt = MqttConnector({})
        _connectors.append(mqtt)
        await mqtt.start()
        logger.info("📡 MQTT connector started")

    if REST_ENABLED:
        rest = RestConnector({})
        _connectors.append(rest)
        await rest.start()
        logger.info("🌐 REST connector started")


# ─── Startup ──────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    create_tables()

    from services.llm_service import has_real_llm, GROQ_MODEL
    if has_real_llm():
        logger.info(f"🚀 LLM: Groq API [{GROQ_MODEL}]")
    else:
        logger.warning(f"🚀 LLM: Groq API missing — mock fallback (add GROQ_API_KEY to .env)")

    asyncio.create_task(kpi_broadcaster(), name="kpi_broadcaster")
    logger.info("📡 WebSocket broadcaster started — ws://localhost:8000/ws/kpis")

    await _start_connectors()
    logger.info("✅ Digital Twin Backend v2.1 ready — http://localhost:8000/docs")


@app.on_event("shutdown")
async def shutdown():
    for c in _connectors:
        await c.stop()


# ─── Root ─────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    from services.llm_service import has_real_llm, GROQ_MODEL
    from connectors.postgres_connector import get_postgres_connector
    pc = get_postgres_connector()
    return {
        "name": "Digital Twin Platform API",
        "version": "2.2.0-PG",
        "docs": "/docs",
        "llm_mode": "groq" if has_real_llm() else "mock",
        "model": GROQ_MODEL,
        "ws_endpoint": "ws://localhost:8000/ws/kpis",
        "source_status": {
            "domain": pc.domain if pc else None,
            "assignments": len(pc.assignments) if pc else 0,
        },
        "endpoints": {
            "get_schema":     "GET  /source/schema",
            "assign_columns": "POST /source/assign",
            "layout_prompt":  "POST /layout/prompt",
            "nlq_query":      "POST /analytics/query",
            "ws_stream":      "WS   /ws/kpis",
        }
    }


@app.get("/health")
def health():
    from connectors.postgres_connector import get_postgres_connector
    from services.llm_service import has_real_llm
    pc = get_postgres_connector()
    return {
        "status": "ok",
        "llm_ready": has_real_llm(),
        "ws_clients": manager.client_count,
        "connectors": [c.name for c in _connectors if c._running],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("DEBUG", "true").lower() == "true",
        reload_excludes=["source_data/*", "*.json", "__pycache__/*", "venv/*"],
    )

