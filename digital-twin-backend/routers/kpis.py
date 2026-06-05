from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from db.database import get_db, UserDB
from routers.auth import get_current_user, get_user_id_for_read
from db import crud
from models.schemas import KpiImportResponse, KpiRecord
from services.data_service import parse_upload, detect_columns, df_to_kpi_records
from datetime import datetime

router = APIRouter(prefix="/kpis", tags=["KPIs"])


@router.post("/import", response_model=KpiImportResponse)
async def import_kpi_file(
    file: UploadFile = File(...),
    component_id: str = Form(...),
    kpi_name: str = Form(...),
    twin_id: str = Form("default"),
    value_col: str = Form(None),
    timestamp_col: str = Form(None),
    unit_col: str = Form(None),
    unit: str = Form(""),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Upload a CSV or Excel file and store KPI data for a component."""
    if twin_id == "default":
        twin_id = f"default_{current_user.id}"
    if not file.filename.endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported.")

    file_bytes = await file.read()
    try:
        df = parse_upload(file_bytes, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {e}")

    # Auto-detect columns if not provided
    detected = detect_columns(df)
    v_col = value_col or detected.get("value") or df.columns[0]
    ts_col = timestamp_col or detected.get("timestamp")
    u_col = unit_col or detected.get("unit")

    if v_col not in df.columns:
        raise HTTPException(status_code=400, detail=f"Value column '{v_col}' not found. Available: {list(df.columns)}")

    records = df_to_kpi_records(df, value_col=v_col, timestamp_col=ts_col, unit_col=u_col)
    # Apply fixed unit if no unit column
    if unit and not u_col:
        for r in records:
            r["unit"] = unit

    rows_saved = crud.insert_kpi_records(db, twin_id, component_id, kpi_name, records)

    preview = [{v_col: r["value"], "timestamp": str(r["timestamp"]), "unit": r["unit"]} for r in records[:5]]
    return KpiImportResponse(
        componentId=component_id,
        kpiName=kpi_name,
        rowsImported=rows_saved,
        preview=preview,
        columns=list(df.columns),
    )


@router.post("/realtime")
async def push_realtime_kpi(
    component_id: str,
    kpi_name: str,
    value: float,
    unit: str = "",
    twin_id: str = "default",
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Push a single real-time KPI reading."""
    if twin_id == "default":
        twin_id = f"default_{current_user.id}"
    crud.insert_kpi_records(db, twin_id, component_id, kpi_name, [{
        "value": value, "unit": unit,
        "timestamp": datetime.utcnow(), "source": "realtime"
    }])
    return {"status": "ok", "componentId": component_id, "kpiName": kpi_name, "value": value}


@router.get("/summary")
def get_kpi_summary(twin_id: str = "default", db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    """Get aggregated KPI summary across all components."""
    if twin_id == "default":
        twin_id = f"default_{current_user.id}"
    return crud.get_all_kpi_summary(db, twin_id)


@router.get("/{component_id}")
def get_component_kpis(component_id: str, twin_id: str = "default", kpi_name: str = None, limit: int = 200, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    """Get raw KPI data for a specific component."""
    if twin_id == "default":
        twin_id = f"default_{current_user.id}"
    records = crud.get_kpi_data(db, twin_id=twin_id, component_id=component_id, kpi_name=kpi_name, limit=limit)
    return [
        {"id": r.id, "componentId": r.component_id, "kpiName": r.kpi_name,
         "value": r.value, "unit": r.unit, "timestamp": str(r.timestamp), "source": r.source}
        for r in records
    ]


@router.delete("/{component_id}")
def delete_component_kpis(component_id: str, twin_id: str = "default", db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    """Clear all KPI data for a component."""
    if twin_id == "default":
        twin_id = f"default_{current_user.id}"
    crud.delete_kpi_data(db, twin_id, component_id)
    return {"status": "deleted", "componentId": component_id}
