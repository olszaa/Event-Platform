"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { DrawResultEvent, DrawSpinningEvent, Event } from "@event-platform/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4000";

type DrawState = "idle" | "selecting" | "spinning" | "revealing" | "winner";

interface Prize {
  id: string;
  name: string;
  description?: string;
  image?: string;
  quantity: number;
  awarded: number;
  remaining: number;
  eligibleCount?: number;
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

interface Winner {
  id: string;
  fullName: string;
  department?: string;
  company?: string;
  runningNumber?: string;
  ticketNumber?: string;
  luckyDrawNumber?: string;
  prizeName: string;
}

const CONFETTI_COLORS = [
  "#6366f1", "#818cf8", "#06b6d4", "#22d3ee",
  "#f59e0b", "#fbbf24", "#ef4444", "#10b981",
  "#ec4899", "#a855f7", "#f97316", "#14b8a6",
];

export default function LuckyDrawPage() {
  const [token, setToken] = useState<string | null>(null);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [loginForm, setLoginForm] = useState({ username: "", password: "", error: "", loading: false });
  const [showPassword, setShowPassword] = useState(false);

  const [eventId, setEventIdRaw] = useState("");

  const [events, setEvents] = useState<Event[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [selectedPrize, setSelectedPrizeRaw] = useState<Prize | null>(null);

  const setSelectedPrize = (prize: Prize | null) => {
    setSelectedPrizeRaw(prize);
    if (prize) {
      localStorage.setItem("luckydraw_prize_id", prize.id);
    } else {
      localStorage.removeItem("luckydraw_prize_id");
    }
  };

  const setEventId = (id: string) => {
    setEventIdRaw(id);
    setSelectedPrize(null);
    if (id) {
      localStorage.setItem("luckydraw_event_id", id);
    } else {
      localStorage.removeItem("luckydraw_event_id");
      localStorage.removeItem("luckydraw_prize_id");
    }
  };
  // Custom Alert Modal State
  const [alertModal, setAlertModal] = useState<{
    show: boolean;
    type: "success" | "error" | "info" | "warning";
    title?: string;
    message: string;
  }>({ show: false, type: "error", message: "" });

  function showAlert(message: string, type: "success" | "error" | "info" | "warning" = "error", title?: string) {
    setAlertModal({ show: true, type, title, message });
  }

  const [drawState, setDrawState] = useState<DrawState>("idle");
  const [sessionId, setSessionId] = useState("");
  const [spinNames, setSpinNames] = useState<string[]>([]);
  const [currentSpinIndex, setCurrentSpinIndex] = useState(0);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [allWinners, setAllWinners] = useState<Winner[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [drawCountInput, setDrawCountInput] = useState<number>(1);
  const [confetti, setConfetti] = useState<{ id: number; color: string; left: string; delay: string }[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const spinTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("admin_token");
    if (savedToken) setToken(savedToken);
    const savedEvent = localStorage.getItem("luckydraw_event_id");
    if (savedEvent) setEventIdRaw(savedEvent);
    setIsCheckingToken(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginForm((prev) => ({ ...prev, error: "", loading: true }));
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginForm.username, password: loginForm.password }),
      });
      const data = await res.json();
      if (data.success && data.data?.token) {
        setToken(data.data.token);
        localStorage.setItem("admin_token", data.data.token);
      } else {
        setLoginForm((prev) => ({ ...prev, error: data.message || "Invalid credentials" }));
      }
    } catch {
      setLoginForm((prev) => ({ ...prev, error: "Network error" }));
    } finally {
      setLoginForm((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleLogout = () => {
    setToken(null);
    setEventId("");
    setSelectedPrize(null);
    localStorage.removeItem("admin_token");
    localStorage.removeItem("luckydraw_event_id");
    localStorage.removeItem("luckydraw_prize_id");
  };

  const getAuthHeaders = (): Record<string, string> => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Load events
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/events`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setEvents(res.data);
          const savedEvent = localStorage.getItem("luckydraw_event_id");
          if (savedEvent && res.data.some((ev: any) => ev.id === savedEvent)) {
            setEventIdRaw(savedEvent);
          }
        }
      });
  }, [token]);

  // Load prizes & connect socket
  useEffect(() => {
    if (!eventId) return;

    fetch(`${API_URL}/api/prizes?eventId=${eventId}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setPrizes(res.data);
          const savedPrizeId = localStorage.getItem("luckydraw_prize_id");
          const foundSaved = res.data.find((p: any) => p.id === savedPrizeId);
          if (foundSaved) {
            setSelectedPrizeRaw(foundSaved);
          } else if (res.data.length > 0) {
            setSelectedPrizeRaw(res.data[0]);
          }
        }
      });

    // Load existing winners
    fetch(`${API_URL}/api/draws/winners/all?eventId=${eventId}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setAllWinners(res.data.map((w: any) => ({
            id: w.registration?.id,
            fullName: w.registration?.fullName,
            department: w.registration?.department,
            company: w.registration?.company,
            prizeName: w.prize?.name,
          })));
        }
      });

    const socket = io(WS_URL);
    socketRef.current = socket;
    socket.emit("draw:subscribe", eventId);

    socket.on("draw:spinning", (data: DrawSpinningEvent) => {
      const names = data.candidates.map((c) => c.fullName);
      setSpinNames(names.length > 0 ? names : ["..."]);
    });

    socket.on("draw:result", (data: DrawResultEvent) => {
      const newWinners = data.winners.map((w) => ({
        id: w.id,
        fullName: w.fullName,
        department: w.department,
        company: w.company,
        prizeName: w.prizeName,
      }));
      setWinners(newWinners);
      setAllWinners((prev) => [...newWinners, ...prev]);
      setDrawState("winner");
      triggerConfetti();
    });

    return () => { socket.disconnect(); };
  }, [eventId]);

  // Spinning animation
  useEffect(() => {
    if (drawState === "spinning" && spinNames.length > 0) {
      spinTimerRef.current = setInterval(() => {
        setCurrentSpinIndex((prev) => (prev + 1) % spinNames.length);
      }, 80);

      // Slow down gradually
      const slowDown = setTimeout(() => {
        if (spinTimerRef.current) clearInterval(spinTimerRef.current);
        spinTimerRef.current = setInterval(() => {
          setCurrentSpinIndex((prev) => (prev + 1) % spinNames.length);
        }, 200);
      }, 3000);

      const slowDown2 = setTimeout(() => {
        if (spinTimerRef.current) clearInterval(spinTimerRef.current);
        spinTimerRef.current = setInterval(() => {
          setCurrentSpinIndex((prev) => (prev + 1) % spinNames.length);
        }, 400);
      }, 4500);

      return () => {
        if (spinTimerRef.current) clearInterval(spinTimerRef.current);
        clearTimeout(slowDown);
        clearTimeout(slowDown2);
      };
    }
  }, [drawState, spinNames]);

  function triggerConfetti() {
    const pieces = Array.from({ length: 80 }, (_, i) => ({
      id: Date.now() + i,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]!,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 2}s`,
    }));
    setConfetti(pieces);
    setTimeout(() => setConfetti([]), 5000);
  }

  async function startDraw(overrideCount?: number) {
    if (!selectedPrize || !eventId) return;
    if (drawState !== "idle") return;
    const count = overrideCount || drawCountInput || 1;

    setDrawState("selecting");

    try {
      // Create draw session
      const res = await fetch(`${API_URL}/api/draws/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ eventId, prizeId: selectedPrize.id, drawCount: count }),
      });
      const data = await res.json();
      if (!data.success) {
        showAlert(data.error || "ไม่สามารถเริ่มจับรางวัลได้", "error");
        setDrawState("idle");
        return;
      }

      setSessionId(data.data.id);
      setDrawState("spinning");

      // Spin!
      const spinRes = await fetch(`${API_URL}/api/draws/${data.data.id}/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
      const spinData = await spinRes.json();

      if (!spinData.success) {
        showAlert(spinData.error || "เกิดข้อผิดพลาดขณะจับรางวัล", "error");
        setDrawState("idle");
        return;
      }

      // Socket.io will handle the result event
      if (!spinData.success && !socketRef.current?.connected) {
        // Fallback if socket doesn't trigger
        if (spinData.data?.winners) {
          setWinners(spinData.data.winners);
          setDrawState("winner");
          triggerConfetti();
        }
      }
    } catch {
      showAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง", "error");
      setDrawState("idle");
    }
  }

  async function handleRedraw(winnerId: string) {
    const res = await fetch(`${API_URL}/api/draws/${sessionId}/redraw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winnerId, reason: "Redraw requested by admin" }),
    });
    const data = await res.json();
    if (data.success && data.data.newWinner) {
      setWinners([{
        id: data.data.newWinner.id,
        fullName: data.data.newWinner.fullName,
        department: data.data.newWinner.department,
        prizeName: selectedPrize?.name || "",
      }]);
      triggerConfetti();
    }
  }

  function resetDraw() {
    setDrawState("idle");
    setWinners([]);
    setSessionId("");
    if (spinTimerRef.current) clearInterval(spinTimerRef.current);
    // Refresh prizes
    fetch(`${API_URL}/api/prizes?eventId=${eventId}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setPrizes(res.data);
          if (selectedPrize) {
            const updated = res.data.find((p: any) => p.id === selectedPrize.id);
            if (updated) setSelectedPrize(updated);
          }
        }
      });
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }

  const selectedEvent = events.find((e) => e.id === eventId);
  const bgUrl = selectedEvent?.settings?.luckyDrawBackground;
  const animType = selectedEvent?.settings?.luckyDrawAnimation || "pulse";

  if (isCheckingToken) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "var(--background)" }}>
        <h2 style={{ color: "white" }}>Loading...</h2>
      </div>
    );
  }

  if (!token) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "var(--background)" }}>
        <div style={{ backgroundColor: "var(--surface)", padding: "var(--space-8)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-md)", width: "100%", maxWidth: "400px" }}>
          <h2 style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>LuckyDraw Login</h2>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div>
              <label style={{ display: "block", marginBottom: "var(--space-2)" }}>Username</label>
              <input 
                type="text" 
                value={loginForm.username} 
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} 
                required 
                style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc", backgroundColor: "white", color: "black" }}
              />
            </div>
             <div>
              <label style={{ display: "block", marginBottom: "var(--space-2)" }}>Password</label>
              <div style={{ position: "relative" }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={loginForm.password} 
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} 
                  required 
                  style={{ width: "100%", padding: "0.5rem", paddingRight: "40px", borderRadius: "4px", border: "1px solid #ccc", backgroundColor: "white", color: "black" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "1.2rem",
                    color: "#999",
                    padding: 0,
                    lineHeight: 1,
                  }}
                  title={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPassword ? "👁️" : "🙈"}
                </button>
              </div>
            </div>
            {loginForm.error && <div style={{ color: "var(--color-danger)", fontSize: "0.875rem" }}>{loginForm.error}</div>}
            <button 
              type="submit" 
              disabled={loginForm.loading} 
              style={{ marginTop: "var(--space-4)", padding: "0.75rem", backgroundColor: "var(--color-primary)", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
            >
              {loginForm.loading ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    );
  }

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
            <span style={{ fontSize: "2rem" }}>🎰</span>
            <div>
              <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 800 }}>Lucky Draw Stage</h1>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>ระบบสุ่มจับรางวัลสำหรับหน้าจอ LED</p>
            </div>
          </div>
          <button
            className="btn btn--secondary btn--sm"
            onClick={handleLogout}
            style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}
          >
            🚪 ออกจากระบบ
          </button>
        </header>

        <main className="container" style={{ padding: "var(--space-10) var(--space-6)" }}>
          <div style={{ textAlign: "center", marginBottom: "var(--space-10)" }}>
            <h2 style={{ fontSize: "var(--text-3xl)", fontWeight: 800, marginBottom: "var(--space-2)" }}>
              เลือกงาน Event เพื่อเริ่มจับรางวัล
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-base)" }}>
              เลือกงานที่ต้องการเปิดเวที Lucky Draw สุ่มแจกของรางวัล
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
                    🎰 เข้าสู่เวที Lucky Draw →
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
      {/* Confetti */}
      {confetti.length > 0 && (
        <div className="confetti-container">
          {confetti.map((c) => (
            <div
              key={c.id}
              className="confetti-piece"
              style={{
                position: "absolute",
                left: c.left,
                top: "-20px",
                width: `${8 + Math.random() * 8}px`,
                height: `${8 + Math.random() * 8}px`,
                background: c.color,
                borderRadius: Math.random() > 0.5 ? "50%" : "2px",
                animation: `confetti-fall ${2 + Math.random() * 3}s ease-in-out ${c.delay} forwards`,
              }}
            />
          ))}
        </div>
      )}

      {/* Main Stage */}
      <div
        className={`draw-stage ${bgUrl ? "draw-stage--custom-bg" : ""}`}
        style={{
          background: bgUrl ? `url(${bgUrl}) center/cover fixed no-repeat` : undefined,
        }}
      >
        {/* IDLE State */}
        {drawState === "idle" && (
          <div className="draw-idle">
            {!selectedPrize ? (
              <>
                <div className="draw-idle__title">🎰 Lucky Draw</div>
                <p style={{ fontSize: "var(--text-xl)", color: "var(--text-secondary)", position: "relative", zIndex: 1 }}>
                  {selectedEvent?.name || "เลือกงานเพื่อเริ่มต้น"}
                </p>
                <div style={{ marginTop: "var(--space-4)", fontSize: "var(--text-md)", color: "var(--text-muted)" }}>
                  👇 กรุณาเลือกรางวัลจากเมนูด้านล่างเพื่อเตรียมจับรางวัล
                </div>
              </>
            ) : (
              <div style={{ position: "relative", zIndex: 1, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div className="draw-prize" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {selectedPrize.image ? (
                    <div
                      style={{
                        width: "220px",
                        height: "160px",
                        borderRadius: "var(--radius-xl)",
                        overflow: "hidden",
                        marginBottom: "var(--space-4)",
                        boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
                        border: "2px solid rgba(255,255,255,0.3)",
                        background: "var(--bg-tertiary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <img
                        src={selectedPrize.image}
                        alt={selectedPrize.name}
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    </div>
                  ) : (
                    <div className="draw-prize__icon" style={{ fontSize: "5rem" }}>🎁</div>
                  )}
                  <div className="draw-prize__name" style={{ fontSize: "var(--text-4xl)", fontWeight: 900 }}>{selectedPrize.name}</div>
                  {selectedPrize.description && (
                    <div style={{ color: "var(--text-secondary)", fontSize: "var(--text-lg)", marginTop: "var(--space-2)", maxWidth: "500px" }}>
                      {selectedPrize.description}
                    </div>
                  )}
                  <div style={{ marginTop: "var(--space-4)", display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
                    <span className="badge badge--primary" style={{ fontSize: "var(--text-base)", padding: "var(--space-2) var(--space-4)" }}>
                      🎁 รางวัลทั้งหมด: {selectedPrize.quantity}
                    </span>
                    <span className={`badge ${selectedPrize.remaining > 0 ? "badge--success" : "badge--error"}`} style={{ fontSize: "var(--text-base)", padding: "var(--space-2) var(--space-4)" }}>
                      คงเหลือ: {selectedPrize.remaining} / {selectedPrize.quantity}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SPINNING State */}
        {(drawState === "spinning" || drawState === "selecting") && (
          <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
            {selectedPrize && (
              <div className="draw-prize" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                {selectedPrize.image ? (
                  <div
                    style={{
                      width: "180px",
                      height: "140px",
                      borderRadius: "var(--radius-xl)",
                      overflow: "hidden",
                      marginBottom: "var(--space-4)",
                      boxShadow: "0 15px 35px rgba(0,0,0,0.5)",
                      border: "2px solid rgba(255,255,255,0.2)",
                      background: "var(--bg-tertiary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src={selectedPrize.image}
                      alt={selectedPrize.name}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  </div>
                ) : (
                  <div className="draw-prize__icon">🎁</div>
                )}
                <div className="draw-prize__name">{selectedPrize.name}</div>
                <div style={{ color: "var(--text-secondary)", fontSize: "var(--text-lg)" }}>
                  {selectedPrize.description}
                </div>
              </div>
            )}

            <div className="draw-slot">
              <div className="draw-slot__inner">
                <div 
                  className="draw-slot__item" 
                  style={{ 
                    animation: drawState === "spinning" && animType === "pulse" ? "pulse 0.3s infinite" : "none",
                    transform: drawState === "spinning" && animType === "random" ? `scale(${1 + Math.random() * 0.4}) rotate(${Math.random() * 20 - 10}deg)` : 
                               drawState === "spinning" && animType === "slot" ? `translateY(${(currentSpinIndex % 2 === 0 ? -15 : 15)}px)` : "none",
                    color: drawState === "spinning" && animType === "random" ? `hsl(${Math.random() * 360}, 80%, 60%)` : "inherit",
                    filter: drawState === "spinning" && animType === "slot" ? "blur(2px)" : "none",
                    transition: "all 0.05s"
                  }}
                >
                  {drawState === "selecting" ? (
                    <span className="spinner spinner--lg" />
                  ) : (
                    spinNames[currentSpinIndex] || "..."
                  )}
                </div>
              </div>
            </div>

            {drawState === "spinning" && (
              <p style={{ marginTop: "var(--space-6)", color: "var(--color-primary-light)", fontSize: "var(--text-lg)", animation: "pulse 1s infinite" }}>
                🎲 กำลังสุ่ม...
              </p>
            )}
          </div>
        )}

        {/* WINNER State */}
        {drawState === "winner" && winners.length > 0 && (
          <div className="draw-winner" style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: "1000px", padding: "0 var(--space-6)" }}>
            <div style={{ fontSize: "4rem", marginBottom: "var(--space-1)" }}>🏆</div>
            <div style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--color-accent-light)", marginBottom: "var(--space-4)" }}>
              ขอแสดงความยินดีกับผู้โชคดี ({winners.length} ท่าน)!
            </div>
            {selectedPrize?.image && (
              <div
                style={{
                  width: "140px",
                  height: "100px",
                  borderRadius: "var(--radius-lg)",
                  overflow: "hidden",
                  marginBottom: "var(--space-4)",
                  boxShadow: "0 0 25px rgba(245, 158, 11, 0.4)",
                  border: "2px solid var(--color-accent-light)",
                  background: "var(--bg-tertiary)",
                }}
              >
                <img
                  src={selectedPrize.image}
                  alt={selectedPrize.name}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </div>
            )}

            {/* Single Winner Display */}
            {winners.length === 1 ? (
              <div style={{ textAlign: "center" }}>
                {(winners[0]!.runningNumber || winners[0]!.ticketNumber || winners[0]!.luckyDrawNumber) && (
                  <div
                    style={{
                      display: "inline-block",
                      padding: "var(--space-2) var(--space-6)",
                      background: "linear-gradient(135deg, #f59e0b, #d97706)",
                      color: "#fff",
                      borderRadius: "var(--radius-full)",
                      fontSize: "var(--text-2xl)",
                      fontWeight: 800,
                      marginBottom: "var(--space-3)",
                      boxShadow: "0 4px 15px rgba(245, 158, 11, 0.4)",
                    }}
                  >
                    🎟️ {winners[0]!.runningNumber || winners[0]!.ticketNumber || winners[0]!.luckyDrawNumber}
                  </div>
                )}
                <div className="draw-winner__name">{winners[0]!.fullName}</div>
                {(winners[0]!.department || winners[0]!.company) && (
                  <div className="draw-winner__dept">{winners[0]!.department || winners[0]!.company}</div>
                )}
                <div className="draw-winner__prize">🎁 {winners[0]!.prizeName}</div>
              </div>
            ) : (
              /* Multiple Winners Grid Display */
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: winners.length <= 4 ? "repeat(auto-fit, minmax(220px, 1fr))" : "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "var(--space-4)",
                  width: "100%",
                  maxHeight: "60vh",
                  overflowY: "auto",
                  padding: "var(--space-2)",
                }}
              >
                {winners.map((w, i) => (
                  <div
                    key={w.id || i}
                    style={{
                      background: "rgba(30, 41, 59, 0.8)",
                      border: "1px solid var(--color-accent-light)",
                      borderRadius: "var(--radius-xl)",
                      padding: "var(--space-4)",
                      textAlign: "center",
                      boxShadow: "0 10px 25px rgba(0,0,0,0.4)",
                    }}
                  >
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--color-accent-light)", fontWeight: 700, marginBottom: "var(--space-1)" }}>
                      ลำดับที่ {i + 1}
                    </div>
                    {(w.runningNumber || w.ticketNumber || w.luckyDrawNumber) && (
                      <div
                        style={{
                          display: "inline-block",
                          padding: "2px 10px",
                          background: "rgba(245, 158, 11, 0.2)",
                          border: "1px solid #f59e0b",
                          borderRadius: "12px",
                          color: "#fbbf24",
                          fontSize: "var(--text-sm)",
                          fontWeight: 800,
                          marginBottom: "var(--space-2)",
                        }}
                      >
                        🎟️ {w.runningNumber || w.ticketNumber || w.luckyDrawNumber}
                      </div>
                    )}
                    <div style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: "#fff", marginBottom: "var(--space-1)" }}>
                      {w.fullName}
                    </div>
                    {(w.department || w.company) && (
                      <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-2)" }}>
                        {w.department || w.company}
                      </div>
                    )}
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--color-primary-light)" }}>
                      🎁 {w.prizeName}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: "var(--space-6)", display: "flex", gap: "var(--space-3)", justifyContent: "center" }}>
              <button className="btn btn--primary btn--xl" onClick={resetDraw}>
                🎰 จับรางวัลต่อ
              </button>
              {winners.length === 1 && (
                <button
                  className="btn btn--secondary btn--lg"
                  onClick={() => handleRedraw(winners[0]!.id)}
                >
                  🔄 Re-draw
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className={`draw-controls ${!showControls ? "draw-controls--hidden" : ""}`}>
        <div className="flex gap-4" style={{ alignItems: "center" }}>
          <button
            className="btn btn--secondary btn--sm"
            onClick={() => {
              setEventId("");
              setSelectedPrize(null);
            }}
            title="กลับไปหน้าเลือกงาน"
          >
            ← เลือกงานใหม่
          </button>

          <button
            className="btn btn--secondary btn--sm"
            onClick={handleLogout}
            title="ออกจากระบบ"
            style={{ borderColor: "rgba(239,68,68,0.3)" }}
          >
            🚪 ออกจากระบบ
          </button>

          <select
            className="form-input"
            value={selectedPrize?.id || ""}
            onChange={(e) => {
              const prize = prizes.find((p) => p.id === e.target.value) || null;
              setSelectedPrize(prize);
            }}
            style={{ width: "280px" }}
          >
            <option value="">-- เลือกรางวัล --</option>
            {prizes.map((p) => (
              <option key={p.id} value={p.id} disabled={p.remaining <= 0}>
                {p.name} (เหลือ {p.remaining}/{p.quantity} รางวัล)
              </option>
            ))}
          </select>

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>จำนวนผู้ชนะ:</span>
            <input
              type="number"
              min={1}
              max={selectedPrize ? Math.max(1, Math.min(selectedPrize.remaining, selectedPrize.eligibleCount ?? selectedPrize.remaining)) : 1}
              value={drawCountInput}
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value) || 1);
                const maxDrawable = selectedPrize ? Math.min(selectedPrize.remaining, selectedPrize.eligibleCount ?? selectedPrize.remaining) : val;
                setDrawCountInput(Math.min(val, Math.max(1, maxDrawable)));
              }}
              style={{
                width: "60px",
                padding: "0.4rem 0.5rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                fontSize: "var(--text-sm)",
                textAlign: "center",
              }}
            />
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>คน</span>
          </div>

          <button
            className="btn btn--primary btn--lg"
            disabled={
              !selectedPrize ||
              selectedPrize.remaining <= 0 ||
              (selectedPrize.eligibleCount !== undefined && selectedPrize.eligibleCount <= 0) ||
              drawState !== "idle"
            }
            onClick={() => startDraw(drawCountInput)}
          >
            {!selectedPrize
              ? "🎲 สุ่มรางวัล"
              : selectedPrize.remaining <= 0
              ? "❌ รางวัลแจกหมดแล้ว"
              : selectedPrize.eligibleCount !== undefined && selectedPrize.eligibleCount <= 0
              ? "❌ ไม่มีผู้มีสิทธิ์ (0 คน)"
              : `🎲 สุ่ม ${drawCountInput} รางวัล`}
          </button>
        </div>

        <div className="flex gap-2">
          <button className="btn btn--ghost" onClick={() => setShowSidebar(!showSidebar)}>
            🏆 ผู้ชนะ ({allWinners.length})
          </button>
          <button className="btn btn--ghost" onClick={toggleFullscreen}>
            ⛶ เต็มจอ
          </button>
          <button className="btn btn--ghost" onClick={() => setShowControls(false)}>
            ▾ ซ่อน
          </button>
        </div>
      </div>

      {/* Show controls button when hidden */}
      {!showControls && (
        <button
          className="btn btn--ghost"
          style={{
            position: "fixed",
            bottom: "var(--space-4)",
            right: "var(--space-4)",
            zIndex: 60,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-subtle)",
          }}
          onClick={() => setShowControls(true)}
        >
          ▴ แสดง Controls
        </button>
      )}

      {/* Winners Sidebar */}
      <div className={`draw-sidebar ${showSidebar ? "draw-sidebar--open" : ""}`}>
        <div className="flex-between" style={{ marginBottom: "var(--space-6)" }}>
          <h3 style={{ fontWeight: 700 }}>🏆 ผู้ชนะทั้งหมด</h3>
          <button className="btn btn--ghost btn--icon" onClick={() => setShowSidebar(false)}>✕</button>
        </div>
        {allWinners.length === 0 ? (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "var(--space-8) 0" }}>
            ยังไม่มีผู้ชนะ
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {allWinners.map((w, i) => (
              <div
                key={`${w.id}-${i}`}
                style={{
                  padding: "var(--space-3)",
                  background: "var(--bg-glass)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{w.fullName}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                  <span>{w.department || ""}</span>
                  <span style={{ color: "var(--color-accent-light)" }}>🎁 {w.prizeName}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom Alert Popup Modal */}
      {alertModal.show && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ maxWidth: "420px", width: "100%", background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "16px", padding: "1.75rem", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.6)", textAlign: "center", animation: "scaleUp 0.2s ease-out" }}>
            <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>
              {alertModal.type === "success" ? "🎉" : alertModal.type === "warning" ? "⚠️" : alertModal.type === "info" ? "ℹ️" : "❌"}
            </div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: alertModal.type === "success" ? "#10B981" : alertModal.type === "warning" ? "#F59E0B" : alertModal.type === "info" ? "#3B82F6" : "#EF4444", marginBottom: "0.5rem" }}>
              {alertModal.title || (alertModal.type === "success" ? "ทำรายการสำเร็จ" : alertModal.type === "warning" ? "แจ้งเตือน" : alertModal.type === "info" ? "แจ้งเตือน" : "เกิดข้อผิดพลาด")}
            </h3>
            <p style={{ fontSize: "0.95rem", color: "#cbd5e1", whiteSpace: "pre-line", lineHeight: "1.5", marginBottom: "1.5rem" }}>
              {alertModal.message}
            </p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setAlertModal((prev) => ({ ...prev, show: false }))}
              style={{ minWidth: "130px", padding: "0.6rem 1.6rem", borderRadius: "10px", fontWeight: 600, margin: "0 auto", background: alertModal.type === "success" ? "linear-gradient(135deg, #10B981, #059669)" : alertModal.type === "warning" ? "linear-gradient(135deg, #F59E0B, #D97706)" : alertModal.type === "info" ? "linear-gradient(135deg, #3B82F6, #2563EB)" : "linear-gradient(135deg, #EF4444, #DC2626)" }}
            >
              ตกลง (OK)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
