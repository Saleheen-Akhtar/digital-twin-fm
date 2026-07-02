# ESP32 / MQTT Integration

The ingestion service subscribes to MQTT topics from IoT devices and forwards
valid readings to the real-time pipeline.

## Topic structure

```
sensors/{sensorId}/reading
```

- `{sensorId}` — unique ID for the sensor/device (e.g. `esp32-01`, `env-sensor-l2`)
- The ingestion service subscribes to `sensors/+/reading` (all sensors under that pattern)

## Payload format

All readings must be valid JSON matching this schema:

```json
{
  "sensorId":  "esp32-01",
  "assetId":   "demo-env-sensor-01",
  "timestamp": "2026-07-02T12:00:00.000Z",
  "value":     24.5,
  "unit":      "celsius",
  "quality":   "good"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `sensorId` | string | yes | Unique sensor identifier |
| `assetId` | string | yes | FK to an Asset record in the DB |
| `timestamp` | string | no | ISO 8601. Server fills on arrival if omitted |
| `value` | number | yes | Float sensor reading |
| `unit` | string | no | Human-readable unit (celsius, percent, rpm, kW, etc.) |
| `quality` | `"good"\|"uncertain"\|"bad"` | no | Defaults to `"good"` |

Invalid payloads are logged as a warning and dropped.

## ESP32 firmware

Complete Arduino firmware is in [`docs/esp32-firmware/`](esp32-firmware/).

### Hardware required

- ESP32 DevKit V1 (or any ESP32 board)
- DHT22 temperature/humidity sensor
- Jumper wires, breadboard
- USB power supply

### Wiring

```
DHT22 DATA → GPIO 4
DHT22 VCC  → 3.3 V
DHT22 GND  → GND
```

### Setup

1. Open `docs/esp32-firmware/dtfm-esp32-sensor.ino` in Arduino IDE (or PlatformIO).
2. Install libraries:
   - ArduinoJson (bblanchon)
   - PubSubClient (knolleary)
   - DHT sensor library (adafruit)
3. Update these constants at the top of the sketch:
   - `WIFI_SSID` / `WIFI_PASSWORD`
   - `MQTT_BROKER` — the IP of the host running `docker compose`
4. Flash the ESP32.
5. Open Serial Monitor (115200 baud) to verify connectivity.

### How it works

1. Connects to WiFi and the MQTT broker.
2. Reads temperature + humidity from the DHT22 every 30 seconds.
3. Publishes two separate messages to `sensors/esp32-01/reading`.
4. The ingestion service receives them, validates, and pushes to Redis →
   api-gateway → frontend WebSockets.

### Customisation

- Change `SENSOR_ID` and `ASSET_ID` to match your sensor registration in the DB.
- Adjust `SEND_INTERVAL_MS` for faster/slower publishing.
- Replace DHT22 with any sensor (BME280, SHT3x, analog light sensor, etc.)
  by modifying the `publishReading()` function.

## Testing without hardware

Publish a test reading to the Mosquitto broker manually:

```bash
# Using mosquitto_pub (install from https://mosquitto.org/download/)
mosquitto_pub -h localhost -p 1883 -t "sensors/test-01/reading" -m '{
  "sensorId": "test-01",
  "assetId": "demo-env-sensor-01",
  "value": 23.5,
  "unit": "celsius"
}'
```

Or use any MQTT client (MQTTX, Node-RED, Python paho-mqtt).
