"""
Postgres Connector — polls the target PostgreSQL table for new sensor data,
evaluates user-defined math formulas, applies thresholds, and emits KPIs.
"""
from __future__ import annotations
import asyncio
import logging
import os
from datetime import datetime, timezone
import psycopg2
from psycopg2.extras import RealDictCursor
from simpleeval import simple_eval, NameNotDefined

from connectors.base import BaseConnector, KpiReading

logger = logging.getLogger(__name__)

_instance = None

def get_postgres_connector():
    return _instance

class PostgresConnector(BaseConnector):
    name = "postgres"

    def __init__(self, config: dict):
        super().__init__(config)
        global _instance
        _instance = self
        
        self.db_url = config.get("db_url") or os.getenv("TELEMETRY_DB_URL", "postgresql://postgres:postgrespassword@localhost:5433/telemetry_db")
        self.assignments = config.get("assignments", {})
        self.domain = config.get("domain", "factory") 
        self.table_name = config.get("table_name")
        self.timestamp_col = config.get("timestamp_col", "timestamp")
        self.component_id_col = config.get("component_id_col", "component_id")
        self.poll_interval = float(config.get("poll_interval", 2.0))
        self.user_id = config.get("user_id", 1)
        self.last_timestamps = {}  # Keep track of last seen row per component

    def update_assignments(self, assignments: dict, domain: str, db_url: str = None, table_name: str = None, timestamp_col: str = None, component_id_col: str = None):
        self.assignments = assignments
        self.domain = domain
        if db_url:
            self.db_url = db_url
        if table_name:
            self.table_name = table_name
        if timestamp_col:
            self.timestamp_col = timestamp_col
        if component_id_col:
            self.component_id_col = component_id_col
        logger.info(f"PostgresConnector: updated for domain {domain} with {len(assignments)} KPIs")

    def get_table_name(self):
        return self.table_name or f"{self.domain}_data"

    def _get_connection(self):
        try:
            return psycopg2.connect(self.db_url)
        except Exception as e:
            logger.error(f"PostgresConnector failed to connect: {e}")
            return None

    def _evaluate_formula(self, formula: str, row: dict) -> float:
        safe_row = {}
        for k, v in row.items():
            if isinstance(v, datetime):
                safe_row[k] = v.timestamp()
            else:
                safe_row[k] = v
                
        try:
            val = simple_eval(formula, names=safe_row)
            return float(val)
        except NameNotDefined as e:
            # Column referenced in formula doesn't exist in this table — expected
            # when a KPI belongs to a different domain/table than the current one.
            logger.debug(f"Formula '{formula}' skipped — column not in row: {e}")
            return 0.0
        except Exception as e:
            logger.warning(f"Formula evaluation failed for '{formula}': {e}")
            return 0.0

    async def _run_loop(self):
        logger.info(f"PostgresConnector: Polling {self.db_url} every {self.poll_interval}s")
        outage_logged = False
        
        while self._running:
            await asyncio.sleep(self.poll_interval)
            
            # logger.info(f"PostgresConnector: Polling with {len(self.assignments)} assignments")
            if not self.assignments:
                continue

            conn = self._get_connection()
            if not conn:
                if not outage_logged:
                    logger.warning("PostgresConnector: Waiting for DB connection...")
                    outage_logged = True
                continue
                
            outage_logged = False
            cursor = None  # always initialise so finally block is safe

            try:
                cursor = conn.cursor(cursor_factory=RealDictCursor)
                table_name = self.get_table_name()
                
                # Fetch latest row for EACH mapped component uniquely
                components_needed = set(kpi.get('component_id') for kpi in self.assignments.values() if kpi.get('component_id'))
                
                for comp_id in components_needed:
                    from psycopg2 import sql
                    
                    query = sql.SQL("SELECT * FROM {table} WHERE {comp_col} = %s").format(
                        table=sql.Identifier(table_name or "factory_data"),
                        comp_col=sql.Identifier(self.component_id_col or "component_id")
                    )
                    params = [comp_id]
                    
                    last_ts = self.last_timestamps.get(comp_id)
                    if last_ts:
                        query += sql.SQL(" AND {ts_col} > %s").format(
                            ts_col=sql.Identifier(self.timestamp_col or "timestamp")
                        )
                        params.append(last_ts)
                        
                    query += sql.SQL(" ORDER BY {ts_col} DESC LIMIT 1").format(
                        ts_col=sql.Identifier(self.timestamp_col or "timestamp")
                    )
                    
                    cursor.execute(query, tuple(params))
                    row = cursor.fetchone()
                    
                    if row:
                        # logger.info(f"PostgresConnector: Found row for {comp_id}")
                        self.last_timestamps[comp_id] = row.get(self.timestamp_col)
                        
                        # Process assigned KPIs for THIS specific component
                        comp_kpis = {k: v for k, v in self.assignments.items() if v.get('component_id') == comp_id}
                        
                        for kpi_id, kpi_config in comp_kpis.items():
                            formula = kpi_config.get("formula", "")
                            value = self._evaluate_formula(formula, dict(row))
                            rules = kpi_config.get("rules", {})
                            status = self.compute_status(value, rules)
                            
                            ts = row.get(self.timestamp_col) or datetime.now(timezone.utc)
                            if ts.tzinfo is None:
                                ts = ts.replace(tzinfo=timezone.utc)
                                
                            reading = KpiReading(twin_id=self.twin_id, 
                                user_id=self.user_id,
                                component_id=comp_id,
                                kpi_name=kpi_config.get("kpi_name", "KPI"),
                                value=round(value, 3),
                                unit=kpi_config.get("unit", ""),
                                timestamp=ts,
                                source="postgres",
                                status=status,
                                meta={
                                    "formula": formula,
                                    "interaction": kpi_config.get("interaction", "pulse"),
                                    "rules": rules
                                }
                            )
                            await self.emit(reading)
                            logger.info(f"Emitted KPI {kpi_config.get('kpi_name')} = {value} for {comp_id}")
                            
            except Exception as e:
                logger.error(f"PostgresConnector poll error: {e}")
            finally:
                if cursor:
                    cursor.close()
                conn.close()
