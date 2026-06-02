import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgrespassword@localhost:5432/digital_twin")

def run_migration():
    print("Running migration...")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        cur = conn.cursor()
        
        # Check if the column exists
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='users' AND column_name='role';
        """)
        
        if not cur.fetchone():
            print("Adding 'role' column to 'users' table...")
            cur.execute("ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'user';")
            print("Migration successful.")
            
            # Make the first user an admin for testing purposes
            print("Making the first user an admin...")
            cur.execute("UPDATE users SET role = 'admin' WHERE id = (SELECT id FROM users ORDER BY id ASC LIMIT 1);")
            print("First user updated to admin.")
        else:
            print("Column 'role' already exists.")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error during migration: {e}")

if __name__ == "__main__":
    run_migration()
