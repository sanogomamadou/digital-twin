import asyncio
from dotenv import load_dotenv

# Langfuse credentials are read from the environment (.env). Never hard-code secrets.
load_dotenv()

from db.database import SessionLocal
from models.schemas import AnalyticsQueryRequest
from agents.nlq_agent import run_nlq_agent_stream
from langfuse import Langfuse

async def main():
    db = SessionLocal()
    req = AnalyticsQueryRequest(question='Quel est l etat general ?', time_range='1 day', twin_id='default', conversation_id='123')
    async for chunk in run_nlq_agent_stream(req, [], 1, db, None, 'test_thread'):
        print(chunk)
    print("Done generating!")
    # Force global flush
    client = Langfuse()
    client.flush()
    print("Flushed!")

if __name__ == '__main__':
    asyncio.run(main())
