/**
 * Digital Twin FM — ESP32 Sensor Firmware
 *
 * Publishes temperature & humidity readings to the Mosquitto MQTT broker
 * at topics like `sensors/{sensorId}/reading`.
 *
 * Hardware: ESP32 DevKit V1 + DHT22
 * Wiring:
 *   DHT22 DATA → GPIO 4
 *   DHT22 VCC  → 3.3 V
 *   DHT22 GND  → GND
 *
 * Configure via platformio.ini:
 *   [env:esp32dev]
 *   platform = espressif32
 *   board = esp32dev
 *   framework = arduino
 *   lib_deps =
 *     bblanchon/ArduinoJson @ ^6.21
 *     knolleary/PubSubClient @ ^2.8
 *     adafruit/DHT sensor library @ ^1.4
 *
 * Or open the .ino in the Arduino IDE and install the libraries above.
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ── WiFi ────────────────────────────────────────────────────────────
const char *WIFI_SSID     = "YOUR_WIFI_SSID";
const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// ── MQTT ────────────────────────────────────────────────────────────
const char *MQTT_BROKER   = "YOUR_SERVER_IP";   // IP of the host running docker compose
const int   MQTT_PORT     = 1883;
const char *MQTT_TOPIC    = "sensors/esp32-01/reading";

// ── Sensor ──────────────────────────────────────────────────────────
#define DHTPIN            4
#define DHTTYPE           DHT22
const char *SENSOR_ID     = "esp32-01";
const char *ASSET_ID      = "demo-env-sensor-01";
const char *UNIT_TEMP     = "celsius";
const char *UNIT_HUM      = "percent";

// ── Globals ─────────────────────────────────────────────────────────
WiFiClient    wifiClient;
PubSubClient  mqttClient(wifiClient);
DHT           dht(DHTPIN, DHTTYPE);

unsigned long lastSend = 0;
const unsigned long SEND_INTERVAL_MS = 30_000;  // every 30 seconds

// ── WiFi connect ────────────────────────────────────────────────────
void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" OK");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}

// ── MQTT reconnect ──────────────────────────────────────────────────
void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("MQTT connecting…");
    if (mqttClient.connect("esp32-dtfm")) {
      Serial.println(" OK");
    } else {
      Serial.print(" failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" retry in 5s");
      delay(5000);
    }
  }
}

// ── Publish sensor reading ──────────────────────────────────────────
void publishReading(float temperature, float humidity) {
  StaticJsonDocument<256> doc;

  doc["sensorId"]    = SENSOR_ID;
  doc["assetId"]     = ASSET_ID;
  doc["timestamp"]   = "";   // server fills on arrival; set ISO string if you have RTC
  doc["unit"]        = UNIT_TEMP;
  doc["value"]       = temperature;
  doc["quality"]     = "good";

  char buffer[256];
  size_t n = serializeJson(doc, buffer);
  bool ok = mqttClient.publish(MQTT_TOPIC, buffer, n);
  Serial.printf("Publish temp  %.1f°C → %s [%s]\n", temperature, MQTT_TOPIC, ok ? "OK" : "FAIL");

  // Second reading for humidity
  doc["unit"]  = UNIT_HUM;
  doc["value"] = humidity;
  n = serializeJson(doc, buffer);
  ok = mqttClient.publish(MQTT_TOPIC, buffer, n);
  Serial.printf("Publish hum   %.1f%%  → %s [%s]\n", humidity, MQTT_TOPIC, ok ? "OK" : "FAIL");
}

// ── Setup ───────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== DTFM ESP32 Sensor ===");

  dht.begin();
  connectWiFi();

  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setKeepAlive(60);
}

// ── Loop ────────────────────────────────────────────────────────────
void loop() {
  if (!mqttClient.connected()) reconnectMQTT();
  mqttClient.loop();

  unsigned long now = millis();
  if (now - lastSend >= SEND_INTERVAL_MS) {
    lastSend = now;

    float h = dht.readHumidity();
    float t = dht.readTemperature();

    if (isnan(h) || isnan(t)) {
      Serial.println("DHT read failed — check wiring");
      return;
    }

    publishReading(t, h);
  }
}
