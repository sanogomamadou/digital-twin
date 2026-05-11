import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.database import get_db, UserDB, ShareLinkDB
from db import crud
from models.schemas import LayoutStateSchema, TwinSummary
from routers.auth import get_current_user

router = APIRouter(prefix="/twins", tags=["Twins"])


def _to_summary(db_layout) -> TwinSummary:
    components = json.loads(db_layout.components_json or "[]")
    connections = json.loads(db_layout.connections_json or "[]")
    return TwinSummary(
        id=db_layout.id,
        name=db_layout.name,
        domain=db_layout.domain,
        width=getattr(db_layout, "width", 60.0) or 60.0,
        length=getattr(db_layout, "length", 40.0) or 40.0,
        gridCols=db_layout.grid_cols,
        gridRows=db_layout.grid_rows,
        componentCount=len(components),
        connectionCount=len(connections),
        createdAt=db_layout.created_at,
        updatedAt=db_layout.updated_at,
    )


@router.get("", response_model=list[TwinSummary])
def list_twins(db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    """List all saved digital twins (summary cards)."""
    twins = crud.list_twins(db, current_user.id)
    return [_to_summary(t) for t in twins]


@router.get("/{twin_id}", response_model=LayoutStateSchema)
def get_twin(twin_id: str, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    """Load full state of a saved digital twin."""
    db_layout = crud.get_layout(db, twin_id, current_user.id)
    if not db_layout:
        raise HTTPException(status_code=404, detail="Twin not found")
    schema = crud.layout_db_to_schema(db_layout)

    # Sync backend data stream to use this Twin's KPIs
    try:
        from routers.data_source import apply_assignments_sync
        if schema.kpiAssignments:
            apply_assignments_sync(schema.domain, schema.kpiAssignments)
    except Exception as e:
        print(f"Failed to sync KPIs on twin load: {e}")

    return schema


@router.put("/{twin_id}", response_model=TwinSummary)
def save_twin(twin_id: str, state: LayoutStateSchema, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    """Create or update a digital twin by ID."""
    state.id = twin_id
    db_layout = crud.save_layout(db, state, current_user.id)
    return _to_summary(db_layout)


@router.delete("/{twin_id}")
def delete_twin(twin_id: str, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    """Delete a saved digital twin."""
    deleted = crud.delete_twin(db, twin_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Twin not found")
    return {"deleted": twin_id}


@router.get("/shared/{share_id}", response_model=LayoutStateSchema)
def get_shared_twin(share_id: str, password: str, db: Session = Depends(get_db)):
    """Load full state of a shared digital twin using its password."""
    db_link = db.query(ShareLinkDB).filter(ShareLinkDB.id == share_id).first()
    if not db_link:
        raise HTTPException(status_code=404, detail="Share link not found")
        
    from routers.share import verify_password
    if not verify_password(password, db_link.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password")
        
    db_layout = crud.get_layout(db, db_link.twin_id, user_id=None) # Shared views bypass user_id check
    if not db_layout:
        raise HTTPException(status_code=404, detail="Twin not found")
    schema = crud.layout_db_to_schema(db_layout)

    try:
        from routers.data_source import apply_assignments_sync
        if schema.kpiAssignments:
            apply_assignments_sync(schema.domain, schema.kpiAssignments)
    except Exception as e:
        print(f"Failed to sync KPIs on shared twin load: {e}")

    return schema
