# COSINE — Control of Systems with Intelligent Networking Environment

🚀 **A Non-Invasive IoT-Based Smart Home Automation System**

COSINE is an IoT-based smart home automation system that allows users to control household appliances from anywhere in the world without modifying existing electrical wiring.

Instead of replacing switches or installing expensive smart devices, COSINE uses **servo motors to physically operate existing switches**, making it compatible with almost any home.

---

# 🌐 Live System

Website  
https://cosine-iot.web.app

---

# 📖 Project Overview

COSINE converts a traditional home into an intelligent smart home using:

- NodeMCU ESP8266 microcontroller
- Servo motor switch actuation
- MQTT cloud communication
- Firebase hosted web dashboard
- Environmental sensors
- Motion detection automation
- Live surveillance camera

The system enables **remote control, automation, monitoring, and surveillance through a unified web platform.**

---

# ✨ Key Features

## Non-Invasive Installation
No electrical rewiring required. Servo motors physically press existing switches.

## Worldwide Remote Access
Control appliances from anywhere via MQTT cloud communication.

## Unified Web Dashboard
A single dashboard for:

- Light control
- Fan control
- Temperature monitoring
- Voice commands
- Live surveillance
- Notifications

## Environmental Monitoring
Real-time temperature and humidity monitoring using the **DHT11 sensor**.

## Motion-Based Automation
IR motion sensor automatically activates lights and fan when movement is detected.

## Voice Control
Hands-free control using the browser's **Web Speech API**.

## Integrated Surveillance
Live video feed using **ESP32-CAM** embedded in the dashboard.

---

# 🏗 System Architecture

COSINE is built using a **three-layer IoT architecture**.

### 1️⃣ Perception Layer (Hardware)

- NodeMCU ESP8266
- SG90 Servo Motors
- DHT11 Temperature Sensor
- IR Motion Sensor
- Buzzer Alarm
- ESP32-CAM Surveillance Module

### 2️⃣ Network Layer

- WiFi Network
- HiveMQ MQTT Cloud Broker
- Internet Connectivity

### 3️⃣ Application Layer

- Firebase Hosted Web Dashboard
- Voice Command Interface
- Real-time Monitoring Interface

---

# 🔧 Hardware Components

| Component | Purpose |
|--------|--------|
| NodeMCU ESP8266 | Main IoT controller |
| SG90 Servo Motor | Switch actuation |
| DHT11 Sensor | Temperature & humidity monitoring |
| IR Motion Sensor | Automatic appliance control |
| ESP32-CAM | Live video surveillance |
| Buzzer | Fire / emergency alert |

---

# 💻 Technology Stack

| Layer | Technology |
|------|-----------|
| Frontend | HTML5, CSS3, JavaScript |
| MQTT Client | Paho MQTT JS |
| Cloud Broker | HiveMQ MQTT |
| Hosting | Firebase |
| Firmware | Arduino C++ |
| Voice Recognition | Web Speech API |

---

# 📡 MQTT Topic Structure

| Topic | Publisher | Subscriber | Purpose |
|------|-----------|------------|--------|
| cosine/light | Web App | NodeMCU | Light control |
| cosine/fan | Web App | NodeMCU | Fan control |
| cosine/sensor/temp | NodeMCU | Web App | Temperature data |
| cosine/sensor/hum | NodeMCU | Web App | Humidity data |
| cosine/motion | NodeMCU | Web App | Motion detection |
| cosine/alarm | NodeMCU / Web | Both | Fire alarm |
| cosine/status | NodeMCU | Web App | System status |

---

# 🔌 GPIO Pin Connections

| Component | NodeMCU Pin |
|-----------|-------------|
| Servo Motor (Light) | D5 |
| Servo Motor (Fan) | D7 |
| DHT11 Sensor | D2 |
| IR Motion Sensor | D1 |
| Buzzer | D6 |

---

# 📁 Repository Structure

```
COSINE
│
├── Backend
│   └── Firmware (ESP8266 Code)
│
├── Frontend
│   └── Web Dashboard (HTML, CSS, JS)
│
├── diagrams
│   └── Architecture, circuit diagrams
│
└── README.md
```

---

# ⚙️ Installation Guide

## 1️⃣ Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/COSINE.git
```

---

## 2️⃣ Upload Firmware

Open Arduino IDE and upload firmware to:

```
NodeMCU ESP8266
```

Required Libraries:

```
ESP8266WiFi
PubSubClient
Servo
DHT
```

---

## 3️⃣ Setup MQTT Broker

Create HiveMQ Cloud account

Configure credentials in firmware:

```
MQTT_SERVER
MQTT_USERNAME
MQTT_PASSWORD
```

---

## 4️⃣ Deploy Web Dashboard

Install Firebase CLI

```
npm install -g firebase-tools
```

Login

```
firebase login
```

Deploy

```
firebase deploy
```

---

# 🧪 Testing Results

| Test | Result |
|----|----|
| Web Command Response | 200–800 ms |
| MQTT Delivery (Local) | <200 ms |
| MQTT Delivery (Global) | <1.5 s |
| Motion Detection | <200 ms |
| Voice Command Accuracy | ~90% |
| System Uptime | 99.2% |

---

# 🚀 Advantages

- No electrical rewiring required
- 90% cheaper than commercial smart home systems
- Works with existing switches
- Worldwide access
- Unified dashboard
- Open source architecture

---

# 🔮 Future Improvements

- AI human detection using ESP32-CAM
- Face recognition for security
- Dedicated Android/iOS mobile app
- Energy consumption monitoring
- Google Assistant / Alexa integration
- Battery backup support

---

# 👨‍💻 Team

**Agrawal Karan R**  
Project Lead  
MQTT Architecture, Firebase Deployment, Web Dashboard, Surveillance Integration

**Ravikumar**  
ESP8266 Firmware, Servo Control Logic, IR Sensor Integration

**D. Chand Akarsh**  
Hardware Design, Circuit Wiring, Servo Mounting

---

# 📜 License

This project is open-source and available under the **MIT License**.

---

⭐ If you like this project, please give it a star!
