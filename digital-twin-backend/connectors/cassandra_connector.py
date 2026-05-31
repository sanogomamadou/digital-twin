import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

from connectors.base import BaseConnector, KpiReading

class CassandraConnector(BaseConnector):
    name = "cassandra"

    def __init__(self, config: dict):
        super().__init__(config)
        self.user_id = config.get("user_id", 1)
        self.contact_points = config.get("db_url").split(',') # e.g. "127.0.0.1,127.0.0.2"
        self.keyspace = config.get("db_name")
        self.table_name = config.get("table_name")
        self.timestamp_col = config.get("timestamp_col", "timestamp")
        self.component_id_col = config.get("component_id_col", "component_id")

        for ident in [self.table_name, self.timestamp_col, self.component_id_col]:
            if not self.is_safe_identifier(str(ident)):
                raise ValueError(f"Invalid or unsafe identifier detected: {ident}")

        self._last_ts = None
        self._cluster = None
        self._session = None

    async def _run_loop(self):
        try:
            from cassandra.cluster import Cluster
        except ImportError:
            logger.error("cassandra-driver not installed.")
            return

        try:
            self._cluster = Cluster(self.contact_points)
            self._session = self._cluster.connect(self.keyspace)
        except Exception as e:
            logger.error(f"Cassandra connection failed: {e}")
            return

        while self._running:
            try:
                components_needed = set(kpi.get('component_id') for kpi in self.assignments.values() if kpi.get('component_id'))
                if not components_needed:
                    await asyncio.sleep(5)
                    continue

                for comp_id in components_needed:
                    if self._last_ts:
                        # Cassandra requires ALLOW FILTERING if not querying by partition key, 
                        # which might be bad for prod, but we do our best here.
                        query = f"SELECT * FROM {self.table_name} WHERE {self.component_id_col} = %s AND {self.timestamp_col} > %s ALLOW FILTERING"
                        rows = await asyncio.get_event_loop().run_in_executor(None, self._session.execute, query, [comp_id, self._last_ts])
                    else:
                        query = f"SELECT * FROM {self.table_name} WHERE {self.component_id_col} = %s LIMIT 10 ALLOW FILTERING"
                        rows = await asyncio.get_event_loop().run_in_executor(None, self._session.execute, query, [comp_id])

                    max_ts = self._last_ts
                    for row in rows:
                        row_dict = row._asdict()
                        row_ts = row_dict.get(self.timestamp_col)
                        
                        if row_ts and (not max_ts or row_ts > max_ts):
                            max_ts = row_ts

                        for kpi_id, mapping in self.assignments.items():
                            if mapping.get("component_id") != comp_id:
                                continue
                            
                            col_name = mapping.get("kpi_name")
                            if col_name in row_dict and row_dict[col_name] is not None:
                                val = float(row_dict[col_name])
                                rules = mapping.get("rules", {})
                                reading = KpiReading(twin_id=self.twin_id, 
                            user_id=self.user_id,
                            component_id=comp_id,
                                    kpi_name=mapping.get("kpi_name", col_name),
                                    value=val,
                                    unit=mapping.get("unit", ""),
                                    timestamp=datetime.now(timezone.utc),
                                    source="cassandra",
                                    status=self.compute_status(val, rules),
                                    meta={"interaction": mapping.get("interaction", "pulse")}
                                )
                                await self.emit(reading)

                    if max_ts:
                        self._last_ts = max_ts

            except Exception as e:
                logger.error(f"CassandraConnector poll error: {e}")
            
            await asyncio.sleep(5)

    async def stop(self):
        await super().stop()
        if self._cluster:
            self._cluster.shutdown()
