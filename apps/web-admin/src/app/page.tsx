"use client";

import { useState, useEffect } from "react";
import { Modal, Input, TextArea, Button } from "@event-platform/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Tab = "dashboard" | "events" | "registrations" | "prizes" | "draws" | "audit";

const NAV_ITEMS: { key: Tab; icon: string; label: string }[] = [
  { key: "dashboard", icon: "📊", label: "Dashboard" },
  { key: "events", icon: "🎪", label: "จัดการงาน" },
  { key: "registrations", icon: "📋", label: "ผู้ลงทะเบียน" },
  { key: "prizes", icon: "🎁", label: "รางวัล" },
  { key: "draws", icon: "🎰", label: "ผลจับรางวัล" },
  { key: "audit", icon: "📜", label: "Audit Log" },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [prizes, setPrizes] = useState<any[]>([]);
  const [drawSessions, setDrawSessions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // New Event State
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    name: "",
    description: "",
    venue: "",
    startDate: "",
    endDate: "",
  });

  // Load events
  useEffect(() => {
    fetch(`${API_URL}/api/events`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setEvents(res.data);
          if (res.data.length > 0 && !selectedEventId) setSelectedEventId(res.data[0].id);
        }
      });
  }, []);

  // Load data when event or tab changes
  useEffect(() => {
    if (!selectedEventId) return;
    setLoading(true);

    const loads: Promise<void>[] = [];

    if (activeTab === "dashboard") {
      loads.push(
        fetch(`${API_URL}/api/events/${selectedEventId}/stats`)
          .then((r) => r.json())
          .then((res) => { if (res.success) setStats(res.data); })
      );
    }

    if (activeTab === "registrations" || activeTab === "dashboard") {
      loads.push(
        fetch(`${API_URL}/api/registrations?eventId=${selectedEventId}&limit=50`)
          .then((r) => r.json())
          .then((res) => { if (res.success) setRegistrations(res.data); })
      );
    }

    if (activeTab === "prizes" || activeTab === "dashboard") {
      loads.push(
        fetch(`${API_URL}/api/prizes?eventId=${selectedEventId}`)
          .then((r) => r.json())
          .then((res) => { if (res.success) setPrizes(res.data); })
      );
    }

    if (activeTab === "draws") {
      loads.push(
        fetch(`${API_URL}/api/draws?eventId=${selectedEventId}`)
          .then((r) => r.json())
          .then((res) => { if (res.success) setDrawSessions(res.data); })
      );
    }

    if (activeTab === "audit") {
      loads.push(
        fetch(`${API_URL}/api/audit?limit=100`)
          .then((r) => r.json())
          .then((res) => { if (res.success) setAuditLogs(res.data); })
      );
    }

    Promise.all(loads).finally(() => setLoading(false));
  }, [selectedEventId, activeTab]);

  async function handleExport() {
    window.open(`${API_URL}/api/registrations/export?eventId=${selectedEventId}`, "_blank");
  }

  async function handleImport(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("eventId", selectedEventId);
    const res = await fetch(`${API_URL}/api/registrations/import`, { method: "POST", body: formData });
    const data = await res.json();
    alert(data.success
      ? `นำเข้าสำเร็จ: ${data.data.imported} รายการ, ข้อผิดพลาด: ${data.data.errors}`
      : `เกิดข้อผิดพลาด: ${data.error}`);
    // Reload registrations
    const r = await fetch(`${API_URL}/api/registrations?eventId=${selectedEventId}&limit=50`);
    const rd = await r.json();
    if (rd.success) setRegistrations(rd.data);
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...newEvent,
        startDate: new Date(newEvent.startDate).toISOString(),
        endDate: new Date(newEvent.endDate).toISOString(),
      };
      const res = await fetch(`${API_URL}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setEvents([data.data, ...events]);
        setIsCreateEventOpen(false);
        setNewEvent({ name: "", description: "", venue: "", startDate: "", endDate: "" });
        if (!selectedEventId) setSelectedEventId(data.data.id);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert("Failed to create event");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar__logo">⚡ Event Admin</div>

        {/* Event Selector */}
        <div style={{ marginBottom: "var(--space-6)" }}>
          <label className="form-label" style={{ marginBottom: "var(--space-2)", display: "block" }}>
            งานปัจจุบัน
          </label>
          <select
            className="form-input"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            style={{ fontSize: "var(--text-xs)" }}
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>

        <nav className="admin-sidebar__nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`admin-nav-item ${activeTab === item.key ? "admin-nav-item--active" : ""}`}
              onClick={() => setActiveTab(item.key)}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: "auto", paddingTop: "var(--space-6)", borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            Event Platform v0.1
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-content">
        {/* Dashboard */}
        {activeTab === "dashboard" && (
          <div>
            <div className="admin-header">
              <div>
                <h1 className="admin-header__title">Dashboard</h1>
                <p className="admin-header__subtitle">ภาพรวมงาน {events.find((e) => e.id === selectedEventId)?.name}</p>
              </div>
            </div>

            {stats && (
              <div className="grid grid-4 gap-6" style={{ marginBottom: "var(--space-8)" }}>
                <div className="glass-card stat-card">
                  <span className="stat-card__label">ลงทะเบียนทั้งหมด</span>
                  <span className="stat-card__value">{stats.registrations?.total || 0}</span>
                </div>
                <div className="glass-card stat-card">
                  <span className="stat-card__label">เช็กอินแล้ว</span>
                  <span className="stat-card__value">{stats.registrations?.checkedIn || 0}</span>
                  <span className="stat-card__change stat-card__change--up">{stats.checkins?.percentage || 0}%</span>
                </div>
                <div className="glass-card stat-card">
                  <span className="stat-card__label">รางวัลทั้งหมด</span>
                  <span className="stat-card__value">{stats.prizes?.total || 0}</span>
                </div>
                <div className="glass-card stat-card">
                  <span className="stat-card__label">แจกรางวัลแล้ว</span>
                  <span className="stat-card__value">{stats.prizes?.awarded || 0}</span>
                </div>
              </div>
            )}

            {/* Recent Registrations */}
            <div className="glass-card" style={{ marginBottom: "var(--space-6)" }}>
              <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-4)" }}>
                📋 ผู้ลงทะเบียนล่าสุด
              </h3>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ชื่อ</th>
                      <th>อีเมล</th>
                      <th>แผนก</th>
                      <th>สถานะ</th>
                      <th>วันที่</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.slice(0, 10).map((reg) => (
                      <tr key={reg.id}>
                        <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{reg.fullName}</td>
                        <td>{reg.email || "-"}</td>
                        <td>{reg.department || "-"}</td>
                        <td>
                          <span className={`badge badge--${reg.status === "CHECKED_IN" ? "success" : reg.status === "CANCELLED" ? "error" : "primary"}`}>
                            {reg.status === "CHECKED_IN" ? "เช็กอินแล้ว" : reg.status === "CANCELLED" ? "ยกเลิก" : "ลงทะเบียน"}
                          </span>
                        </td>
                        <td style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                          {new Date(reg.createdAt).toLocaleString("th-TH")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Events Management */}
        {activeTab === "events" && (
          <div>
            <div className="admin-header">
              <div>
                <h1 className="admin-header__title">จัดการงาน Event</h1>
                <p className="admin-header__subtitle">{events.length} งานทั้งหมด</p>
              </div>
              <Button variant="primary" onClick={() => setIsCreateEventOpen(true)}>+ สร้างงานใหม่</Button>
            </div>
            <div className="grid grid-2 gap-6">
              {events.map((ev) => (
                <div key={ev.id} className="glass-card">
                  <div className="flex-between" style={{ marginBottom: "var(--space-3)" }}>
                    <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>{ev.name}</h3>
                    <span className={`badge badge--${ev.status === "ACTIVE" ? "success" : ev.status === "PUBLISHED" ? "primary" : "neutral"}`}>
                      {ev.status}
                    </span>
                  </div>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-3)" }}>
                    {ev.description || "ไม่มีรายละเอียด"}
                  </p>
                  <div className="flex gap-4" style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    <span>📅 {new Date(ev.startDate).toLocaleDateString("th-TH")}</span>
                    <span>📍 {ev.venue || "-"}</span>
                    <span>👥 {ev._count?.registrations || 0} คน</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Registrations */}
        {activeTab === "registrations" && (
          <div>
            <div className="admin-header">
              <div>
                <h1 className="admin-header__title">ผู้ลงทะเบียน</h1>
                <p className="admin-header__subtitle">{registrations.length} คน</p>
              </div>
              <div className="flex gap-3">
                <label className="btn btn--secondary" style={{ cursor: "pointer" }}>
                  📥 Import Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleImport(e.target.files[0]);
                    }}
                  />
                </label>
                <button className="btn btn--secondary" onClick={handleExport}>📤 Export Excel</button>
              </div>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>ชื่อ-นามสกุล</th>
                    <th>อีเมล</th>
                    <th>เบอร์โทร</th>
                    <th>บริษัท</th>
                    <th>แผนก</th>
                    <th>ประเภท</th>
                    <th>สถานะ</th>
                    <th>QR Code</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((reg) => (
                    <tr key={reg.id}>
                      <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{reg.fullName}</td>
                      <td>{reg.email || "-"}</td>
                      <td>{reg.phone || "-"}</td>
                      <td>{reg.company || "-"}</td>
                      <td>{reg.department || "-"}</td>
                      <td>{reg.employeeType || "-"}</td>
                      <td>
                        <span className={`badge badge--${reg.status === "CHECKED_IN" ? "success" : reg.status === "CANCELLED" ? "error" : "primary"}`}>
                          {reg.status === "CHECKED_IN" ? "✓ เช็กอิน" : reg.status === "CANCELLED" ? "ยกเลิก" : "ลงทะเบียน"}
                        </span>
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}>{reg.qrCode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Prizes */}
        {activeTab === "prizes" && (
          <div>
            <div className="admin-header">
              <div>
                <h1 className="admin-header__title">รางวัลทั้งหมด</h1>
                <p className="admin-header__subtitle">{prizes.length} รางวัล</p>
              </div>
              <button className="btn btn--primary">+ เพิ่มรางวัล</button>
            </div>
            <div className="grid grid-3 gap-6">
              {prizes.map((prize) => (
                <div key={prize.id} className="glass-card">
                  <div
                    style={{
                      height: "100px",
                      borderRadius: "var(--radius-lg)",
                      marginBottom: "var(--space-4)",
                      background: "linear-gradient(135deg, var(--bg-tertiary) 0%, rgba(245,158,11,0.2) 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "2.5rem",
                    }}
                  >
                    🎁
                  </div>
                  <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, marginBottom: "var(--space-2)" }}>
                    {prize.name}
                  </h3>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-3)" }}>
                    {prize.description || "-"}
                  </p>
                  <div className="flex-between">
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                      แจกแล้ว {prize.awarded}/{prize.quantity}
                    </span>
                    <span className={`badge ${prize.remaining > 0 ? "badge--success" : "badge--error"}`}>
                      เหลือ {prize.remaining}
                    </span>
                  </div>
                  {/* Conditions */}
                  {prize.conditions && (
                    <div style={{ marginTop: "var(--space-3)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--border-subtle)" }}>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "var(--space-1)" }}>
                        เงื่อนไข:
                      </div>
                      <div className="flex gap-1" style={{ flexWrap: "wrap" }}>
                        {prize.conditions.mustCheckedIn && <span className="badge badge--neutral">ต้องเช็กอิน</span>}
                        {prize.conditions.onePerPerson && <span className="badge badge--neutral">1 รางวัล/คน</span>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Draw Results */}
        {activeTab === "draws" && (
          <div>
            <div className="admin-header">
              <div>
                <h1 className="admin-header__title">ผลการจับรางวัล</h1>
                <p className="admin-header__subtitle">{drawSessions.length} รอบ</p>
              </div>
            </div>
            {drawSessions.length === 0 ? (
              <div className="glass-card flex-center" style={{ padding: "var(--space-16)", textAlign: "center" }}>
                <div>
                  <div style={{ fontSize: "3rem", marginBottom: "var(--space-4)" }}>🎰</div>
                  <h3 style={{ color: "var(--text-muted)" }}>ยังไม่มีการจับรางวัล</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>ไปที่หน้าจอ Lucky Draw เพื่อเริ่มจับรางวัล</p>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                {drawSessions.map((session) => (
                  <div key={session.id} className="glass-card">
                    <div className="flex-between" style={{ marginBottom: "var(--space-3)" }}>
                      <div>
                        <h3 style={{ fontWeight: 700 }}>{session.prize?.name}</h3>
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                          {new Date(session.createdAt).toLocaleString("th-TH")}
                        </span>
                      </div>
                      <span className={`badge badge--${session.status === "COMPLETED" ? "success" : "warning"}`}>
                        {session.status}
                      </span>
                    </div>
                    {session.winners?.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                        {session.winners.map((w: any) => (
                          <div
                            key={w.id}
                            className="flex-between"
                            style={{
                              padding: "var(--space-2) var(--space-3)",
                              background: "var(--bg-glass)",
                              borderRadius: "var(--radius-md)",
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: 600 }}>🏆 {w.registration?.fullName}</span>
                              {w.registration?.department && (
                                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginLeft: "var(--space-2)" }}>
                                  ({w.registration.department})
                                </span>
                              )}
                            </div>
                            <span className={`badge badge--${w.status === "REDRAWN" ? "error" : "success"}`}>
                              {w.status === "REDRAWN" ? "Redrawn" : "✓"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Audit Log */}
        {activeTab === "audit" && (
          <div>
            <div className="admin-header">
              <div>
                <h1 className="admin-header__title">Audit Log</h1>
                <p className="admin-header__subtitle">ประวัติการทำงานทั้งหมดของระบบ</p>
              </div>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>เวลา</th>
                    <th>ประเภท</th>
                    <th>การกระทำ</th>
                    <th>Entity ID</th>
                    <th>ผู้ดำเนินการ</th>
                    <th>ข้อมูล</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: "var(--text-xs)", whiteSpace: "nowrap" }}>
                        {new Date(log.timestamp).toLocaleString("th-TH")}
                      </td>
                      <td><span className="badge badge--neutral">{log.entityType}</span></td>
                      <td><span className="badge badge--primary">{log.action}</span></td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}>
                        {log.entityId?.slice(0, 12)}...
                      </td>
                      <td>{log.performedBy || "-"}</td>
                      <td style={{ fontSize: "var(--text-xs)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {log.newData ? JSON.stringify(log.newData).slice(0, 60) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex-center" style={{ padding: "var(--space-8)" }}>
            <span className="spinner spinner--lg" />
          </div>
        )}
      </main>

      {/* Create Event Modal */}
      <Modal
        isOpen={isCreateEventOpen}
        onClose={() => setIsCreateEventOpen(false)}
        title="สร้างงาน Event ใหม่"
        footer={
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setIsCreateEventOpen(false)}>ยกเลิก</Button>
            <Button variant="primary" type="submit" form="create-event-form">บันทึก</Button>
          </div>
        }
      >
        <form id="create-event-form" onSubmit={handleCreateEvent} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Input
            label="ชื่องาน"
            required
            value={newEvent.name}
            onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
            placeholder="เช่น Townhall 2024"
          />
          <TextArea
            label="รายละเอียด"
            value={newEvent.description}
            onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
            rows={3}
          />
          <Input
            label="สถานที่"
            value={newEvent.venue}
            onChange={(e) => setNewEvent({ ...newEvent, venue: e.target.value })}
            placeholder="เช่น ห้องประชุมใหญ่ A"
          />
          <div className="grid grid-2 gap-4">
            <Input
              label="วันที่เริ่ม"
              type="datetime-local"
              required
              value={newEvent.startDate}
              onChange={(e) => setNewEvent({ ...newEvent, startDate: e.target.value })}
            />
            <Input
              label="วันที่สิ้นสุด"
              type="datetime-local"
              required
              value={newEvent.endDate}
              onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
