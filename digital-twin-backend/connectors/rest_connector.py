"""
REST API Connector — polls external REST endpoints and converts responses to KPI readings.
Use for: Airport AODB, BRS, FIDS, SCADA APIs, custom vendor APIs.

Configure in .env or in connector_config.json:
  REST_ENABLED=true
  REST_CONFIG_FILE=connector_config.json

connector_config.json example:
[
  {
    "name": "aodb_passenger_flow",
    "url": "https://api.airport.com/v1/terminals/T1/pax-flow",
    "method": "GET",
    "headers": {"Authorization": "Bearer TOKEN"},
    "interval_seconds": 30,
    "component_id": "terminal_1",
    "kpi_name": "Passenger Flow",
    "unit": "pax/h",
    "value_path": "data.current_flow",   ← dot-path into the JSON response
    "rules": {"orange": [1000, 1500], "red": [1500, 9999]}
  }
]
"""
from __future__ import annotations
import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any
import httpx
from connectors.base import BaseConnector, KpiReading

logger = logging.getLogger(__name__)

REST_ENABLED     = os.getenv("REST_ENABLED", "false").lower() == "true"
REST_CONFIG_FILE = os.getenv("REST_CONFIG_FILE", "connector_config.json")


def _get_nested(obj: Any, path: str) -> Any:
    """Extract a value from nested dict using dot-notation path."""
    for key in path.split("."):
        if isinstance(obj, dict):
            obj = obj.get(key)
        elif isinstance(obj, list) and key.isdigit():
            obj = obj[int(key)]
        else:
            return None
    return obj


class RestConnector(BaseConnector):
    """Polls one or more REST endpoints on configurable intervals."""
    name = "rest"
    enabled = REST_ENABLED

    def __init__(self, config: dict):
        super().__init__(config)
        self.user_id = config.get("user_id", 1)
        self._endpoints: list[dict] = []

    def _load_config(self):
        if not os.path.exists(REST_CONFIG_FILE):
            logger.warning(f"REST connector config not found: {REST_CONFIG_FILE}")
            return []
        with open(REST_CONFIG_FILE) as f:
            return json.load(f)

    async def _poll_endpoint(self, ep: dict, client: httpx.AsyncClient):
        """Poll a single endpoint and emit a KPI reading."""
        url     = ep["url"]
        method  = ep.get("method", "GET").upper()
        headers = ep.get("headers", {})
        v_path  = ep.get("value_path", "value")

        try:
            resp = await client.request(method, url, headers=headers, timeout=10.0)
            resp.raise_for_status()
            data = resp.json()
            raw  = _get_nested(data, v_path)
            if raw is None:
                logger.warning(f"Value not found at path '{v_path}' in response from {url}")
                return
            value = float(raw)
            rules = ep.get("rules", {})
            reading = KpiReading(
                            user_id=self.user_id,
                            component_id=ep["component_id"],
                kpi_name=ep["kpi_name"],
                value=value,
                unit=ep.get("unit", ""),
                timestamp=datetime.now(timezone.utc),
                source="rest",
                status=self.compute_status(value, rules),
                meta={"url": url, "endpoint_name": ep.get("name", "")},
            )
            await self.emit(reading)
            logger.debug(f"REST [{ep['name']}] → {value} {ep.get('unit', '')}")
        except httpx.HTTPError as e:
            logger.error(f"REST poll error [{url}]: {e}")
        except Exception as e:
            logger.error(f"REST unexpected error [{url}]: {e}")

    async def _endpoint_loop(self, ep: dict, client: httpx.AsyncClient):
        interval = ep.get("interval_seconds", 30)
        while self._running:
            await self._poll_endpoint(ep, client)
            await asyncio.sleep(interval)

    async def _run_loop(self):
        if not REST_ENABLED:
            logger.info("REST connector disabled (set REST_ENABLED=true)")
            return

        endpoints = self._load_config()
        if not endpoints:
            return

        logger.info(f"✅ REST connector: polling {len(endpoints)} endpoint(s)")
        async with httpx.AsyncClient() as client:
            tasks = [
                asyncio.create_task(self._endpoint_loop(ep, client))
                for ep in endpoints
            ]
            try:
                await asyncio.gather(*tasks)
            except asyncio.CancelledError:
                for t in tasks:
                    t.cancel()
