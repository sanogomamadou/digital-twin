"""
File Connector — watches the uploaded source file for new rows and streams them.

Modes:
  1. TAIL mode  — monitors file for appended rows (production: file grows in real-time)
  2. REPLAY mode — replays all rows with configurable speed (demo / testing)

The connector reads the column→component assignments and emits KpiReadings
for each assigned column in every new row.
"""
from __future__ import annotations
import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Optional
import pandas as pd
from connectors.base import BaseConnector, KpiReading

logger = logging.getLogger(__name__)

# Singleton reference so routers can call update_assignments()
_instance: Optional["FileConnector"] = None


def get_file_connector() -> Optional["FileConnector"]:
    return _instance


class FileConnector(BaseConnector):
    """
    Watches the uploaded source file.
    - In TAIL mode: polls for new rows appended to the file
    - In REPLAY mode: replays existing rows at configurable speed
    """
    name = "file"

    def __init__(self, config: dict):
        super().__init__(config)
        self.user_id = config.get("user_id", 1)
        global _instance
        _instance = self

        self.file_path: Optional[str] = config.get("file_path")
        self.assignments: dict = config.get("assignments", {})
        self.mode: str = config.get("mode", "replay")       # "tail" | "replay"
        self.replay_speed: float = config.get("replay_speed", 1.0)  # rows/sec in replay
        self.poll_interval: float = config.get("poll_interval", 2.0) # seconds for tail
        self._last_row: int = 0
        self._df: Optional[pd.DataFrame] = None

    def update_assignments(self, assignments: dict):
        """Called by the data source router when user saves new assignments."""
        self.assignments = assignments
        logger.info(f"FileConnector: assignments updated — {len(assignments)} columns mapped")

    def set_source(self, file_path: str):
        self.file_path = file_path
        self._last_row = 0
        self._df = None
        self.enabled = True

    def _load(self) -> pd.DataFrame:
        if not self.file_path or not os.path.exists(self.file_path):
            return pd.DataFrame()
        try:
            if self.file_path.endswith((".xlsx", ".xls")):
                return pd.read_excel(self.file_path)
            return pd.read_csv(self.file_path)
        except Exception as e:
            logger.error(f"FileConnector read error: {e}")
            return pd.DataFrame()

    def _detect_ts_col(self, df: pd.DataFrame) -> Optional[str]:
        for col in df.columns:
            if any(k in col.lower() for k in ["time", "date", "ts", "timestamp"]):
                return col
        return None

    def _row_to_readings(self, row: pd.Series, ts_col: Optional[str]) -> list[KpiReading]:
        readings = []
        try:
            ts = pd.to_datetime(row[ts_col]) if ts_col and ts_col in row else datetime.now(timezone.utc)
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
        except Exception:
            ts = datetime.now(timezone.utc)

        for col, assignment in self.assignments.items():
            if col not in row.index:
                continue
            try:
                value = float(row[col])
            except (ValueError, TypeError):
                continue

            rules = assignment.get("rules", {})
            status = self.compute_status(value, rules)

            readings.append(KpiReading(twin_id=self.twin_id, user_id=self.user_id, component_id=assignment["component_id"],
                kpi_name=assignment["kpi_name"],
                value=round(value, 3),
                unit=assignment.get("unit", ""),
                timestamp=ts,
                source="file",
                status=status,
                meta={
                    "column": col,
                    "fileName": os.path.basename(self.file_path or ""),
                    "rules": rules,                   # pass thresholds to frontend
                    "componentName": assignment.get("component_name", ""),
                },
            ))
        return readings

    async def _run_loop(self):
        # Wait for a source file to be available
        if not self.file_path:
            logger.info("FileConnector: waiting for source file to be uploaded…")
            while self._running and not self.file_path:
                await asyncio.sleep(2)
            if not self._running:
                return

        if self.mode == "replay":
            await self._replay_loop()
        else:
            await self._tail_loop()

    async def _replay_loop(self):
        """Replay all rows in the file, then loop back to beginning."""
        while self._running:
            df = self._load()
            if df.empty:
                logger.warning("FileConnector: source file is empty or missing")
                await asyncio.sleep(5)
                continue

            # Wait for assignments if not yet configured
            if not self.assignments:
                logger.info("FileConnector REPLAY: waiting for column assignments…")
                await asyncio.sleep(3)
                continue

            ts_col = self._detect_ts_col(df)
            logger.info(f"FileConnector REPLAY: {len(df)} rows, {len(self.assignments)} assigned cols")

            interval = 1.0 / max(self.replay_speed, 0.1)

            for _, row in df.iterrows():
                if not self._running:
                    return
                readings = self._row_to_readings(row, ts_col)
                for r in readings:
                    await self.emit(r)
                await asyncio.sleep(interval)

            logger.info("FileConnector REPLAY: completed one pass — restarting loop")

    async def _tail_loop(self):
        """Poll file for new rows (for files growing in real-time)."""
        logger.info(f"FileConnector TAIL: polling {self.file_path} every {self.poll_interval}s")
        df = self._load()
        ts_col = self._detect_ts_col(df)
        self._last_row = len(df)

        while self._running:
            await asyncio.sleep(self.poll_interval)
            try:
                new_df = self._load()
                if len(new_df) > self._last_row:
                    new_rows = new_df.iloc[self._last_row:]
                    ts_col = self._detect_ts_col(new_df)
                    for _, row in new_rows.iterrows():
                        if not self.assignments:
                            break
                        readings = self._row_to_readings(row, ts_col)
                        for r in readings:
                            await self.emit(r)
                    self._last_row = len(new_df)
                    logger.info(f"FileConnector TAIL: emitted {len(new_rows)} new rows")
            except Exception as e:
                logger.error(f"FileConnector tail error: {e}")
