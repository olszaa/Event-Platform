"use client";

import { useState, useEffect } from "react";
import type { Event } from "@event-platform/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function HomePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/events?status=PUBLISHED`)
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
          <div className="grid grid-3 gap-6">
            {events.map((event) => (
              <a
                key={event.id}
                href={`/register/${event.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="glass-card" style={{ height: "100%", transition: "all 0.3s" }}>
                  {/* Event Cover */}
                  <div
                    style={{
                      height: "160px",
                      borderRadius: "var(--radius-lg)",
                      marginBottom: "var(--space-4)",
                      background:
                        "linear-gradient(135deg, var(--bg-tertiary) 0%, var(--color-primary-dark) 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "3rem",
                    }}
                  >
                    🎪
                  </div>
                  <h3
                    style={{
                      fontSize: "var(--text-lg)",
                      fontWeight: 700,
                      marginBottom: "var(--space-2)",
                    }}
                  >
                    {event.name}
                  </h3>
                  {event.description && (
                    <p
                      style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--text-secondary)",
                        marginBottom: "var(--space-3)",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {event.description}
                    </p>
                  )}
                  <div
                    style={{
                      display: "flex",
                      gap: "var(--space-4)",
                      fontSize: "var(--text-xs)",
                      color: "var(--text-muted)",
                    }}
                  >
                    <span>
                      📅{" "}
                      {new Date(event.startDate).toLocaleDateString("th-TH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {event.venue && <span>📍 {event.venue}</span>}
                  </div>
                  <div style={{ marginTop: "var(--space-4)" }}>
                    <span className="badge badge--primary">เปิดลงทะเบียน</span>
                  </div>
                </div>
              </a>
            ))}
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
