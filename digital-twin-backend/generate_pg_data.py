import os
import time
import random
import psycopg2
from datetime import datetime

# Database Connection Details
DB_URL = os.getenv("TELEMETRY_DB_URL", "postgresql://postgres:postgrespassword@localhost:5433/telemetry_db")

# --- Schemas ---
# We will create one table per domain (factory, airport, warehouse)
TABLES = {
    "factory_data": [
        "component_id VARCHAR(50)",
        "timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "temp_engine FLOAT",
        "pressure_bar FLOAT",
        "vibration_freq FLOAT",
        "energy_in FLOAT",
        "energy_out FLOAT",
        "quality_score FLOAT",
        "defect_rate FLOAT"
    ],
    "airport_data": [
        "component_id VARCHAR(50)",
        "timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "passenger_count INT",
        "wait_time_minutes FLOAT",
        "processing_rate FLOAT",
        "baggage_throughput INT",
        "security_score FLOAT",
        "flight_delay_minutes FLOAT"
    ],
    "warehouse_data": [
        "component_id VARCHAR(50)",
        "timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "inventory_level INT",
        "pick_rate FLOAT",
        "cycle_time_seconds FLOAT",
        "conveyor_speed FLOAT",
        "forklift_battery FLOAT",
        "error_rate FLOAT"
    ]
}

def get_db_connection():
    try:
        conn = psycopg2.connect(DB_URL)
        conn.autocommit = True
        return conn
    except Exception as e:
        print(f"❌ Failed to connect to PostgreSQL: {e}")
        return None

def init_tables(conn):
    cursor = conn.cursor()
    for table_name, columns in TABLES.items():
        create_sql = f"CREATE TABLE IF NOT EXISTS {table_name} ({', '.join(columns)});"
        cursor.execute(create_sql)
        print(f"✅ Ensured table {table_name} exists.")
    cursor.close()

STATE = {}

def get_initial_state(table_name, component_id):
    if table_name == "factory_data":
        return {
            "temp_engine": random.uniform(50.0, 70.0),
            "pressure_bar": random.uniform(3.0, 5.0),
            "vibration_freq": random.uniform(40.0, 60.0),
            "energy_in": random.uniform(80.0, 100.0),
            "energy_out": random.uniform(60.0, 80.0),
            "quality_score": random.uniform(95.0, 99.0),
            "defect_rate": random.uniform(0.5, 1.0),
        }
    elif table_name == "airport_data":
        return {
            "passenger_count": random.randint(100, 200),
            "wait_time_minutes": random.uniform(5.0, 15.0),
            "processing_rate": random.uniform(40.0, 60.0),
            "baggage_throughput": random.randint(300, 500),
            "security_score": random.uniform(85.0, 95.0),
            "flight_delay_minutes": random.uniform(2.0, 10.0),
        }
    elif table_name == "warehouse_data":
        return {
            "inventory_level": random.randint(4000, 6000),
            "pick_rate": random.uniform(150.0, 250.0),
            "cycle_time_seconds": random.uniform(100.0, 150.0),
            "conveyor_speed": random.uniform(1.0, 2.0),
            "forklift_battery": random.uniform(80.0, 100.0),
            "error_rate": random.uniform(0.5, 1.0),
        }
    return {}

def generate_random_data(table_name, component_id):
    if component_id not in STATE:
        STATE[component_id] = get_initial_state(table_name, component_id)
    
    current = STATE[component_id]
    
    # Apply small random drift/trends to each value
    for k, v in current.items():
        # Prevent getting stuck at 0: reset to initial if too low
        if v <= 0.01 and k != "forklift_battery":
            current[k] = get_initial_state(table_name, component_id).get(k, 10.0)
            continue

        # Random walk with slight upward bias occasionally, or just noise
        drift = random.uniform(-0.02, 0.025) * max(v, 1.0)  # max(v, 1.0) avoids zero multiplication
        
        # specific hard caps depending on field to prevent absurd values
        if "rate" in k or k == "quality_score":
            current[k] = max(0.0, min(100.0, v + drift))
        elif k == "passenger_count" or k == "inventory_level":
            current[k] = max(0, int(v + drift * 10))
        elif k == "forklift_battery":
            if v <= 5.0:
                current[k] = 100.0 # Recharge automatically
            else:
                current[k] = max(0.0, min(100.0, v - random.uniform(0.1, 0.5))) # Battery drains
        else:
            current[k] = max(0.0, v + drift)
            
    res = {"component_id": component_id}
    for k, v in current.items():
        res[k] = round(v, 2) if isinstance(v, float) else v
    return res

# Simulated component IDs that map to the 3D twin default components
COMPONENT_IDS = {
    "factory_data": ["hydraulic_press_1", "conveyor_belt_1", "cnc_machine_1", "assembly_station_1", "quality_control_1"],
    "airport_data": ["terminal_1", "gate_1", "runway_1", "security_zone_1", "checkin_desk_1", "baggage_claim_1"],
    "warehouse_data": ["storage_rack_1", "picking_zone_1", "reception_dock_1", "shipping_dock_1", "conveyor_1", "sorter_1"]
}

import json

ASSIGNMENTS_FILE = os.path.join(os.path.dirname(__file__), "source_data", "db_assignments.json")

def simulate_stream():
    conn = get_db_connection()
    if not conn:
        print("Waiting 5 seconds and retrying...")
        time.sleep(5)
        conn = get_db_connection()
        if not conn:
            return

    init_tables(conn)
    cursor = conn.cursor()

    print("🚀 Starting real-time data streaming to Postgres... (Waiting for assignments)")
    current_domain = None  # Track active domain to detect switches

    try:
        while True:
            tasks_to_generate = []
            try:
                from db.database import SessionLocal, UserConfigurationDB
                with SessionLocal() as db:
                    configs = db.query(UserConfigurationDB).all()
                    for config in configs:
                        domain = config.domain or "factory"
                        assignments = json.loads(config.assignments_json) if config.assignments_json else {}
                        components = list(set(
                            a.get("component_id")
                            for a in assignments.values()
                            if a.get("component_id")
                        ))
                        if not components:
                            components = COMPONENT_IDS.get(f"{domain}_data", ["generic_1"])
                        tasks_to_generate.append((f"{domain}_data", components))
            except Exception as e:
                print(f"Error reading DB configurations: {e}")

            if not tasks_to_generate:
                tasks_to_generate.append(("factory_data", COMPONENT_IDS.get("factory_data", ["generic_1"])))

            for table_name, active_components in tasks_to_generate:
                success_count = 0
                for comp_id in active_components:
                    data = generate_random_data(table_name, comp_id)
                    columns = list(data.keys())
                    values = list(data.values())

                    col_str = ", ".join(columns)
                    val_placeholders = ", ".join(["%s"] * len(values))

                    sql = f"INSERT INTO {table_name} ({col_str}) VALUES ({val_placeholders})"
                    try:
                        cursor.execute(sql, values)
                        success_count += 1
                    except Exception as e:
                        print(f"Error inserting into {table_name}: {e}")
                        STATE.pop(comp_id, None)

                print(f"[{datetime.now().strftime('%H:%M:%S')}] Inserted {success_count}/{len(active_components)} rows for {table_name}.")

            time.sleep(2)

    except KeyboardInterrupt:
        print("\n⏹️ Stopped data generation.")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    simulate_stream()
