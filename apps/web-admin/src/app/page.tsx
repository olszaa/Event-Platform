"use client";

import { useState, useEffect } from "react";
import { Modal, Input, TextArea, Button } from "@event-platform/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Tab = "dashboard" | "events" | "registrations" | "prizes" | "checkinPoints" | "draws" | "audit" | "users";

const NAV_ITEMS: { key: Tab; icon: string; label: string }[] = [
  { key: "dashboard", icon: "📊", label: "Dashboard" },
  { key: "events", icon: "🎪", label: "จัดการงาน" },
  { key: "registrations", icon: "📋", label: "ผู้ลงทะเบียน" },
  { key: "checkinPoints", icon: "🚪", label: "ทางเข้า / จุดเช็กอิน" },
  { key: "prizes", icon: "🎁", label: "รางวัล" },
  { key: "draws", icon: "🎰", label: "ผลจับรางวัล" },
  { key: "audit", icon: "📜", label: "Audit Log" },
  { key: "users", icon: "👥", label: "จัดการผู้ใช้" },
];

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [loginForm, setLoginForm] = useState({ username: "", password: "", error: "", loading: false });

  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [prizes, setPrizes] = useState<any[]>([]);
  const [drawSessions, setDrawSessions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // User Management State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ username: "", password: "", role: "ADMIN" });

  // Checkin Points Management State
  const [checkinPoints, setCheckinPoints] = useState<any[]>([]);
  const [isPointModalOpen, setIsPointModalOpen] = useState(false);
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [pointForm, setPointForm] = useState({
    name: "",
    location: "",
    isActive: true,
    sortOrder: 1,
  });

  // Prize Management State
  const [isPrizeModalOpen, setIsPrizeModalOpen] = useState(false);
  const [editingPrizeId, setEditingPrizeId] = useState<string | null>(null);
  const [prizeForm, setPrizeForm] = useState({
    name: "",
    description: "",
    image: "",
    quantity: 1,
    sortOrder: 1,
    mustCheckedIn: true,
    onePerPerson: true,
  });

  // New Event State
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [newEvent, setNewEvent] = useState({
    name: "",
    description: "",
    venue: "",
    startDate: "",
    endDate: "",
    themeColor: "#6366f1",
    registerBackground: "",
    checkinBackground: "",
    luckyDrawBackground: "",
    luckyDrawAnimation: "pulse",
    coverImage: "",
    allowGroupRegistration: false,
    isPinned: false,
    enableRegisterWhenActive: true,
    enableCheckinWhenPublic: true,
  });

  function openCreateEvent() {
    setEditingEventId(null);
    setNewEvent({
      name: "",
      description: "",
      venue: "",
      startDate: "",
      endDate: "",
      themeColor: "#6366f1",
      registerBackground: "",
      checkinBackground: "",
      luckyDrawBackground: "",
      luckyDrawAnimation: "pulse",
      coverImage: "",
      allowGroupRegistration: false,
      isPinned: false,
      enableRegisterWhenActive: true,
      enableCheckinWhenPublic: true,
    });
    setIsCreateEventOpen(true);
  }

  function openEditEvent(ev: any) {
    setEditingEventId(ev.id);
    const startIso = ev.startDate ? new Date(ev.startDate).toISOString().slice(0, 16) : "";
    const endIso = ev.endDate ? new Date(ev.endDate).toISOString().slice(0, 16) : "";
    setNewEvent({
      name: ev.name || "",
      description: ev.description || "",
      venue: ev.venue || "",
      startDate: startIso,
      endDate: endIso,
      themeColor: ev.settings?.themeColor || "#6366f1",
      registerBackground: ev.settings?.registerBackground || "",
      checkinBackground: ev.settings?.checkinBackground || "",
      luckyDrawBackground: ev.settings?.luckyDrawBackground || "",
      luckyDrawAnimation: ev.settings?.luckyDrawAnimation || "pulse",
      coverImage: ev.coverImage || "",
      allowGroupRegistration: ev.settings?.allowGroupRegistration || false,
      isPinned: ev.settings?.isPinned || false,
      enableRegisterWhenActive: ev.settings?.enableRegisterWhenActive !== false,
      enableCheckinWhenPublic: ev.settings?.enableCheckinWhenPublic !== false,
    });
    setIsCreateEventOpen(true);
  }

  function openCreatePrize() {
    setEditingPrizeId(null);
    setPrizeForm({
      name: "",
      description: "",
      image: "",
      quantity: 1,
      sortOrder: (prizes.length || 0) + 1,
      mustCheckedIn: true,
      onePerPerson: true,
    });
    setIsPrizeModalOpen(true);
  }

  function openEditPrize(prize: any) {
    setEditingPrizeId(prize.id);
    const cond = prize.conditions || {};
    setPrizeForm({
      name: prize.name || "",
      description: prize.description || "",
      image: prize.image || "",
      quantity: prize.quantity || 1,
      sortOrder: prize.sortOrder || 1,
      mustCheckedIn: cond.mustCheckedIn !== false,
      onePerPerson: cond.onePerPerson !== false,
    });
    setIsPrizeModalOpen(true);
  }

  async function handleSavePrize(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEventId) {
      alert("กรุณาเลือกงาน Event ก่อนเพิ่มรางวัล");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        eventId: selectedEventId,
        name: prizeForm.name,
        description: prizeForm.description,
        image: prizeForm.image,
        quantity: Number(prizeForm.quantity),
        sortOrder: Number(prizeForm.sortOrder || 1),
        conditions: {
          mustCheckedIn: prizeForm.mustCheckedIn,
          onePerPerson: prizeForm.onePerPerson,
        },
      };

      if (editingPrizeId) {
        const res = await fetch(`${API_URL}/api/prizes/${editingPrizeId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          setPrizes(prizes.map((p) => (p.id === editingPrizeId ? data.data : p)));
          setIsPrizeModalOpen(false);
        } else {
          alert(`Error: ${data.error}`);
        }
      } else {
        const res = await fetch(`${API_URL}/api/prizes`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          setPrizes([...prizes, data.data]);
          setIsPrizeModalOpen(false);
        } else {
          alert(`Error: ${data.error}`);
        }
      }
    } catch {
      alert("ไม่สามารถบันทึกข้อมูลรางวัลได้");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePrize(id: string) {
    if (!confirm("คุณต้องการลบรางวัลนี้ใช่หรือไม่?")) return;
    try {
      const res = await fetch(`${API_URL}/api/prizes/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setPrizes(prizes.filter((p) => p.id !== id));
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert("Failed to delete prize");
    }
  }

  function openCreatePoint() {
    setEditingPointId(null);
    setPointForm({
      name: "",
      location: "",
      isActive: true,
      sortOrder: (checkinPoints.length || 0) + 1,
    });
    setIsPointModalOpen(true);
  }

  function openEditPoint(point: any) {
    setEditingPointId(point.id);
    setPointForm({
      name: point.name || "",
      location: point.location || "",
      isActive: point.isActive !== false,
      sortOrder: point.sortOrder || 1,
    });
    setIsPointModalOpen(true);
  }

  async function handleSavePoint(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEventId) {
      alert("กรุณาเลือกงาน Event ก่อนเพิ่มทางเข้างาน");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        eventId: selectedEventId,
        name: pointForm.name,
        location: pointForm.location,
        isActive: pointForm.isActive,
        sortOrder: Number(pointForm.sortOrder || 1),
      };

      if (editingPointId) {
        const res = await fetch(`${API_URL}/api/checkin/points/${editingPointId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          setCheckinPoints(checkinPoints.map((p) => (p.id === editingPointId ? data.data : p)));
          setIsPointModalOpen(false);
        } else {
          alert(`Error: ${data.error}`);
        }
      } else {
        const res = await fetch(`${API_URL}/api/checkin/points`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          setCheckinPoints([...checkinPoints, data.data]);
          setIsPointModalOpen(false);
        } else {
          alert(`Error: ${data.error}`);
        }
      }
    } catch {
      alert("ไม่สามารถบันทึกข้อมูลทางเข้างานได้");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePoint(id: string) {
    if (!confirm("คุณต้องการลบทางเข้างาน/จุดเช็กอินนี้ใช่หรือไม่?")) return;
    try {
      const res = await fetch(`${API_URL}/api/checkin/points/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setCheckinPoints(checkinPoints.filter((p) => p.id !== id));
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert("Failed to delete point");
    }
  }

  async function handleTogglePointActive(point: any) {
    try {
      const res = await fetch(`${API_URL}/api/checkin/points/${point.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ isActive: !point.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        setCheckinPoints(checkinPoints.map((p) => (p.id === point.id ? { ...p, isActive: !point.isActive } : p)));
      }
    } catch {
      alert("Failed to update status");
    }
  }

  useEffect(() => {
    const savedToken = localStorage.getItem("admin_token");
    const savedRole = localStorage.getItem("admin_role");
    const savedId = localStorage.getItem("admin_id");
    if (savedToken) {
      setToken(savedToken);
      setCurrentUserRole(savedRole);
      setCurrentUserId(savedId);
    }
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
        setCurrentUserRole(data.data.user?.role || "ADMIN");
        setCurrentUserId(data.data.user?.id || null);
        localStorage.setItem("admin_token", data.data.token);
        localStorage.setItem("admin_role", data.data.user?.role || "ADMIN");
        if (data.data.user?.id) localStorage.setItem("admin_id", data.data.user.id);
      } else {
        setLoginForm((prev) => ({ ...prev, error: data.message || "Invalid credentials" }));
      }
    } catch (err) {
      setLoginForm((prev) => ({ ...prev, error: "Network error" }));
    } finally {
      setLoginForm((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_role");
    localStorage.removeItem("admin_id");
    setToken(null);
    setCurrentUserRole(null);
    setCurrentUserId(null);
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
          if (res.data.length > 0 && !selectedEventId) setSelectedEventId(res.data[0].id);
        }
      });
  }, [token]);

  // Load data when event or tab changes
  useEffect(() => {
    if (!token) return;
    if (!selectedEventId) return;
    setLoading(true);

    const loads: Promise<void>[] = [];

    if (activeTab === "dashboard") {
      loads.push(
        fetch(`${API_URL}/api/events/${selectedEventId}/stats`, { headers: getAuthHeaders() })
          .then((r) => r.json())
          .then((res) => { if (res.success) setStats(res.data); })
      );
    }

    if (activeTab === "registrations" || activeTab === "dashboard") {
      loads.push(
        fetch(`${API_URL}/api/registrations?eventId=${selectedEventId}&limit=50`, { headers: getAuthHeaders() })
          .then((r) => r.json())
          .then((res) => { if (res.success) setRegistrations(res.data); })
      );
    }

    if (activeTab === "prizes" || activeTab === "dashboard") {
      loads.push(
        fetch(`${API_URL}/api/prizes?eventId=${selectedEventId}`, { headers: getAuthHeaders() })
          .then((r) => r.json())
          .then((res) => { if (res.success) setPrizes(res.data); })
      );
    }

    if (activeTab === "checkinPoints" || activeTab === "dashboard") {
      loads.push(
        fetch(`${API_URL}/api/checkin/points?eventId=${selectedEventId}`, { headers: getAuthHeaders() })
          .then((r) => r.json())
          .then((res) => { if (res.success) setCheckinPoints(res.data); })
      );
    }

    if (activeTab === "draws") {
      loads.push(
        fetch(`${API_URL}/api/draws?eventId=${selectedEventId}`, { headers: getAuthHeaders() })
          .then((r) => r.json())
          .then((res) => { if (res.success) setDrawSessions(res.data); })
      );
    }

    if (activeTab === "audit") {
      loads.push(
        fetch(`${API_URL}/api/audit?limit=100`, { headers: getAuthHeaders() })
          .then((r) => r.json())
          .then((res) => { if (res.success) setAuditLogs(res.data); })
      );
    }

    if (activeTab === "users") {
      loads.push(
        fetch(`${API_URL}/api/users`, { headers: getAuthHeaders() })
          .then((r) => r.json())
          .then((res) => { if (res.success) setAdminUsers(res.data); })
      );
    }

    Promise.all(loads).finally(() => setLoading(false));
  }, [selectedEventId, activeTab, token]);

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
        name: newEvent.name,
        description: newEvent.description,
        venue: newEvent.venue,
        startDate: new Date(newEvent.startDate).toISOString(),
        endDate: new Date(newEvent.endDate).toISOString(),
        coverImage: newEvent.coverImage,
        settings: {
          themeColor: newEvent.themeColor,
          registerBackground: newEvent.registerBackground,
          checkinBackground: newEvent.checkinBackground,
          luckyDrawBackground: newEvent.luckyDrawBackground,
          luckyDrawAnimation: newEvent.luckyDrawAnimation,
          allowGroupRegistration: newEvent.allowGroupRegistration,
          isPinned: newEvent.isPinned,
          enableRegisterWhenActive: newEvent.enableRegisterWhenActive,
          enableCheckinWhenPublic: newEvent.enableCheckinWhenPublic,
        }
      };

      if (editingEventId) {
        const res = await fetch(`${API_URL}/api/events/${editingEventId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          setEvents(events.map((ev) => (ev.id === editingEventId ? data.data : ev)));
          setIsCreateEventOpen(false);
        } else {
          alert(`Error: ${data.error}`);
        }
      } else {
        const res = await fetch(`${API_URL}/api/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, status: "DRAFT" }),
        });
        const data = await res.json();
        if (data.success) {
          setEvents([data.data, ...events]);
          setIsCreateEventOpen(false);
          if (!selectedEventId) setSelectedEventId(data.data.id);
        } else {
          alert(`Error: ${data.error}`);
        }
      }
    } catch (err) {
      alert("Failed to save event");
    } finally {
      setLoading(false);
    }
  }

  async function updateEventStatus(id: string, newStatus: string) {
    try {
      const res = await fetch(`${API_URL}/api/events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        setEvents(events.map(ev => ev.id === id ? { ...ev, status: newStatus } : ev));
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert("Failed to update status");
    }
  }

  if (isCheckingToken) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "var(--background)" }}>
        <h2 style={{ color: "var(--text)" }}>Loading...</h2>
      </div>
    );
  }

  if (!token) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "var(--background)" }}>
        <div style={{ backgroundColor: "var(--surface)", padding: "var(--space-8)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-md)", width: "100%", maxWidth: "400px" }}>
          <h2 style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>Admin Login</h2>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div>
              <label style={{ display: "block", marginBottom: "var(--space-2)" }}>Username</label>
              <Input value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} required />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "var(--space-2)" }}>Password</label>
              <Input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} required />
            </div>
            {loginForm.error && <div style={{ color: "var(--color-danger)", fontSize: "0.875rem" }}>{loginForm.error}</div>}
            <Button type="submit" disabled={loginForm.loading} style={{ marginTop: "var(--space-4)" }}>
              {loginForm.loading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      {/* Mobile Topbar */}
      <div className="admin-mobile-topbar">
        <div style={{ fontWeight: 800, fontSize: "var(--text-base)", background: "linear-gradient(135deg, var(--color-primary-light) 0%, var(--color-secondary-light) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          ⚡ Event Admin
        </div>
        <button
          className="btn btn--secondary btn--sm"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          style={{ padding: "var(--space-1) var(--space-3)" }}
        >
          {isSidebarOpen ? "✕ ปิด" : "☰ เมนู"}
        </button>
      </div>

      {/* Backdrop overlay for mobile */}
      {isSidebarOpen && (
        <div className="admin-sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`admin-sidebar ${isSidebarOpen ? "admin-sidebar--open" : ""}`}>
        <div className="admin-sidebar__logo">⚡ Event Admin</div>

        <nav className="admin-sidebar__nav" style={{ marginBottom: "var(--space-4)", flex: "none" }}>
          <button
            className={`admin-nav-item ${activeTab === "events" ? "admin-nav-item--active" : ""}`}
            onClick={() => {
              setActiveTab("events");
              setIsSidebarOpen(false);
            }}
          >
            <span>🎪</span>
            จัดการงาน Event
          </button>
        </nav>

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
          {NAV_ITEMS.filter((item) => item.key !== "events").map((item) => (
            <button
              key={item.key}
              className={`admin-nav-item ${activeTab === item.key ? "admin-nav-item--active" : ""}`}
              onClick={() => {
                setActiveTab(item.key);
                setIsSidebarOpen(false);
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: "auto", paddingTop: "var(--space-6)", borderTop: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <button
            className="btn btn--secondary"
            style={{ width: "100%", fontSize: "var(--text-xs)", display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" }}
            onClick={handleLogout}
          >
            🚪 ออกจากระบบ
          </button>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textAlign: "center" }}>
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
              <Button variant="primary" onClick={openCreateEvent}>+ สร้างงานใหม่</Button>
            </div>
            <div className="grid grid-2 gap-6">
              {events.map((ev) => (
                <div key={ev.id} className="glass-card">
                  <div className="flex-between" style={{ marginBottom: "var(--space-3)" }}>
                    <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>{ev.name}</h3>
                    <div className="flex gap-2 items-center">
                      <button
                        className="btn btn--outline"
                        style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                        onClick={() => openEditEvent(ev)}
                      >
                        ✏️ แก้ไข
                      </button>
                      <select
                        className={`badge badge--${ev.status === "ACTIVE" ? "success" : ev.status === "PUBLISHED" ? "primary" : "neutral"}`}
                        style={{ border: "none", outline: "none", cursor: "pointer", fontFamily: "inherit" }}
                        value={ev.status}
                        onChange={(e) => updateEventStatus(ev.id, e.target.value)}
                      >
                        <option value="DRAFT">DRAFT</option>
                        <option value="PUBLISHED">PUBLISHED</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="CLOSED">CLOSED</option>
                        <option value="ARCHIVED">ARCHIVED</option>
                      </select>
                    </div>
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
              <button className="btn btn--primary" onClick={openCreatePrize}>+ เพิ่มรางวัล</button>
            </div>
            <div className="grid grid-3 gap-6">
              {prizes.map((prize) => (
                <div key={prize.id} className="glass-card">
                  <div
                    style={{
                      height: "140px",
                      borderRadius: "var(--radius-lg)",
                      marginBottom: "var(--space-4)",
                      background: prize.image ? `url(${prize.image}) center/cover no-repeat` : "linear-gradient(135deg, var(--bg-tertiary) 0%, rgba(245,158,11,0.2) 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "2.5rem",
                    }}
                  >
                    {!prize.image && "🎁"}
                  </div>
                  <div className="flex-between" style={{ marginBottom: "var(--space-2)", alignItems: "center" }}>
                    <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700 }}>
                      {prize.name}
                    </h3>
                    <div className="flex gap-2">
                      <button
                        className="btn btn--secondary btn--sm"
                        style={{ padding: "0.2rem 0.4rem", fontSize: "0.75rem" }}
                        onClick={() => openEditPrize(prize)}
                        title="แก้ไขรางวัล"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn--danger btn--sm"
                        style={{ padding: "0.2rem 0.4rem", fontSize: "0.75rem" }}
                        onClick={() => handleDeletePrize(prize.id)}
                        title="ลบรางวัล"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
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

        {/* Check-in Points Management */}
        {activeTab === "checkinPoints" && (
          <div>
            <div className="admin-header">
              <div>
                <h1 className="admin-header__title">ทางเข้างาน / จุดเช็กอิน (Check-in Entrances)</h1>
                <p className="admin-header__subtitle">
                  {checkinPoints.length} ทางเข้า สำหรับงาน {events.find((e) => e.id === selectedEventId)?.name || ""}
                </p>
              </div>
              <Button variant="primary" onClick={openCreatePoint}>
                + เพิ่มทางเข้างาน / จุดเช็กอิน
              </Button>
            </div>
            {checkinPoints.length === 0 ? (
              <div className="glass-card flex-center" style={{ padding: "var(--space-16)", textAlign: "center" }}>
                <div>
                  <div style={{ fontSize: "3rem", marginBottom: "var(--space-4)" }}>🚪</div>
                  <h3 style={{ color: "var(--text-muted)" }}>ยังไม่มีทางเข้างาน/จุดเช็กอิน</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginBottom: "var(--space-4)" }}>
                    คลิก "+ เพิ่มทางเข้างาน / จุดเช็กอิน" เพื่อสร้างทางเข้าแรก
                  </p>
                  <Button variant="primary" onClick={openCreatePoint}>
                    + เพิ่มทางเข้างาน / จุดเช็กอิน
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-3 gap-6">
                {checkinPoints.map((point) => (
                  <div key={point.id} className="glass-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <div className="flex-between" style={{ marginBottom: "var(--space-3)", alignItems: "center" }}>
                        <div className="flex gap-2 items-center">
                          <span style={{ fontSize: "1.8rem" }}>🚪</span>
                          <div>
                            <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700 }}>{point.name}</h3>
                            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                              📍 {point.location || "ไม่ได้ระบุสถานที่"}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="btn btn--secondary btn--sm"
                            style={{ padding: "0.2rem 0.4rem", fontSize: "0.75rem" }}
                            onClick={() => openEditPoint(point)}
                            title="แก้ไข"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn--danger btn--sm"
                            style={{ padding: "0.2rem 0.4rem", fontSize: "0.75rem" }}
                            onClick={() => handleDeletePoint(point.id)}
                            title="ลบ"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--border-subtle)" }} className="flex-between">
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                        👥 เช็กอินแล้ว {point._count?.checkins || 0} คน
                      </span>
                      <button
                        className={`badge ${point.isActive ? "badge--success" : "badge--neutral"}`}
                        onClick={() => handleTogglePointActive(point)}
                        style={{ cursor: "pointer", border: "none" }}
                        title="คลิกเพื่อสลับสถานะ"
                      >
                        {point.isActive ? "🟢 เปิดใช้งาน" : "🔴 ปิดใช้งาน"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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

        {/* Users Management */}
        {activeTab === "users" && (
          <div>
            <div className="admin-header">
              <div>
                <h1 className="admin-header__title">จัดการผู้ใช้ (SuperAdmin)</h1>
                <p className="admin-header__subtitle">จัดการบัญชีผู้ดูแลระบบ</p>
              </div>
              <div style={{ display: "flex", gap: "var(--space-3)" }}>
                {currentUserRole === "SUPERADMIN" && (
                  <Button 
                    variant="primary" 
                    onClick={() => {
                      setEditingUserId(null);
                      setUserForm({ username: "", password: "", role: "ADMIN" });
                      setIsUserModalOpen(true);
                    }}
                  >
                    + เพิ่มผู้ใช้ใหม่
                  </Button>
                )}
                <Button variant="danger" onClick={handleLogout}>
                  🚪 ออกจากระบบ
                </Button>
              </div>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Role</th>
                    <th>วันที่สร้าง</th>
                    <th>การกระทำ</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.username}</td>
                      <td><span className="badge badge--primary">{user.role}</span></td>
                      <td style={{ fontSize: "var(--text-xs)", whiteSpace: "nowrap" }}>
                        {new Date(user.createdAt).toLocaleDateString("th-TH")}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          {(currentUserRole === "SUPERADMIN" || currentUserId === user.id) && (
                            <button 
                              className="btn btn--outline" 
                              style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                              onClick={() => {
                                setEditingUserId(user.id);
                                setUserForm({ username: user.username, password: "", role: user.role });
                                setIsUserModalOpen(true);
                              }}
                            >
                              แก้ไข
                            </button>
                          )}
                          {currentUserRole === "SUPERADMIN" && (
                            <button 
                              className="btn btn--danger" 
                              style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                              onClick={async () => {
                                if (confirm("ยืนยันการลบผู้ใช้นี้?")) {
                                  const res = await fetch(`${API_URL}/api/users/${user.id}`, {
                                    method: "DELETE",
                                    headers: getAuthHeaders(),
                                  });
                                  if (res.ok) {
                                    setAdminUsers(adminUsers.filter((u) => u.id !== user.id));
                                  } else {
                                    alert("Failed to delete user");
                                  }
                                }
                              }}
                            >
                              ลบ
                            </button>
                          )}
                        </div>
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

      {/* Create / Edit Event Modal */}
      <Modal
        isOpen={isCreateEventOpen}
        onClose={() => setIsCreateEventOpen(false)}
        title={editingEventId ? "แก้ไขงาน Event" : "สร้างงาน Event ใหม่"}
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
          
          <div className="form-group" style={{ marginBottom: "var(--space-4)" }}>
            <label className="form-label" style={{ marginBottom: "var(--space-1)", display: "block" }}>
              รูปภาพหน้าปก (Cover Image)
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <input
                type="file"
                accept="image/*"
                className="form-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setNewEvent((prev) => ({ ...prev, coverImage: reader.result as string }));
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                หรือใส่ลิงก์รูปภาพ (Image URL):
              </div>
              <input
                className="form-input"
                type="text"
                placeholder="https://... (สำหรับแสดงในการ์ดงาน)"
                value={newEvent.coverImage}
                onChange={(e) => setNewEvent({ ...newEvent, coverImage: e.target.value })}
              />
              {newEvent.coverImage && (
                <div style={{ position: "relative", display: "inline-block", maxWidth: "200px" }}>
                  <img
                    src={newEvent.coverImage}
                    alt="Cover Preview"
                    style={{ width: "100%", maxHeight: "120px", borderRadius: "var(--radius-md)", objectFit: "cover", border: "1px solid var(--border-subtle)" }}
                  />
                  <button
                    type="button"
                    onClick={() => setNewEvent({ ...newEvent, coverImage: "" })}
                    style={{
                      position: "absolute",
                      top: "4px",
                      right: "4px",
                      background: "rgba(0,0,0,0.7)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "50%",
                      width: "20px",
                      height: "20px",
                      lineHeight: "18px",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: "var(--space-2)", paddingTop: "var(--space-4)" }}>
            <h4 style={{ marginBottom: "var(--space-3)", fontSize: "var(--text-sm)", fontWeight: 600 }}>การตั้งค่า (Settings)</h4>

            <div className="form-group" style={{ marginBottom: "var(--space-3)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={newEvent.isPinned}
                  onChange={(e) => setNewEvent({ ...newEvent, isPinned: e.target.checked })}
                  style={{ width: "16px", height: "16px" }}
                />
                <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-primary)" }}>📌 Pin to top (ตรึงไว้ด้านบนสุดในหน้าเว็บ)</span>
              </label>
            </div>

            <div className="form-group" style={{ marginBottom: "var(--space-3)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={newEvent.enableRegisterWhenActive}
                  onChange={(e) => setNewEvent({ ...newEvent, enableRegisterWhenActive: e.target.checked })}
                  style={{ width: "16px", height: "16px" }}
                />
                <span style={{ fontSize: "var(--text-sm)" }}>📝 เปิดให้ลงทะเบียนเมื่อสถานะเป็น Active (จะเปิดรับลงทะเบียนทั้ง Published & Active)</span>
              </label>
            </div>

            <div className="form-group" style={{ marginBottom: "var(--space-3)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={newEvent.enableCheckinWhenPublic}
                  onChange={(e) => setNewEvent({ ...newEvent, enableCheckinWhenPublic: e.target.checked })}
                  style={{ width: "16px", height: "16px" }}
                />
                <span style={{ fontSize: "var(--text-sm)" }}>🎟️ เปิดให้เช็กอินเมื่อสถานะเป็น Published (จะเปิดให้เช็กอินทั้ง Published & Active)</span>
              </label>
            </div>

            <div className="form-group" style={{ marginBottom: "var(--space-4)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={newEvent.allowGroupRegistration}
                  onChange={(e) => setNewEvent({ ...newEvent, allowGroupRegistration: e.target.checked })}
                  style={{ width: "16px", height: "16px" }}
                />
                <span style={{ fontSize: "var(--text-sm)" }}>เปิดให้ลงทะเบียนแบบกลุ่ม (Group Registration)</span>
              </label>
            </div>

            <div className="form-group" style={{ marginBottom: "var(--space-4)" }}>
              <label className="form-label">รูปแบบ Animation ลุ้นรางวัล (Lucky Draw)</label>
              <select
                className="form-input"
                value={newEvent.luckyDrawAnimation}
                onChange={(e) => setNewEvent({ ...newEvent, luckyDrawAnimation: e.target.value })}
              >
                <option value="pulse">Pulse (กระพริบขยาย)</option>
                <option value="slot">Slot (เลื่อนขึ้นเหมือนสล็อต)</option>
                <option value="random">Random (สุ่มสีและตำแหน่ง)</option>
              </select>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: "var(--space-2)", paddingTop: "var(--space-4)" }}>
            <h4 style={{ marginBottom: "var(--space-3)", fontSize: "var(--text-sm)", fontWeight: 600 }}>การตกแต่ง (Theme & Background)</h4>
            <div className="grid grid-2 gap-4" style={{ marginBottom: "var(--space-4)" }}>
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: "var(--space-2)", display: "block" }}>สีธีม (Theme Color)</label>
                <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                  <input
                    type="color"
                    value={newEvent.themeColor}
                    onChange={(e) => setNewEvent({ ...newEvent, themeColor: e.target.value })}
                    style={{ width: "40px", height: "40px", padding: "0", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer" }}
                  />
                  <input
                    className="form-input"
                    value={newEvent.themeColor}
                    onChange={(e) => setNewEvent({ ...newEvent, themeColor: e.target.value })}
                    placeholder="#6366f1"
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: "var(--space-1)", display: "block" }}>
                  ภาพพื้นหลังหน้า Register
                </label>
                <input
                  type="file"
                  accept="image/*"
                  className="form-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setNewEvent((prev) => ({ ...prev, registerBackground: reader.result as string }));
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <input
                  className="form-input"
                  type="text"
                  placeholder="หรือใส่ URL..."
                  value={newEvent.registerBackground}
                  onChange={(e) => setNewEvent({ ...newEvent, registerBackground: e.target.value })}
                  style={{ marginTop: "var(--space-1)" }}
                />
                {newEvent.registerBackground && (
                  <div style={{ position: "relative", marginTop: "4px", display: "inline-block" }}>
                    <img src={newEvent.registerBackground} alt="Preview" style={{ maxHeight: "60px", borderRadius: "var(--radius-sm)" }} />
                    <button type="button" onClick={() => setNewEvent({ ...newEvent, registerBackground: "" })} style={{ position: "absolute", top: 0, right: 0, background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", borderRadius: "50%", width: "18px", height: "18px", fontSize: "10px", cursor: "pointer" }}>✕</button>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-2 gap-4">
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: "var(--space-1)", display: "block" }}>
                  ภาพพื้นหลังหน้า Check-in
                </label>
                <input
                  type="file"
                  accept="image/*"
                  className="form-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setNewEvent((prev) => ({ ...prev, checkinBackground: reader.result as string }));
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <input
                  className="form-input"
                  type="text"
                  placeholder="หรือใส่ URL..."
                  value={newEvent.checkinBackground}
                  onChange={(e) => setNewEvent({ ...newEvent, checkinBackground: e.target.value })}
                  style={{ marginTop: "var(--space-1)" }}
                />
                {newEvent.checkinBackground && (
                  <div style={{ position: "relative", marginTop: "4px", display: "inline-block" }}>
                    <img src={newEvent.checkinBackground} alt="Preview" style={{ maxHeight: "60px", borderRadius: "var(--radius-sm)" }} />
                    <button type="button" onClick={() => setNewEvent({ ...newEvent, checkinBackground: "" })} style={{ position: "absolute", top: 0, right: 0, background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", borderRadius: "50%", width: "18px", height: "18px", fontSize: "10px", cursor: "pointer" }}>✕</button>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: "var(--space-1)", display: "block" }}>
                  ภาพพื้นหลังหน้า Lucky Draw
                </label>
                <input
                  type="file"
                  accept="image/*"
                  className="form-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setNewEvent((prev) => ({ ...prev, luckyDrawBackground: reader.result as string }));
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <input
                  className="form-input"
                  type="text"
                  placeholder="หรือใส่ URL..."
                  value={newEvent.luckyDrawBackground}
                  onChange={(e) => setNewEvent({ ...newEvent, luckyDrawBackground: e.target.value })}
                  style={{ marginTop: "var(--space-1)" }}
                />
                {newEvent.luckyDrawBackground && (
                  <div style={{ position: "relative", marginTop: "4px", display: "inline-block" }}>
                    <img src={newEvent.luckyDrawBackground} alt="Preview" style={{ maxHeight: "60px", borderRadius: "var(--radius-sm)" }} />
                    <button type="button" onClick={() => setNewEvent({ ...newEvent, luckyDrawBackground: "" })} style={{ position: "absolute", top: 0, right: 0, background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", borderRadius: "50%", width: "18px", height: "18px", fontSize: "10px", cursor: "pointer" }}>✕</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* User Management Modal */}
      <Modal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        title={editingUserId ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้ใหม่"}
        footer={
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setIsUserModalOpen(false)}>ยกเลิก</Button>
            <Button variant="primary" type="submit" form="user-form">บันทึก</Button>
          </div>
        }
      >
        <form 
          id="user-form" 
          onSubmit={async (e) => {
            e.preventDefault();
            const method = editingUserId ? "PUT" : "POST";
            const url = editingUserId ? `${API_URL}/api/users/${editingUserId}` : `${API_URL}/api/users`;
            
            const res = await fetch(url, {
              method,
              headers: { "Content-Type": "application/json", ...getAuthHeaders() },
              body: JSON.stringify(userForm),
            });

            if (res.ok) {
              setIsUserModalOpen(false);
              // Refetch users
              const usersRes = await fetch(`${API_URL}/api/users`, { headers: getAuthHeaders() });
              const data = await usersRes.json();
              if (data.success) setAdminUsers(data.data);
            } else {
              const data = await res.json();
              alert(data.message || "Failed to save user");
            }
          }} 
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
        >
          <Input
            label="Username"
            required
            value={userForm.username}
            onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
            placeholder="admin123"
          />
          <Input
            label={editingUserId ? "Password (ปล่อยว่างถ้าไม่ต้องการเปลี่ยน)" : "Password"}
            type="password"
            required={!editingUserId}
            value={userForm.password}
            onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
          />
          <div className="form-group">
            <label className="form-label">Role</label>
            <select
              className="form-input"
              value={userForm.role}
              onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
              disabled={currentUserRole !== "SUPERADMIN"}
            >
              <option value="ADMIN">ADMIN</option>
              <option value="SUPERADMIN">SUPERADMIN</option>
            </select>
          </div>
        </form>
      </Modal>
      {/* Create / Edit Prize Modal */}
      <Modal
        isOpen={isPrizeModalOpen}
        onClose={() => setIsPrizeModalOpen(false)}
        title={editingPrizeId ? "แก้ไขรางวัล" : "เพิ่มรางวัลใหม่"}
      >
        <form onSubmit={handleSavePrize} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Input
            label="ชื่อรางวัล"
            required
            value={prizeForm.name}
            onChange={(e) => setPrizeForm({ ...prizeForm, name: e.target.value })}
            placeholder="เช่น iPhone 16 Pro Max 256GB"
          />
          <TextArea
            label="รายละเอียด"
            value={prizeForm.description}
            onChange={(e) => setPrizeForm({ ...prizeForm, description: e.target.value })}
            rows={2}
            placeholder="คำอธิบายรางวัลเพิ่มเติม..."
          />

          <div className="form-group" style={{ marginBottom: "var(--space-2)" }}>
            <label className="form-label" style={{ marginBottom: "var(--space-1)", display: "block" }}>
              รูปภาพรางวัล (Prize Image)
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <input
                type="file"
                accept="image/*"
                className="form-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setPrizeForm((prev) => ({ ...prev, image: reader.result as string }));
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                หรือใส่ลิงก์รูปภาพ (Image URL):
              </div>
              <Input
                value={prizeForm.image}
                onChange={(e) => setPrizeForm({ ...prizeForm, image: e.target.value })}
                placeholder="https://example.com/prize.png หรือเลือกไฟล์ด้านบน"
              />
              {prizeForm.image && (
                <div style={{ position: "relative", width: "100%", height: "120px", borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--bg-tertiary)", marginTop: "var(--space-1)" }}>
                  <img src={prizeForm.image} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  <button
                    type="button"
                    onClick={() => setPrizeForm({ ...prizeForm, image: "" })}
                    style={{ position: "absolute", top: "4px", right: "4px", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "50%", width: "22px", height: "22px", cursor: "pointer", fontSize: "12px" }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-2 gap-4">
            <Input
              label="จำนวนรางวัล"
              type="number"
              min={1}
              required
              value={prizeForm.quantity}
              onChange={(e) => setPrizeForm({ ...prizeForm, quantity: Number(e.target.value) })}
            />
            <Input
              label="ลำดับการสุ่ม (Sort Order)"
              type="number"
              min={1}
              value={prizeForm.sortOrder}
              onChange={(e) => setPrizeForm({ ...prizeForm, sortOrder: Number(e.target.value) })}
            />
          </div>

          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-3)" }}>
            <h4 style={{ marginBottom: "var(--space-3)", fontSize: "var(--text-sm)", fontWeight: 600 }}>เงื่อนไขการรับรางวัล (Conditions)</h4>
            <div className="form-group" style={{ marginBottom: "var(--space-2)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={prizeForm.mustCheckedIn}
                  onChange={(e) => setPrizeForm({ ...prizeForm, mustCheckedIn: e.target.checked })}
                  style={{ width: "16px", height: "16px" }}
                />
                <span style={{ fontSize: "var(--text-sm)" }}>เฉพาะผู้เข้าร่วมที่เช็กอินแล้วเท่านั้น (Must Checked In)</span>
              </label>
            </div>
            <div className="form-group">
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={prizeForm.onePerPerson}
                  onChange={(e) => setPrizeForm({ ...prizeForm, onePerPerson: e.target.checked })}
                  style={{ width: "16px", height: "16px" }}
                />
                <span style={{ fontSize: "var(--text-sm)" }}>จำกัด 1 รางวัลต่อคน (One Prize Per Person)</span>
              </label>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
            <Button variant="secondary" type="button" onClick={() => setIsPrizeModalOpen(false)}>
              ยกเลิก
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? "กำลังบันทึก..." : editingPrizeId ? "บันทึกการแก้ไข" : "สร้างรางวัล"}
            </Button>
          </div>
        </form>
      </Modal>
      {/* Create / Edit CheckinPoint Modal */}
      <Modal
        isOpen={isPointModalOpen}
        onClose={() => setIsPointModalOpen(false)}
        title={editingPointId ? "แก้ไขทางเข้างาน / จุดเช็กอิน" : "เพิ่มทางเข้างาน / จุดเช็กอินใหม่"}
        footer={
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setIsPointModalOpen(false)}>ยกเลิก</Button>
            <Button variant="primary" type="submit" form="point-form">บันทึก</Button>
          </div>
        }
      >
        <form id="point-form" onSubmit={handleSavePoint} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Input
            label="ชื่อทางเข้างาน / จุดเช็กอิน"
            required
            value={pointForm.name}
            onChange={(e) => setPointForm({ ...pointForm, name: e.target.value })}
            placeholder="เช่น ทางเข้าประตู 1 (Main Gate), ประตู VIP, จุดเช็กอิน Hall A"
          />
          <Input
            label="สถานที่ตั้ง / รายละเอียดเพิ่มเติม"
            value={pointForm.location}
            onChange={(e) => setPointForm({ ...pointForm, location: e.target.value })}
            placeholder="เช่น บริเวณหน้าโถงทางเข้าฝั่งทิศตะวันออก"
          />
          <Input
            label="ลำดับการจัดเรียง (Sort Order)"
            type="number"
            value={pointForm.sortOrder}
            onChange={(e) => setPointForm({ ...pointForm, sortOrder: Number(e.target.value) })}
          />
          <div className="form-group">
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={pointForm.isActive}
                onChange={(e) => setPointForm({ ...pointForm, isActive: e.target.checked })}
                style={{ width: "16px", height: "16px" }}
              />
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>🟢 เปิดใช้งานทางเข้างานนี้</span>
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
