"use client";

import { useState, useEffect, useRef } from "react";

const CORRECT_PASSWORD = "karan123";

declare global {
  interface Window { mqtt: any; }
}

const TOPICS = {
  FAN_CMD:    "cosine/fan/command",
  LIGHT_CMD:  "cosine/light/command",
  FAN_STATE:  "cosine/fan/state",
  LIGHT_ST:   "cosine/light/state",
  SENSOR:     "cosine/sensor",
  STATUS:     "cosine/status",
  CAM:        "cosine/camera/frame",
  CAM_STATUS: "cosine/camera/status",
  CAM_CMD:    "cosine/camera/command",
};

export default function Home() {
  const [page, setPage] = useState<"login" | "dashboard-grid">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [currentUser, setCurrentUser] = useState("");

  const [mqttConnected, setMqttConnected] = useState(false);
  const [espOnline, setEspOnline] = useState(false);
  const [fanOn, setFanOn] = useState(false);
  const [lightOn, setLightOn] = useState(false);
  const [temp, setTemp] = useState<string>("--");
  const [hum, setHum] = useState<string>("--");
  const [updateRate, setUpdateRate] = useState<string>("--");
  const [camOnline, setCamOnline] = useState(false);
  const [camFrame, setCamFrame] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<{ src: string; ts: string; id: number }[]>([]);
  const [streaming, setStreaming] = useState(true);

  const [notif, setNotif] = useState({ show: false, icon: "", text: "" });
  const [listening, setListening] = useState(false);

  const mqttRef = useRef<any>(null);
  const lastSensorTime = useRef<number | null>(null);
  const notifTimer = useRef<any>(null);
  const latestFrame = useRef<string | null>(null);

  function showNotif(icon: string, text: string) {
    setNotif({ show: true, icon, text });
    clearTimeout(notifTimer.current);
    notifTimer.current = setTimeout(() => setNotif(n => ({ ...n, show: false })), 3500);
  }

  function doLogin() {
    if (!username.trim()) { showNotif("⚠️", "Please enter your name"); return; }
    if (password !== CORRECT_PASSWORD) {
      setLoginError(true);
      setTimeout(() => setLoginError(false), 3000);
      return;
    }
    setCurrentUser(username.trim());
    setPage("dashboard-grid");
  }

  function doLogout() {
    if (mqttRef.current) { try { mqttRef.current.end(); } catch (e) {} mqttRef.current = null; }
    setMqttConnected(false); setEspOnline(false); setFanOn(false); setLightOn(false);
    setTemp("--"); setHum("--"); setCamFrame(null); setCamOnline(false); setSnapshots([]);
    setPage("login"); setUsername(""); setPassword("");
  }

  useEffect(() => {
    if (page !== "dashboard-grid") return;
    const interval = setInterval(() => {
      if (window.mqtt) { clearInterval(interval); initMQTT(); }
    }, 200);
    return () => clearInterval(interval);
  }, [page]);

  function initMQTT() {
    const clientId = "COSINE-DASH-" + Math.random().toString(36).slice(2, 9);
    const client = window.mqtt.connect("wss://broker.hivemq.com:8884/mqtt", {
      clientId, clean: true, connectTimeout: 10000, reconnectPeriod: 3000,
    });
    mqttRef.current = client;

    client.on("connect", () => {
      setMqttConnected(true);
      Object.values(TOPICS).forEach(t => client.subscribe(t));
      showNotif("✅", "MQTT Connected to broker.hivemq.com");
    });
    client.on("disconnect", () => setMqttConnected(false));
    client.on("error",      () => setMqttConnected(false));
    client.on("offline",    () => setMqttConnected(false));

    client.on("message", (topic: string, msg: Buffer) => {
      const payload = msg.toString().trim();
      if (topic === TOPICS.STATUS)     setEspOnline(payload === "online");
      if (topic === TOPICS.CAM_STATUS) setCamOnline(payload === "online");
      if (topic === TOPICS.FAN_STATE)  setFanOn(payload === "ON");
      if (topic === TOPICS.LIGHT_ST)   setLightOn(payload === "ON");
      if (topic === TOPICS.SENSOR) {
        try {
          const d = JSON.parse(payload);
          setTemp(d.temp ?? "--"); setHum(d.hum ?? "--");
          const now = Date.now();
          if (lastSensorTime.current) setUpdateRate(((now - lastSensorTime.current) / 1000).toFixed(1) + "s");
          lastSensorTime.current = now;
        } catch (e) {}
      }
      if (topic === TOPICS.CAM) {
        const src = payload.startsWith("data:") ? payload : "data:image/jpeg;base64," + payload;
        setCamFrame(src);
        setCamOnline(true);
        latestFrame.current = src;
      }
    });
  }

  function sendCmd(device: string, state: string) {
    if (!mqttRef.current?.connected) { showNotif("⚠️", "MQTT not connected!"); return; }
    const topic = device === "fan" ? TOPICS.FAN_CMD : TOPICS.LIGHT_CMD;
    mqttRef.current.publish(topic, state);
    showNotif("📤", `${device.charAt(0).toUpperCase() + device.slice(1)} command: ${state}`);
  }

  function toggleStream() {
    if (!mqttRef.current?.connected) { showNotif("⚠️", "MQTT not connected!"); return; }
    const newState = !streaming;
    setStreaming(newState);
    mqttRef.current.publish(TOPICS.CAM_CMD, newState ? "stream_on" : "stream_off");
    showNotif(newState ? "▶️" : "⏸", newState ? "Stream started" : "Stream paused");
  }

  function takeSnapshot() {
    const src = latestFrame.current ?? camFrame;
    if (!src) {
      if (mqttRef.current?.connected) {
        mqttRef.current.publish(TOPICS.CAM_CMD, "snapshot");
        showNotif("📸", "Snapshot requested from camera...");
      } else {
        showNotif("⚠️", "No camera feed available");
      }
      return;
    }
    const ts = new Date().toLocaleString();
    setSnapshots(prev => [{ src, ts, id: Date.now() }, ...prev].slice(0, 12));
    showNotif("📸", "Snapshot captured! Click image to download.");
  }

  function downloadSnapshot(snap: { src: string; id: number; ts: string }) {
    const a = document.createElement("a");
    a.href = snap.src; a.download = `cosine-snapshot-${snap.id}.jpg`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showNotif("💾", "Snapshot downloaded!");
  }

  function deleteSnapshot(id: number) {
    setSnapshots(prev => prev.filter(s => s.id !== id));
  }

  function toggleVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { showNotif("⚠️", "Voice not supported in this browser"); return; }
    if (listening) return;
    const r = new SR();
    r.lang = "en-US"; r.continuous = false; r.interimResults = false;
    r.onstart  = () => setListening(true);
    r.onend    = () => setListening(false);
    r.onerror  = (e: any) => { setListening(false); showNotif("⚠️", "Voice error: " + e.error); };
    r.onresult = (e: any) => {
      const cmd = e.results[0][0].transcript.toLowerCase();
      showNotif("🎙️", `Heard: "${cmd}"`);
      if (cmd.includes("fan")   && cmd.includes("on"))  sendCmd("fan",   "ON");
      if (cmd.includes("fan")   && cmd.includes("off")) sendCmd("fan",   "OFF");
      if (cmd.includes("light") && cmd.includes("on"))  sendCmd("light", "ON");
      if (cmd.includes("light") && cmd.includes("off")) sendCmd("light", "OFF");
    };
    r.start();
  }

  const initials = currentUser.slice(0, 2).toUpperCase() || "CS";

  // ── CARD STYLE ──
  const cardStyle: React.CSSProperties = {
    background: "var(--bg-card)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(0,243,255,0.2)",
    borderRadius: "24px",
    padding: "2rem",
    boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
    position: "relative",
    zIndex: 1,
  };

  // ── LOGIN PAGE ──
  if (page === "login") return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", padding:"2rem", position:"relative", zIndex:10 }}>
      <div style={{ textAlign:"center", marginBottom:"2rem" }}>
        <h1 className="logo">COSINE</h1>
        <p className="tagline">Control of Systems with Intelligent Networking Environment</p>
        <p className="subtitle">Advanced Smart Home Management System</p>
      </div>
      <div className="card" style={{ width:"100%", maxWidth:"440px", padding:"3rem 3.5rem", position:"relative", zIndex:10 }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px", background:"linear-gradient(90deg, transparent, var(--primary), var(--secondary), var(--accent), transparent)", borderRadius:"24px 24px 0 0" }}></div>
        <h2 style={{ fontFamily:"Orbitron, sans-serif", fontSize:"1.2rem", color:"var(--primary)", textAlign:"center", marginBottom:"0.4rem" }}>🔐 SYSTEM ACCESS</h2>
        <p style={{ color:"var(--text-secondary)", textAlign:"center", fontSize:"0.9rem", marginBottom:"2rem" }}>Enter credentials to access COSINE dashboard</p>
        <div style={{ marginBottom:"1.5rem" }}>
          <label style={{ display:"block", fontSize:"0.78rem", fontWeight:600, color:"var(--text-secondary)", textTransform:"uppercase", letterSpacing:"0.15rem", marginBottom:"0.6rem" }}>Username</label>
          <input type="text" value={username} placeholder="Enter your name" autoComplete="off"
            onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === "Enter" && doLogin()}
            style={{ width:"100%", padding:"1rem 1.2rem", background:"rgba(0,0,0,0.4)", border:"1px solid rgba(0,243,255,0.2)", borderRadius:"12px", color:"#fff", fontFamily:"Rajdhani, sans-serif", fontSize:"1rem", outline:"none", position:"relative", zIndex:20 }} />
        </div>
        <div style={{ marginBottom:"1.5rem" }}>
          <label style={{ display:"block", fontSize:"0.78rem", fontWeight:600, color:"var(--text-secondary)", textTransform:"uppercase", letterSpacing:"0.15rem", marginBottom:"0.6rem" }}>Password</label>
          <input type="password" value={password} placeholder="Enter system password" autoComplete="new-password"
            onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && doLogin()}
            style={{ width:"100%", padding:"1rem 1.2rem", background:"rgba(0,0,0,0.4)", border:"1px solid rgba(0,243,255,0.2)", borderRadius:"12px", color:"#fff", fontFamily:"Rajdhani, sans-serif", fontSize:"1rem", outline:"none", position:"relative", zIndex:20 }} />
        </div>
        <button className="btn btn-primary" style={{ width:"100%" }} onClick={doLogin}>⚡ AUTHORIZE ACCESS</button>
        {loginError && (
          <div style={{ marginTop:"1rem", padding:"0.8rem 1.2rem", background:"rgba(255,51,102,0.15)", border:"1px solid var(--danger)", borderRadius:"10px", color:"var(--danger)", textAlign:"center", fontSize:"0.9rem", fontWeight:600 }}>
            🚫 Invalid credentials. Access denied.
          </div>
        )}
      </div>
    </div>
  );

  // ── DASHBOARD PAGE ──
  return (
    <>
      <header className="header">
        <h1 className="logo">COSINE</h1>
        <p className="tagline">Control of Systems with Intelligent Networking Environment</p>
        <p className="subtitle">Advanced Smart Home Management System</p>
      </header>

      <div className="container">

        {/* User Bar */}
        <div className="user-bar">
          <div className="user-info">
            <div className="user-avatar">{initials}</div>
            <div className="user-details">
              <h3>{currentUser}</h3>
              <p className="user-role">System Administrator</p>
              <button onClick={doLogout} style={{ marginTop:"0.3rem", padding:"0.3rem 0.8rem", background:"rgba(255,51,102,0.15)", border:"1px solid rgba(255,51,102,0.4)", borderRadius:"8px", color:"var(--danger)", fontFamily:"Rajdhani, sans-serif", fontSize:"0.75rem", fontWeight:600, letterSpacing:"0.1rem", textTransform:"uppercase", cursor:"pointer" }}>
                ⏻ LOGOUT
              </button>
            </div>
          </div>
          <div className="system-status">
            <div className="status-item">
              <div className={`status-dot ${mqttConnected ? "online" : "offline"}`}></div>
              <span>{mqttConnected ? "MQTT Connected" : "MQTT Offline"}</span>
            </div>
            <div className="status-item">
              <div className={`status-dot ${espOnline ? "online" : "offline"}`}></div>
              <span>{espOnline ? "ESP8266 Online" : "ESP8266 Offline"}</span>
            </div>
          </div>
        </div>

        {/* ── Main 3-column equal grid ── */}
        <div className="dashboard-grid">

          {/* MQTT Card */}
          <div style={cardStyle}>
            <div className="card-header">
              <div className="card-title"><span className="card-icon">📡</span> MQTT Connection</div>
              <span className={`card-badge ${mqttConnected ? "badge-connected" : "badge-disconnected"}`}>{mqttConnected ? "CONNECTED" : "OFFLINE"}</span>
            </div>
            <div style={{ padding:"1rem", background:"rgba(0,0,0,0.3)", borderRadius:"12px", marginBottom:"1rem", border:"1px solid rgba(0,243,255,0.1)", fontSize:"0.9rem" }}>
              <div style={{ marginBottom:"0.4rem" }}>🌐 Broker: <strong style={{ color:"var(--primary)" }}>broker.hivemq.com</strong></div>
              <div style={{ marginBottom:"0.4rem" }}>🔒 Protocol: <strong style={{ color:"var(--primary)" }}>WSS (secure WebSocket)</strong></div>
              <div>✅ <strong style={{ color:"var(--primary)" }}>No laptop or ngrok needed!</strong></div>
            </div>
            <div className="status-display">
              <span className="status-label">ESP8266</span>
              <span className={`status-value ${espOnline ? "status-on" : "status-off"}`}>{espOnline ? "ONLINE" : "OFFLINE"}</span>
            </div>
            <div className="status-display">
              <span className="status-label">Dashboard</span>
              <span className="status-value status-on">ONLINE</span>
            </div>
          </div>

          {/* Fan Control */}
          <div style={cardStyle}>
            <div className="card-header">
              <div className="card-title"><span className="card-icon">🌀</span> Fan Control</div>
              <span className={`card-badge ${fanOn ? "badge-connected" : "badge-disconnected"}`}>{fanOn ? "ON" : "OFF"}</span>
            </div>
            <div className="control-group">
              <button className="btn btn-success" onClick={() => sendCmd("fan","ON")}>TURN ON</button>
              <button className="btn btn-danger"  onClick={() => sendCmd("fan","OFF")}>TURN OFF</button>
            </div>
            <div className="status-display">
              <span className="status-label">Fan Status</span>
              <span className={`status-value ${fanOn ? "status-on" : "status-off"}`}>{fanOn ? "ON" : "OFF"}</span>
            </div>
          </div>

          {/* Light Control */}
          <div style={cardStyle}>
            <div className="card-header">
              <div className="card-title"><span className="card-icon">💡</span> Light Control</div>
              <span className={`card-badge ${lightOn ? "badge-active" : "badge-disconnected"}`}>{lightOn ? "ON" : "OFF"}</span>
            </div>
            <div className="control-group">
              <button className="btn btn-success" onClick={() => sendCmd("light","ON")}>TURN ON</button>
              <button className="btn btn-danger"  onClick={() => sendCmd("light","OFF")}>TURN OFF</button>
            </div>
            <div className="status-display">
              <span className="status-label">Light Status</span>
              <span className={`status-value ${lightOn ? "status-on" : "status-off"}`}>{lightOn ? "ON" : "OFF"}</span>
            </div>
          </div>

          {/* DHT11 Sensor */}
          <div style={cardStyle}>
            <div className="card-header">
              <div className="card-title"><span className="card-icon">🌡️</span> DHT11 Sensor</div>
              <span className={`card-badge ${temp !== "--" ? "badge-connected" : "badge-disconnected"}`}>{temp !== "--" ? "LIVE" : "NO DATA"}</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem", marginTop:"1rem" }}>
              {[{ label:"Temperature", val:temp, unit:"°C" }, { label:"Humidity", val:hum, unit:"%" }].map(s => (
                <div key={s.label} style={{ background:"rgba(0,0,0,0.35)", border:"1px solid rgba(0,243,255,0.15)", borderRadius:"16px", padding:"1.5rem", textAlign:"center" }}>
                  <div style={{ fontFamily:"Orbitron, sans-serif", fontSize:"2.2rem", fontWeight:700, background:"linear-gradient(135deg, var(--primary), var(--accent))", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>{s.val}</div>
                  <span style={{ fontSize:"1.1rem", color:"var(--text-secondary)" }}>{s.unit}</span>
                  <div style={{ fontSize:"0.78rem", color:"var(--text-secondary)", textTransform:"uppercase", letterSpacing:"0.15rem", marginTop:"0.5rem" }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div className="status-display">
              <span className="status-label">Update Rate</span>
              <span className="status-value" style={{ color:"var(--primary)", fontSize:"1rem" }}>{updateRate}</span>
            </div>
          </div>

          {/* ESP32-CAM */}
          <div style={cardStyle}>
            <div className="card-header">
              <div className="card-title"><span className="card-icon">📷</span> ESP32-CAM Security</div>
              <span className={`card-badge ${camOnline ? "badge-connected" : "badge-disconnected"}`}>{camOnline ? "ONLINE" : "OFFLINE"}</span>
            </div>
            <div style={{ width:"100%", aspectRatio:"4/3", background:"#000", borderRadius:"14px", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid rgba(0,243,255,0.15)", marginTop:"0.5rem" }}>
              {camFrame ? (
                <img src={camFrame} alt="Camera Feed" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              ) : (
                <div style={{ textAlign:"center", color:"var(--text-secondary)" }}>
                  <div style={{ fontSize:"3rem" }}>📷</div>
                  <p style={{ fontSize:"0.9rem", marginBottom:"0.3rem" }}>Camera offline</p>
                  <small style={{ fontSize:"0.75rem", opacity:0.6 }}>Flash cosine_cam_mqtt.ino to your ESP32-CAM</small>
                </div>
              )}
            </div>
            <div className="control-group" style={{ marginTop:"1rem" }}>
              <button className="btn btn-success" onClick={() => { if(!streaming) toggleStream(); }}>▶ STREAM</button>
              <button className="btn btn-danger"  onClick={() => { if(streaming) toggleStream(); }}>⏸ PAUSE</button>
            </div>
            <button className="btn btn-primary" style={{ width:"100%", marginTop:"0.8rem", background:"linear-gradient(135deg, var(--primary), #0088cc)", color:"#000", fontWeight:800 }} onClick={takeSnapshot}>
              📸 SNAPSHOT
            </button>
            <div className="status-display">
              <span className="status-label">Camera</span>
              <span className={`status-value ${camOnline ? "status-on" : "status-off"}`}>{camOnline ? "ONLINE" : "OFFLINE"}</span>
            </div>
            <div className="status-display">
              <span className="status-label">Transport</span>
              <span className="status-value" style={{ color:"var(--primary)", fontSize:"1rem" }}>MQTT • 2fps</span>
            </div>
          </div>

          {/* Voice Control */}
          <div style={cardStyle}>
            <div className="card-header">
              <div className="card-title"><span className="card-icon">🎙️</span> Voice Control</div>
              <span className="card-badge badge-active">READY</span>
            </div>
            <button className="btn btn-voice" style={{ width:"100%" }} onClick={toggleVoice}>
              {listening ? "🛑 STOP LISTENING" : "🎙️ START VOICE COMMAND"}
            </button>
            <div style={{ marginTop:"1rem", padding:"1rem", background:"rgba(0,0,0,0.3)", borderRadius:"12px", border:"1px solid rgba(255,0,110,0.25)" }}>
              <h4 style={{ fontSize:"0.78rem", color:"var(--text-secondary)", marginBottom:"0.6rem", textTransform:"uppercase", letterSpacing:"0.1rem" }}>Say one of these:</h4>
              <div style={{ display:"flex", flexWrap:"wrap", gap:"0.4rem" }}>
                {['"Fan on"','"Fan off"','"Light on"','"Light off"'].map(c => (
                  <span key={c} style={{ padding:"0.3rem 0.7rem", background:"rgba(255,0,110,0.15)", border:"1px solid var(--accent)", borderRadius:"20px", fontSize:"0.78rem", color:"var(--accent)" }}>{c}</span>
                ))}
              </div>
            </div>
            {listening && (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"0.4rem", marginTop:"1rem", padding:"0.8rem", background:"rgba(255,0,110,0.15)", borderRadius:"10px", color:"var(--accent)", fontSize:"0.9rem" }}>
                🎧 Listening…
              </div>
            )}
          </div>

        </div>{/* end main grid */}

        {/* ── Snapshots Card — full width, separate row, only shows when snapshots exist ── */}
        {snapshots.length > 0 && (
          <div style={{ ...cardStyle, marginBottom:"2rem" }}>
            <div className="card-header">
              <div className="card-title"><span className="card-icon">📁</span> Captured Snapshots</div>
              <div style={{ display:"flex", alignItems:"center", gap:"1rem" }}>
                <span className="card-badge badge-active">{snapshots.length} SAVED</span>
                <button onClick={() => setSnapshots([])} style={{ padding:"0.3rem 0.8rem", background:"rgba(255,51,102,0.15)", border:"1px solid rgba(255,51,102,0.4)", borderRadius:"8px", color:"var(--danger)", fontFamily:"Rajdhani, sans-serif", fontSize:"0.75rem", fontWeight:600, letterSpacing:"0.1rem", textTransform:"uppercase", cursor:"pointer" }}>
                  🗑 CLEAR ALL
                </button>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:"1rem" }}>
              {snapshots.map(snap => (
                <div key={snap.id} style={{ position:"relative", borderRadius:"12px", overflow:"hidden", border:"1px solid rgba(0,243,255,0.2)", background:"rgba(0,0,0,0.3)" }}>
                  <img src={snap.src} alt={snap.ts} style={{ width:"100%", aspectRatio:"4/3", objectFit:"cover", display:"block" }} />
                  <div style={{ padding:"0.6rem 0.8rem", borderTop:"1px solid rgba(0,243,255,0.1)" }}>
                    <div style={{ fontSize:"0.72rem", color:"var(--text-secondary)", marginBottom:"0.5rem" }}>🕐 {snap.ts}</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.4rem" }}>
                      <button onClick={() => downloadSnapshot(snap)} style={{ padding:"0.4rem", background:"linear-gradient(135deg, var(--primary), #0088cc)", border:"none", borderRadius:"8px", color:"#000", fontFamily:"Rajdhani, sans-serif", fontSize:"0.75rem", fontWeight:700, cursor:"pointer", textTransform:"uppercase" }}>
                        ⬇ Save
                      </button>
                      <button onClick={() => deleteSnapshot(snap.id)} style={{ padding:"0.4rem", background:"rgba(255,51,102,0.2)", border:"1px solid rgba(255,51,102,0.4)", borderRadius:"8px", color:"var(--danger)", fontFamily:"Rajdhani, sans-serif", fontSize:"0.75rem", fontWeight:700, cursor:"pointer", textTransform:"uppercase" }}>
                        🗑 Del
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>{/* end container */}

      <footer className="footer">
        <p>© 2026 <span className="footer-brand">COSINE</span> Project | Intelligent Home Automation System</p>
        <p>Designed for Advanced Smart Home Management</p>
      </footer>

      {/* Notification */}
      <div className="notification" style={{ transform: notif.show ? "translateX(0)" : "translateX(420px)" }}>
        <span style={{ fontSize:"1.8rem" }}>{notif.icon}</span>
        <span style={{ fontSize:"1rem", fontWeight:600 }}>{notif.text}</span>
      </div>
    </>
  );
}