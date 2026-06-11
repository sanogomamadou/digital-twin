"""
Base Connector — abstract class all connectors must implement.
Connectors push KPI readings into the shared in-memory KPI bus,
which the WebSocket router then streams to all connected clients.
"""
from __future__ import annotations
import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable, Awaitable

logger = logging.getLogger(__name__)


@dataclass
class KpiReading:
    """A single real-time KPI measurement."""
    user_id: int
    twin_id: str
    component_id: str
    kpi_name: str
    value: float
    unit: str = ""
    timestamp: datetime = field(default_factory=datetime.utcnow)
    source: str = "connector"
    status: str = "green"        # green | orange | red  (computed by connector)
    meta: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "componentId": self.component_id,
            "kpiName": self.kpi_name,
            "value": self.value,
            "unit": self.unit,
            "timestamp": self.timestamp.isoformat(),
            "source": self.source,
            "status": self.status,
            "meta": self.meta,
        }


# Global KPI event bus — any connector publishes here, WS router subscribes
KPI_BUS: asyncio.Queue = asyncio.Queue(maxsize=2000)


class BaseConnector(ABC):
    """Abstract base for all data connectors."""

    name: str = "base"
    enabled: bool = True

    @staticmethod
    def is_safe_identifier(name: str) -> bool:
        """Ensure an identifier only contains alphanumeric chars and underscores."""
        import re
        return bool(name and re.match(r"^[a-zA-Z0-9_]+$", name))

    def __init__(self, config: dict):
        self.config = config
        self._running = False
        self._task: asyncio.Task | None = None
        self.twin_id = config.get("twin_id", "default")
        self.user_id = config.get("user_id", 1)
        # KPI assignment interface shared by ALL connectors (set/refreshed via
        # update_assignments). Without this, factory-built connectors crash when
        # _run_loop reads self.assignments or /assign clears last_timestamps.
        self.assignments = config.get("assignments", {})
        self.domain = config.get("domain", "factory")
        self.last_timestamps = {}   # per-component incremental cursor (Postgres-style)
        self._last_ts = None        # single global incremental cursor (NoSQL/lakehouse-style)

    async def start(self):
        """Start the connector background task."""
        if not self.enabled:
            return
        self._running = True
        self._task = asyncio.create_task(self._run_loop(), name=f"connector:{self.name}")
        logger.info(f"▶ Connector [{self.name}] started")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
        logger.info(f"■ Connector [{self.name}] stopped")

    @abstractmethod
    async def _run_loop(self):
        """Connector main loop — must call self.emit() for each reading."""
        ...

    async def emit(self, reading: KpiReading):
        """Push a reading onto the global bus."""
        try:
            await asyncio.wait_for(KPI_BUS.put(reading), timeout=1.0)
        except asyncio.TimeoutError:
            logger.warning(f"KPI bus full — dropping reading from [{self.name}]")

    def compute_status(self, value: float, rules: dict) -> str:
        """Compute green/orange/red from threshold rules dict."""
        direction = rules.get("direction", "asc")
        red_lo = rules.get("red", [None, None])[0]
        orange_lo = rules.get("orange", [None, None])[0]
        
        if direction == "desc":
            if red_lo is not None and value <= red_lo:
                return "red"
            if orange_lo is not None and value <= orange_lo:
                return "orange"
        else:
            if red_lo is not None and value >= red_lo:
                return "red"
            if orange_lo is not None and value >= orange_lo:
                return "orange"

        return "green"

    def update_assignments(self, assignments: dict, domain: str = None,
                           db_url: str = None, table_name: str = None,
                           timestamp_col: str = None, component_id_col: str = None):
        """Generic hot-update of the KPI assignments + reset of the incremental
        read cursors. Connection parameters are fixed at construction here;
        PostgresConnector overrides this for finer control over the DB target."""
        self.assignments = assignments
        if domain:
            self.domain = domain
        self.last_timestamps = {}
        self._last_ts = None
