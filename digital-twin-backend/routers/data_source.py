"""
Data Source Router — Manages Database Connections and KPI mapping for multiple sources.
"""
import json
import os
import psycopg2
from datetime import datetime
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

def get_user_state(db, twin_id: str) -> dict:
    from db.crud import get_user_configuration
    config = get_user_configuration(db, twin_id)
    if not config:
        return get_default_source_state()
    import json
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
            conn = psycopg2.connect(db_url)
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
    user_state = get_user_state(db, twin_id)

    tables = []
    try:
        stype = payload.source_type
        if stype == "postgres":
            conn = psycopg2.connect(payload.db_url)
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
    user_state = get_user_state(db, twin_id)

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
def get_schema(twin_id: str, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    user_id = current_user.id
    user_state = get_user_state(db, twin_id)

    table = user_state.get("telemetry_table")
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

def get_connector_instance(db, twin_id: str, user_id: int):
    user_state = get_user_state(db, twin_id)

    stype = user_state.get("source_type", "postgres")
    config = {
        "db_url": user_state.get("telemetry_db_url"),
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
    return None

# We must manage the active connector globally to stop the old one when assignments change

def get_all_user_states(db):
    from db.crud import get_all_user_configurations
    configs = get_all_user_configurations(db)
    states = {}
    for config in configs:
        states[config.twin_id] = get_user_state(db, config.twin_id)
        states[config.twin_id]["user_id"] = config.user_id
    return states

def register_active_connector(twin_id: str, connector):
    """Called by main.py at startup to register the boot connector."""
    global _active_connectors
    _active_connectors[twin_id] = connector

@router.post("/assign")
async def assign_columns(payload: AssignmentsPayload, twin_id: str, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    user_id = current_user.id
    user_state = get_user_state(db, twin_id)

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
            if _active_connectors.get(twin_id):
                import asyncio
                asyncio.create_task(_active_connectors.get(twin_id).stop())
            
            pc = get_connector_instance(db, twin_id, current_user.id)
            if pc:
                pc.update_assignments(new_assignments, payload.domain)
                pc.last_timestamps.clear()
                _active_connectors[twin_id] = pc
                import asyncio
                asyncio.create_task(pc.start())
                print(f"[assign] Started new connector for domain={payload.domain}, {len(new_assignments)} KPIs")
    except Exception as e:
        print(f"Failed to notify connector: {e}")

    return {"saved": len(new_assignments), "assignments": new_assignments}

def apply_assignments_sync(twin_id: str, user_id: int, domain: str, assignments_list: list):
    from db.database import SessionLocal
    with SessionLocal() as db:
        user_state = get_user_state(db, twin_id)

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
        return

    # ── Use env var for DB URL (reliable, not the shared file which can drift)
    saved_db_url = os.getenv("TELEMETRY_DB_URL", "postgresql://postgres:postgrespassword@localhost:5433/telemetry_db")
    saved_table  = f"{domain}_data"  # always derived from the twin's domain

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
            # Stop old one and start fresh
            if _active_connectors.get(twin_id):
                import asyncio
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(_active_connectors.get(twin_id).stop())
                except RuntimeError:
                    pass

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
                import asyncio
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(pc.start())
                except RuntimeError:
                    pass
        print(f"[apply_assignments_sync] domain={domain}: connector updated with {len(new_assignments)} KPIs, table={saved_table}")
    except Exception as e:
        print(f"Failed to notify connector: {e}")

class ProposeKpisRequest(BaseModel):
    domain: str
    columns: List[str]
    components: Optional[List[Dict[str, str]]] = []

@router.post("/propose_kpis")
async def propose_kpis_endpoint(payload: ProposeKpisRequest, twin_id: str, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    user_id = current_user.id
    user_state = get_user_state(db, twin_id)

    from agents.kpi_agent import propose_kpis
    kpis = await propose_kpis(payload.domain, payload.columns, payload.components)
    return {"kpis": kpis}

@router.get("/status")
def get_status(twin_id: str, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    user_id = current_user.id
    user_state = get_user_state(db, twin_id)

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
    user_state = get_user_state(db, twin_id)

    global _active_connectors
    if _active_connectors.get(twin_id):
        import asyncio
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_active_connectors.get(twin_id).stop())
        except:
            pass
        if user_id in _active_connectors: del _active_connectors[twin_id]

    user_state.update({
        "columns": [], "streaming": False, "assignments": {},
        "telemetry_db_url": None, "telemetry_table": None,
        "timestamp_col": "timestamp", "component_id_col": "component_id",
        "source_type": "postgres", "credentials": {}
    })
    save_user_state(db, twin_id, current_user.id, user_state)
    return {"status": "disconnected"}

def get_source_state():
    return _source_state
