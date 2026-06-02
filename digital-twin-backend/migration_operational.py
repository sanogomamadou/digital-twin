import os
import json
from dotenv import load_dotenv
import psycopg2

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgrespassword@localhost:5432/digital_twin")

def run_migration():
    print("Running operational migration...")
    try:
        from db.database import Base, engine, SessionLocal, LLMConfigDB
        Base.metadata.create_all(bind=engine)
        print("Tables created successfully.")
        
        # Insert default config if empty
        db = SessionLocal()
        config = db.query(LLMConfigDB).first()
        if not config:
            print("Inserting default LLM config...")
            
            # Use env key if exists
            initial_keys = []
            groq_env = os.getenv("GROQ_API_KEY")
            if groq_env:
                initial_keys.append(groq_env)
                
            new_config = LLMConfigDB(
                model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
                temperature=0.2,
                max_tokens=4096,
                system_prompt="You are a factory planning assistant. Help the user design digital twins.",
                api_keys_json=json.dumps(initial_keys)
            )
            db.add(new_config)
            db.commit()
            print("Default config inserted.")
        else:
            print("LLM config already exists.")
            
        db.close()
    except Exception as e:
        print(f"Error during migration: {e}")

if __name__ == "__main__":
    run_migration()
