import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

from connectors.base import BaseConnector, KpiReading

class DatabricksConnector(BaseConnector):
    name = "databricks"

    def __init__(self, config: dict):
        super().__init__(config)
        self.user_id = config.get("user_id", 1)
        self.server_hostname = config.get("db_url") # Map to server_hostname
        self.http_path = config.get("db_name")      # Map to http_path
        self.access_token = config.get("access_token")
        self.table_name = config.get("table_name")
        self.timestamp_col = config.get("timestamp_col", "timestamp")
        self.component_id_col = config.get("component_id_col", "component_id")
        self._last_ts = None
        self._connection = None

    async def _run_loop(self):
        try:
            from databricks import sql
        except ImportError:
            logger.error("databricks-sql-connector not installed.")
            return

        try:
            def connect():
                return sql.connect(
                    server_hostname=self.server_hostname,
                    http_path=self.http_path,
                    access_token=self.access_token
                )
            self._connection = await asyncio.get_event_loop().run_in_executor(None, connect)
        except Exception as e:
            logger.error(f"Databricks connection failed: {e}")
            return

        while self._running:
            try:
                components_needed = set(kpi.get('component_id') for kpi in self.assignments.values() if kpi.get('component_id'))
                if not components_needed:
                    await asyncio.sleep(5)
                    continue

                for comp_id in components_needed:
                    def execute_query(comp_id, last_ts):
                        with self._connection.cursor() as cursor:
                            if last_ts:
                                query = f"SELECT * FROM {self.table_name} WHERE {self.component_id_col} = ? AND {self.timestamp_col} > ?"
                                cursor.execute(query, (comp_id, last_ts))
                            else:
                                query = f"SELECT * FROM {self.table_name} WHERE {self.component_id_col} = ? ORDER BY {self.timestamp_col} DESC LIMIT 10"
                                cursor.execute(query, (comp_id,))
                            
                            columns = [col[0] for col in cursor.description]
                            rows = cursor.fetchall()
                            return columns, rows
                    
                    columns, rows = await asyncio.get_event_loop().run_in_executor(None, execute_query, comp_id, self._last_ts)
                    
                    max_ts = self._last_ts
                    for row in rows:
                        row_dict = dict(zip(columns, row))
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
                                    source="databricks",
                                    status=self.compute_status(val, rules),
                                    meta={"interaction": mapping.get("interaction", "pulse")}
                                )
                                await self.emit(reading)

                    if max_ts:
                        self._last_ts = max_ts

            except Exception as e:
                logger.error(f"DatabricksConnector poll error: {e}")
            
            await asyncio.sleep(5)

    async def stop(self):
        await super().stop()
        if self._connection:
            self._connection.close()
