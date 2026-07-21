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
}

interface Winner {
  id: string;
  fullName: string;
  department?: string;
  company?: string;
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

  const [eventId, setEventId] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [selectedPrize, setSelectedPrize] = useState<Prize | null>(null);
  const [drawState, setDrawState] = useState<DrawState>("idle");
  const [sessionId, setSessionId] = useState("");
  const [spinNames, setSpinNames] = useState<string[]>([]);
  const [currentSpinIndex, setCurrentSpinIndex] = useState(0);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [allWinners, setAllWinners] = useState<Winner[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [confetti, setConfetti] = useState<{ id: number; color: string; left: string; delay: string }[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const spinTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("admin_token");
    if (savedToken) setToken(savedToken);
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
    } catch (err) {
      setLoginForm((prev) => ({ ...prev, error: "Network error" }));
    } finally {
      setLoginForm((prev) => ({ ...prev, loading: false }));
    }
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
          if (res.data.length > 0) setEventId(res.data[0].id);
        }
      });
  }, [token]);

  // Load prizes & connect socket
  useEffect(() => {
    if (!eventId) return;

    fetch(`${API_URL}/api/prizes?eventId=${eventId}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((res) => { if (res.success) setPrizes(res.data); });

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

  async function startDraw() {
    if (!selectedPrize || !eventId) return;

    setDrawState("selecting");

    // Create draw session
    const res = await fetch(`${API_URL}/api/draws/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ eventId, prizeId: selectedPrize.id, drawCount: 1 }),
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.error || "ไม่สามารถเริ่มจับรางวัลได้");
      setDrawState("idle");
      return;
    }

    setSessionId(data.data.id);
    setDrawState("spinning");

    // Spin!
    const spinRes = await fetch(`${API_URL}/api/draws/${data.data.id}/spin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: 1 }),
    });
    const spinData = await spinRes.json();

    // Socket.io will handle the result event
    if (!spinData.success && !socketRef.current?.connected) {
      // Fallback if socket doesn't trigger
      if (spinData.data?.winners) {
        setWinners(spinData.data.winners);
        setDrawState("winner");
        triggerConfetti();
      }
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
              <input 
                type="password" 
                value={loginForm.password} 
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} 
                required 
                style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc", backgroundColor: "white", color: "black" }}
              />
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
                  {events.find((e) => e.id === eventId)?.name || "เลือกงานเพื่อเริ่มต้น"}
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

                <div style={{ marginTop: "var(--space-6)" }}>
                  <button
                    className="btn btn--primary btn--xl"
                    disabled={selectedPrize.remaining <= 0}
                    onClick={startDraw}
                    style={{ fontSize: "var(--text-xl)", padding: "var(--space-4) var(--space-8)" }}
                  >
                    {selectedPrize.remaining > 0 ? "🎲 เริ่มสุ่มรางวัล →" : "❌ รางวัลแจกหมดแล้ว"}
                  </button>
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
          <div className="draw-winner" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: "5rem", marginBottom: "var(--space-2)" }}>🏆</div>
            <div style={{ fontSize: "var(--text-xl)", color: "var(--text-muted)", marginBottom: "var(--space-3)" }}>
              ยินดีด้วย!
            </div>
            {selectedPrize?.image && (
              <div
                style={{
                  width: "160px",
                  height: "120px",
                  borderRadius: "var(--radius-xl)",
                  overflow: "hidden",
                  marginBottom: "var(--space-4)",
                  boxShadow: "0 0 30px rgba(245, 158, 11, 0.4)",
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
            {winners.map((w, i) => (
              <div key={i}>
                <div className="draw-winner__name">{w.fullName}</div>
                {w.department && <div className="draw-winner__dept">{w.department}</div>}
                <div className="draw-winner__prize">
                  🎁 {w.prizeName}
                </div>
              </div>
            ))}

            <div style={{ marginTop: "var(--space-8)", display: "flex", gap: "var(--space-3)", justifyContent: "center" }}>
              <button className="btn btn--primary btn--xl" onClick={resetDraw}>
                🎰 จับรางวัลต่อ
              </button>
              <button
                className="btn btn--secondary btn--lg"
                onClick={() => winners[0] && handleRedraw(winners[0].id)}
              >
                🔄 Re-draw
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className={`draw-controls ${!showControls ? "draw-controls--hidden" : ""}`}>
        <div className="flex gap-4" style={{ alignItems: "center" }}>
          <select
            className="form-input"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            style={{ width: "200px" }}
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>

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

          <button
            className="btn btn--primary btn--lg"
            disabled={!selectedPrize || selectedPrize.remaining <= 0 || drawState !== "idle"}
            onClick={startDraw}
          >
            🎲 สุ่มรางวัล
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
    </div>
  );
}
