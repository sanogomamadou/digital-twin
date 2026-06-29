"""
Data Source Router — Manages Database Connections and KPI mapping for multiple sources.
"""
import json
import os
import psycopg2
import re
import socket
import ipaddress
from urllib.parse import urlparse
from datetime import datetime

def is_safe_identifier(name: str) -> bool:
    if not name: return False
    return bool(re.match(r"^[a-zA-Z0-9_.]+$", name))

def validate_db_url(url: str) -> bool:
    if os.getenv("ENVIRONMENT") != "production":
        return True
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname
        if not hostname:
            return True # Not an IP/hostname based URL
        ip = socket.gethostbyname(hostname)
        ip_obj = ipaddress.ip_address(ip)
        if ip_obj.is_private or ip_obj.is_loopback:
            return False
        return True
    except Exception:
        return False
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from db.database import get_db
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from routers.auth import get_current_user
from db.database import UserDB

router = APIRouter(prefix="/source", tags=["Data Source"])

# ── Shared state ──────────────────────────────────────────────────────────────
_active_connectors = {}

# Reference to the main asyncio event loop, captured at app startup. Sync routes
# (e.g. the share-link verify endpoint) run in Starlette's threadpool where there
# is NO running loop, so they need this to schedule connector start/stop.
_main_loop = None

# Per-twin timestamp (monotonic) of when the connector first had zero WS clients,
# used by the idle-connector reaper to avoid leaking connectors forever.
_idle_since: dict[str, float] = {}


def register_event_loop(loop):
    """Called once from main.py startup to capture the main event loop."""
    global _main_loop
    _main_loop = loop


def _schedule_coro(coro):
    """Schedule a connector coroutine (start/stop) on the main event loop,
    whether we're called from the loop thread (async route) or from a worker
    thread (sync route in Starlette's threadpool, where there is no running loop).

    The previous code used `asyncio.create_task` and swallowed the RuntimeError
    raised off-loop — so connectors created from sync routes silently never ran."""
    import asyncio
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(coro)
        return
    except RuntimeError:
        pass
    if _main_loop is not None and _main_loop.is_running():
        asyncio.run_coroutine_threadsafe(coro, _main_loop)
    else:
        # No usable loop (should not happen once startup ran) — close the coro
        # to avoid a "coroutine was never awaited" warning.
        coro.close()
        print("[connector] _schedule_coro: no running loop available — skipped")


async def connector_reaper(idle_grace_s: float = 600.0, interval_s: float = 60.0):
    """Periodically stop connectors for twins that have had no WebSocket client
    for `idle_grace_s` seconds. Prevents the per-twin connector registry from
    growing unbounded (every new twin spawns a connector that polls the DB every
    2s). A generous grace period keeps a stream alive across WS reconnect backoff."""
    import asyncio
    import time
    from routers.stream import manager
    while True:
        await asyncio.sleep(interval_s)
        try:
            now = time.monotonic()
            for twin_id, pc in list(_active_connectors.items()):
                if manager.client_count(twin_id) > 0:
                    _idle_since.pop(twin_id, None)
                    continue
                first = _idle_since.setdefault(twin_id, now)
                if now - first >= idle_grace_s:
                    try:
                        await pc.stop()
                    except Exception:
                        pass
                    _active_connectors.pop(twin_id, None)
                    _idle_since.pop(twin_id, None)
                    print(f"[reaper] stopped idle connector for twin={twin_id}")
        except Exception as e:
            print(f"[reaper] error: {e}")

def get_default_source_state():
    return {
        "domain": "factory",
        "columns": [],
        "assignments": {},
        "connected_at": None,
        "streaming": False,
        "source_type": "postgres",
        "telemetry_db_url": None,
        "telemetry_table": None,
        "timestamp_col": "timestamp",
        "component_id_col": "component_id",
        "credentials": {}
    }

def get_user_state(db, twin_id: str, user_id: int = None) -> dict:
    from db.crud import get_user_configuration
    import json
    config = get_user_configuration(db, twin_id, user_id)
    if not config:
        state = get_default_source_state()
        # A brand-new twin has no config yet. The telemetry source is connected
        # ONCE via the wizard before any twin exists (stored under the user's
        # "default" config), so a fresh twin must inherit that global connection
        # — otherwise the KPI step shows no columns. We copy only the CONNECTION
        # fields (never the assignments, which stay per-twin) and only for the
        # user's own default (no cross-tenant leak).
        if user_id is not None and not str(twin_id).startswith("default"):
            default_cfg = get_user_configuration(db, "default", user_id)
            if default_cfg and default_cfg.telemetry_db_url:
                state["source_type"] = default_cfg.source_type
                state["telemetry_db_url"] = default_cfg.telemetry_db_url
                state["telemetry_table"] = default_cfg.telemetry_table
                state["timestamp_col"] = default_cfg.timestamp_col
                state["component_id_col"] = default_cfg.component_id_col
                state["credentials"] = json.loads(default_cfg.credentials_json) if default_cfg.credentials_json else {}
        return state
    return {
        "domain": config.domain,
        "columns": [],
        "assignments": json.loads(config.assignments_json) if config.assignments_json else {},
        "connected_at": config.updated_at.isoformat() if config.updated_at else None,
        "streaming": bool(config.streaming),
        "source_type": config.source_type,
        "telemetry_db_url": config.telemetry_db_url,
        "telemetry_table": config.telemetry_table,
        "timestamp_col": config.timestamp_col,
        "component_id_col": config.component_id_col,
        "credentials": json.loads(config.credentials_json) if config.credentials_json else {},
    }

def save_user_state(db, twin_id: str, user_id: int, state: dict):
    from db.crud import update_user_configuration
    import json
    config_data = {
        "domain": state.get("domain", "factory"),
        "assignments_json": json.dumps(state.get("assignments", {})),
        "streaming": 1 if state.get("streaming") else 0,
        "source_type": state.get("source_type", "postgres"),
        "telemetry_db_url": state.get("telemetry_db_url"),
        "telemetry_table": state.get("telemetry_table"),
        "timestamp_col": state.get("timestamp_col"),
        "component_id_col": state.get("component_id_col"),
        "credentials_json": json.dumps(state.get("credentials", {})),
    }
    update_user_configuration(db, twin_id, user_id, config_data)

class ColAssignment(BaseModel):
    kpi_id: str
    component_id: str
    kpi_name: str
    formula: str
    unit: str = ""
    rules: dict = {}
    interaction: str = "pulse"

class AssignmentsPayload(BaseModel):
    domain: str
    assignments: List[ColAssignment]

def get_db_columns(table_name: str, db_url: str, source_type: str, credentials: dict, exclude_cols: list = None) -> list:
    if not table_name or not db_url:
        return []
    if exclude_cols is None:
        exclude_cols = []
    
    cols = []
    try:
        if source_type == "postgres":
            conn = psycopg2.connect(db_url, connect_timeout=3)
            cursor = conn.cursor()
            query = "SELECT column_name FROM information_schema.columns WHERE table_name = %s;"
            cursor.execute(query, (table_name,))
            cols = [row[0] for row in cursor.fetchall()]
            cursor.close()
            conn.close()
        elif source_type == "mongo":
            from pymongo import MongoClient
            client = MongoClient(db_url)
            db = client[credentials.get("db_name", "digital_twin")]
            collection = db[table_name]
            doc = collection.find_one()
            if doc:
                cols = list(doc.keys())
            client.close()
        elif source_type == "cassandra":
            from cassandra.cluster import Cluster
            cluster = Cluster(db_url.split(','))
            session = cluster.connect(credentials.get("db_name"))
            rows = session.execute("SELECT column_name FROM system_schema.columns WHERE keyspace_name=%s AND table_name=%s", [credentials.get("db_name"), table_name])
            cols = [row.column_name for row in rows]
            cluster.shutdown()
        elif source_type == "databricks":
            if not is_safe_identifier(table_name):
                raise ValueError("Invalid table name")
            from databricks import sql
            connection = sql.connect(
                server_hostname=db_url,
                http_path=credentials.get("db_name"),
                access_token=credentials.get("access_token")
            )
            with connection.cursor() as cursor:
                cursor.execute(f"DESCRIBE TABLE {table_name}")
                rows = cursor.fetchall()
                cols = [row[0] for row in rows]
            connection.close()
        elif source_type in ["kafka", "mqtt"]:
            # Hard to introspect schema without consuming, let UI handle it with free text
            cols = ["value", "unit", "timestamp", "component_id", "status"] 
    except Exception as e:
        print(f"Error fetching schema for {source_type}: {e}")
        
    return [c for c in cols if c not in exclude_cols]

# ── Endpoints ─────────────────────────────────────────────────────────────────

class ConnectPayload(BaseModel):
    source_type: str = "postgres"
    db_url: str
    credentials: Dict[str, Any] = {}

@router.post("/connect")
def connect_telemetry_db(payload: ConnectPayload, twin_id: str, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    user_id = current_user.id
    user_state = get_user_state(db, twin_id, user_id)
    
    if not validate_db_url(payload.db_url):
        raise HTTPException(status_code=403, detail="Connection to private/local IPs is restricted in production.")

    tables = []
    try:
        stype = payload.source_type
        if stype == "postgres":
            conn = psycopg2.connect(payload.db_url, connect_timeout=3)
            cursor = conn.cursor()
            cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
            tables = [row[0] for row in cursor.fetchall()]
            cursor.close()
            conn.close()
        elif stype == "mongo":
            from pymongo import MongoClient
            client = MongoClient(payload.db_url)
            db = client[payload.credentials.get("db_name", "digital_twin")]
            tables = db.list_collection_names()
            client.close()
        elif stype == "cassandra":
            from cassandra.cluster import Cluster
            cluster = Cluster(payload.db_url.split(','))
            session = cluster.connect(payload.credentials.get("db_name"))
            rows = session.execute("SELECT table_name FROM system_schema.tables WHERE keyspace_name=%s", [payload.credentials.get("db_name")])
            tables = [row.table_name for row in rows]
            cluster.shutdown()
        elif stype == "databricks":
            from databricks import sql
            connection = sql.connect(
                server_hostname=payload.db_url,
                http_path=payload.credentials.get("db_name"),
                access_token=payload.credentials.get("access_token")
            )
            with connection.cursor() as cursor:
                cursor.execute("SHOW TABLES")
                tables = [row[1] for row in cursor.fetchall()]
            connection.close()
        elif stype in ["kafka", "mqtt"]:
            tables = [payload.credentials.get("topic", "default_topic")]

        user_state["source_type"] = stype
        user_state["telemetry_db_url"] = payload.db_url
        user_state["credentials"] = payload.credentials
        save_user_state(db, twin_id, current_user.id, user_state)
        return {"connected": True, "tables": tables}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Connection failed: {e}")

class TablePayload(BaseModel):
    table_name: str
    timestamp_col: str = "timestamp"
    component_id_col: str = "component_id"

@router.post("/table")
def select_table(payload: TablePayload, twin_id: str, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    user_id = current_user.id
    user_state = get_user_state(db, twin_id, user_id)

    user_state["telemetry_table"] = payload.table_name
    user_state["timestamp_col"] = payload.timestamp_col
    user_state["component_id_col"] = payload.component_id_col
    
    user_state["columns"] = get_db_columns(
        payload.table_name, 
        user_state["telemetry_db_url"], 
        user_state["source_type"],
        user_state["credentials"],
        exclude_cols=[payload.timestamp_col, payload.component_id_col]
    )
    
    save_user_state(db, twin_id, current_user.id, user_state)
    return {"table": payload.table_name, "timestamp_col": payload.timestamp_col, "component_id_col": payload.component_id_col}

@router.get("/schema")
def get_schema(twin_id: str, domain: str = None, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    user_id = current_user.id
    user_state = get_user_state(db, twin_id, user_id)

    saved_table = user_state.get("telemetry_table")
    saved_domain = user_state.get("domain")
    
    # If the saved table is a standard default table, we can safely swap it to the new domain's default.
    # If it's a custom table (configured in the wizard), we preserve it.
    is_default_table = not saved_table or saved_table == f"{saved_domain}_data"
    
    if domain and is_default_table:
        table = f"{domain}_data"
    else:
        table = saved_table
    db_url = user_state.get("telemetry_db_url")
    stype = user_state.get("source_type", "postgres")
    creds = user_state.get("credentials", {})
    cols = get_db_columns(table, db_url, stype, creds)
    
    return {
        "table": table,
        "columns": cols,
        "assignments": user_state.get("assignments", {}),
        "streaming": user_state.get("streaming", False),
    }

def _db_name(url: str) -> str:
    try:
        return urlparse(url).path.lstrip("/").split("?")[0]
    except Exception:
        return ""


def safe_telemetry_db_url(url: str | None) -> str | None:
    """Guard against a telemetry connection that points at the main application
    database. The simulator only ever writes telemetry to TELEMETRY_DB_URL, so a
    config whose telemetry_db_url drifted to the app DB (e.g. inherited from a
    mis-connected default) would query an empty table → 0 readings. In that case
    fall back to the real telemetry DB."""
    env_tele = os.getenv("TELEMETRY_DB_URL")
    main_db = os.getenv("DATABASE_URL", "")
    if not url:
        return env_tele or url
    if env_tele and main_db and _db_name(url) and _db_name(url) == _db_name(main_db):
        logger_msg = f"[telemetry] db_url pointed at the app DB ({_db_name(url)}) — redirecting to TELEMETRY_DB_URL"
        print(logger_msg)
        return env_tele
    return url


def get_connector_instance(db, twin_id: str, user_id: int):
    user_state = get_user_state(db, twin_id, user_id)

    stype = user_state.get("source_type", "postgres")
    config = {
        "db_url": safe_telemetry_db_url(user_state.get("telemetry_db_url")),
        "table_name": user_state.get("telemetry_table"),
        "timestamp_col": user_state.get("timestamp_col"),
        "component_id_col": user_state.get("component_id_col"),
        "user_id": user_id,
        "twin_id": twin_id,
    }
    config.update(user_state.get("credentials", {}))

    if stype == "postgres":
        from connectors.postgres_connector import PostgresConnector
        return PostgresConnector(config)
    elif stype == "mongo":
        from connectors.mongo_connector import MongoConnector
        return MongoConnector(config)
    elif stype == "kafka":
        from connectors.kafka_connector import KafkaConnector
        return KafkaConnector(config)
    elif stype == "cassandra":
        from connectors.cassandra_connector import CassandraConnector
        return CassandraConnector(config)
    elif stype == "databricks":
        from connectors.databricks_connector import DatabricksConnector
        return DatabricksConnector(config)
    return None

# We must manage the active connector globally to stop the old one when assignments change

def get_all_user_states(db):
    from db.crud import get_all_user_configurations
    configs = get_all_user_configurations(db)
    states = {}
    for config in configs:
        states[config.twin_id] = get_user_state(db, config.twin_id, config.user_id)
        states[config.twin_id]["user_id"] = config.user_id
    return states

def register_active_connector(twin_id: str, connector):
    """Called by main.py at startup to register the boot connector."""
    global _active_connectors
    _active_connectors[twin_id] = connector

def get_active_connectors():
    """Read-only access to the per-twin connector registry — the authoritative
    multi-tenant source of truth, keyed by twin_id."""
    return _active_connectors

@router.post("/assign")
async def assign_columns(payload: AssignmentsPayload, twin_id: str, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    user_id = current_user.id
    user_state = get_user_state(db, twin_id, user_id)
    # Never let telemetry point at the app DB (drifts via inheritance → 0 readings)
    user_state["telemetry_db_url"] = safe_telemetry_db_url(user_state.get("telemetry_db_url"))

    global _active_connectors
    # REPLACE all assignments — the frontend sends the complete set for the current twin.
    # Merging caused stale cross-domain assignments (e.g. airport KPIs in a factory twin).
    new_assignments = {}
    for a in payload.assignments:
        new_assignments[a.kpi_id] = {
            "component_id": a.component_id,
            "kpi_name": a.kpi_name,
            "formula": a.formula,
            "unit": a.unit,
            "rules": a.rules,
            "interaction": a.interaction,
        }
    
    user_state["assignments"] = new_assignments
    user_state["domain"] = payload.domain
    user_state["streaming"] = True
    user_state["telemetry_table"] = f"{payload.domain}_data"
    user_state["connected_at"] = user_state.get("connected_at") or datetime.utcnow().isoformat()

    try:
        from connectors.base import KPI_BUS
        while not KPI_BUS.empty():
            KPI_BUS.get_nowait()
        from routers.stream import manager
        manager.clear_latest()
    except Exception as e:
        print(f"Failed to flush KPI bus: {e}")

    save_user_state(db, twin_id, current_user.id, user_state)

    try:
        # Prefer updating the existing connector's assignments in-place
        # so we don't create a duplicate that fights the old one.
        existing_pc = _active_connectors.get(twin_id)
        
        if existing_pc and existing_pc._running:
            # Hot-update: just change the assignments on the running connector
            existing_pc.update_assignments(
                new_assignments,
                payload.domain,
                db_url=user_state.get("telemetry_db_url"),
                table_name=user_state.get("telemetry_table") or f"{payload.domain}_data",
                timestamp_col=user_state.get("timestamp_col", "timestamp"),
                component_id_col=user_state.get("component_id_col", "component_id"),
            )
            # Clear stale last_timestamps so new component IDs get fresh queries
            existing_pc.last_timestamps.clear()
            _active_connectors[twin_id] = existing_pc
            print(f"[assign] Hot-updated running connector for domain={payload.domain}, {len(new_assignments)} KPIs")
        else:
            # No running connector — stop old one if any and start fresh
            old_pc = _active_connectors.get(twin_id)
            if old_pc:
                await old_pc.stop()

            pc = get_connector_instance(db, twin_id, current_user.id)
            if pc:
                pc.update_assignments(
                    new_assignments,
                    payload.domain,
                    db_url=user_state.get("telemetry_db_url"),
                    table_name=user_state.get("telemetry_table") or f"{payload.domain}_data",
                    timestamp_col=user_state.get("timestamp_col", "timestamp"),
                    component_id_col=user_state.get("component_id_col", "component_id"),
                )
                pc.last_timestamps.clear()
                _active_connectors[twin_id] = pc
                # IMPORTANT: await start() (it is non-blocking — it only schedules
                # the poll loop). A fire-and-forget `create_task(pc.start())` left
                # the start coroutine unreferenced, so a freshly-created twin's
                # connector never actually ran in production → "Live · 0 readings".
                await pc.start()
                print(f"[assign] Started new connector for domain={payload.domain}, {len(new_assignments)} KPIs")
            else:
                print(f"[assign] No connector could be built for twin={twin_id} (source_type={user_state.get('source_type')})")
    except Exception as e:
        print(f"Failed to notify connector: {e}")

    return {"saved": len(new_assignments), "assignments": new_assignments}

def apply_assignments_sync(twin_id: str, user_id: int, domain: str, assignments_list: list):
    from db.database import SessionLocal
    db = SessionLocal()
    user_state = get_user_state(db, twin_id, user_id)

    """Re-apply KPI assignments when loading a twin.
    
    - If the twin has no kpiAssignments, skip the connector update so the
      existing connector keeps running (avoids wiping a working stream).
    - Always use TELEMETRY_DB_URL from env (never the shared file which can
      get corrupted when multiple twins with different domains are loaded).
    - Always derive the table name from the current domain.
    """
    global _active_connectors

    new_assignments = {}
    for a in assignments_list:
        if isinstance(a, dict):
            kpi_id = a.get("kpi_id", a.get("id"))
            if not kpi_id: continue
            new_assignments[kpi_id] = {
                "component_id": a.get("component_id"),
                "kpi_name": a.get("kpi_name"),
                "formula": a.get("formula"),
                "unit": a.get("unit", ""),
                "rules": a.get("rules", {}),
                "interaction": a.get("interaction", "pulse"),
            }
        else:
            kpi_id = getattr(a, "kpi_id", getattr(a, "id", None))
            if not kpi_id: continue
            new_assignments[kpi_id] = {
                "component_id": getattr(a, "component_id", None),
                "kpi_name": getattr(a, "kpi_name", ""),
                "formula": getattr(a, "formula", ""),
                "unit": getattr(a, "unit", ""),
                "rules": getattr(a, "rules", {}),
                "interaction": getattr(a, "interaction", "pulse"),
            }

    # Guard: twin has no KPI config — keep existing connector running
    if not new_assignments:
        print(f"[apply_assignments_sync] domain={domain}: no KPI assignments — skipping connector update")
        db.close()
        return

    # ── Use env var for DB URL (reliable, not the shared file which can drift)
    saved_db_url = safe_telemetry_db_url(user_state.get("telemetry_db_url")) or os.getenv("TELEMETRY_DB_URL", "postgresql://postgres:postgrespassword@localhost:5433/telemetry_db")
    saved_table  = user_state.get("telemetry_table") or f"{domain}_data"

    user_state["assignments"]       = new_assignments
    user_state["domain"]            = domain
    user_state["streaming"]         = True
    user_state["connected_at"]      = datetime.utcnow().isoformat()
    user_state["telemetry_db_url"]  = saved_db_url
    user_state["telemetry_table"]   = saved_table
    user_state["timestamp_col"]     = "timestamp"
    user_state["component_id_col"]  = "component_id"
    user_state["source_type"]       = user_state.get("source_type", "postgres")

    try:
        from connectors.base import KPI_BUS
        while not KPI_BUS.empty():
            KPI_BUS.get_nowait()
        from routers.stream import manager
        manager.clear_latest()
    except Exception:
        pass

    save_user_state(db, twin_id, user_id, user_state)

    try:
        existing_pc = _active_connectors.get(twin_id)
        
        if existing_pc and existing_pc._running:
            # Hot-update the running connector
            existing_pc.update_assignments(
                new_assignments,
                domain,
                db_url=saved_db_url,
                table_name=saved_table,
            )
            existing_pc.last_timestamps.clear()
            _active_connectors[twin_id] = existing_pc
        else:
            # Stop old one and start fresh — schedule on the main loop so this
            # works even when called from a sync route (share-link verify).
            old_pc = _active_connectors.get(twin_id)
            if old_pc:
                _schedule_coro(old_pc.stop())

            pc = get_connector_instance(db, twin_id, user_id)
            if pc:
                pc.update_assignments(
                    new_assignments,
                    domain,
                    db_url=saved_db_url,
                    table_name=saved_table,
                )
                pc.last_timestamps.clear()
                _active_connectors[twin_id] = pc
                _schedule_coro(pc.start())
        print(f"[apply_assignments_sync] domain={domain}: connector updated with {len(new_assignments)} KPIs, table={saved_table}")
    except Exception as e:
        print(f"Failed to notify connector: {e}")
    finally:
        db.close()

class ProposeKpisRequest(BaseModel):
    domain: str
    columns: List[str]
    components: Optional[List[Dict[str, str]]] = []

@router.post("/propose_kpis")
async def propose_kpis_endpoint(payload: ProposeKpisRequest, twin_id: str, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    user_id = current_user.id
    user_state = get_user_state(db, twin_id, user_id)

    from agents.kpi_agent import propose_kpis
    kpis = await propose_kpis(payload.domain, payload.columns, payload.components)
    return {"kpis": kpis}

@router.get("/status")
def get_status(twin_id: str, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    user_id = current_user.id
    user_state = get_user_state(db, twin_id, user_id)

    global _active_connectors
    if len(user_state["columns"]) == 0 and user_state.get("telemetry_table"):
        user_state["columns"] = get_db_columns(
            user_state["telemetry_table"], 
            user_state["telemetry_db_url"],
            user_state.get("source_type", "postgres"),
            user_state.get("credentials", {}),
            exclude_cols=[user_state.get("timestamp_col", "timestamp"), user_state.get("component_id_col", "component_id")]
        )
        
    assigned_count = len(user_state.get("assignments", {}))

    return {
        "connected": len(user_state["columns"]) > 0 or user_state.get("source_type") in ["kafka", "mqtt"],
        "streaming": user_state.get("streaming", False) or assigned_count > 0,
        "domain": user_state.get("domain"),
        "assignedColumns": assigned_count,
        "connectedAt": user_state.get("connected_at"),
        "connectorRunning": _active_connectors.get(twin_id)._running if _active_connectors.get(twin_id) else False,
    }

@router.delete("")
def disconnect_source(twin_id: str, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    user_id = current_user.id
    user_state = get_user_state(db, twin_id, user_id)

    global _active_connectors
    if _active_connectors.get(twin_id):
        import asyncio
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_active_connectors.get(twin_id).stop())
        except:
            pass
        if twin_id in _active_connectors: del _active_connectors[twin_id]

    user_state.update({
        "columns": [], "streaming": False, "assignments": {},
        "telemetry_db_url": None, "telemetry_table": None,
        "timestamp_col": "timestamp", "component_id_col": "component_id",
        "source_type": "postgres", "credentials": {}
    })
    save_user_state(db, twin_id, current_user.id, user_state)
    return {"status": "disconnected"}
