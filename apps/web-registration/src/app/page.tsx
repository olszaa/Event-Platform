"use client";

import { useState, useEffect } from "react";
import type { Event as EventType } from "@event-platform/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getThaiStatusLabel(status: string) {
  switch (status) {
    case "DRAFT": return "ฉบับร่าง";
    case "PUBLISHED": return "เปิดลงทะเบียน";
    case "ACTIVE": return "กำลังดำเนินงาน";
    case "CLOSED": return "สิ้นสุดกิจกรรม";
    case "ARCHIVED": return "จัดเก็บแล้ว";
    default: return status;
  }
}

function getStatusBadgeStyle(status: string, themeColor?: string) {
  switch (status) {
    case "PUBLISHED":
      return { backgroundColor: themeColor || "var(--color-primary)", color: "#fff", borderColor: themeColor || "var(--color-primary)" };
    case "ACTIVE":
      return { backgroundColor: "var(--color-success)", color: "#fff", borderColor: "var(--color-success)" };
    case "CLOSED":
    case "ARCHIVED":
      return { backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)", borderColor: "var(--border-subtle)" };
    default:
      return {};
  }
}

export default function HomePage() {
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinnedIndex, setPinnedIndex] = useState(0);

  useEffect(() => {
    fetch(`${API_URL}/api/events?status=PUBLISHED,ACTIVE,CLOSED,ARCHIVED`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setEvents(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const pinnedEvents = events.filter((e) => e.settings?.isPinned && e.status !== "DRAFT");
  const otherActiveEvents = events.filter((e) => !e.settings?.isPinned && (e.status === "PUBLISHED" || e.status === "ACTIVE"));
  const pastEvents = events.filter((e) => e.status === "CLOSED" || e.status === "ARCHIVED");

  // Auto slide for Pinned Events
  useEffect(() => {
    if (pinnedEvents.length <= 1) return;
    const timer = setInterval(() => {
      setPinnedIndex((prev) => (prev + 1) % pinnedEvents.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [pinnedEvents.length]);

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Hero */}
      <header
        style={{
          textAlign: "center",
          padding: "var(--space-20) var(--space-6) var(--space-12)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "600px",
            height: "600px",
            background:
              "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)",
            borderRadius: "50%",
            filter: "blur(60px)",
            pointerEvents: "none",
          }}
        />
        <h1
          style={{
            fontSize: "var(--text-5xl)",
            fontWeight: 900,
            marginBottom: "var(--space-4)",
            background:
              "linear-gradient(135deg, var(--color-primary-light) 0%, var(--color-secondary-light) 50%, var(--color-accent-light) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            position: "relative",
          }}
        >
          🎉 Event Registration
        </h1>
        <p
          style={{
            fontSize: "var(--text-lg)",
            color: "var(--text-secondary)",
            maxWidth: "600px",
            margin: "0 auto",
            position: "relative",
          }}
        >
          เลือกงานที่ต้องการเข้าร่วม แล้วลงทะเบียนได้เลย
        </p>
      </header>

      {/* Main Content */}
      <main className="container" style={{ paddingBottom: "var(--space-16)" }}>
        {loading ? (
          <div className="flex-center" style={{ padding: "var(--space-16)" }}>
            <span className="spinner spinner--lg" />
          </div>
        ) : events.length === 0 ? (
          <div
            className="glass-card flex-center"
            style={{
              padding: "var(--space-16)",
              textAlign: "center",
              color: "var(--text-muted)",
            }}
          >
            <div>
              <div style={{ fontSize: "3rem", marginBottom: "var(--space-4)" }}>📭</div>
              <h2 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-2)" }}>
                ยังไม่มีงานในขณะนี้
              </h2>
              <p>กรุณาตรวจสอบอีกครั้งในภายหลัง</p>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
            {/* 🔴 ส่วนที่ 1: Pinned Events Carousel (Slide from Pin to top) */}
            {pinnedEvents.length > 0 && (() => {
              const current = pinnedEvents[pinnedIndex] || pinnedEvents[0]!;
              const themeColor = current.settings?.themeColor || "var(--color-primary-dark)";
              const bgUrl = current.coverImage || current.settings?.registerBackground;

              return (
                <section>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
                    <h3 style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: "var(--text-primary)" }}>
                      📌 งานแนะนำ (Featured Events)
                    </h3>
                    {pinnedEvents.length > 1 && (
                      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                        <button
                          className="btn btn--secondary btn--sm"
                          onClick={() => setPinnedIndex((prev) => (prev - 1 + pinnedEvents.length) % pinnedEvents.length)}
                        >
                          ‹
                        </button>
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                          {pinnedIndex + 1} / {pinnedEvents.length}
                        </span>
                        <button
                          className="btn btn--secondary btn--sm"
                          onClick={() => setPinnedIndex((prev) => (prev + 1) % pinnedEvents.length)}
                        >
                          ›
                        </button>
                      </div>
                    )}
                  </div>

                  <a
                    href={`/register/${current.id}`}
                    style={{ textDecoration: "none", color: "inherit", display: "block" }}
                  >
                    <div className="glass-card" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-6)", padding: "var(--space-8)", position: "relative", overflow: "hidden", transition: "all 0.5s ease-in-out" }}>
                      <div
                        style={{
                          flex: "1 1 300px",
                          height: "300px",
                          borderRadius: "var(--radius-lg)",
                          background: bgUrl ? `url(${bgUrl}) center/cover no-repeat` : `linear-gradient(135deg, var(--bg-tertiary) 0%, ${themeColor} 100%)`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "5rem",
                        }}
                      >
                        {!bgUrl && "🎪"}
                      </div>
                      <div style={{ flex: "2 1 400px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                        <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)", flexWrap: "wrap" }}>
                          <span className="badge" style={{ backgroundColor: "var(--color-primary)", color: "#fff" }}>🔥 งานปักหมุด</span>
                          <span className="badge" style={getStatusBadgeStyle(current.status, themeColor)}>
                            {getThaiStatusLabel(current.status)}
                          </span>
                        </div>
                        <h2 style={{ fontSize: "var(--text-3xl)", fontWeight: 800, marginBottom: "var(--space-4)" }}>{current.name}</h2>
                        <p style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)", marginBottom: "var(--space-6)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {current.description || "ไม่มีรายละเอียดเพิ่มเติม"}
                        </p>
                        <div style={{ display: "flex", gap: "var(--space-4)", fontSize: "var(--text-sm)", color: "var(--text-muted)", marginBottom: "var(--space-6)" }}>
                          <span>📅 {new Date(current.startDate).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}</span>
                          {current.venue && <span>📍 {current.venue}</span>}
                        </div>
                        <div>
                          <span 
                            className={`btn ${current.status === "CLOSED" || current.status === "ARCHIVED" ? "btn--neutral" : "btn--primary"}`} 
                            style={current.status === "CLOSED" || current.status === "ARCHIVED" ? {} : { backgroundColor: themeColor, borderColor: themeColor }}
                          >
                            {current.status === "CLOSED" || current.status === "ARCHIVED" ? "ดูรายละเอียดงาน" : "ลงทะเบียนเข้างาน →"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </a>

                  {/* Carousel Dots */}
                  {pinnedEvents.length > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
                      {pinnedEvents.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setPinnedIndex(idx)}
                          style={{
                            width: idx === pinnedIndex ? "24px" : "8px",
                            height: "8px",
                            borderRadius: "4px",
                            border: "none",
                            backgroundColor: idx === pinnedIndex ? "var(--color-primary)" : "var(--border-subtle)",
                            cursor: "pointer",
                            transition: "all 0.3s"
                          }}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })()}

            {/* 🟢 ส่วนที่ 2: งานอื่นๆ ที่เปิดลงทะเบียน / กำลังดำเนินงาน (PUBLISHED & ACTIVE) */}
            {otherActiveEvents.length > 0 && (
              <section>
                <h3 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "var(--space-6)", paddingBottom: "var(--space-2)", borderBottom: "1px solid var(--border-subtle)" }}>
                  ⚡ งาน Event ที่เปิดอยู่
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  {otherActiveEvents.map((event) => {
                    const themeColor = event.settings?.themeColor || "var(--color-primary)";
                    const bgUrl = event.coverImage || event.settings?.registerBackground;
                    return (
                      <a
                        key={event.id}
                        href={`/register/${event.id}`}
                        style={{ textDecoration: "none", color: "inherit" }}
                      >
                        <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", padding: "var(--space-4)", transition: "all 0.3s" }}>
                          <div
                            style={{
                              width: "80px",
                              height: "80px",
                              borderRadius: "var(--radius-md)",
                              background: bgUrl ? `url(${bgUrl}) center/cover no-repeat` : `linear-gradient(135deg, var(--bg-tertiary) 0%, ${themeColor} 100%)`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "2rem",
                              flexShrink: 0
                            }}
                          >
                            {!bgUrl && "🎪"}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginBottom: "var(--space-1)" }}>
                              <h4 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>{event.name}</h4>
                              <span className="badge" style={getStatusBadgeStyle(event.status, themeColor)}>
                                {getThaiStatusLabel(event.status)}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: "var(--space-4)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                              <span>📅 {new Date(event.startDate).toLocaleDateString("th-TH")}</span>
                              {event.venue && <span>📍 {event.venue}</span>}
                            </div>
                          </div>
                          <div>
                            <span 
                              className="btn btn--sm btn--primary" 
                              style={{ backgroundColor: themeColor, borderColor: themeColor }}
                            >
                              ลงทะเบียน →
                            </span>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ⚪ ส่วนที่ 3: งานที่ผ่านมาแล้ว (CLOSED & ARCHIVED) */}
            {pastEvents.length > 0 && (
              <section>
                <h3 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "var(--space-6)", paddingBottom: "var(--space-2)", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                  🏛️ งานที่ผ่านมาแล้ว (Past Events)
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  {pastEvents.map((event) => {
                    const bgUrl = event.coverImage || event.settings?.registerBackground;
                    return (
                      <a
                        key={event.id}
                        href={`/register/${event.id}`}
                        style={{ textDecoration: "none", color: "inherit", opacity: 0.85 }}
                      >
                        <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", padding: "var(--space-4)", transition: "all 0.3s" }}>
                          <div
                            style={{
                              width: "80px",
                              height: "80px",
                              borderRadius: "var(--radius-md)",
                              background: bgUrl ? `url(${bgUrl}) center/cover no-repeat` : "var(--bg-tertiary)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "2rem",
                              flexShrink: 0
                            }}
                          >
                            {!bgUrl && "📁"}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginBottom: "var(--space-1)" }}>
                              <h4 style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--text-secondary)" }}>{event.name}</h4>
                              <span className="badge" style={getStatusBadgeStyle(event.status)}>
                                {getThaiStatusLabel(event.status)}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: "var(--space-4)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                              <span>📅 {new Date(event.startDate).toLocaleDateString("th-TH")}</span>
                              {event.venue && <span>📍 {event.venue}</span>}
                            </div>
                          </div>
                          <div>
                            <span className="btn btn--sm btn--neutral">
                              ดูรายละเอียด
                            </span>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          textAlign: "center",
          padding: "var(--space-12) var(--space-6)",
          color: "var(--text-muted)",
          fontSize: "var(--text-sm)",
        }}
      >
        Event Platform © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
