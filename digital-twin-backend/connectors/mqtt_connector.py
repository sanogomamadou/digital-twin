"""
MQTT Connector — subscribes to a broker and forwards sensor readings.
Used for real IoT sensors (airport equipment, factory machines, warehouse scanners).

Topic convention:
  dt/{domain}/{component_id}/{kpi_name}
  e.g. dt/airport/terminal_1/passenger_flow  → payload: {"value": 1240, "unit": "pax/h"}

Install: pip install paho-mqtt (already in requirements)
Configure in .env:
  MQTT_ENABLED=true
  MQTT_BROKER=localhost
  MQTT_PORT=1883
  MQTT_TOPIC_PREFIX=dt/#
  MQTT_USERNAME=          (optional)
  MQTT_PASSWORD=          (optional)
"""
from __future__ import annotations
import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from connectors.base import BaseConnector, KpiReading

logger = logging.getLogger(__name__)

MQTT_ENABLED  = os.getenv("MQTT_ENABLED", "false").lower() == "true"
MQTT_BROKER   = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT     = int(os.getenv("MQTT_PORT", "1883"))
MQTT_PREFIX   = os.getenv("MQTT_TOPIC_PREFIX", "dt/#")
MQTT_USER     = os.getenv("MQTT_USERNAME", "")
MQTT_PASS     = os.getenv("MQTT_PASSWORD", "")


class MqttConnector(BaseConnector):
    name = "mqtt"

    def __init__(self, config: dict):
        super().__init__(config)
        self.user_id = config.get("user_id", 1)
        self.broker = config.get("db_url", "localhost")
        self.port = int(config.get("port", 1883))
        self.topic_prefix = config.get("table_name", "dt/#")
        self.username = config.get("username", "")
        self.password = config.get("password", "")
        self._loop: asyncio.AbstractEventLoop | None = None
        self._client = None

    async def _run_loop(self):
        try:
            import paho.mqtt.client as mqtt
        except ImportError:
            logger.warning("paho-mqtt not installed. Run: pip install paho-mqtt")
            return

        self._loop = asyncio.get_event_loop()

        def on_connect(client, userdata, flags, rc):
            if rc == 0:
                logger.info(f"✅ MQTT connected to {self.broker}:{self.port}")
                client.subscribe(self.topic_prefix)
            else:
                logger.error(f"MQTT connection failed: rc={rc}")

        def on_message(client, userdata, msg):
            """Parse topic dt/{domain}/{component_id}/{kpi_name} and emit reading."""
            try:
                parts = msg.topic.split("/")
                # Expected: dt / domain / component_id / kpi_name
                if len(parts) < 4:
                    return
                _, domain, component_id, kpi_name = parts[:4]
                payload = json.loads(msg.payload.decode())
                value = float(payload.get("value", 0))
                unit  = str(payload.get("unit", ""))
                rules = payload.get("rules", {})

                reading = KpiReading(
                            user_id=self.user_id,
                            component_id=component_id,
                    kpi_name=kpi_name.replace("_", " ").title(),
                    value=value,
                    unit=unit,
                    timestamp=datetime.now(timezone.utc),
                    source="mqtt",
                    status=self.compute_status(value, rules),
                    meta={"topic": msg.topic, "domain": domain},
                )
                # Thread-safe: schedule coroutine from callbacks
                asyncio.run_coroutine_threadsafe(self.emit(reading), self._loop)
            except Exception as e:
                logger.error(f"MQTT message parse error: {e} — topic={msg.topic}")

        client = mqtt.Client()
        if self.username:
            client.username_pw_set(self.username, self.password)
        client.on_connect = on_connect
        client.on_message = on_message

        try:
            client.connect(self.broker, self.port, keepalive=60)
            client.loop_start()
            self._client = client
            # Keep alive
            while self._running:
                await asyncio.sleep(1)
        except Exception as e:
            logger.error(f"MQTT connector error: {e}")
        finally:
            if self._client:
                self._client.loop_stop()
                self._client.disconnect()

    async def stop(self):
        await super().stop()
        if self._client:
            self._client.loop_stop()
            self._client.disconnect()
