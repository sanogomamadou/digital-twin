from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgrespassword@localhost:5432/digital_twin")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,   # validate connections before use (Neon cold start / recycled conns)
    pool_recycle=1800,    # refresh idle connections after 30 min
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ─── ORM Models ───────────────────────────────────────────────────────────────

class UserDB(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="user")
    created_at = Column(DateTime, default=datetime.utcnow)


class LayoutStateDB(Base):
    __tablename__ = "layout_states"

    id = Column(String, primary_key=True, default="default")
    user_id = Column(Integer, index=True, nullable=True) # Will make it required later when migrating
    name = Column(String, default="Digital Twin")
    domain = Column(String, default="factory")
    width = Column(Float, default=60.0)
    length = Column(Float, default=40.0)
    grid_cols = Column(Integer, default=10)
    grid_rows = Column(Integer, default=8)
    components_json = Column(Text, default="[]")
    connections_json = Column(Text, default="[]")
    assignments_json = Column(Text, default="[]")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class KpiDataDB(Base):
    __tablename__ = "kpi_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    twin_id = Column(String, index=True, nullable=False)
    component_id = Column(String, nullable=False, index=True)
    kpi_name = Column(String, nullable=False)
    value = Column(Float)
    unit = Column(String, default="")
    timestamp = Column(DateTime, default=datetime.utcnow)
    source = Column(String, default="manual")  # manual | csv | realtime


class QueryHistoryDB(Base):
    __tablename__ = "query_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, index=True, nullable=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=True)
    chart_config_json = Column(Text, nullable=True)
    rating = Column(Integer, nullable=True) # 1 for upvote, 0 for downvote, None for unrated
    created_at = Column(DateTime, default=datetime.utcnow)


class UserConfigurationDB(Base):
    __tablename__ = "user_configurations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    twin_id = Column(String, index=True, nullable=False, unique=True)
    user_id = Column(Integer, index=True, nullable=True)
    source_type = Column(String, default="postgres")
    telemetry_db_url = Column(String)
    telemetry_table = Column(String)
    timestamp_col = Column(String)
    component_id_col = Column(String)
    credentials_json = Column(Text, default="{}")
    domain = Column(String, default="factory")
    assignments_json = Column(Text, default="{}")
    streaming = Column(Integer, default=0) # boolean via integer
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ShareLinkDB(Base):
    __tablename__ = "share_links"

    id = Column(String, primary_key=True)
    user_id = Column(Integer, index=True, nullable=True)
    twin_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class LLMConfigDB(Base):
    __tablename__ = "llm_config"

    id = Column(Integer, primary_key=True, autoincrement=True)
    model = Column(String, default="llama3-70b-8192")
    temperature = Column(Float, default=0.2)
    max_tokens = Column(Integer, default=4096)
    system_prompt = Column(Text, default="You are a helpful AI assistant.")
    api_keys_json = Column(Text, default="[]")  # List of API keys
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AgentMetricsDB(Base):
    __tablename__ = "agent_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trace_id = Column(String, index=True)
    latency_ms = Column(Float, default=0.0)
    token_count = Column(Integer, default=0)
    success = Column(Integer, default=1)  # 1 for success, 0 for failure
    error_message = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)


def create_tables():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
