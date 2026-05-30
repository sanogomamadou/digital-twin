from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgrespassword@localhost:5432/digital_twin")

engine = create_engine(
    DATABASE_URL
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ─── ORM Models ───────────────────────────────────────────────────────────────

class UserDB(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
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
    answer = Column(Text)
    chart_config_json = Column(Text)
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


def create_tables():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
