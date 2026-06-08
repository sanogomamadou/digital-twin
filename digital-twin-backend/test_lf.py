import asyncio
import os
os.environ["LANGFUSE_PUBLIC_KEY"] = "pk-lf-a8f10522-306d-4a3f-9ea1-c08ce2859294"
os.environ["LANGFUSE_SECRET_KEY"] = "sk-lf-c420edae-0fab-46c7-b2d7-e97c0629c421"
os.environ["LANGFUSE_HOST"] = "https://cloud.langfuse.com"

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
