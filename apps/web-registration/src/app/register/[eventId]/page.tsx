"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Event } from "@event-platform/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface GroupMemberForm {
  fullName: string;
  email: string;
  phone: string;
  role: string;
}

export default function RegisterPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isGroup, setIsGroup] = useState(false);
  const [success, setSuccess] = useState<{
    qrCode: string;
    qrDataUrl: string;
    fullName: string;
    id: string;
  } | null>(null);

  // Form state
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    company: "",
    department: "",
    employeeType: "",
    groupName: "",
  });
  const [groupMembers, setGroupMembers] = useState<GroupMemberForm[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`${API_URL}/api/events/${eventId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setEvent(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [eventId]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: "" });
    }
  }

  function addGroupMember() {
    setGroupMembers([...groupMembers, { fullName: "", email: "", phone: "", role: "member" }]);
  }

  function removeGroupMember(index: number) {
    setGroupMembers(groupMembers.filter((_, i) => i !== index));
  }

  function updateGroupMember(index: number, field: string, value: string) {
    const updated = [...groupMembers];
    updated[index] = { ...updated[index]!, [field]: value };
    setGroupMembers(updated);
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.fullName.trim()) errs.fullName = "กรุณากรอกชื่อ-นามสกุล";
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) errs.email = "รูปแบบอีเมลไม่ถูกต้อง";
    if (form.phone && !/^0[0-9]{8,9}$/.test(form.phone)) errs.phone = "รูปแบบเบอร์โทรไม่ถูกต้อง";
    if (isGroup && !form.groupName.trim()) errs.groupName = "กรุณากรอกชื่อกลุ่ม";
    if (isGroup && groupMembers.length === 0) errs.groupMembers = "กรุณาเพิ่มสมาชิกอย่างน้อย 1 คน";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        eventId,
        fullName: form.fullName,
        email: form.email || undefined,
        phone: form.phone || undefined,
        company: form.company || undefined,
        department: form.department || undefined,
        employeeType: form.employeeType || undefined,
      };
      if (isGroup) {
        body.groupName = form.groupName;
        body.groupMembers = groupMembers.filter((m) => m.fullName.trim());
      }

      const res = await fetch(`${API_URL}/api/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        setSuccess({
          qrCode: data.data.qrCode,
          qrDataUrl: data.data.qrDataUrl,
          fullName: data.data.fullName,
          id: data.data.id,
        });
      } else {
        setErrors({ submit: data.error || "เกิดข้อผิดพลาด" });
      }
    } catch (err) {
      setErrors({ submit: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-center" style={{ minHeight: "100vh" }}>
        <span className="spinner spinner--lg" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex-center" style={{ minHeight: "100vh" }}>
        <div className="glass-card" style={{ textAlign: "center", padding: "var(--space-12)" }}>
          <div style={{ fontSize: "4rem", marginBottom: "var(--space-4)" }}>😕</div>
          <h2 style={{ marginBottom: "var(--space-3)" }}>ไม่พบงานนี้</h2>
          <a href="/" className="btn btn--primary">กลับหน้าหลัก</a>
        </div>
      </div>
    );
  }

  const canRegister =
    event.status === "PUBLISHED" ||
    (event.status === "ACTIVE" && event.settings?.enableRegisterWhenActive !== false);

  if (!canRegister) {
    return (
      <div className="flex-center" style={{ minHeight: "100vh", padding: "var(--space-6)" }}>
        <div className="glass-card" style={{ textAlign: "center", padding: "var(--space-12)", maxWidth: "500px", width: "100%" }}>
          <div style={{ fontSize: "4rem", marginBottom: "var(--space-4)" }}>🔒</div>
          <h2 style={{ marginBottom: "var(--space-3)", fontSize: "var(--text-2xl)", fontWeight: 800 }}>
            งานนี้ไม่ได้เปิดรับลงทะเบียนในขณะนี้
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-6)" }}>
            {event.status === "CLOSED" || event.status === "ARCHIVED"
              ? "งานนี้ได้เสร็จสิ้นกิจกรรมไปแล้ว"
              : event.status === "ACTIVE"
              ? "งานนี้อยู่ในระหว่างดำเนินงานและปิดรับลงทะเบียน"
              : "สถานะงานปัจจุบันยังไม่พร้อมเปิดรับลงทะเบียน"}
          </p>
          <a href="/" className="btn btn--primary">กลับหน้าหลัก</a>
        </div>
      </div>
    );
  }

  // Success State
  if (success) {
    return (
      <div className="flex-center" style={{ minHeight: "100vh", padding: "var(--space-6)" }}>
        <div
          className="glass-card glass-card--elevated"
          style={{
            maxWidth: "500px",
            width: "100%",
            textAlign: "center",
            padding: "var(--space-10)",
            animation: "slideUp 0.5s ease-out",
          }}
        >
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--color-success) 0%, #059669 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto var(--space-6)",
              fontSize: "2rem",
              boxShadow: "0 0 30px rgba(16, 185, 129, 0.4)",
            }}
          >
            ✓
          </div>
          <h2
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 800,
              marginBottom: "var(--space-2)",
            }}
          >
            ลงทะเบียนสำเร็จ!
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              marginBottom: "var(--space-6)",
            }}
          >
            คุณ {success.fullName} ลงทะเบียนเข้าร่วมงาน <strong>{event.name}</strong> เรียบร้อยแล้ว
          </p>

          {/* QR Code */}
          <div
            style={{
              background: "#fff",
              borderRadius: "var(--radius-xl)",
              padding: "var(--space-6)",
              display: "inline-block",
              marginBottom: "var(--space-4)",
              boxShadow: "0 0 30px rgba(99, 102, 241, 0.2)",
            }}
          >
            {success.qrDataUrl ? (
              <img
                src={success.qrDataUrl}
                alt="QR Code"
                style={{ width: "200px", height: "200px" }}
              />
            ) : (
              <div
                style={{
                  width: "200px",
                  height: "200px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#333",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {success.qrCode}
              </div>
            )}
          </div>

          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              marginBottom: "var(--space-6)",
            }}
          >
            รหัส: {success.qrCode}
          </p>

          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              marginBottom: "var(--space-6)",
              background: "var(--bg-glass)",
              padding: "var(--space-3) var(--space-4)",
              borderRadius: "var(--radius-md)",
            }}
          >
            📱 กรุณาบันทึกภาพ QR Code หรือจดรหัสไว้ เพื่อใช้เช็กอินในวันงาน
          </p>

          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center" }}>
            <a href="/" className="btn btn--secondary">กลับหน้าหลัก</a>
            <button
              className="btn btn--primary"
              onClick={() => {
                const link = document.createElement("a");
                link.href = success.qrDataUrl!;
                link.download = `qr-${success.qrCode}.png`;
                link.click();
              }}
            >
              📥 ดาวน์โหลด QR
            </button>
          </div>
        </div>
      </div>
    );
  }

  const themeColor = event?.settings?.themeColor || "var(--color-primary)";
  const bgUrl = event?.settings?.registerBackground;

  return (
    <div style={{ 
      minHeight: "100vh", 
      padding: "var(--space-6)",
      background: bgUrl ? `url(${bgUrl}) center/cover fixed no-repeat` : undefined
    }}>
      <div className="container" style={{ maxWidth: "700px" }}>
        {/* Back */}
        <a
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
            color: "var(--text-secondary)",
            fontSize: "var(--text-sm)",
            marginBottom: "var(--space-6)",
          }}
        >
          ← กลับหน้าเลือกงาน
        </a>

        {/* Event Header */}
        <div className="glass-card" style={{ marginBottom: "var(--space-6)", borderTop: `4px solid ${themeColor}` }}>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, marginBottom: "var(--space-2)", color: themeColor }}>
            {event.name}
          </h1>
          <div
            style={{
              display: "flex",
              gap: "var(--space-4)",
              color: "var(--text-secondary)",
              fontSize: "var(--text-sm)",
              flexWrap: "wrap",
            }}
          >
            <span>
              📅{" "}
              {new Date(event.startDate).toLocaleDateString("th-TH", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            {event.venue && <span>📍 {event.venue}</span>}
          </div>
        </div>

        {/* Registration Form */}
        {event.status === "CLOSED" ? (
          <div className="glass-card" style={{ marginBottom: "var(--space-6)", textAlign: "center", padding: "var(--space-12)" }}>
            <div style={{ fontSize: "4rem", marginBottom: "var(--space-4)" }}>⌛</div>
            <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "var(--space-2)" }}>ปิดรับลงทะเบียนแล้ว</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-6)" }}>งานอีเว้นท์นี้ได้ปิดรับลงทะเบียนแล้ว</p>
            <a href="/" className="btn btn--secondary">กลับหน้าหลัก</a>
          </div>
        ) : (
        <form onSubmit={handleSubmit}>
          <div className="glass-card" style={{ marginBottom: "var(--space-6)" }}>
            <h2
              style={{
                fontSize: "var(--text-lg)",
                fontWeight: 700,
                marginBottom: "var(--space-6)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
              }}
            >
              📝 ข้อมูลผู้ลงทะเบียน
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {/* Name */}
              <div className="form-group">
                <label className="form-label form-label--required">ชื่อ-นามสกุล</label>
                <input
                  className={`form-input ${errors.fullName ? "form-input--error" : ""}`}
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  placeholder="กรอกชื่อ-นามสกุล"
                />
                {errors.fullName && <span className="form-error">{errors.fullName}</span>}
              </div>

              {/* Email & Phone */}
              <div className="grid grid-2 gap-4">
                <div className="form-group">
                  <label className="form-label">อีเมล</label>
                  <input
                    className={`form-input ${errors.email ? "form-input--error" : ""}`}
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="email@example.com"
                  />
                  {errors.email && <span className="form-error">{errors.email}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">เบอร์โทร</label>
                  <input
                    className={`form-input ${errors.phone ? "form-input--error" : ""}`}
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="0812345678"
                  />
                  {errors.phone && <span className="form-error">{errors.phone}</span>}
                </div>
              </div>

              {/* Company & Department */}
              <div className="grid grid-2 gap-4">
                <div className="form-group">
                  <label className="form-label">บริษัท/หน่วยงาน</label>
                  <input
                    className="form-input"
                    name="company"
                    value={form.company}
                    onChange={handleChange}
                    placeholder="ชื่อบริษัท"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">แผนก</label>
                  <input
                    className="form-input"
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    placeholder="แผนกที่สังกัด"
                  />
                </div>
              </div>

              {/* Employee Type */}
              <div className="form-group">
                <label className="form-label">ประเภทพนักงาน</label>
                <select
                  className="form-input"
                  name="employeeType"
                  value={form.employeeType}
                  onChange={handleChange}
                >
                  <option value="">-- เลือกประเภท --</option>
                  <option value="Full-time">พนักงานประจำ</option>
                  <option value="Part-time">พนักงาน Part-time</option>
                  <option value="Contract">พนักงานสัญญาจ้าง</option>
                  <option value="Intern">นักศึกษาฝึกงาน</option>
                </select>
              </div>
            </div>
          </div>

          {/* Group Registration Toggle */}
          {event.settings?.allowGroupRegistration && (
          <div className="glass-card" style={{ marginBottom: "var(--space-6)" }}>
            <div className="flex-between" style={{ marginBottom: isGroup ? "var(--space-4)" : 0 }}>
              <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                👥 ลงทะเบียนเป็นกลุ่ม
              </h2>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={isGroup}
                  onChange={(e) => setIsGroup(e.target.checked)}
                  style={{ width: "18px", height: "18px", accentColor: "var(--color-primary)" }}
                />
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                  เปิดใช้งาน
                </span>
              </label>
            </div>

            {isGroup && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <div className="form-group">
                  <label className="form-label form-label--required">ชื่อกลุ่ม</label>
                  <input
                    className={`form-input ${errors.groupName ? "form-input--error" : ""}`}
                    name="groupName"
                    value={form.groupName}
                    onChange={handleChange}
                    placeholder="เช่น Team Alpha"
                  />
                  {errors.groupName && <span className="form-error">{errors.groupName}</span>}
                </div>

                {groupMembers.map((member, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "var(--space-4)",
                      background: "var(--bg-glass)",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div className="flex-between" style={{ marginBottom: "var(--space-3)" }}>
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
                        สมาชิกคนที่ {i + 1}
                      </span>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => removeGroupMember(i)}
                        style={{ color: "var(--color-error)" }}
                      >
                        ✕ ลบ
                      </button>
                    </div>
                    <div className="grid grid-3 gap-3">
                      <input
                        className="form-input"
                        placeholder="ชื่อ-นามสกุล"
                        value={member.fullName}
                        onChange={(e) => updateGroupMember(i, "fullName", e.target.value)}
                      />
                      <input
                        className="form-input"
                        placeholder="อีเมล"
                        value={member.email}
                        onChange={(e) => updateGroupMember(i, "email", e.target.value)}
                      />
                      <input
                        className="form-input"
                        placeholder="เบอร์โทร"
                        value={member.phone}
                        onChange={(e) => updateGroupMember(i, "phone", e.target.value)}
                      />
                    </div>
                  </div>
                ))}

                {errors.groupMembers && (
                  <span className="form-error">{errors.groupMembers}</span>
                )}

                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={addGroupMember}
                >
                  + เพิ่มสมาชิก
                </button>
              </div>
            )}
          </div>
          )}

          {/* Submit */}
          {errors.submit && (
            <div
              style={{
                padding: "var(--space-3) var(--space-4)",
                background: "rgba(239, 68, 68, 0.1)",
                borderRadius: "var(--radius-md)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "var(--color-error-light)",
                fontSize: "var(--text-sm)",
                marginBottom: "var(--space-4)",
              }}
            >
              ❌ {errors.submit}
            </div>
          )}

          <button
            type="submit"
            className="btn btn--primary btn--xl"
            disabled={submitting}
            style={{ width: "100%", backgroundColor: themeColor, borderColor: themeColor }}
          >
            {submitting ? (
              <>
                <span className="spinner spinner--sm" /> กำลังลงทะเบียน...
              </>
            ) : (
              "🎉 ลงทะเบียน"
            )}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
