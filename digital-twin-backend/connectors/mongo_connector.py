import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

from connectors.base import BaseConnector, KpiReading

class MongoConnector(BaseConnector):
    name = "mongo"

    def __init__(self, config: dict):
        super().__init__(config)
        self.user_id = config.get("user_id", 1)
        self.db_url = config.get("db_url")
        self.db_name = config.get("db_name", "digital_twin")
        self.collection_name = config.get("table_name") # re-use table_name as collection_name
        self.timestamp_col = config.get("timestamp_col", "timestamp")
        self.component_id_col = config.get("component_id_col", "component_id")
        self._last_ts = None
        self._client = None

    async def _run_loop(self):
        try:
            from pymongo import MongoClient
        except ImportError:
            logger.error("pymongo not installed.")
            return

        try:
            self._client = MongoClient(self.db_url)
            db = self._client[self.db_name]
            collection = db[self.collection_name]
        except Exception as e:
            logger.error(f"MongoDB connection failed: {e}")
            return

        while self._running:
            try:
                components_needed = set(kpi.get('component_id') for kpi in self.assignments.values() if kpi.get('component_id'))
                if not components_needed:
                    await asyncio.sleep(5)
                    continue

                query = {self.component_id_col: {"$in": list(components_needed)}}
                if self._last_ts:
                    query[self.timestamp_col] = {"$gt": self._last_ts}

                # We use executor to avoid blocking the event loop
                cursor = await asyncio.get_event_loop().run_in_executor(None, lambda: list(collection.find(query).sort(self.timestamp_col, 1)))
                
                max_ts = self._last_ts
                for row in cursor:
                    comp_id = row.get(self.component_id_col)
                    row_ts = row.get(self.timestamp_col)
                    
                    if row_ts and (not max_ts or row_ts > max_ts):
                        max_ts = row_ts

                    for kpi_id, mapping in self.assignments.items():
                        if mapping.get("component_id") != comp_id:
                            continue
                        
                        col_name = mapping.get("kpi_name")
                        if col_name in row and row[col_name] is not None:
                            val = float(row[col_name])
                            rules = mapping.get("rules", {})
                            reading = KpiReading(twin_id=self.twin_id, 
                            user_id=self.user_id,
                            component_id=comp_id,
                                kpi_name=mapping.get("kpi_name", col_name),
                                value=val,
                                unit=mapping.get("unit", ""),
                                timestamp=datetime.now(timezone.utc),
                                source="mongo",
                                status=self.compute_status(val, rules),
                                meta={"interaction": mapping.get("interaction", "pulse")}
                            )
                            await self.emit(reading)

                if max_ts:
                    self._last_ts = max_ts

            except Exception as e:
                logger.error(f"MongoConnector poll error: {e}")
            
            await asyncio.sleep(5)

    async def stop(self):
        await super().stop()
        if self._client:
            self._client.close()
