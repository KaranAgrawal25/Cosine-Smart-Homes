/*  COSINE ESP32-CAM — MQTT Camera
    Captures JPEG frames and publishes them as base64 over MQTT.
    No ngrok, no local server needed.

    Board: AI Thinker ESP32-CAM
    Libraries needed:
      - PubSubClient  (Nick O'Leary)
      - base64        (Densaugeo/base64_encode  OR  Arduino built-in)
*/

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include "esp_camera.h"
#include "Base64.h"          // ArduinoBase64 library

// ── WiFi ──────────────────────────────────────────────────────────
const char* ssid     = "iPhone";
const char* password = "karan123";

// ── MQTT ──────────────────────────────────────────────────────────
const char* mqttServer = "broker.hivemq.com";
const int   mqttPort   = 1883;
const char* clientId   = "COSINE-ESP32CAM-001";

#define TOPIC_CAM_FRAME  "cosine/camera/frame"   // publishes base64 JPEG
#define TOPIC_CAM_STATUS "cosine/camera/status"  // online / offline
#define TOPIC_CAM_CMD    "cosine/camera/command" // "snapshot" or "stream_on" / "stream_off"

// ── Camera pins (AI Thinker ESP32-CAM) ───────────────────────────
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

WiFiClient   wifiClient;
PubSubClient mqtt(wifiClient);

bool streaming = true;
unsigned long lastFrameTime = 0;
const int FRAME_INTERVAL_MS = 500; // send a frame every 500ms (2 fps — safe for free broker)

// ── Camera init ───────────────────────────────────────────────────
bool initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Use smaller frame size to keep payload under MQTT 128KB limit
  config.frame_size   = FRAMESIZE_QVGA;  // 320x240 — ~8-15KB per frame
  config.jpeg_quality = 15;              // 0-63, lower = better quality
  config.fb_count     = 1;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    return false;
  }
  Serial.println("Camera init OK");
  return true;
}

// ── MQTT callback ─────────────────────────────────────────────────
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  msg.trim();

  if (String(topic) == TOPIC_CAM_CMD) {
    if (msg == "stream_on")  { streaming = true;  Serial.println("Stream ON"); }
    if (msg == "stream_off") { streaming = false; Serial.println("Stream OFF"); }
    if (msg == "snapshot")   { lastFrameTime = 0; } // force immediate frame
  }
}

// ── WiFi connect ──────────────────────────────────────────────────
void connectWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nWiFi OK: " + WiFi.localIP().toString());
}

// ── MQTT connect ──────────────────────────────────────────────────
void connectMQTT() {
  mqtt.setBufferSize(60000); // increase buffer for base64 frames (~20KB)
  while (!mqtt.connected()) {
    Serial.print("Connecting MQTT...");
    if (mqtt.connect(clientId, NULL, NULL, TOPIC_CAM_STATUS, 0, true, "offline")) {
      Serial.println("connected!");
      mqtt.publish(TOPIC_CAM_STATUS, "online", true);
      mqtt.subscribe(TOPIC_CAM_CMD);
    } else {
      Serial.print("failed rc="); Serial.println(mqtt.state());
      delay(3000);
    }
  }
}

// ── Capture and publish one frame ────────────────────────────────
void publishFrame() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) { Serial.println("Camera capture failed"); return; }

  // Encode JPEG bytes to base64
  String encoded = base64::encode(fb->buf, fb->len);
  esp_camera_fb_return(fb);

  Serial.printf("Frame: %d bytes → base64: %d chars\n", fb->len, encoded.length());

  // Publish — PubSubClient needs c_str and length
  bool ok = mqtt.publish(TOPIC_CAM_FRAME, (const uint8_t*)encoded.c_str(), encoded.length(), false);
  if (!ok) Serial.println("Publish failed — frame may be too large, try FRAMESIZE_QQVGA");
}

// ── SETUP ─────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== COSINE ESP32-CAM MQTT ===");

  if (!initCamera()) {
    Serial.println("Camera failed — halting");
    while (true) delay(1000);
  }

  connectWiFi();
  mqtt.setServer(mqttServer, mqttPort);
  mqtt.setCallback(mqttCallback);
  connectMQTT();
}

// ── LOOP ──────────────────────────────────────────────────────────
void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (!mqtt.connected())             connectMQTT();
  mqtt.loop();

  if (streaming && millis() - lastFrameTime > FRAME_INTERVAL_MS) {
    lastFrameTime = millis();
    publishFrame();
  }
}