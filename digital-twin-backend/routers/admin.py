from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from db.database import get_db, UserDB
from routers.auth import require_admin, get_password_hash
from models.schemas import UserRead

router = APIRouter(prefix="/admin", tags=["Admin"])

class RoleUpdate(BaseModel):
    role: str

class PasswordReset(BaseModel):
    new_password: str

from db.database import get_db, UserDB, LLMConfigDB, AgentMetricsDB
import json
from datetime import datetime, timedelta
from sqlalchemy import func

class LLMConfig(BaseModel):
    model: str
    temperature: float
    max_tokens: int
    system_prompt: str
    api_keys: List[str]

class UserCreateWithRole(BaseModel):
    username: str
    password: str
    role: str

@router.post("/users", response_model=UserRead)
def create_user(user_data: UserCreateWithRole, db: Session = Depends(get_db), current_admin: UserDB = Depends(require_admin)):
    """Admin creates a new user."""
    db_user = db.query(UserDB).filter(UserDB.username == user_data.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
        
    if user_data.role not in ["user", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role")
        
    hashed_password = get_password_hash(user_data.password)
    new_user = UserDB(username=user_data.username, password_hash=hashed_password, role=user_data.role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.get("/users", response_model=List[UserRead])
def list_users(db: Session = Depends(get_db), current_admin: UserDB = Depends(require_admin)):
    """Fetch all users."""
    users = db.query(UserDB).all()
    return users

@router.put("/users/{target_user_id}/role", response_model=UserRead)
def change_user_role(target_user_id: int, role_data: RoleUpdate, db: Session = Depends(get_db), current_admin: UserDB = Depends(require_admin)):
    """Change a user's role (user <-> admin)."""
    if role_data.role not in ["user", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role")
        
    user = db.query(UserDB).filter(UserDB.id == target_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.role = role_data.role
    db.commit()
    db.refresh(user)
    return user

@router.delete("/users/{target_user_id}")
def delete_user(target_user_id: int, db: Session = Depends(get_db), current_admin: UserDB = Depends(require_admin)):
    """Delete a user account."""
    if current_admin.id == target_user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")
        
    user = db.query(UserDB).filter(UserDB.id == target_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    db.delete(user)
    db.commit()
    return {"status": "User deleted"}

@router.put("/users/{target_user_id}/password")
def reset_user_password(target_user_id: int, pwd_data: PasswordReset, db: Session = Depends(get_db), current_admin: UserDB = Depends(require_admin)):
    """Force reset a user's password."""
    user = db.query(UserDB).filter(UserDB.id == target_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.password_hash = get_password_hash(pwd_data.new_password)
    db.commit()
    return {"status": "Password updated successfully"}


@router.get("/llm-config", response_model=LLMConfig)
def get_llm_config(db: Session = Depends(get_db), current_admin: UserDB = Depends(require_admin)):
    """Get global LLM configuration from DB."""
    config = db.query(LLMConfigDB).first()
    if not config:
        return LLMConfig(model="llama3-70b-8192", temperature=0.2, max_tokens=4096, system_prompt="", api_keys=[])
    keys = json.loads(config.api_keys_json) if config.api_keys_json else []
    return LLMConfig(
        model=config.model,
        temperature=config.temperature,
        max_tokens=config.max_tokens,
        system_prompt=config.system_prompt,
        api_keys=keys
    )

@router.put("/llm-config", response_model=LLMConfig)
def update_llm_config(config_data: LLMConfig, db: Session = Depends(get_db), current_admin: UserDB = Depends(require_admin)):
    """Update global LLM configuration in DB."""
    config = db.query(LLMConfigDB).first()
    if not config:
        config = LLMConfigDB()
        db.add(config)
        
    config.model = config_data.model
    config.temperature = config_data.temperature
    config.max_tokens = config_data.max_tokens
    config.system_prompt = config_data.system_prompt
    config.api_keys_json = json.dumps(config_data.api_keys)
    
    db.commit()
    db.refresh(config)

    # Invalidate the cached analytics orchestrator so the new model/keys take
    # effect immediately (otherwise the NLQ/Report graph keeps the old LLM until restart).
    try:
        from agents.graph_orchestrator import reset_orchestrator_cache
        reset_orchestrator_cache()
    except Exception:
        pass

    return config_data

@router.get("/metrics")
def get_performance_metrics(db: Session = Depends(get_db), current_admin: UserDB = Depends(require_admin)):
    """Fetch real agent performance metrics — aggregated in SQL (no row scan)."""
    from sqlalchemy import text
    one_week_ago = datetime.utcnow() - timedelta(days=7)

    # Scalar aggregates over the last 7 days
    agg = db.execute(text("""
        SELECT COUNT(*) AS total_calls,
               COALESCE(AVG(latency_ms), 0) AS avg_latency,
               COALESCE(SUM(token_count), 0) AS total_tokens,
               COALESCE(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END), 0) AS success_calls
        FROM agent_metrics
        WHERE timestamp >= :since
    """), {"since": one_week_ago}).first()

    total_calls = agg.total_calls or 0

    # User satisfaction from rated queries
    sat = db.execute(text("""
        SELECT AVG(rating) AS avg_rating, COUNT(*) AS rated
        FROM query_history
        WHERE created_at >= :since AND rating IS NOT NULL
    """), {"since": one_week_ago}).first()
    user_satisfaction = round(sat.avg_rating * 100, 1) if sat and sat.rated and sat.avg_rating is not None else 100.0

    if total_calls == 0:
        return {
            "avgLatency": 0,
            "successRate": 100,
            "userSatisfaction": user_satisfaction,
            "totalTokens": 0,
            "totalCalls": 0,
            "timeSeries": []
        }

    success_rate = (agg.success_calls / total_calls) * 100

    # Hourly time series via SQL date_trunc (last 12 hours kept for the UI)
    rows = db.execute(text("""
        SELECT date_trunc('hour', timestamp) AS hr,
               AVG(latency_ms) AS latency,
               SUM(token_count) AS tokens,
               COUNT(*) AS count,
               SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successes
        FROM agent_metrics
        WHERE timestamp >= :since
        GROUP BY 1
        ORDER BY 1
    """), {"since": one_week_ago}).fetchall()

    time_series = [{
        "time": r.hr.strftime("%H:00"),
        "latency": round(r.latency or 0),
        "successRate": round((r.successes / r.count) * 100) if r.count else 0,
        "tokens": int(r.tokens or 0),
        "count": r.count,
    } for r in rows][-12:]

    return {
        "avgLatency": round(agg.avg_latency or 0),
        "successRate": round(success_rate, 1),
        "userSatisfaction": user_satisfaction,
        "totalTokens": int(agg.total_tokens or 0),
        "totalCalls": total_calls,
        "timeSeries": time_series
    }
