import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL or "postgresql" not in DATABASE_URL:
    print("This migration is only required for PostgreSQL.")
    exit(0)

# Extract psycopg2 connection string
db_url = DATABASE_URL.replace("postgresql://", "postgresql://")

queries = [
    "ALTER TABLE layout_states ADD COLUMN IF NOT EXISTS user_id INTEGER;",
    "ALTER TABLE query_history ADD COLUMN IF NOT EXISTS user_id INTEGER;",
    "ALTER TABLE share_links ADD COLUMN IF NOT EXISTS user_id INTEGER;",
    "CREATE INDEX IF NOT EXISTS ix_layout_states_user_id ON layout_states (user_id);",
    "CREATE INDEX IF NOT EXISTS ix_query_history_user_id ON query_history (user_id);",
    "CREATE INDEX IF NOT EXISTS ix_share_links_user_id ON share_links (user_id);"
]

try:
    print(f"Connecting to {db_url}...")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cursor = conn.cursor()
    
    for query in queries:
        print(f"Running: {query}")
        cursor.execute(query)
        
    print("Migration successful! user_id columns have been added to your Docker PostgreSQL database.")
    
except Exception as e:
    print(f"Migration error: {e}")
finally:
    if 'cursor' in locals():
        cursor.close()
    if 'conn' in locals():
        conn.close()
