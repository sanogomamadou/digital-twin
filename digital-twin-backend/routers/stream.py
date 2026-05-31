"""
WebSocket router — streams real-time KPI readings to all connected browser clients.

Each client connects to ws://localhost:8000/ws/kpis?domain=airport
The server broadcasts every reading from the KPI_BUS immediately.

Message format sent to clients:
  { "type": "kpi", "componentId": "...", "kpiName": "...",
    "value": 1234, "unit": "pax/h", "timestamp": "...",
    "status": "green|orange|red", "source": "simulator|mqtt|rest" }

Special messages:
  { "type": "ping" }  — heartbeat every 15s
  { "type": "snapshot", "readings": [...] } — latest value of every KPI on connect
"""
from __future__ import annotations
import asyncio
import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from routers.auth import SECRET_KEY, ALGORITHM
import jwt
from connectors.base import KPI_BUS, KpiReading

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Stream"])

# ── Connection manager ────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self._clients: dict[str, set[WebSocket]] = {}
        self._latest: dict[str, dict[str, dict]] = {}

    def clear_latest(self, twin_id: str = None):
        if twin_id:
            self._latest[twin_id] = {}
        else:
            self._latest = {}
        logger.info("WS snapshot cache cleared")

    async def connect(self, ws: WebSocket, twin_id: str):
        await ws.accept()
        if twin_id not in self._clients:
            self._clients[twin_id] = set()
        self._clients[twin_id].add(ws)
        logger.info(f"WS client connected for twin {twin_id}")
        
        latest = self._latest.get(twin_id, {})
        if latest:
            try:
                await ws.send_text(json.dumps({
                    "type": "snapshot",
                    "readings": list(latest.values()),
                    "ts": datetime.now(timezone.utc).isoformat(),
                }))
            except Exception as e:
                logger.error(f"Error sending snapshot: {e}")

    def disconnect(self, ws: WebSocket, twin_id: str):
        if twin_id in self._clients:
            self._clients[twin_id].discard(ws)

    def update_latest(self, reading: KpiReading):
        if reading.twin_id not in self._latest:
            self._latest[reading.twin_id] = {}
        key = f"{reading.component_id}:{reading.kpi_name}"
        self._latest[reading.twin_id][key] = reading.to_dict()

    async def broadcast(self, message: dict, twin_id: str):
        if twin_id not in self._clients:
            return
        dead = set()
        payload = json.dumps(message)
        for ws in self._clients[twin_id]:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.disconnect(ws, twin_id)
            
    async def broadcast_all(self, message: dict):
        payload = json.dumps(message)
        for twin_id, clients in self._clients.items():
            dead = set()
            for ws in clients:
                try:
                    await ws.send_text(payload)
                except Exception:
                    dead.add(ws)
            for ws in dead:
                self.disconnect(ws, twin_id)

    def client_count(self, twin_id: str = None) -> int:
        if twin_id:
            return len(self._clients.get(twin_id, set()))
        return sum(len(c) for c in self._clients.values())


manager = ConnectionManager()


# ── Background broadcaster — drains KPI_BUS and broadcasts ───────────────────

async def kpi_broadcaster():
    while True:
        try:
            reading: KpiReading = await asyncio.wait_for(KPI_BUS.get(), timeout=15.0)
            manager.update_latest(reading)

            if manager.client_count(reading.twin_id) > 0:
                await manager.broadcast({
                    "type": "kpi",
                    **reading.to_dict(),
                }, reading.twin_id)

            asyncio.create_task(_persist_reading(reading))

        except asyncio.TimeoutError:
            if manager.client_count() > 0:
                await manager.broadcast_all({
                    "type": "ping",
                    "ts": datetime.now(timezone.utc).isoformat(),
                    "clients": manager.client_count(),
                })
        except Exception as e:
            logger.error(f"Broadcaster error: {e}")

async def _persist_reading(reading: KpiReading):
    """Persist a KPI reading to PostgreSQL in background."""
    try:
        from db.database import SessionLocal
        from db.crud import insert_kpi_records
        db = SessionLocal()
        try:
            insert_kpi_records(db, reading.twin_id, reading.component_id, reading.kpi_name, [{
                "value": reading.value,
                "unit": reading.unit,
                "timestamp": reading.timestamp,
                "source": reading.source,
            }])
        finally:
            db.close()
    except Exception as e:
        logger.debug(f"Persist error (non-fatal): {e}")


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@router.websocket("/ws/kpis")
async def kpi_stream(
    websocket: WebSocket,
    twin_id: str = Query("default"),
):
    token = websocket.cookies.get("access_token")
    share_token = websocket.cookies.get("share_token")
    
    user_id = None
    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
        except:
            pass
            
    if not user_id and share_token:
        try:
            payload = jwt.decode(share_token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
        except:
            pass

    if not user_id:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, twin_id)
    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except asyncio.TimeoutError:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket, twin_id)


# ── REST endpoints for WS status ─────────────────────────────────────────────

@router.get("/stream/status")
def stream_status():
    return {
        "connected_clients": manager.client_count(),
        "kpi_bus_size": KPI_BUS.qsize(),
        "latest_kpis": len(manager._latest),
        "latest_snapshot": [],
    }
