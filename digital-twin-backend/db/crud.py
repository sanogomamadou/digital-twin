import json
from datetime import datetime
from sqlalchemy.orm import Session
from db.database import LayoutStateDB, KpiDataDB, QueryHistoryDB, UserConfigurationDB
from models.schemas import LayoutStateSchema, KpiRecord


# ─── Layout CRUD ──────────────────────────────────────────────────────────────

def get_layout(db: Session, user_id: int, layout_id: str = "default") -> LayoutStateDB | None:
    if layout_id == "default":
        layout_id = f"default_{user_id}"
    return db.query(LayoutStateDB).filter(LayoutStateDB.id == layout_id, LayoutStateDB.user_id == user_id).first()


def list_twins(db: Session, user_id: int) -> list[LayoutStateDB]:
    return (
        db.query(LayoutStateDB)
        .filter(LayoutStateDB.user_id == user_id)
        .filter(~LayoutStateDB.id.startswith("default_"))
        .order_by(LayoutStateDB.updated_at.desc())
        .all()
    )


def delete_twin(db: Session, user_id: int, twin_id: str) -> bool:
    twin = db.query(LayoutStateDB).filter(LayoutStateDB.id == twin_id, LayoutStateDB.user_id == user_id).first()
    if not twin:
        return False
    db.delete(twin)
    db.commit()
    return True


def save_layout(db: Session, user_id: int, state: LayoutStateSchema) -> LayoutStateDB:
    if state.id == "default":
        state.id = f"default_{user_id}"
        
    existing = get_layout(db, user_id, state.id)
    if existing:
        existing.name = state.name
        existing.domain = state.domain
        existing.width = state.width
        existing.length = state.length
        existing.grid_cols = state.gridCols
        existing.grid_rows = state.gridRows
        existing.components_json = json.dumps([c.model_dump() for c in state.components])
        existing.connections_json = json.dumps([c.model_dump() for c in state.connections])
        existing.assignments_json = json.dumps(state.kpiAssignments)
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        db_layout = LayoutStateDB(
            id=state.id,
            user_id=user_id,
            name=state.name,
            domain=state.domain,
            width=state.width,
            length=state.length,
            grid_cols=state.gridCols,
            grid_rows=state.gridRows,
            components_json=json.dumps([c.model_dump() for c in state.components]),
            connections_json=json.dumps([c.model_dump() for c in state.connections]),
            assignments_json=json.dumps(state.kpiAssignments),
        )
        db.add(db_layout)
        db.commit()
        db.refresh(db_layout)
        return db_layout


def layout_db_to_schema(db_layout: LayoutStateDB) -> LayoutStateSchema:
    from models.schemas import ComponentSchema, ConnectionSchema
    return LayoutStateSchema(
        id=db_layout.id,
        name=db_layout.name,
        domain=db_layout.domain,
        width=getattr(db_layout, "width", 60.0) or 60.0,
        length=getattr(db_layout, "length", 40.0) or 40.0,
        gridCols=db_layout.grid_cols,
        gridRows=db_layout.grid_rows,
        components=[ComponentSchema(**c) for c in json.loads(db_layout.components_json or "[]")],
        connections=[ConnectionSchema(**c) for c in json.loads(db_layout.connections_json or "[]")],
        kpiAssignments=json.loads(db_layout.assignments_json or "[]"),
        createdAt=db_layout.created_at,
        updatedAt=db_layout.updated_at,
    )


# ─── KPI CRUD ─────────────────────────────────────────────────────────────────

def insert_kpi_records(db: Session, twin_id: str, component_id: str, kpi_name: str, records: list[dict]) -> int:
    db_records = [
        KpiDataDB(
            twin_id=twin_id,
            component_id=component_id,
            kpi_name=kpi_name,
            value=float(r.get("value", 0)),
            unit=str(r.get("unit", "")),
            timestamp=r.get("timestamp", datetime.utcnow()),
            source=r.get("source", "csv"),
        )
        for r in records
    ]
    db.bulk_save_objects(db_records)
    db.commit()
    return len(db_records)


def get_kpi_data(db: Session, twin_id: str, component_id: str | None = None, kpi_name: str | None = None, component_ids: list[str] | None = None, limit: int = 1000) -> list[KpiDataDB]:
    q = db.query(KpiDataDB).filter(KpiDataDB.twin_id == twin_id)
    if component_id:
        q = q.filter(KpiDataDB.component_id == component_id)
    if component_ids is not None:
        q = q.filter(KpiDataDB.component_id.in_(component_ids))
    if kpi_name:
        q = q.filter(KpiDataDB.kpi_name == kpi_name)
    return q.order_by(KpiDataDB.timestamp.desc()).limit(limit).all()


def get_all_kpi_summary(db: Session, twin_id: str) -> list[dict]:
    from sqlalchemy import func, text
    result = db.execute(text("""
        SELECT component_id, kpi_name, COUNT(*) as count,
               MIN(value) as min_val, MAX(value) as max_val, AVG(value) as avg_val,
               MAX(timestamp) as last_seen
        FROM kpi_data
        WHERE twin_id = :twin_id
        GROUP BY component_id, kpi_name
    """), {"twin_id": twin_id}).fetchall()
    return [dict(r._mapping) for r in result]


def delete_kpi_data(db: Session, twin_id: str, component_id: str):
    db.query(KpiDataDB).filter(KpiDataDB.twin_id == twin_id, KpiDataDB.component_id == component_id).delete()
    db.commit()


# ─── Query History CRUD ───────────────────────────────────────────────────────

def save_query(db: Session, user_id: int, question: str, answer: str, chart_config: dict | None) -> QueryHistoryDB:
    record = QueryHistoryDB(
        user_id=user_id,
        question=question,
        answer=answer,
        chart_config_json=json.dumps(chart_config) if chart_config else None,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_query_history(db: Session, user_id: int, limit: int = 20) -> list[QueryHistoryDB]:
    return db.query(QueryHistoryDB).filter(QueryHistoryDB.user_id == user_id).order_by(QueryHistoryDB.created_at.desc()).limit(limit).all()


# ─── User Configuration CRUD ──────────────────────────────────────────────────

def get_user_configuration(db: Session, twin_id: str) -> UserConfigurationDB | None:
    config = db.query(UserConfigurationDB).filter(UserConfigurationDB.twin_id == twin_id).first()
    if not config and twin_id != "default":
        # Fallback to the global default configuration if the twin doesn't have a specific one yet
        config = db.query(UserConfigurationDB).filter(UserConfigurationDB.twin_id == "default").first()
    return config


def get_all_user_configurations(db: Session) -> list[UserConfigurationDB]:
    return db.query(UserConfigurationDB).all()


def update_user_configuration(db: Session, twin_id: str, user_id: int, config_data: dict) -> UserConfigurationDB:
    config = db.query(UserConfigurationDB).filter(UserConfigurationDB.twin_id == twin_id).first()
    if not config:
        config = UserConfigurationDB(twin_id=twin_id, user_id=user_id)
        db.add(config)
    
    for key, value in config_data.items():
        if hasattr(config, key):
            setattr(config, key, value)
            
    config.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(config)
    return config
