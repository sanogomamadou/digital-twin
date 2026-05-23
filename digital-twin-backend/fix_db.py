import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL").replace("postgresql://", "postgresql://")

queries = [
    "ALTER TABLE layout_states ALTER COLUMN user_id TYPE INTEGER USING user_id::integer;",
    "ALTER TABLE query_history ALTER COLUMN user_id TYPE INTEGER USING user_id::integer;",
    "ALTER TABLE share_links ALTER COLUMN user_id TYPE INTEGER USING user_id::integer;"
]

conn = psycopg2.connect(db_url)
conn.autocommit = True
cursor = conn.cursor()
for q in queries:
    try:
        cursor.execute(q)
        print("Success:", q)
    except Exception as e:
        print("Error on", q, e)
