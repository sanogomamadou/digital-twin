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
        self._clients: dict[int, set[WebSocket]] = {}
        self._latest: dict[int, dict[str, dict]] = {}

    def clear_latest(self, user_id: int = None):
        if user_id:
            self._latest[user_id] = {}
        else:
            self._latest = {}
        logger.info("WS snapshot cache cleared")

    async def connect(self, ws: WebSocket, user_id: int):
        await ws.accept()
        if user_id not in self._clients:
            self._clients[user_id] = set()
        self._clients[user_id].add(ws)
        logger.info(f"WS client connected for user {user_id}")
        
        latest = self._latest.get(user_id, {})
        if latest:
            try:
                await ws.send_text(json.dumps({
                    "type": "snapshot",
                    "readings": list(latest.values()),
                    "ts": datetime.now(timezone.utc).isoformat(),
                }))
            except Exception as e:
                logger.error(f"Error sending snapshot: {e}")

    def disconnect(self, ws: WebSocket, user_id: int):
        if user_id in self._clients:
            self._clients[user_id].discard(ws)

    def update_latest(self, reading: KpiReading):
        if reading.user_id not in self._latest:
            self._latest[reading.user_id] = {}
        key = f"{reading.component_id}:{reading.kpi_name}"
        self._latest[reading.user_id][key] = reading.to_dict()

    async def broadcast(self, message: dict, user_id: int):
        if user_id not in self._clients:
            return
        dead = set()
        payload = json.dumps(message)
        for ws in self._clients[user_id]:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.disconnect(ws, user_id)
            
    async def broadcast_all(self, message: dict):
        payload = json.dumps(message)
        for user_id, clients in self._clients.items():
            dead = set()
            for ws in clients:
                try:
                    await ws.send_text(payload)
                except Exception:
                    dead.add(ws)
            for ws in dead:
                self.disconnect(ws, user_id)

    def client_count(self, user_id: int = None) -> int:
        if user_id:
            return len(self._clients.get(user_id, set()))
        return sum(len(c) for c in self._clients.values())


manager = ConnectionManager()


# ── Background broadcaster — drains KPI_BUS and broadcasts ───────────────────

async def kpi_broadcaster():
    while True:
        try:
            reading: KpiReading = await asyncio.wait_for(KPI_BUS.get(), timeout=15.0)
            manager.update_latest(reading)

            if manager.client_count(reading.user_id) > 0:
                await manager.broadcast({
                    "type": "kpi",
                    **reading.to_dict(),
                }, reading.user_id)

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
    """Persist a KPI reading to SQLite in background."""
    try:
        from db.database import SessionLocal
        from db.crud import insert_kpi_records
        db = SessionLocal()
        try:
            insert_kpi_records(db, reading.component_id, reading.kpi_name, [{
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
    domain: str = Query("airport"),
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
        
    try:
        user_id = int(user_id)
    except:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, user_id)
    try:
        while True:
            # Keep connection alive; handle client pings
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except asyncio.TimeoutError:
                pass  # normal — connection still alive
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket, user_id)


# ── REST endpoints for WS status ─────────────────────────────────────────────

@router.get("/stream/status")
def stream_status():
    return {
        "connected_clients": manager.client_count,
        "kpi_bus_size": KPI_BUS.qsize(),
        "latest_kpis": len(manager._latest),
        "latest_snapshot": [],
    }
