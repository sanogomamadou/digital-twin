import asyncio, json
from models.schemas import AnalyticsQueryRequest
from agents.nlq_agent import run_nlq_agent_stream

async def run():
    req = AnalyticsQueryRequest(question="Fais-moi un résumé de l'état actuel du moteur principal.", timeRange='24h')
    try:
        async for e in run_nlq_agent_stream(req, []):
            print("YIELDED:", e)
    except Exception as e:
        print("EXCEPTION:", str(e))

asyncio.run(run())
