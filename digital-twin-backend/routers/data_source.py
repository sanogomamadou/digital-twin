"""
Data Source Router — Manages Database Connections and KPI mapping for multiple sources.
"""
import json
import os
import psycopg2
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

router = APIRouter(prefix="/source", tags=["Data Source"])

# ── Shared state ──────────────────────────────────────────────────────────────
_source_state = {
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

SOURCE_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "source_data")
ASSIGNMENTS_FILE = os.path.join(SOURCE_DATA_DIR, "db_assignments.json")
os.makedirs(SOURCE_DATA_DIR, exist_ok=True)

def _load_saved_assignments():
    if os.path.exists(ASSIGNMENTS_FILE):
        with open(ASSIGNMENTS_FILE) as f:
            saved = json.load(f)
            _source_state["assignments"] = saved.get("assignments", {})
            _source_state["domain"] = saved.get("domain", "factory")
            _source_state["source_type"] = saved.get("source_type", "postgres")
            _source_state["telemetry_db_url"] = saved.get("telemetry_db_url")
            _source_state["telemetry_table"] = saved.get("telemetry_table")
            _source_state["timestamp_col"] = saved.get("timestamp_col", "timestamp")
            _source_state["component_id_col"] = saved.get("component_id_col", "component_id")
            _source_state["credentials"] = saved.get("credentials", {})

_load_saved_assignments()

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
def connect_telemetry_db(payload: ConnectPayload):
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

        _source_state["source_type"] = stype
        _source_state["telemetry_db_url"] = payload.db_url
        _source_state["credentials"] = payload.credentials
        return {"connected": True, "tables": tables}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Connection failed: {e}")

class TablePayload(BaseModel):
    table_name: str
    timestamp_col: str = "timestamp"
    component_id_col: str = "component_id"

@router.post("/table")
def select_table(payload: TablePayload):
    _source_state["telemetry_table"] = payload.table_name
    _source_state["timestamp_col"] = payload.timestamp_col
    _source_state["component_id_col"] = payload.component_id_col
    
    _source_state["columns"] = get_db_columns(
        payload.table_name, 
        _source_state["telemetry_db_url"], 
        _source_state["source_type"],
        _source_state["credentials"],
        exclude_cols=[payload.timestamp_col, payload.component_id_col]
    )
    
    return {"table": payload.table_name, "timestamp_col": payload.timestamp_col, "component_id_col": payload.component_id_col}

@router.get("/schema")
def get_schema():
    table = _source_state.get("telemetry_table")
    db_url = _source_state.get("telemetry_db_url")
    stype = _source_state.get("source_type", "postgres")
    creds = _source_state.get("credentials", {})
    cols = get_db_columns(table, db_url, stype, creds)
    
    return {
        "table": table,
        "columns": cols,
        "assignments": _source_state.get("assignments", {}),
        "streaming": _source_state.get("streaming", False),
    }

def get_connector_instance():
    stype = _source_state.get("source_type", "postgres")
    config = {
        "db_url": _source_state.get("telemetry_db_url"),
        "table_name": _source_state.get("telemetry_table"),
        "timestamp_col": _source_state.get("timestamp_col"),
        "component_id_col": _source_state.get("component_id_col"),
    }
    config.update(_source_state.get("credentials", {}))

    if stype == "postgres":
        from connectors.postgres_connector import PostgresConnector, get_postgres_connector
        pc = get_postgres_connector()
        if pc:
            return pc
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
    elif stype == "mqtt":
        from connectors.mqtt_connector import MqttConnector
        return MqttConnector(config)
    return None

# We must manage the active connector globally to stop the old one when assignments change
_active_connector = None

def register_active_connector(connector):
    """Called by main.py at startup to register the boot connector."""
    global _active_connector
    _active_connector = connector

@router.post("/assign")
async def assign_columns(payload: AssignmentsPayload):
    global _active_connector
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
    
    _source_state["assignments"] = new_assignments
    _source_state["domain"] = payload.domain
    _source_state["streaming"] = True
    _source_state["connected_at"] = _source_state.get("connected_at") or datetime.utcnow().isoformat()

    try:
        from connectors.base import KPI_BUS
        while not KPI_BUS.empty():
            KPI_BUS.get_nowait()
        from routers.stream import manager
        manager.clear_latest()
    except Exception as e:
        print(f"Failed to flush KPI bus: {e}")

    with open(ASSIGNMENTS_FILE, "w") as f:
        json.dump(_source_state, f, indent=2)

    try:
        # Prefer updating the existing connector's assignments in-place
        # so we don't create a duplicate that fights the old one.
        from connectors.postgres_connector import get_postgres_connector
        existing_pc = get_postgres_connector()
        
        if existing_pc and existing_pc._running:
            # Hot-update: just change the assignments on the running connector
            existing_pc.update_assignments(
                new_assignments,
                payload.domain,
                db_url=_source_state.get("telemetry_db_url"),
                table_name=_source_state.get("telemetry_table") or f"{payload.domain}_data",
                timestamp_col=_source_state.get("timestamp_col", "timestamp"),
                component_id_col=_source_state.get("component_id_col", "component_id"),
            )
            # Clear stale last_timestamps so new component IDs get fresh queries
            existing_pc.last_timestamps.clear()
            _active_connector = existing_pc
            print(f"[assign] Hot-updated running connector for domain={payload.domain}, {len(new_assignments)} KPIs")
        else:
            # No running connector — stop old one if any and start fresh
            if _active_connector:
                import asyncio
                asyncio.create_task(_active_connector.stop())
            
            pc = get_connector_instance()
            if pc:
                pc.update_assignments(new_assignments, payload.domain)
                pc.last_timestamps.clear()
                _active_connector = pc
                import asyncio
                asyncio.create_task(pc.start())
                print(f"[assign] Started new connector for domain={payload.domain}, {len(new_assignments)} KPIs")
    except Exception as e:
        print(f"Failed to notify connector: {e}")

    return {"saved": len(new_assignments), "assignments": new_assignments}

def apply_assignments_sync(domain: str, assignments_list: list):
    """Re-apply KPI assignments when loading a twin.
    
    - If the twin has no kpiAssignments, skip the connector update so the
      existing connector keeps running (avoids wiping a working stream).
    - Always use TELEMETRY_DB_URL from env (never the shared file which can
      get corrupted when multiple twins with different domains are loaded).
    - Always derive the table name from the current domain.
    """
    global _active_connector

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

    _source_state["assignments"]       = new_assignments
    _source_state["domain"]            = domain
    _source_state["streaming"]         = True
    _source_state["connected_at"]      = datetime.utcnow().isoformat()
    _source_state["telemetry_db_url"]  = saved_db_url
    _source_state["telemetry_table"]   = saved_table
    _source_state["timestamp_col"]     = "timestamp"
    _source_state["component_id_col"]  = "component_id"
    _source_state["source_type"]       = _source_state.get("source_type", "postgres")

    try:
        from connectors.base import KPI_BUS
        while not KPI_BUS.empty():
            KPI_BUS.get_nowait()
        from routers.stream import manager
        manager.clear_latest()
    except Exception:
        pass

    with open(ASSIGNMENTS_FILE, "w") as f:
        import json as _json2
        _json2.dump(_source_state, f, indent=2)

    try:
        from connectors.postgres_connector import get_postgres_connector
        existing_pc = get_postgres_connector()
        
        if existing_pc and existing_pc._running:
            # Hot-update the running connector
            existing_pc.update_assignments(
                new_assignments,
                domain,
                db_url=saved_db_url,
                table_name=saved_table,
            )
            existing_pc.last_timestamps.clear()
            _active_connector = existing_pc
        else:
            # Stop old one and start fresh
            if _active_connector:
                import asyncio
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(_active_connector.stop())
                except RuntimeError:
                    pass

            pc = get_connector_instance()
            if pc:
                pc.update_assignments(
                    new_assignments,
                    domain,
                    db_url=saved_db_url,
                    table_name=saved_table,
                )
                pc.last_timestamps.clear()
                _active_connector = pc
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
async def propose_kpis_endpoint(payload: ProposeKpisRequest):
    from agents.kpi_agent import propose_kpis
    kpis = await propose_kpis(payload.domain, payload.columns, payload.components)
    return {"kpis": kpis}

@router.get("/status")
def get_status():
    global _active_connector
    if len(_source_state["columns"]) == 0 and _source_state.get("telemetry_table"):
        _source_state["columns"] = get_db_columns(
            _source_state["telemetry_table"], 
            _source_state["telemetry_db_url"],
            _source_state.get("source_type", "postgres"),
            _source_state.get("credentials", {}),
            exclude_cols=[_source_state.get("timestamp_col", "timestamp"), _source_state.get("component_id_col", "component_id")]
        )
        
    assigned_count = len(_source_state.get("assignments", {}))

    return {
        "connected": len(_source_state["columns"]) > 0 or _source_state.get("source_type") in ["kafka", "mqtt"],
        "streaming": _source_state.get("streaming", False) or assigned_count > 0,
        "domain": _source_state.get("domain"),
        "assignedColumns": assigned_count,
        "connectedAt": _source_state.get("connected_at"),
        "connectorRunning": _active_connector._running if _active_connector else False,
    }

@router.delete("")
def disconnect_source():
    global _active_connector
    if _active_connector:
        import asyncio
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_active_connector.stop())
        except:
            pass
        _active_connector = None

    _source_state.update({
        "columns": [], "streaming": False, "assignments": {},
        "telemetry_db_url": None, "telemetry_table": None,
        "timestamp_col": "timestamp", "component_id_col": "component_id",
        "source_type": "postgres", "credentials": {}
    })
    return {"status": "disconnected"}

def get_source_state():
    return _source_state
