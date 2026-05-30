"""
Simulator Connector — generates realistic real-time KPI data with:
- Rush-hour patterns (airport), shift patterns (factory), throughput cycles (warehouse)
- Random walk on each value (realistic drift, not just random noise)
- Occasional anomaly injection (so NLQ can detect them)
- Configurable refresh interval per KPI

This is the fallback when real data sources are not connected.
It behaves identically to real connectors from the WebSocket client's perspective.
"""
from __future__ import annotations
import asyncio
import math
import random
import logging
from datetime import datetime, timezone
from connectors.base import BaseConnector, KpiReading

logger = logging.getLogger(__name__)


# ── Domain KPI definitions ─────────────────────────────────────────────────

DOMAIN_KPIS = {
    "airport": [
        {
            "component_id": "terminal_1",
            "kpi_name": "Passenger Flow",
            "unit": "pax/h",
            "base": 800,
            "amplitude": 600,      # peak variation
            "noise": 80,
            "interval": 5,         # seconds between updates
            "rules": {"orange": [1000, 1500], "red": [1500, 9999]},
            "rush_hours": [7, 8, 12, 17, 18],
        },
        {
            "component_id": "security_zone_1",
            "kpi_name": "Security Wait Time",
            "unit": "min",
            "base": 8,
            "amplitude": 25,
            "noise": 3,
            "interval": 10,
            "rules": {"orange": [15, 30], "red": [30, 999]},
            "rush_hours": [7, 8, 17, 18],
        },
        {
            "component_id": "gate_1",
            "kpi_name": "Gate Utilization",
            "unit": "%",
            "base": 45,
            "amplitude": 50,
            "noise": 5,
            "interval": 15,
            "rules": {"orange": [85, 95], "red": [95, 100]},
            "rush_hours": [7, 8, 12, 17, 18],
            "clamp": (0, 100),
        },
        {
            "component_id": "baggage_claim_1",
            "kpi_name": "Baggage Delay",
            "unit": "min",
            "base": 5,
            "amplitude": 15,
            "noise": 2,
            "interval": 20,
            "rules": {"orange": [10, 20], "red": [20, 999]},
            "rush_hours": [7, 8, 17, 18],
        },
        {
            "component_id": "checkin_desk_1",
            "kpi_name": "Queue Length",
            "unit": "persons",
            "base": 8,
            "amplitude": 35,
            "noise": 4,
            "interval": 8,
            "rules": {"orange": [20, 40], "red": [40, 999]},
            "rush_hours": [6, 7, 8, 17, 18],
        },
        {
            "component_id": "runway_1",
            "kpi_name": "Aircraft Movements",
            "unit": "mov/h",
            "base": 8,
            "amplitude": 22,
            "noise": 2,
            "interval": 30,
            "rules": {"orange": [25, 32], "red": [32, 999]},
            "rush_hours": [7, 8, 12, 17, 18],
        },
    ],
    "factory": [
        {
            "component_id": "cnc_machine_1",
            "kpi_name": "Machine Temperature",
            "unit": "°C",
            "base": 55,
            "amplitude": 35,
            "noise": 4,
            "interval": 5,
            "rules": {"orange": [60, 85], "red": [85, 999]},
            "rush_hours": [],
        },
        {
            "component_id": "assembly_station_1",
            "kpi_name": "Production Throughput",
            "unit": "u/h",
            "base": 90,
            "amplitude": 40,
            "noise": 5,
            "interval": 10,
            "rules": {"orange": [50, 80], "red": [0, 50]},
            "rush_hours": [],
            "invert_rush": True,  # throughput drops → bad
        },
        {
            "component_id": "hydraulic_press_1",
            "kpi_name": "Hydraulic Pressure",
            "unit": "bar",
            "base": 140,
            "amplitude": 60,
            "noise": 8,
            "interval": 8,
            "rules": {"orange": [170, 190], "red": [190, 999]},
            "rush_hours": [],
        },
        {
            "component_id": "quality_control_1",
            "kpi_name": "Quality Rate",
            "unit": "%",
            "base": 96,
            "amplitude": 10,
            "noise": 1,
            "interval": 15,
            "rules": {"orange": [70, 90], "red": [0, 70]},
            "rush_hours": [],
            "clamp": (0, 100),
        },
        {
            "component_id": "conveyor_belt_1",
            "kpi_name": "Belt Speed",
            "unit": "m/min",
            "base": 25,
            "amplitude": 10,
            "noise": 2,
            "interval": 5,
            "rules": {"orange": [10, 15], "red": [0, 10]},
            "rush_hours": [],
        },
    ],
    "warehouse": [
        {
            "component_id": "picking_zone_1",
            "kpi_name": "Pick Rate",
            "unit": "items/h",
            "base": 340,
            "amplitude": 120,
            "noise": 20,
            "interval": 10,
            "rules": {"orange": [200, 300], "red": [0, 200]},
            "rush_hours": [],
        },
        {
            "component_id": "storage_rack_1",
            "kpi_name": "Rack Fill Rate",
            "unit": "%",
            "base": 75,
            "amplitude": 20,
            "noise": 3,
            "interval": 30,
            "rules": {"orange": [85, 95], "red": [95, 100]},
            "rush_hours": [],
            "clamp": (0, 100),
        },
        {
            "component_id": "shipping_dock_1",
            "kpi_name": "Dock Utilization",
            "unit": "%",
            "base": 60,
            "amplitude": 35,
            "noise": 5,
            "interval": 15,
            "rules": {"orange": [80, 95], "red": [95, 100]},
            "rush_hours": [],
            "clamp": (0, 100),
        },
        {
            "component_id": "conveyor_1",
            "kpi_name": "Conveyor Throughput",
            "unit": "items/min",
            "base": 45,
            "amplitude": 20,
            "noise": 4,
            "interval": 5,
            "rules": {"orange": [20, 30], "red": [0, 20]},
            "rush_hours": [],
        },
    ],
}


class SimulatorConnector(BaseConnector):
    """
    Realistic KPI simulator. Emits data in real-time.
    Each KPI has its own update interval, noise model, and anomaly injection schedule.
    """
    name = "simulator"

    def __init__(self, config: dict):
        super().__init__(config)
        self.domain = config.get("domain", "airport")
        self.user_id = config.get("user_id", 1)
        self.anomaly_prob = config.get("anomaly_probability", 0.02)  # 2% chance per tick
        # State: random walk values per KPI
        self._current: dict[str, float] = {}

    def _rush_factor(self, kpi_def: dict) -> float:
        """Return 0..1 indicating how much of a rush hour boost to apply."""
        rush_hours = kpi_def.get("rush_hours", [])
        if not rush_hours:
            return 0.3  # slight variation based on time of day
        now_h = datetime.now().hour
        # Gaussian bump around each rush hour
        factor = max(
            math.exp(-((now_h - rh) ** 2) / 2)
            for rh in rush_hours
        )
        return factor

    def _next_value(self, kpi_def: dict) -> float:
        key = f"{kpi_def['component_id']}:{kpi_def['kpi_name']}"
        base = kpi_def["base"]
        amp = kpi_def["amplitude"]
        noise = kpi_def["noise"]
        clamp = kpi_def.get("clamp")

        # Initialise random walk
        if key not in self._current:
            self._current[key] = base

        # Rush-hour modulation
        rf = self._rush_factor(kpi_def)
        target = base + rf * amp

        # Anomaly injection
        if random.random() < self.anomaly_prob:
            target += random.choice([-1, 1]) * amp * random.uniform(1.2, 2.0)
            logger.debug(f"Anomaly injected for {key}")

        # Random walk toward target
        prev = self._current[key]
        step = (target - prev) * 0.15 + random.gauss(0, noise)
        value = prev + step

        # Clamp if defined
        if clamp:
            value = max(clamp[0], min(clamp[1], value))

        self._current[key] = value
        return round(value, 2)

    async def _run_loop(self):
        kpis = DOMAIN_KPIS.get(self.domain, DOMAIN_KPIS["airport"])
        # Run each KPI on its own sub-loop
        tasks = [
            asyncio.create_task(self._kpi_loop(k))
            for k in kpis
        ]
        try:
            await asyncio.gather(*tasks)
        except asyncio.CancelledError:
            for t in tasks:
                t.cancel()

    async def _kpi_loop(self, kpi_def: dict):
        interval = kpi_def.get("interval", 5)
        while self._running:
            try:
                value = self._next_value(kpi_def)
                status = self.compute_status(value, kpi_def.get("rules", {}))
                reading = KpiReading(twin_id=self.twin_id, 
                    user_id=self.user_id,
                    component_id=kpi_def["component_id"],
                    kpi_name=kpi_def["kpi_name"],
                    value=value,
                    unit=kpi_def["unit"],
                    timestamp=datetime.now(timezone.utc),
                    source="simulator",
                    status=status,
                    meta={"domain": self.domain},
                )
                await self.emit(reading)
                await asyncio.sleep(interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"SimulatorConnector error: {e}")
                await asyncio.sleep(2)
