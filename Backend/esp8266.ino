#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <Servo.h>
#include <DHT.h>

// ---------------- Pins ----------------
#define DHTPIN          D2
#define DHTTYPE         DHT11
#define LIGHT_SERVO_PIN D5
#define FAN_SERVO_PIN   D7
#define IR_PIN          D1
#define BUZZER_PIN      D6

// ---------------- WiFi ----------------
const char* ssid     = "iPhone";
const char* password = "karan123";

// ---------------- MQTT Broker ----------------
// Free public broker — no account needed
const char* mqttServer = "broker.hivemq.com";
const int   mqttPort   = 1883;
const char* clientId   = "COSINE-ESP8266-001"; // must be unique

// ---------------- MQTT Topics ----------------
// Dashboard publishes commands TO these:
#define TOPIC_FAN_CMD   "cosine/fan/command"
#define TOPIC_LIGHT_CMD "cosine/light/command"

// ESP publishes status TO these (dashboard reads):
#define TOPIC_FAN_STATE   "cosine/fan/state"
#define TOPIC_LIGHT_STATE "cosine/light/state"
#define TOPIC_SENSOR      "cosine/sensor"
#define TOPIC_MOTION      "cosine/motion"
#define TOPIC_STATUS      "cosine/status"

// ---------------- Limits ----------------
float tempLimit = 30.0;
float humLimit  = 70.0;

// ---------------- Objects ----------------
DHT           dht(DHTPIN, DHTTYPE);
Servo         lightServo;
Servo         fanServo;
WiFiClient    wifiClient;
PubSubClient  mqtt(wifiClient);

// ---------------- States ----------------
int  lightState    = 0;
int  fanState      = 0;
int  motionFlag    = 0;
unsigned long lastBuzzerTime = 0;
unsigned long lastSensorTime = 0;

// ── Buzzer ───────────────────────────────
void buzzerAlarm() {
  tone(BUZZER_PIN, 3000); delay(200);
  noTone(BUZZER_PIN);     delay(200);
  tone(BUZZER_PIN, 3000); delay(200);
  noTone(BUZZER_PIN);
}

// ── Fan helpers ──────────────────────────
void setFan(bool on) {
  fanServo.write(on ? 43 : 0);
  fanState = on ? 1 : 0;
  mqtt.publish(TOPIC_FAN_STATE, on ? "ON" : "OFF", true); // retain=true
  Serial.println(on ? "Fan ON" : "Fan OFF");
}

// ── Light helpers ────────────────────────
void setLight(bool on) {
  lightServo.write(on ? 0 : 48);
  lightState = on ? 1 : 0;
  mqtt.publish(TOPIC_LIGHT_STATE, on ? "ON" : "OFF", true); // retain=true
  Serial.println(on ? "Light ON" : "Light OFF");
}

// ── MQTT message received ────────────────
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  msg.trim();
  msg.toUpperCase();

  Serial.print("MQTT ["); Serial.print(topic); Serial.print("]: "); Serial.println(msg);

  if (String(topic) == TOPIC_FAN_CMD) {
    if (msg == "ON")  setFan(true);
    if (msg == "OFF") setFan(false);
  }
  if (String(topic) == TOPIC_LIGHT_CMD) {
    if (msg == "ON")  setLight(true);
    if (msg == "OFF") setLight(false);
  }
}

// ── WiFi connect ─────────────────────────
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.println("\nWiFi Connected! IP: " + WiFi.localIP().toString());
}

// ── MQTT connect ─────────────────────────
void connectMQTT() {
  while (!mqtt.connected()) {
    Serial.print("Connecting to MQTT...");
    if (mqtt.connect(clientId, NULL, NULL, TOPIC_STATUS, 0, true, "offline")) {
      Serial.println("connected!");
      mqtt.publish(TOPIC_STATUS, "online", true);
      mqtt.subscribe(TOPIC_FAN_CMD);
      mqtt.subscribe(TOPIC_LIGHT_CMD);
      // Republish current states so dashboard syncs immediately
      mqtt.publish(TOPIC_FAN_STATE,   fanState   ? "ON" : "OFF", true);
      mqtt.publish(TOPIC_LIGHT_STATE, lightState ? "ON" : "OFF", true);
    } else {
      Serial.print("failed rc="); Serial.println(mqtt.state());
      delay(3000);
    }
  }
}

// ── Publish sensor data ──────────────────
void publishSensor() {
  float temp = dht.readTemperature();
  float hum  = dht.readHumidity();
  if (isnan(temp)) temp = 0.0;
  if (isnan(hum))  hum  = 0.0;

  String json = "{";
  json += "\"temp\":"  + String(temp, 1) + ",";
  json += "\"hum\":"   + String(hum,  1) + ",";
  json += "\"fan\":\""   + String(fanState   ? "ON" : "OFF") + "\",";
  json += "\"light\":\"" + String(lightState ? "ON" : "OFF") + "\"";
  json += "}";

  mqtt.publish(TOPIC_SENSOR, json.c_str());
  Serial.println("Sensor: " + json);

  // Temperature alarm
  if (temp > tempLimit || hum > humLimit) {
    if (millis() - lastBuzzerTime > 5000) {
      Serial.println("ALERT: High Temp/Humidity!");
      buzzerAlarm();
      lastBuzzerTime = millis();
    }
  }
}

// ── SETUP ────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n=== COSINE MQTT STARTING ===");

  dht.begin();

  lightServo.attach(LIGHT_SERVO_PIN);
  fanServo.attach(FAN_SERVO_PIN);
  lightServo.write(48); // off position
  fanServo.write(0);    // off position

  pinMode(IR_PIN,    INPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  connectWiFi();

  mqtt.setServer(mqttServer, mqttPort);
  mqtt.setCallback(mqttCallback);
  mqtt.setKeepAlive(30);

  connectMQTT();
}

// ── LOOP ─────────────────────────────────
void loop() {
  // Reconnect if dropped
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (!mqtt.connected())             connectMQTT();
  mqtt.loop();

  // Publish sensor every 3 seconds
  if (millis() - lastSensorTime > 3000) {
    lastSensorTime = millis();
    publishSensor();
  }

  // Motion detection
  int motion = digitalRead(IR_PIN);
  if (motion == LOW && motionFlag == 0) {
    motionFlag = 1;
    Serial.println("Motion Detected!");
    mqtt.publish(TOPIC_MOTION, "DETECTED");
    if (!lightState) setLight(true);
    if (!fanState)   setFan(true);
  }
  if (motion == HIGH) motionFlag = 0;
}