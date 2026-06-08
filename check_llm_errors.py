import sys
import os

# Append backend directory so we can import modules
sys.path.append(r"c:\Users\info\Desktop\Stage PFE - DXC\digital_twin\digital-twin-backend")

from db.database import SessionLocal, AgentMetricsDB

def get_latest_errors():
    db = SessionLocal()
    metrics = db.query(AgentMetricsDB).order_by(AgentMetricsDB.id.desc()).limit(10).all()
    for m in metrics:
        print(f"ID: {m.id}, Success: {m.success}, Error: {m.error_message}, Trace: {m.trace_id}, Time: {m.timestamp}")
    db.close()

if __name__ == "__main__":
    get_latest_errors()
