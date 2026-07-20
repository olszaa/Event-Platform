"use client";

import { useState, useEffect } from "react";
import type { Event as EventType } from "@event-platform/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function HomePage() {
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/events?status=PUBLISHED,ACTIVE,CLOSED`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setEvents(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Hero */}
      <header
        style={{
          textAlign: "center",
          padding: "var(--space-24) var(--space-6) var(--space-16)",
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

      {/* Events Grid */}
      <main className="container">
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
                ยังไม่มีงานที่เปิดลงทะเบียน
              </h2>
              <p>กรุณาตรวจสอบอีกครั้งในภายหลัง</p>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
            {/* Featured Event (Top Card) */}
            {events.length > 0 && (() => {
              const featured = events[0]!;
              const themeColor = featured.settings?.themeColor || "var(--color-primary-dark)";
              const bgUrl = featured.coverImage || featured.settings?.registerBackground;
              
              return (
                <a
                  href={`/register/${featured.id}`}
                  style={{ textDecoration: "none", color: "inherit", display: "block" }}
                >
                  <div className="glass-card" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-6)", padding: "var(--space-8)", position: "relative", overflow: "hidden" }}>
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
                      <div style={{ marginBottom: "var(--space-2)" }}>
                        <span className="badge badge--primary" style={{ backgroundColor: themeColor, color: "#fff", borderColor: themeColor }}>🔥 งานแนะนำ</span>
                      </div>
                      <h2 style={{ fontSize: "var(--text-3xl)", fontWeight: 800, marginBottom: "var(--space-4)" }}>{featured.name}</h2>
                      <p style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)", marginBottom: "var(--space-6)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {featured.description || "ไม่มีรายละเอียดเพิ่มเติม"}
                      </p>
                      <div style={{ display: "flex", gap: "var(--space-4)", fontSize: "var(--text-sm)", color: "var(--text-muted)", marginBottom: "var(--space-6)" }}>
                        <span>📅 {new Date(featured.startDate).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}</span>
                        {featured.venue && <span>📍 {featured.venue}</span>}
                      </div>
                      <div>
                        <span 
                          className={`btn ${featured.status === "CLOSED" ? "btn--neutral" : "btn--primary"}`} 
                          style={featured.status === "CLOSED" ? {} : { backgroundColor: themeColor, borderColor: themeColor }}
                        >
                          {featured.status === "CLOSED" ? "ประวัติงาน (ปิดรับลงทะเบียน)" : "ลงทะเบียนเข้างาน →"}
                        </span>
                      </div>
                    </div>
                  </div>
                </a>
              );
            })()}

            {/* Other Events List (Bottom List) */}
            {events.length > 1 && (
              <div>
                <h3 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "var(--space-6)", paddingBottom: "var(--space-2)", borderBottom: "1px solid var(--border-subtle)" }}>
                  งาน Event อื่นๆ
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  {events.slice(1).map((event) => {
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
                            <h4 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-1)" }}>{event.name}</h4>
                            <div style={{ display: "flex", gap: "var(--space-4)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                              <span>📅 {new Date(event.startDate).toLocaleDateString("th-TH")}</span>
                              {event.venue && <span>📍 {event.venue}</span>}
                            </div>
                          </div>
                          <div>
                            <span 
                              className={`btn btn--sm ${event.status === "CLOSED" ? "btn--neutral" : "btn--ghost"}`} 
                              style={event.status === "CLOSED" ? {} : { color: themeColor }}
                            >
                              {event.status === "CLOSED" ? "ประวัติงาน" : "ดูรายละเอียด"}
                            </span>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
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
