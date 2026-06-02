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
    return config_data

@router.get("/metrics")
def get_performance_metrics(db: Session = Depends(get_db), current_admin: UserDB = Depends(require_admin)):
    """Fetch real agent performance metrics."""
    one_week_ago = datetime.utcnow() - timedelta(days=7)
    metrics = db.query(AgentMetricsDB).filter(AgentMetricsDB.timestamp >= one_week_ago).all()
    
    # User satisfaction from QueryHistoryDB
    from db.database import QueryHistoryDB
    queries = db.query(QueryHistoryDB).filter(QueryHistoryDB.created_at >= one_week_ago).all()
    rated_queries = [q for q in queries if q.rating is not None]
    if len(rated_queries) > 0:
        user_satisfaction = (sum(q.rating for q in rated_queries) / len(rated_queries)) * 100
    else:
        user_satisfaction = 100.0 # Default if unrated
    
    total_calls = len(metrics)
    if total_calls == 0:
        return {
            "avgLatency": 0,
            "successRate": 100,
            "userSatisfaction": round(user_satisfaction, 1),
            "totalTokens": 0,
            "totalCalls": 0,
            "timeSeries": []
        }
        
    success_calls = sum(1 for m in metrics if m.success == 1)
    avg_latency = sum(m.latency_ms for m in metrics) / total_calls
    total_tokens = sum(m.token_count for m in metrics)
    success_rate = (success_calls / total_calls) * 100
    
    # Simple time series grouping by hour
    # For a real dashboard, a proper GROUP BY with date_trunc is better,
    # but for simplicity we will group in python
    series_map = {}
    for m in metrics:
        hr = m.timestamp.strftime("%Y-%m-%d %H:00")
        if hr not in series_map:
            series_map[hr] = {"time": hr, "latency": 0, "successRate": 0, "tokens": 0, "count": 0, "successes": 0}
        
        series_map[hr]["latency"] += m.latency_ms
        series_map[hr]["tokens"] += m.token_count
        series_map[hr]["count"] += 1
        if m.success == 1:
            series_map[hr]["successes"] += 1
            
    time_series = []
    for hr in sorted(series_map.keys()):
        d = series_map[hr]
        time_series.append({
            "time": hr.split(" ")[1], # Just the hour part for UI
            "latency": round(d["latency"] / d["count"]),
            "successRate": round((d["successes"] / d["count"]) * 100),
            "tokens": d["tokens"],
            "count": d["count"]
        })
        
    return {
        "avgLatency": round(avg_latency),
        "successRate": round(success_rate, 1),
        "userSatisfaction": round(user_satisfaction, 1),
        "totalTokens": total_tokens,
        "totalCalls": total_calls,
        "timeSeries": time_series[-12:] # Last 12 hours max
    }
