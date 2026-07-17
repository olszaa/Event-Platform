"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { DrawResultEvent, DrawSpinningEvent } from "@event-platform/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4000";

type DrawState = "idle" | "selecting" | "spinning" | "revealing" | "winner";

interface Prize {
  id: string;
  name: string;
  description?: string;
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
  const [eventId, setEventId] = useState("");
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
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

  // Load events
  useEffect(() => {
    fetch(`${API_URL}/api/events`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setEvents(res.data);
          if (res.data.length > 0) setEventId(res.data[0].id);
        }
      });
  }, []);

  // Load prizes & connect socket
  useEffect(() => {
    if (!eventId) return;

    fetch(`${API_URL}/api/prizes?eventId=${eventId}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setPrizes(res.data); });

    // Load existing winners
    fetch(`${API_URL}/api/draws/winners/all?eventId=${eventId}`)
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
    const res = await fetch(`${API_URL}/api/draws`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    fetch(`${API_URL}/api/prizes?eventId=${eventId}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setPrizes(res.data); });
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }

  return (
    <>
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
      <div className="draw-stage">
        {/* IDLE State */}
        {drawState === "idle" && (
          <div className="draw-idle">
            <div className="draw-idle__title">🎰 Lucky Draw</div>
            <p style={{ fontSize: "var(--text-xl)", color: "var(--text-secondary)", position: "relative", zIndex: 1 }}>
              {events.find((e) => e.id === eventId)?.name || "เลือกงานเพื่อเริ่มต้น"}
            </p>
          </div>
        )}

        {/* SPINNING State */}
        {(drawState === "spinning" || drawState === "selecting") && (
          <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
            {selectedPrize && (
              <div className="draw-prize">
                <div className="draw-prize__icon">🎁</div>
                <div className="draw-prize__name">{selectedPrize.name}</div>
                <div style={{ color: "var(--text-secondary)", fontSize: "var(--text-lg)" }}>
                  {selectedPrize.description}
                </div>
              </div>
            )}

            <div className="draw-slot">
              <div className="draw-slot__inner">
                <div className="draw-slot__item" style={{ animation: drawState === "spinning" ? "pulse 0.3s infinite" : "none" }}>
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
          <div className="draw-winner">
            <div style={{ fontSize: "5rem", marginBottom: "var(--space-4)" }}>🏆</div>
            <div style={{ fontSize: "var(--text-xl)", color: "var(--text-muted)", marginBottom: "var(--space-3)" }}>
              ยินดีด้วย!
            </div>
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
            style={{ width: "250px" }}
          >
            <option value="">-- เลือกรางวัล --</option>
            {prizes.map((p) => (
              <option key={p.id} value={p.id} disabled={p.remaining <= 0}>
                {p.name} (เหลือ {p.remaining}/{p.quantity})
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
    </>
  );
}
