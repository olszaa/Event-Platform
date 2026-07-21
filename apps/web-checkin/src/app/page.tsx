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

export default function CheckinPage() {
  const [eventId, setEventId] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [checkpoints, setCheckpoints] = useState<CheckinPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState("");
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

  // Load events
  useEffect(() => {
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
          if (res.data.length > 0) setSelectedPoint(res.data[0].id);
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
    try {
      const res = await fetch(`${API_URL}/api/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCode, checkinPointId: selectedPoint, method: mode === "scan" ? "QR_SCAN" : "SEARCH" }),
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
    } catch (err) {
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
    try {
      const res = await fetch(`${API_URL}/api/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId: regId, checkinPointId: selectedPoint, method: "SEARCH" }),
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
          <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 800 }}>
            📱 Event Check-in
          </h1>
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
            <label className="form-label">เลือกงาน</label>
            <select
              className="form-input"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
            >
              <option value="">-- เลือกงาน --</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>
          </div>
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
