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
  const [showPassword, setShowPassword] = useState(false);
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

  // Registration Filter & Edit Modal State
  const [regSearchQuery, setRegSearchQuery] = useState("");
  const [regSortField, setRegSortField] = useState<string>("createdAt");
  const [regSortDirection, setRegSortDirection] = useState<"asc" | "desc">("desc");

  function handleRegSort(field: string) {
    if (regSortField === field) {
      setRegSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setRegSortField(field);
      setRegSortDirection("asc");
    }
  }

  // Delete Event Confirmation State
  const [deleteEventModal, setDeleteEventModal] = useState<{
    show: boolean;
    event: any | null;
    confirmCode: string;
    inputCode: string;
  }>({
    show: false,
    event: null,
    confirmCode: "",
    inputCode: "",
  });

  function openDeleteEventModal(ev: any) {
    const randomCode = String(Math.floor(1000 + Math.random() * 9000));
    setDeleteEventModal({
      show: true,
      event: ev,
      confirmCode: randomCode,
      inputCode: "",
    });
  }

  async function handleConfirmDeleteEvent() {
    if (!deleteEventModal.event) return;
    if (deleteEventModal.inputCode.trim() !== deleteEventModal.confirmCode) {
      showAlert("รหัสยืนยันไม่ถูกต้อง กรุณากรอกรหัสตามที่แสดงบนหน้าจอ", "warning");
      return;
    }

    const eventToDeleteId = deleteEventModal.event.id;
    const eventName = deleteEventModal.event.name;
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/events/${eventToDeleteId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setEvents((prev) => prev.filter((e) => e.id !== eventToDeleteId));
        if (selectedEventId === eventToDeleteId) {
          const remaining = events.filter((e) => e.id !== eventToDeleteId);
          if (remaining.length > 0) {
            setSelectedEventId(remaining[0].id);
          } else {
            setSelectedEventId("");
          }
        }
        setDeleteEventModal({ show: false, event: null, confirmCode: "", inputCode: "" });
        showAlert(`ลบงาน Event '${eventName}' และข้อมูลผู้ลงทะเบียนทั้งหมดสำเร็จแล้ว 🗑️`, "success", "ลบงาน Event สำเร็จ");
      } else {
        showAlert(`เกิดข้อผิดพลาด: ${data.error}`, "error");
      }
    } catch (err: any) {
      showAlert(`เกิดข้อผิดพลาด: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  const [isEditRegModalOpen, setIsEditRegModalOpen] = useState(false);
  const [editingReg, setEditingReg] = useState<{
    id: string;
    fullName: string;
    company: string;
    phone: string;
    email: string;
    department: string;
    employeeType: string;
    status: string;
    ticketNumber: string;
  }>({
    id: "",
    fullName: "",
    company: "",
    phone: "",
    email: "",
    department: "",
    employeeType: "",
    status: "APPROVED",
    ticketNumber: "",
  });

  function openEditReg(reg: any) {
    setEditingReg({
      id: reg.id,
      fullName: reg.fullName || "",
      company: reg.company || "",
      phone: reg.phone || "",
      email: reg.email || "",
      department: reg.department || "",
      employeeType: reg.employeeType || "",
      status: reg.status || "APPROVED",
      ticketNumber: reg.ticketNumber || reg.luckyDrawNumber || "",
    });
    setIsEditRegModalOpen(true);
  }

  async function handleSaveRegEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingReg.fullName.trim() || !editingReg.company.trim()) {
      showAlert("กรุณาระบุ 'ชื่อ-นามสกุล' และ 'บริษัท/หน่วยงาน' ให้ครบถ้วน", "warning");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/registrations/${editingReg.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(editingReg),
      });
      const data = await res.json();
      if (data.success) {
        setRegistrations(registrations.map((r) => (r.id === editingReg.id ? { ...r, ...data.data } : r)));
        setIsEditRegModalOpen(false);
        showAlert("อัปเดตข้อมูลผู้ลงทะเบียนสำเร็จ 🎉", "success");
      } else {
        showAlert(`เกิดข้อผิดพลาด: ${data.error}`, "error");
      }
    } catch (err: any) {
      showAlert(`เกิดข้อผิดพลาด: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  // Prize Management State
  const [duplicateModal, setDuplicateModal] = useState<{
    show: boolean;
    file: File | null;
    duplicates: Array<{
      qrCode: string;
      rowNumber: number;
      existing: { fullName: string; email: string; phone: string; company: string; status: string };
      incoming: { fullName: string; email: string; phone: string; company: string; status: string };
    }>;
    selectedQrCodes: Set<string>;
    newRecordsCount: number;
  }>({
    show: false,
    file: null,
    duplicates: [],
    selectedQrCodes: new Set(),
    newRecordsCount: 0,
  });

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
    registerPlatform: "BOTH",
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
      registerPlatform: "BOTH",
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
      registerPlatform: ev.settings?.registerPlatform || "BOTH",
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
    if (loading) return;
    if (!selectedEventId) {
      showAlert("กรุณาเลือกงาน Event ก่อนเพิ่มรางวัล", "warning");
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
          showAlert("บันทึกข้อมูลรางวัลเรียบร้อยแล้ว", "success");
        } else {
          showAlert(data.error || "เกิดข้อผิดพลาดในการบันทึกรางวัล", "error");
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
          showAlert("เพิ่มรางวัลเรียบร้อยแล้ว", "success");
        } else {
          showAlert(data.error || "เกิดข้อผิดพลาดในการเพิ่มรางวัล", "error");
        }
      }
    } catch {
      showAlert("ไม่สามารถบันทึกข้อมูลรางวัลได้", "error");
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
        showAlert("ลบรางวัลเรียบร้อยแล้ว", "success");
      } else {
        showAlert(data.error || "เกิดข้อผิดพลาดในการลบรางวัล", "error");
      }
    } catch {
      showAlert("ไม่สามารถลบรางวัลได้", "error");
    }
  }

  async function handleUpdateWinnerStatus(winnerId: string, status: string) {
    try {
      const res = await fetch(`${API_URL}/api/draws/winners/${winnerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        setDrawSessions(drawSessions.map(session => ({
          ...session,
          winners: session.winners.map((w: any) => w.id === winnerId ? { ...w, status } : w)
        })));
        showAlert("อัปเดตสถานะผู้ได้รับรางวัลเรียบร้อยแล้ว", "success");
      } else {
        showAlert(data.error || "เกิดข้อผิดพลาดในการอัปเดตสถานะ", "error");
      }
    } catch {
      showAlert("ไม่สามารถอัปเดตสถานะผู้ได้รับรางวัลได้", "error");
    }
  }

  async function handleDeleteWinner(winnerId: string) {
    if (!confirm("คุณต้องการลบผู้ได้รับรางวัลคนนี้ใช่หรือไม่? การกระทำนี้จะคืนโควตารางวัลกลับไปด้วย")) return;
    try {
      const res = await fetch(`${API_URL}/api/draws/winners/${winnerId}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setDrawSessions(drawSessions.map(session => ({
          ...session,
          winners: session.winners.filter((w: any) => w.id !== winnerId)
        })));
        showAlert("ลบผู้ได้รับรางวัลเรียบร้อยแล้ว", "success");
      } else {
        showAlert(data.error || "เกิดข้อผิดพลาดในการลบผู้ได้รับรางวัล", "error");
      }
    } catch {
      showAlert("ไม่สามารถลบผู้ได้รับรางวัลได้", "error");
    }
  }

  async function handleDeleteSession(sessionId: string) {
    if (!confirm("คุณต้องการลบลบการจับรางวัลรอบนี้ทั้งหมดใช่หรือไม่? ผู้ได้รับรางวัลทั้งหมดในรอบนี้จะถูกลบและคืนโควตารางวัล")) return;
    try {
      const res = await fetch(`${API_URL}/api/draws/sessions/${sessionId}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setDrawSessions(drawSessions.filter(session => session.id !== sessionId));
        showAlert("ลบการจับรางวัลรอบนี้เรียบร้อยแล้ว", "success");
      } else {
        showAlert(data.error || "เกิดข้อผิดพลาดในการลบการจับรางวัล", "error");
      }
    } catch {
      showAlert("ไม่สามารถลบการจับรางวัลได้", "error");
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
    if (loading) return;
    if (!selectedEventId) {
      showAlert("กรุณาเลือกงาน Event ก่อนเพิ่มทางเข้างาน", "warning");
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
          showAlert("บันทึกข้อมูลทางเข้างานเรียบร้อยแล้ว", "success");
        } else {
          showAlert(data.error || "เกิดข้อผิดพลาดในการบันทึกทางเข้างาน", "error");
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
          showAlert("เพิ่มทางเข้างานเรียบร้อยแล้ว", "success");
        } else {
          showAlert(data.error || "เกิดข้อผิดพลาดในการเพิ่มทางเข้างาน", "error");
        }
      }
    } catch {
      showAlert("ไม่สามารถบันทึกข้อมูลทางเข้างานได้", "error");
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
        showAlert("ลบทางเข้างานเรียบร้อยแล้ว", "success");
      } else {
        showAlert(data.error || "เกิดข้อผิดพลาดในการลบทางเข้างาน", "error");
      }
    } catch {
      showAlert("ไม่สามารถลบทางเข้างานได้", "error");
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
      showAlert("ไม่สามารถอัปเดตสถานะทางเข้างานได้", "error");
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
    if (loginForm.loading) return;
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

  function handleDownloadTemplate() {
    window.open(`${API_URL}/api/registrations/template`, "_blank");
  }

  async function handleImport(
    file: File,
    options?: { confirmAll?: boolean; skipAll?: boolean; confirmedQrCodes?: string[] }
  ) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("eventId", selectedEventId);

    if (options?.confirmAll) formData.append("confirmDuplicates", "true");
    if (options?.skipAll) formData.append("skipDuplicates", "true");
    if (options?.confirmedQrCodes) formData.append("confirmedQrCodes", JSON.stringify(options.confirmedQrCodes));

    const res = await fetch(`${API_URL}/api/registrations/import`, { method: "POST", body: formData });
    const data = await res.json();

    if (data.success && data.hasDuplicates) {
      setDuplicateModal({
        show: true,
        file: file,
        duplicates: data.duplicates,
        selectedQrCodes: new Set(data.duplicates.map((d: any) => d.qrCode)),
        newRecordsCount: data.newRecordsCount || 0,
      });
      return;
    }

    if (data.success) {
      setDuplicateModal((prev) => ({ ...prev, show: false }));
      const msgParts = [];
      if (data.data.imported) msgParts.push(`นำเข้าใหม่: ${data.data.imported} รายการ`);
      if (data.data.updated) msgParts.push(`อัปเดตข้อมูลเดิม: ${data.data.updated} รายการ`);
      if (data.data.skipped) msgParts.push(`ข้ามรายการซ้ำ: ${data.data.skipped} รายการ`);
      if (data.data.errors) msgParts.push(`ข้อผิดพลาด: ${data.data.errors} รายการ`);

      showAlert(`การนำเข้าเสร็จสมบูรณ์ 🎉\n\n${msgParts.join("\n")}`, "success", "นำเข้าข้อมูลสำเร็จ");
    } else {
      showAlert(data.error || "ไม่สามารถนำเข้าข้อมูลได้", "error");
    }

    // Reload registrations
    const r = await fetch(`${API_URL}/api/registrations?eventId=${selectedEventId}&limit=50`, { headers: getAuthHeaders() });
    const rd = await r.json();
    if (rd.success) setRegistrations(rd.data);
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
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
          registerPlatform: newEvent.registerPlatform,
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
          showAlert("บันทึกข้อมูลงาน Event เรียบร้อยแล้ว", "success");
        } else {
          showAlert(data.error || "เกิดข้อผิดพลาดในการบันทึกงาน Event", "error");
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
          showAlert("สร้างงาน Event เรียบร้อยแล้ว", "success");
        } else {
          showAlert(data.error || "เกิดข้อผิดพลาดในการสร้างงาน Event", "error");
        }
      }
    } catch (err) {
      showAlert("ไม่สามารถบันทึกข้อมูลงาน Event ได้", "error");
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
        showAlert("อัปเดตสถานะงาน Event เรียบร้อยแล้ว", "success");
      } else {
        showAlert(data.error || "เกิดข้อผิดพลาดในการอัปเดตสถานะ", "error");
      }
    } catch (err) {
      showAlert("ไม่สามารถอัปเดตสถานะงาน Event ได้", "error");
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
              <div style={{ position: "relative" }}>
                <Input
                  type={showPassword ? "text" : "password"}
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  required
                  style={{ width: "100%", paddingRight: "40px" }}
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
                      <button
                        className="btn btn--danger"
                        style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" }}
                        onClick={() => openDeleteEventModal(ev)}
                        title="ลบงาน Event พร้อมผู้ลงทะเบียนทั้งหมด"
                      >
                        🗑️ ลบงาน
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
                <p className="admin-header__subtitle">
                  {registrations.length} คน {regSearchQuery.trim() && `(ผลการค้นหา ${registrations.filter((reg) => {
                    const q = regSearchQuery.toLowerCase().trim();
                    return (
                      (reg.fullName && reg.fullName.toLowerCase().includes(q)) ||
                      (reg.company && reg.company.toLowerCase().includes(q)) ||
                      (reg.qrCode && reg.qrCode.toLowerCase().includes(q)) ||
                      (reg.phone && reg.phone.toLowerCase().includes(q)) ||
                      (reg.ticketNumber && reg.ticketNumber.toLowerCase().includes(q)) ||
                      (reg.luckyDrawNumber && reg.luckyDrawNumber.toLowerCase().includes(q))
                    );
                  }).length} คน)`}
                </p>
              </div>
              <div className="flex gap-3">
                <button className="btn btn--outline" onClick={handleDownloadTemplate}>
                  📄 Download Template
                </button>
                <label className="btn btn--secondary" style={{ cursor: "pointer" }}>
                  📥 Import Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleImport(e.target.files[0]);
                    }}
                  />
                </label>
                <button className="btn btn--secondary" onClick={handleExport}>📤 Export Excel</button>
              </div>
            </div>

            {/* Search Box */}
            <div style={{ marginBottom: "var(--space-4)", display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  type="text"
                  className="input"
                  placeholder="🔍 ค้นหา ชื่อ-นามสกุล, บริษัท, QR Code, เบอร์โทร, เลขเช็กอิน..."
                  value={regSearchQuery}
                  onChange={(e) => setRegSearchQuery(e.target.value)}
                  style={{ paddingLeft: "2.5rem", width: "100%", height: "42px" }}
                />
                {regSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setRegSearchQuery("")}
                    style={{
                      position: "absolute",
                      right: "0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      border: "none",
                      background: "transparent",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      fontSize: "1rem",
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {registrations.length === 0 ? (
              <div className="glass-card flex-center" style={{ padding: "var(--space-12)", textAlign: "center", marginTop: "var(--space-4)" }}>
                <div>
                  <div style={{ fontSize: "3.5rem", marginBottom: "var(--space-3)" }}>📋</div>
                  <h3 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "var(--space-2)" }}>
                    ยังไม่มีข้อมูลผู้ลงทะเบียนในงานนี้
                  </h3>
                  <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-6)", maxWidth: "480px", margin: "0 auto var(--space-6)" }}>
                    คุณสามารถนำเข้าข้อมูลผู้ลงทะเบียนได้โดยดาวน์โหลดไฟล์แม่แบบ (Template) แล้วกรอกข้อมูลก่อนนำเข้าเข้าสู่ระบบ
                  </p>
                  <div className="flex gap-4 justify-center">
                    <button className="btn btn--primary" onClick={handleDownloadTemplate}>
                      📄 ดาวน์โหลด Template Excel
                    </button>
                    <label className="btn btn--secondary" style={{ cursor: "pointer" }}>
                      📥 Import Excel
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleImport(e.target.files[0]);
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      {[
                        { label: "ชื่อ-นามสกุล", field: "fullName" },
                        { label: "บริษัท", field: "company" },
                        { label: "QR Code", field: "qrCode" },
                        { label: "เบอร์โทร", field: "phone" },
                        { label: "สถานะ", field: "status" },
                        { label: "เลขเช็กอิน", field: "ticketNumber" },
                      ].map((col) => {
                        const isActive = regSortField === col.field;
                        return (
                          <th
                            key={col.field}
                            onClick={() => handleRegSort(col.field)}
                            style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                            title={`คลิกเพื่อเรียงข้อมูลตาม ${col.label}`}
                          >
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                              <span>{col.label}</span>
                              <span style={{ fontSize: "0.75rem", color: isActive ? "var(--primary)" : "var(--text-muted)", opacity: isActive ? 1 : 0.3 }}>
                                {isActive ? (regSortDirection === "asc" ? "▲" : "▼") : "↕"}
                              </span>
                            </div>
                          </th>
                        );
                      })}
                      <th style={{ textAlign: "right" }}>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations
                      .filter((reg) => {
                        if (!regSearchQuery.trim()) return true;
                        const q = regSearchQuery.toLowerCase().trim();
                        return (
                          (reg.fullName && reg.fullName.toLowerCase().includes(q)) ||
                          (reg.company && reg.company.toLowerCase().includes(q)) ||
                          (reg.qrCode && reg.qrCode.toLowerCase().includes(q)) ||
                          (reg.phone && reg.phone.toLowerCase().includes(q)) ||
                          (reg.ticketNumber && reg.ticketNumber.toLowerCase().includes(q)) ||
                          (reg.luckyDrawNumber && reg.luckyDrawNumber.toLowerCase().includes(q))
                        );
                      })
                      .sort((a, b) => {
                        let valA = "";
                        let valB = "";

                        switch (regSortField) {
                          case "fullName":
                            valA = a.fullName || "";
                            valB = b.fullName || "";
                            break;
                          case "company":
                            valA = a.company || "";
                            valB = b.company || "";
                            break;
                          case "qrCode":
                            valA = a.qrCode || "";
                            valB = b.qrCode || "";
                            break;
                          case "phone":
                            valA = a.phone || "";
                            valB = b.phone || "";
                            break;
                          case "status":
                            valA = a.status || "";
                            valB = b.status || "";
                            break;
                          case "ticketNumber":
                            valA = a.ticketNumber || a.luckyDrawNumber || "";
                            valB = b.ticketNumber || b.luckyDrawNumber || "";
                            break;
                          default:
                            valA = a.createdAt || "";
                            valB = b.createdAt || "";
                        }

                        const cmp = valA.localeCompare(valB, "th", { numeric: true, sensitivity: "base" });
                        return regSortDirection === "asc" ? cmp : -cmp;
                      })
                      .map((reg) => (
                        <tr key={reg.id}>
                          <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{reg.fullName}</td>
                          <td>{reg.company || "-"}</td>
                          <td style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--primary)" }}>{reg.qrCode}</td>
                          <td>{reg.phone || "-"}</td>
                          <td>
                            <span
                              className={`badge badge--${
                                reg.status === "CHECKED_IN"
                                  ? "success"
                                  : reg.status === "APPROVED"
                                  ? "primary"
                                  : reg.status === "CANCELLED"
                                  ? "error"
                                  : "warning"
                              }`}
                            >
                              {reg.status === "CHECKED_IN"
                                ? "✓ เช็กอินแล้ว"
                                : reg.status === "APPROVED"
                                ? "อนุมัติ"
                                : reg.status === "CANCELLED"
                                ? "ยกเลิก"
                                : reg.status === "PENDING_APPROVAL"
                                ? "รอการอนุมัติ"
                                : "ลงทะเบียน"}
                            </span>
                          </td>
                          <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                            {reg.ticketNumber || reg.luckyDrawNumber || "-"}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div className="flex gap-2 justify-end">
                              <button
                                className="btn btn--secondary btn--sm"
                                style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: "0.2rem" }}
                                onClick={() => openEditReg(reg)}
                                title="แก้ไขข้อมูลผู้ลงทะเบียน"
                              >
                                ✏️ แก้ไข
                              </button>
                              <button
                                className="btn btn--danger btn--sm"
                                style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                                onClick={async () => {
                                  if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ ${reg.fullName}?`)) {
                                    setLoading(true);
                                    try {
                                      const res = await fetch(`${API_URL}/api/registrations/${reg.id}`, {
                                        method: "DELETE",
                                        headers: getAuthHeaders(),
                                      });
                                      const data = await res.json();
                                      if (data.success) {
                                        setRegistrations(registrations.filter((r) => r.id !== reg.id));
                                        showAlert("ลบข้อมูลผู้ลงทะเบียนสำเร็จ", "info");
                                      } else {
                                        showAlert(`เกิดข้อผิดพลาด: ${data.error}`, "error");
                                      }
                                    } catch (err: any) {
                                      showAlert(`เกิดข้อผิดพลาด: ${err.message}`, "error");
                                    } finally {
                                      setLoading(false);
                                    }
                                  }
                                }}
                                title="ลบผู้ลงทะเบียน"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
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
                      <div className="flex gap-2 items-center">
                        <span className={`badge badge--${session.status === "COMPLETED" ? "success" : "warning"}`}>
                          {session.status}
                        </span>
                        <button
                          className="btn btn--danger btn--sm"
                          style={{ padding: "0.2rem 0.4rem", fontSize: "0.75rem" }}
                          onClick={() => handleDeleteSession(session.id)}
                          title="ลบการจับรางวัลรอบนี้"
                        >
                          🗑️ ลบ
                        </button>
                      </div>
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
                              alignItems: "center",
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
                            <div className="flex gap-2 items-center">
                              <select
                                value={w.status}
                                onChange={(e) => handleUpdateWinnerStatus(w.id, e.target.value)}
                                style={{
                                  fontSize: "var(--text-xs)",
                                  padding: "0.2rem 0.4rem",
                                  borderRadius: "var(--radius-sm)",
                                  border: "1px solid var(--border-default)",
                                  background: "var(--bg-input)",
                                  color: "var(--text-primary)"
                                }}
                              >
                                <option value="PENDING">⏳ รอยืนยัน (PENDING)</option>
                                <option value="ACCEPTED">🟢 รับรางวัลแล้ว (ACCEPTED)</option>
                                <option value="REDRAWN">🔄 สุ่มใหม่แล้ว (REDRAWN)</option>
                                <option value="CANCELLED">🔴 ยกเลิกสิทธิ์ (CANCELLED)</option>
                              </select>
                              <button
                                className="btn btn--danger btn--sm"
                                style={{ padding: "0.2rem 0.4rem", fontSize: "0.75rem" }}
                                onClick={() => handleDeleteWinner(w.id)}
                                title="ลบผู้ได้รับรางวัลคนนี้"
                              >
                                🗑️
                              </button>
                            </div>
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
                                    showAlert("ลบผู้ใช้เรียบร้อยแล้ว", "success");
                                  } else {
                                    showAlert("ไม่สามารถลบผู้ใช้ได้", "error");
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
              <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: "var(--space-1)" }}>
                🌐 ช่องทางที่อนุญาตให้ลงทะเบียน (Registration Platform)
              </label>
              <select
                className="form-input"
                value={newEvent.registerPlatform}
                onChange={(e) => setNewEvent({ ...newEvent, registerPlatform: e.target.value })}
                style={{ width: "100%" }}
              >
                <option value="BOTH">ทุกช่องทาง (Google Apps Script & Event Platform)</option>
                <option value="GAS">Google Apps Script (GAS) เท่านั้น</option>
                <option value="EVT">Event Platform (Web Register) เท่านั้น</option>
              </select>
              <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "var(--space-1)" }}>
                * หากเลือก GAS ระบบ Event Platform จะปิดรับการลงทะเบียนทางหน้าเว็บและให้ผู้ลงทะเบียนใช้งานผ่าน GAS เท่านั้น
              </div>
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
              showAlert("บันทึกข้อมูลผู้ใช้เรียบร้อยแล้ว", "success");
            } else {
              const data = await res.json();
              showAlert(data.message || "ไม่สามารถบันทึกข้อมูลผู้ใช้ได้", "error");
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

      {/* Edit Registration Modal */}
      <Modal
        isOpen={isEditRegModalOpen}
        onClose={() => setIsEditRegModalOpen(false)}
        title="✏️ แก้ไขข้อมูลผู้ลงทะเบียน"
        footer={
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setIsEditRegModalOpen(false)}>ยกเลิก</Button>
            <Button variant="primary" type="submit" form="edit-reg-form" disabled={loading}>
              {loading ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
            </Button>
          </div>
        }
      >
        <form id="edit-reg-form" onSubmit={handleSaveRegEdit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Input
            label="ชื่อ-นามสกุล *"
            required
            value={editingReg.fullName}
            onChange={(e) => setEditingReg({ ...editingReg, fullName: e.target.value })}
            placeholder="เช่น สมชาย ใจดี"
          />
          <Input
            label="บริษัท/หน่วยงาน/องค์กร *"
            required
            value={editingReg.company}
            onChange={(e) => setEditingReg({ ...editingReg, company: e.target.value })}
            placeholder="เช่น บริษัท เออบาน่า จำกัด"
          />
          <div className="grid grid-2 gap-4">
            <Input
              label="เบอร์โทรศัพท์"
              value={editingReg.phone}
              onChange={(e) => setEditingReg({ ...editingReg, phone: e.target.value })}
              placeholder="เช่น 0812345678"
            />
            <Input
              label="อีเมล"
              value={editingReg.email}
              onChange={(e) => setEditingReg({ ...editingReg, email: e.target.value })}
              placeholder="เช่น example@email.com"
            />
          </div>
          <div className="grid grid-2 gap-4">
            <Input
              label="แผนก/ฝ่าย"
              value={editingReg.department}
              onChange={(e) => setEditingReg({ ...editingReg, department: e.target.value })}
              placeholder="เช่น ฝ่ายการตลาด"
            />
            <Input
              label="ประเภทพนักงาน / สถานะบุคคล"
              value={editingReg.employeeType}
              onChange={(e) => setEditingReg({ ...editingReg, employeeType: e.target.value })}
              placeholder="เช่น พนักงานประจำ, VIP, ลูกค้า"
            />
          </div>
          <div className="grid grid-2 gap-4">
            <div className="form-group">
              <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "var(--space-1)", display: "block" }}>
                สถานะการลงทะเบียน
              </label>
              <select
                className="input"
                value={editingReg.status}
                onChange={(e) => setEditingReg({ ...editingReg, status: e.target.value })}
                style={{ width: "100%", height: "40px" }}
              >
                <option value="APPROVED">🟢 อนุมัติ (APPROVED)</option>
                <option value="CHECKED_IN">✅ เช็กอินแล้ว (CHECKED_IN)</option>
                <option value="REGISTERED">📝 ลงทะเบียนแล้ว (REGISTERED)</option>
                <option value="PENDING_APPROVAL">⏳ รอการอนุมัติ (PENDING_APPROVAL)</option>
                <option value="CANCELLED">🔴 ยกเลิก (CANCELLED)</option>
              </select>
            </div>
            <Input
              label="Running Number / เลขเช็กอิน"
              value={editingReg.ticketNumber}
              onChange={(e) => setEditingReg({ ...editingReg, ticketNumber: e.target.value })}
              placeholder="เช่น A00001"
            />
          </div>
        </form>
      </Modal>

      {/* Modal Alert & Confirm Duplicate Registrations */}
      {duplicateModal.show && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div className="glass-card" style={{ maxWidth: "850px", width: "100%", maxHeight: "90vh", overflowY: "auto", background: "var(--bg-primary)", padding: "1.5rem", borderRadius: "16px", border: "1px solid var(--border-color)", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#F59E0B", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                ⚠️ พบรายการซ้ำในงานนี้ ({duplicateModal.duplicates.length} รายการ)
              </h2>
              <button
                className="btn btn--outline"
                style={{ padding: "0.2rem 0.5rem", fontSize: "0.8rem" }}
                onClick={() => setDuplicateModal((prev) => ({ ...prev, show: false }))}
              >
                ✕ ปิดหน้าต่าง
              </button>
            </div>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "1.2rem", lineHeight: "1.5" }}>
              ระบบตรวจพบรหัส QR Code ที่ซ้ำกับผู้ลงทะเบียนที่มีอยู่แล้วในงานนี้ คุณสามารถเลือกว่าต้องการ <b>อัปเดตข้อมูลเดิม</b> หรือ <b>ข้ามรายการซ้ำ</b> ได้ครับ
              {duplicateModal.newRecordsCount > 0 && <span style={{ color: "var(--success)", fontWeight: 600 }}> (ส่วนรายการใหม่ที่ไม่ซ้ำอีก {duplicateModal.newRecordsCount} รายการจะถูกนำเข้าตามปกติ)</span>}
            </p>

            {/* Table of Duplicates */}
            <div style={{ overflowX: "auto", marginBottom: "1.5rem", border: "1px solid var(--border-color)", borderRadius: "8px", background: "var(--bg-secondary)" }}>
              <table className="table" style={{ fontSize: "0.85rem", width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--bg-tertiary)" }}>
                    <th style={{ width: "45px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={duplicateModal.selectedQrCodes.size === duplicateModal.duplicates.length && duplicateModal.duplicates.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDuplicateModal((prev) => ({
                              ...prev,
                              selectedQrCodes: new Set(prev.duplicates.map((d) => d.qrCode)),
                            }));
                          } else {
                            setDuplicateModal((prev) => ({ ...prev, selectedQrCodes: new Set() }));
                          }
                        }}
                        style={{ width: "16px", height: "16px", cursor: "pointer" }}
                      />
                    </th>
                    <th>รหัส QR Code</th>
                    <th>ข้อมูลเดิม (ในระบบ)</th>
                    <th>ข้อมูลใหม่ (จากไฟล์)</th>
                  </tr>
                </thead>
                <tbody>
                  {duplicateModal.duplicates.map((dup) => (
                    <tr key={dup.qrCode} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={duplicateModal.selectedQrCodes.has(dup.qrCode)}
                          onChange={(e) => {
                            const newSet = new Set(duplicateModal.selectedQrCodes);
                            if (e.target.checked) newSet.add(dup.qrCode);
                            else newSet.delete(dup.qrCode);
                            setDuplicateModal((prev) => ({ ...prev, selectedQrCodes: newSet }));
                          }}
                          style={{ width: "16px", height: "16px", cursor: "pointer" }}
                        />
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--primary)" }}>{dup.qrCode}</td>
                      <td style={{ padding: "0.6rem" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{dup.existing.fullName}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>📞 {dup.existing.phone} | 🏢 {dup.existing.company}</div>
                      </td>
                      <td style={{ padding: "0.6rem" }}>
                        <div style={{ fontWeight: 600, color: "#10B981" }}>{dup.incoming.fullName}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>📞 {dup.incoming.phone} | 🏢 {dup.incoming.company}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", flexWrap: "wrap", alignItems: "center" }}>
              <button
                className="btn btn--outline"
                onClick={() => setDuplicateModal((prev) => ({ ...prev, show: false }))}
              >
                ❌ ยกเลิกการนำเข้า
              </button>
              <button
                className="btn btn--secondary"
                onClick={() => {
                  if (duplicateModal.file) {
                    handleImport(duplicateModal.file, { skipAll: true });
                  }
                }}
              >
                ⏭️ ข้ามรายการซ้ำทั้งหมด
              </button>
              <button
                className="btn btn--primary"
                style={{ background: duplicateModal.selectedQrCodes.size > 0 ? "linear-gradient(135deg, #059669, #10B981)" : "#9CA3AF" }}
                disabled={duplicateModal.selectedQrCodes.size === 0}
                onClick={() => {
                  if (duplicateModal.file) {
                    handleImport(duplicateModal.file, {
                      confirmedQrCodes: Array.from(duplicateModal.selectedQrCodes),
                    });
                  }
                }}
              >
                ✅ ยืนยันตามรายการที่เลือก ({duplicateModal.selectedQrCodes.size})
              </button>
              <button
                className="btn btn--primary"
                style={{ background: "linear-gradient(135deg, #2563EB, #1D4ED8)" }}
                onClick={() => {
                  if (duplicateModal.file) {
                    handleImport(duplicateModal.file, { confirmAll: true });
                  }
                }}
              >
                ⚡ ยืนยันทั้งหมด ({duplicateModal.duplicates.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Delete Event Confirmation with Verification Code */}
      {deleteEventModal.show && deleteEventModal.event && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div className="glass-card" style={{ maxWidth: "520px", width: "100%", background: "var(--bg-primary)", padding: "1.75rem", borderRadius: "16px", border: "1px solid rgba(239,68,68,0.4)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#EF4444", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                🗑️ ยืนยันการลบงาน Event
              </h2>
              <button
                className="btn btn--outline"
                style={{ padding: "0.2rem 0.5rem", fontSize: "0.8rem" }}
                onClick={() => setDeleteEventModal((prev) => ({ ...prev, show: false }))}
              >
                ✕ ปิด
              </button>
            </div>

            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "12px", padding: "1rem", marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                📌 {deleteEventModal.event.name}
              </h3>
              <p style={{ fontSize: "0.875rem", color: "#FCA5A5", lineHeight: "1.5" }}>
                ⚠️ <b>คำเตือนสำคัญ:</b> การลบงาน Event นี้ จะทำการลบผู้ลงทะเบียนทั้งหมด <b>({deleteEventModal.event._count?.registrations || 0} คน)</b>, ข้อมูลการเช็กอิน, รางวัล, และข้อมูลทั้งหมดที่เกี่ยวข้องอย่างถาวร <b>ไม่สามารถกู้คืนได้!</b>
              </p>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ fontSize: "0.9rem", fontWeight: 600, display: "block", marginBottom: "0.5rem", color: "var(--text-primary)" }}>
                กรุณากรอกรหัสยืนยันด้านล่างเพื่อทำการลบ:
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "1.4rem", fontWeight: 800, fontFamily: "var(--font-mono)", letterSpacing: "4px", background: "var(--bg-tertiary)", padding: "0.4rem 1rem", borderRadius: "8px", border: "1px solid var(--border-color)", color: "#F59E0B" }}>
                  {deleteEventModal.confirmCode}
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  (พิมพ์รหัส 4 หลักให้ถูกต้อง)
                </span>
              </div>
              <input
                type="text"
                className="input"
                placeholder="พิมพ์รหัสยืนยัน 4 หลักที่นี่..."
                value={deleteEventModal.inputCode}
                onChange={(e) => setDeleteEventModal((prev) => ({ ...prev, inputCode: e.target.value }))}
                style={{ width: "100%", height: "44px", fontSize: "1.1rem", fontFamily: "var(--font-mono)", textAlign: "center", letterSpacing: "2px", border: deleteEventModal.inputCode === deleteEventModal.confirmCode ? "2px solid #10B981" : "1px solid var(--border-color)" }}
              />
            </div>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                className="btn btn--outline"
                onClick={() => setDeleteEventModal((prev) => ({ ...prev, show: false }))}
              >
                ❌ ยกเลิก
              </button>
              <button
                className="btn btn--danger"
                disabled={deleteEventModal.inputCode.trim() !== deleteEventModal.confirmCode || loading}
                onClick={handleConfirmDeleteEvent}
                style={{ background: deleteEventModal.inputCode.trim() === deleteEventModal.confirmCode ? "linear-gradient(135deg, #EF4444, #DC2626)" : "#6B7280", cursor: deleteEventModal.inputCode.trim() === deleteEventModal.confirmCode ? "pointer" : "not-allowed" }}
              >
                {loading ? "กำลังลบงาน..." : "🔴 ยืนยันลบงานและผู้ลงทะเบียนทั้งหมด"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Popup Modal */}
      {alertModal.show && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
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
