"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { CheckinEvent, CheckinCountEvent, CheckinPoint, Event } from "@event-platform/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4000";

interface CheckinResult {
  success: boolean;
  fullName?: string;
  department?: string;
  message?: string;
  alreadyCheckedIn?: boolean;
  error?: string;
}

function getThaiStatusLabel(status: string) {
  switch (status) {
    case "DRAFT": return "ฉบับร่าง";
    case "PUBLISHED": return "เปิดบริการ";
    case "ACTIVE": return "กำลังดำเนินงาน";
    case "CLOSED": return "เสร็จสิ้นกิจกรรม";
    case "ARCHIVED": return "จัดเก็บแล้ว";
    default: return status;
  }
}

export default function CheckinPage() {
  const [eventId, setEventIdRaw] = useState("");
  const [selectedPoint, setSelectedPointRaw] = useState("");

  const setSelectedPoint = (pointId: string) => {
    setSelectedPointRaw(pointId);
    if (pointId) {
      localStorage.setItem("checkin_point_id", pointId);
    } else {
      localStorage.removeItem("checkin_point_id");
    }
  };

  const setEventId = (id: string) => {
    setEventIdRaw(id);
    setSelectedPoint("");
    if (id) {
      localStorage.setItem("checkin_event_id", id);
    } else {
      localStorage.removeItem("checkin_event_id");
      localStorage.removeItem("checkin_point_id");
    }
  };

  const [events, setEvents] = useState<Event[]>([]);
  const [checkpoints, setCheckpoints] = useState<CheckinPoint[]>([]);
  const [mode, setMode] = useState<"scan" | "search">("scan");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [lastCheckin, setLastCheckin] = useState<CheckinResult | null>(null);
  const [stats, setStats] = useState({ total: 0, checkedIn: 0, percentage: 0 });
  const [recentCheckins, setRecentCheckins] = useState<CheckinEvent[]>([]);
  const [scanning, setScanning] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load events and restore saved eventId
  useEffect(() => {
    const saved = localStorage.getItem("checkin_event_id");
    if (saved) setEventIdRaw(saved);

    fetch(`${API_URL}/api/events`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setEvents(res.data); })
      .catch(console.error);
  }, []);

  // Load checkpoints when event changes
  useEffect(() => {
    if (!eventId) return;
    fetch(`${API_URL}/api/checkin/points?eventId=${eventId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setCheckpoints(res.data);
          const savedPoint = localStorage.getItem("checkin_point_id");
          const foundSaved = res.data.find((cp: any) => cp.id === savedPoint && cp.isActive !== false);
          if (foundSaved) {
            setSelectedPointRaw(foundSaved.id);
          } else if (res.data.length > 0) {
            const firstActive = res.data.find((cp: any) => cp.isActive !== false) || res.data[0];
            setSelectedPointRaw(firstActive.id);
            localStorage.setItem("checkin_point_id", firstActive.id);
          }
        }
      });

    // Load initial stats
    fetch(`${API_URL}/api/checkin/stats?eventId=${eventId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setStats(res.data);
      });

    // Socket.io connection
    const socket = io(WS_URL);
    socketRef.current = socket;
    socket.emit("checkin:subscribe", eventId);

    socket.on("checkin:new", (data: CheckinEvent) => {
      setRecentCheckins((prev) => [data, ...prev].slice(0, 10));
    });

    socket.on("checkin:count", (data: CheckinCountEvent) => {
      setStats({ total: data.total, checkedIn: data.checkedIn, percentage: data.percentage });
    });

    return () => { socket.disconnect(); };
  }, [eventId]);

  // QR Scanner using camera
  const startScanning = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);

        // Scan frames for QR codes
        scanIntervalRef.current = setInterval(() => {
          if (!videoRef.current || !canvasRef.current) return;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          ctx.drawImage(videoRef.current, 0, 0);

          // Simple QR detection via BarcodeDetector API (modern browsers)
          if ("BarcodeDetector" in window) {
            const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
            detector.detect(canvas).then((barcodes: any[]) => {
              if (barcodes.length > 0) {
                const qrValue = barcodes[0].rawValue;
                handleQRResult(qrValue);
              }
            }).catch(() => {});
          }
        }, 500);
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      setMode("search");
    }
  }, []);

  const stopScanning = useCallback(() => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    if (mode === "scan" && eventId && selectedPoint) {
      startScanning();
    } else {
      stopScanning();
    }
    return () => stopScanning();
  }, [mode, eventId, selectedPoint, startScanning, stopScanning]);

  async function handleQRResult(rawValue: string) {
    // Extract QR code from URL or use directly
    let qrCode = rawValue;
    try {
      const url = new URL(rawValue);
      qrCode = url.searchParams.get("code") || rawValue;
    } catch { /* Not a URL, use as-is */ }

    await performCheckin(qrCode);
  }

  async function performCheckin(qrCode: string) {
    let pointId = selectedPoint;
    if (!pointId && checkpoints.length > 0) {
      const activePoint = checkpoints.find((cp) => cp.isActive !== false) || checkpoints[0];
      pointId = activePoint.id;
      setSelectedPoint(pointId);
    }

    try {
      const res = await fetch(`${API_URL}/api/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCode, checkinPointId: pointId, method: mode === "scan" ? "QR_SCAN" : "SEARCH" }),
      });
      const data = await res.json();

      if (data.success) {
        const reg = data.data.registration || data.data;
        setLastCheckin({
          success: true,
          fullName: reg.fullName,
          department: reg.department,
          message: data.alreadyCheckedIn ? "เช็กอินไปแล้ว" : "เช็กอินสำเร็จ!",
          alreadyCheckedIn: data.alreadyCheckedIn,
        });
      } else {
        setLastCheckin({ success: false, error: data.error });
      }
    } catch {
      setLastCheckin({ success: false, error: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้" });
    }

    // Auto-clear result after 3s
    setTimeout(() => setLastCheckin(null), 3000);
  }

  async function handleSearch() {
    if (!searchQuery.trim() || !eventId) return;
    const res = await fetch(`${API_URL}/api/registrations?eventId=${eventId}&search=${searchQuery}&limit=10`);
    const data = await res.json();
    if (data.success) setSearchResults(data.data);
  }

  async function checkinByRegistration(regId: string) {
    let pointId = selectedPoint;
    if (!pointId && checkpoints.length > 0) {
      const activePoint = checkpoints.find((cp) => cp.isActive !== false) || checkpoints[0];
      pointId = activePoint.id;
      setSelectedPoint(pointId);
    }

    try {
      const res = await fetch(`${API_URL}/api/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId: regId, checkinPointId: pointId, method: "SEARCH" }),
      });
      const data = await res.json();
      if (data.success) {
        const reg = data.data.registration || data.data;
        setLastCheckin({
          success: true,
          fullName: reg.fullName,
          department: reg.department,
          message: data.alreadyCheckedIn ? "เช็กอินไปแล้ว" : "เช็กอินสำเร็จ!",
          alreadyCheckedIn: data.alreadyCheckedIn,
        });
        setSearchResults([]);
        setSearchQuery("");
      } else {
        setLastCheckin({ success: false, error: data.error });
      }
    } catch {
      setLastCheckin({ success: false, error: "ไม่สามารถเช็กอินได้" });
    }
    setTimeout(() => setLastCheckin(null), 3000);
  }

  const selectedEvent = events.find((e) => e.id === eventId);
  const bgUrl = selectedEvent?.settings?.checkinBackground;

  if (!eventId) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
        <header
          style={{
            padding: "var(--space-6) var(--space-8)",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-glass)",
            backdropFilter: "blur(20px)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <span style={{ fontSize: "2rem" }}>📱</span>
            <div>
              <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 800 }}>Event Check-in</h1>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>ระบบเช็กอินผู้เข้าร่วมงาน</p>
            </div>
          </div>
        </header>

        <main className="container" style={{ padding: "var(--space-10) var(--space-6)" }}>
          <div style={{ textAlign: "center", marginBottom: "var(--space-10)" }}>
            <h2 style={{ fontSize: "var(--text-3xl)", fontWeight: 800, marginBottom: "var(--space-2)" }}>
              เลือกงาน Event เพื่อเริ่มเช็กอิน
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-base)" }}>
              เลือกงานที่ต้องการบันทึกการเช็กอิน สแกน QR Code หรือค้นหารายชื่อผู้ลงทะเบียน
            </p>
          </div>

          <div className="grid grid-3 gap-6">
            {events.map((ev: any) => (
              <div
                key={ev.id}
                className="glass-card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  transition: "all var(--transition-fast)",
                }}
                onClick={() => setEventId(ev.id)}
              >
                <div>
                  <div
                    style={{
                      height: "140px",
                      borderRadius: "var(--radius-lg)",
                      marginBottom: "var(--space-4)",
                      background: ev.coverImage
                        ? `url(${ev.coverImage}) center/cover no-repeat`
                        : `linear-gradient(135deg, ${ev.settings?.themeColor || "#6366f1"} 0%, var(--bg-tertiary) 100%)`,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {ev.settings?.isPinned && (
                      <span
                        className="badge badge--primary"
                        style={{ position: "absolute", top: "8px", left: "8px" }}
                      >
                        📌 ตรึงไว้ด้านบน
                      </span>
                    )}
                    <span
                      className={`badge badge--${ev.status === "ACTIVE" ? "success" : ev.status === "PUBLISHED" ? "primary" : "neutral"}`}
                      style={{ position: "absolute", top: "8px", right: "8px" }}
                    >
                      {getThaiStatusLabel(ev.status)}
                    </span>
                  </div>
                  <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-2)" }}>
                    {ev.name}
                  </h3>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-4)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {ev.description || "ไม่มีรายละเอียด"}
                  </p>
                </div>

                <div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "var(--space-4)" }}>
                    <span>📅 {new Date(ev.startDate).toLocaleDateString("th-TH")}</span>
                    <span>📍 {ev.venue || "-"}</span>
                  </div>
                  <button className="btn btn--primary" style={{ width: "100%", justifyContent: "center" }}>
                    📱 เข้าสู่จุดเช็กอิน →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: "100vh",
      background: bgUrl ? `url(${bgUrl}) center/cover fixed no-repeat` : undefined
    }}>
      {/* Header */}
      <header
        style={{
          padding: "var(--space-4) var(--space-6)",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-glass)",
          backdropFilter: "blur(20px)",
          position: "sticky",
          top: 0,
          zIndex: "var(--z-sticky)" as any,
        }}
      >
        <div className="container checkin-header-inner">
          <div className="flex gap-3 items-center">
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => setEventId("")}
              title="กลับไปหน้าเลือกงาน"
            >
              ← เลือกงานใหม่
            </button>
            <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 800 }}>
              📱 Event Check-in
            </h1>
          </div>
          <div className="flex gap-4" style={{ alignItems: "center" }}>
            {/* Stats */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                padding: "var(--space-2) var(--space-4)",
                background: "var(--bg-glass)",
                borderRadius: "var(--radius-full)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                เช็กอิน
              </span>
              <span style={{ fontSize: "var(--text-lg)", fontWeight: 800, color: "var(--color-success-light)" }}>
                {stats.checkedIn}
              </span>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>/</span>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                {stats.total}
              </span>
              <span className="badge badge--success">{stats.percentage}%</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container checkin-container">
        {/* Config Row */}
        <div className="checkin-config-grid">
          <div className="form-group">
            <label className="form-label">จุดเช็กอิน</label>
            <select
              className="form-input"
              value={selectedPoint}
              onChange={(e) => setSelectedPoint(e.target.value)}
            >
              {checkpoints.map((cp) => (
                <option key={cp.id} value={cp.id}>
                  {cp.name} {cp.location ? `(${cp.location})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">โหมด</label>
            <div className="flex gap-2">
              <button
                className={`btn ${mode === "scan" ? "btn--primary" : "btn--secondary"}`}
                onClick={() => setMode("scan")}
                style={{ flex: 1 }}
              >
                📷 สแกน QR
              </button>
              <button
                className={`btn ${mode === "search" ? "btn--primary" : "btn--secondary"}`}
                onClick={() => setMode("search")}
                style={{ flex: 1 }}
              >
                🔍 ค้นหา
              </button>
            </div>
          </div>
        </div>

        {!eventId ? (
          <div className="glass-card flex-center" style={{ padding: "var(--space-16)", textAlign: "center" }}>
            <div>
              <div style={{ fontSize: "4rem", marginBottom: "var(--space-4)" }}>📋</div>
              <h2 style={{ color: "var(--text-muted)" }}>กรุณาเลือกงานเพื่อเริ่มเช็กอิน</h2>
            </div>
          </div>
        ) : (
          <div className="checkin-main-grid">
            {/* Left: Scanner / Search */}
            <div>
              {/* Checkin Result Overlay */}
              {lastCheckin && (
                <div
                  className="checkin-overlay"
                  style={{
                    background: lastCheckin.success
                      ? "linear-gradient(135deg, rgba(16,185,129,0.95), rgba(5,150,105,0.95))"
                      : "linear-gradient(135deg, rgba(239,68,68,0.95), rgba(220,38,38,0.95))",
                  }}
                >
                  <div style={{ fontSize: "4rem", marginBottom: "var(--space-3)" }}>
                    {lastCheckin.success ? (lastCheckin.alreadyCheckedIn ? "⚠️" : "✅") : "❌"}
                  </div>
                  <div style={{ fontSize: "var(--text-2xl)", fontWeight: 800, marginBottom: "var(--space-2)" }}>
                    {lastCheckin.success ? lastCheckin.message : "เช็กอินไม่สำเร็จ"}
                  </div>
                  {lastCheckin.fullName && (
                    <div style={{ fontSize: "var(--text-xl)", fontWeight: 600, marginBottom: "var(--space-1)" }}>
                      {lastCheckin.fullName}
                    </div>
                  )}
                  {lastCheckin.department && (
                    <div style={{ fontSize: "var(--text-base)", opacity: 0.8 }}>
                      {lastCheckin.department}
                    </div>
                  )}
                  {lastCheckin.error && (
                    <div style={{ fontSize: "var(--text-base)", opacity: 0.8 }}>
                      {lastCheckin.error}
                    </div>
                  )}
                </div>
              )}

              {mode === "scan" ? (
                <div className="glass-card">
                  <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    📷 สแกน QR Code
                  </h3>
                  <div
                    style={{
                      position: "relative",
                      borderRadius: "var(--radius-xl)",
                      overflow: "hidden",
                      background: "#000",
                      aspectRatio: "4/3",
                    }}
                  >
                    <video
                      ref={videoRef}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      playsInline
                      muted
                    />
                    <canvas ref={canvasRef} style={{ display: "none" }} />
                    {/* Scan overlay */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                      }}
                    >
                      <div
                        style={{
                          width: "200px",
                          height: "200px",
                          border: "3px solid var(--color-primary-light)",
                          borderRadius: "var(--radius-xl)",
                          boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)",
                          animation: "glow-pulse 2s infinite",
                        }}
                      />
                    </div>
                    {scanning && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: "var(--space-4)",
                          left: "50%",
                          transform: "translateX(-50%)",
                          background: "rgba(0,0,0,0.7)",
                          padding: "var(--space-2) var(--space-4)",
                          borderRadius: "var(--radius-full)",
                          fontSize: "var(--text-sm)",
                          color: "var(--color-success-light)",
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-2)",
                        }}
                      >
                        <span className="spinner spinner--sm" style={{ borderTopColor: "var(--color-success)" }} />
                        กำลังสแกน...
                      </div>
                    )}
                  </div>
                  {/* Manual input fallback */}
                  <div style={{ marginTop: "var(--space-4)" }}>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const input = (e.target as HTMLFormElement).elements.namedItem("manualCode") as HTMLInputElement;
                        if (input.value.trim()) {
                          performCheckin(input.value.trim());
                          input.value = "";
                        }
                      }}
                    >
                      <div className="flex gap-2">
                        <input
                          name="manualCode"
                          className="form-input"
                          placeholder="พิมพ์รหัส QR Code..."
                          style={{ flex: 1 }}
                        />
                        <button type="submit" className="btn btn--primary">เช็กอิน</button>
                      </div>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="glass-card">
                  <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    🔍 ค้นหาผู้ลงทะเบียน
                  </h3>
                  <div className="flex gap-2" style={{ marginBottom: "var(--space-4)" }}>
                    <input
                      className="form-input"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ค้นหาชื่อ, อีเมล, เบอร์โทร..."
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      style={{ flex: 1 }}
                    />
                    <button className="btn btn--primary" onClick={handleSearch}>ค้นหา</button>
                  </div>
                  {searchResults.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                      {searchResults.map((reg: any) => (
                        <div
                          key={reg.id}
                          className="flex-between"
                          style={{
                            padding: "var(--space-3) var(--space-4)",
                            background: "var(--bg-glass)",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--border-subtle)",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600 }}>{reg.fullName}</div>
                            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                              {reg.department || ""} {reg.phone || ""}
                            </div>
                          </div>
                          <div className="flex gap-2" style={{ alignItems: "center" }}>
                            {reg.status === "CHECKED_IN" ? (
                              <span className="badge badge--success">✓ เช็กอินแล้ว</span>
                            ) : (
                              <button
                                className="btn btn--success btn--sm"
                                onClick={() => checkinByRegistration(reg.id)}
                              >
                                เช็กอิน
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Recent Checkins */}
            <div className="glass-card">
              <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                ⚡ เช็กอินล่าสุด
              </h3>
              {recentCheckins.length === 0 ? (
                <div style={{ textAlign: "center", padding: "var(--space-8)", color: "var(--text-muted)" }}>
                  <div style={{ fontSize: "2rem", marginBottom: "var(--space-2)" }}>👋</div>
                  <p>ยังไม่มีเช็กอิน</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {recentCheckins.map((c, i) => (
                    <div
                      key={`${c.registrationId}-${i}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-3)",
                        padding: "var(--space-3) var(--space-4)",
                        background: i === 0 ? "rgba(16, 185, 129, 0.1)" : "var(--bg-glass)",
                        borderRadius: "var(--radius-md)",
                        border: `1px solid ${i === 0 ? "rgba(16, 185, 129, 0.3)" : "var(--border-subtle)"}`,
                        animation: i === 0 ? "slideUp 0.3s ease-out" : "none",
                      }}
                    >
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "var(--text-sm)",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {c.fullName.charAt(0)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{c.fullName}</div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                          {c.checkinPointName} • {new Date(c.checkinTime).toLocaleTimeString("th-TH")}
                        </div>
                      </div>
                      <span className="badge badge--success" style={{ flexShrink: 0 }}>✓</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
