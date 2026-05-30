import asyncio
import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

from connectors.base import BaseConnector, KpiReading

class KafkaConnector(BaseConnector):
    name = "kafka"

    def __init__(self, config: dict):
        super().__init__(config)
        self.user_id = config.get("user_id", 1)
        self.bootstrap_servers = config.get("db_url") # Map to bootstrap servers
        self.topic = config.get("table_name") # Map to topic
        self.timestamp_col = config.get("timestamp_col", "timestamp")
        self.component_id_col = config.get("component_id_col", "component_id")
        self._consumer = None

    async def _run_loop(self):
        try:
            from confluent_kafka import Consumer
        except ImportError:
            logger.error("confluent-kafka not installed.")
            return

        conf = {
            'bootstrap.servers': self.bootstrap_servers,
            'group.id': 'digital_twin_group',
            'auto.offset.reset': 'latest'
        }

        try:
            self._consumer = Consumer(conf)
            self._consumer.subscribe([self.topic])
        except Exception as e:
            logger.error(f"Kafka connection failed: {e}")
            return

        while self._running:
            try:
                # Use executor to avoid blocking the asyncio loop with poll
                msg = await asyncio.get_event_loop().run_in_executor(None, self._consumer.poll, 1.0)
                if msg is None:
                    continue
                if msg.error():
                    logger.error(f"Kafka Consumer error: {msg.error()}")
                    continue

                payload = json.loads(msg.value().decode('utf-8'))
                comp_id = payload.get(self.component_id_col)

                if not comp_id:
                    continue

                for kpi_id, mapping in self.assignments.items():
                    if mapping.get("component_id") != comp_id:
                        continue
                    
                    col_name = mapping.get("kpi_name")
                    if col_name in payload and payload[col_name] is not None:
                        val = float(payload[col_name])
                        rules = mapping.get("rules", {})
                        reading = KpiReading(twin_id=self.twin_id, 
                            user_id=self.user_id,
                            component_id=comp_id,
                            kpi_name=mapping.get("kpi_name", col_name),
                            value=val,
                            unit=mapping.get("unit", ""),
                            timestamp=datetime.now(timezone.utc),
                            source="kafka",
                            status=self.compute_status(val, rules),
                            meta={"interaction": mapping.get("interaction", "pulse")}
                        )
                        await self.emit(reading)

            except Exception as e:
                logger.error(f"KafkaConnector poll error: {e}")
                await asyncio.sleep(2)

    async def stop(self):
        await super().stop()
        if self._consumer:
            self._consumer.close()
