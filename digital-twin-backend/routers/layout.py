from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.database import get_db
from db import crud
from models.schemas import (
    LayoutPromptRequest, LayoutPromptResponse,
    LayoutStateSchema
)
from agents.layout_agent import run_layout_agent
from routers.auth import get_current_user
from db.database import UserDB

router = APIRouter(prefix="/layout", tags=["Layout"])


@router.post("/prompt", response_model=LayoutPromptResponse)
async def layout_from_prompt(
    request: LayoutPromptRequest, 
    db: Session = Depends(get_db), 
    current_user: UserDB = Depends(get_current_user)
):
    """Convert a natural language prompt into layout actions and return the new state."""
    try:
        result = await run_layout_agent(request.prompt, request.currentState)
        # Persist new state to DB
        crud.save_layout(db, current_user.id, result.newState)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/state/{layout_id}", response_model=LayoutStateSchema)
def get_layout_state(
    layout_id: str = "default", 
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Get saved layout state from DB."""
    db_layout = crud.get_layout(db, current_user.id, layout_id)
    if not db_layout:
        raise HTTPException(status_code=404, detail="Layout not found")
    return crud.layout_db_to_schema(db_layout)


@router.get("/state", response_model=LayoutStateSchema)
def get_default_layout(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Get default layout state."""
    db_layout = crud.get_layout(db, current_user.id, "default")
    if not db_layout:
        return LayoutStateSchema(id=f"default_{current_user.id}")
    return crud.layout_db_to_schema(db_layout)


@router.put("/state", response_model=LayoutStateSchema)
def save_layout_state(
    state: LayoutStateSchema, 
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Save/update layout state."""
    db_layout = crud.save_layout(db, current_user.id, state)
    return crud.layout_db_to_schema(db_layout)

@router.get("/suggestions", response_model=list[str])
async def get_layout_suggestions_endpoint(
    domain: str = None,
    twin_id: str = "default",
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Generate domain-specific layout prompt suggestions."""
    if not domain:
        layout = crud.get_layout(db, current_user.id, twin_id)
        domain = layout.domain if layout else "factory"
    
    domain = domain.lower()
    if "airport" in domain:
        return [
            "Add a checkin desk 3x1",
            "Add a security zone 2x2",
            "Move terminal to row 0, col 0",
            "Connect checkin desk to security zone",
            "Generate a custom radar dome 3x3",
            "Add a runway 6x2"
        ]
    elif "warehouse" in domain:
        return [
            "Add 2 warehouse racks",
            "Add a picking zone 3x2",
            "Move shipping dock to col 8",
            "Connect reception dock to sorter",
            "Generate a custom forklift 1x1",
            "Add a conveyor 4x1"
        ]
    else:
        return [
            "Add 2 assembly stations",
            "Move CNC machine to row 2",
            "Connect assembly station to quality control",
            "Add a conveyor belt 4x1",
            "Generate a custom robotic arm 1x1",
            "Add a warehouse rack 2x3"
        ]

