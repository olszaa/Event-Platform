import { Router } from "express";
import { prisma } from "../utils/prisma";
import { asyncHandler, createError } from "../middleware/errorHandler";
import { logAudit } from "../middleware/audit";
import { generateQRDataUrl, buildQRContent, generateCode, parseExcel, generateExcel, getDefaultRegistrationMapping } from "@event-platform/utils";
import type { ExcelColumn } from "@event-platform/utils";
import multer from "multer";

export const registrationsRouter: Router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/registrations?eventId=xxx — List registrations
registrationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const eventId = req.query.eventId as string | undefined;
    const page = String(req.query.page || "1");
    const limit = String(req.query.limit || "20");
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const department = req.query.department as string | undefined;
    const employeeType = req.query.employeeType as string | undefined;

    if (!eventId) throw createError(400, "eventId is required");

    const where: Record<string, unknown> = { eventId };
    if (status) where.status = status;
    if (department) where.department = department;
    if (employeeType) where.employeeType = employeeType;
    if (search) {
      where.OR = [
        { fullName: { contains: search as string, mode: "insensitive" } },
        { email: { contains: search as string, mode: "insensitive" } },
        { phone: { contains: search as string, mode: "insensitive" } },
        { qrCode: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [data, total] = await Promise.all([
      prisma.registration.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: {
          groupMembers: true,
          checkins: { include: { checkinPoint: true } },
        },
      }),
      prisma.registration.count({ where }),
    ]);

    const totalPages = Math.ceil(total / Number(limit));
    res.json({
      success: true,
      data,
      pagination: {
        page: Number(page), limit: Number(limit), total, totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    });
  })
);

// GET /api/registrations/:id
registrationsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const reg = await prisma.registration.findUnique({
      where: { id: String(req.params.id) },
      include: {
        event: true,
        groupMembers: true,
        checkins: { include: { checkinPoint: true } },
        drawWinners: { include: { prize: true } },
      },
    });

    if (!reg) {
      res.status(404).json({ success: false, error: "Registration not found" });
      return;
    }

    res.json({ success: true, data: reg });
  })
);

// POST /api/registrations — Create single / group registration
registrationsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { eventId, fullName, email, phone, company, department, employeeType, groupName, groupMembers, metadata } = req.body;

    // Generate unique QR code
    const qrCode = generateCode("EVT");
    const qrBaseUrl = process.env.QR_BASE_URL || "http://localhost:3002/checkin";
    const qrContent = buildQRContent(qrBaseUrl, qrCode);
    const qrDataUrl = await generateQRDataUrl(qrContent);

    // Create registration
    const groupId = groupName ? `grp-${Date.now()}` : undefined;

    const registration = await prisma.registration.create({
      data: {
        eventId,
        fullName,
        email: email || null,
        phone: phone || null,
        company: company || null,
        department: department || null,
        employeeType: employeeType || null,
        groupName: groupName || null,
        groupId: groupId || null,
        qrCode,
        qrDataUrl,
        status: "REGISTERED",
        metadata: metadata || {},
        ...(groupMembers?.length && {
          groupMembers: {
            create: groupMembers.map((m: { fullName: string; email?: string; phone?: string; role?: string }) => ({
              fullName: m.fullName,
              email: m.email || null,
              phone: m.phone || null,
              role: m.role || "member",
            })),
          },
        }),
      },
      include: { groupMembers: true },
    });

    await logAudit({
      entityType: "Registration",
      entityId: registration.id,
      action: "CREATE",
      newData: { fullName, email, qrCode, groupMembers: groupMembers?.length || 0 },
    });

    res.status(201).json({ success: true, data: registration });
  })
);

// POST /api/registrations/import — Import from Excel
registrationsRouter.post(
  "/import",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw createError(400, "No file uploaded");
    const { eventId } = req.body;
    if (!eventId) throw createError(400, "eventId is required");

    const mapping = getDefaultRegistrationMapping();
    const result = parseExcel<{
      fullName: string;
      email?: string;
      phone?: string;
      company?: string;
      department?: string;
      employeeType?: string;
    }>(req.file.buffer, mapping);

    const created = [];
    const errors = [...result.errors];

    for (let i = 0; i < result.data.length; i++) {
      const row = result.data[i]!;
      if (!row.fullName) {
        errors.push({ row: i + 2, field: "fullName", message: "Name is required" });
        continue;
      }

      try {
        const qrCode = generateCode("EVT");
        const qrBaseUrl = process.env.QR_BASE_URL || "http://localhost:3002/checkin";
        const qrDataUrl = await generateQRDataUrl(buildQRContent(qrBaseUrl, qrCode));

        const reg = await prisma.registration.create({
          data: {
            eventId,
            fullName: row.fullName,
            email: row.email || null,
            phone: row.phone || null,
            company: row.company || null,
            department: row.department || null,
            employeeType: row.employeeType || null,
            qrCode,
            qrDataUrl,
            status: "REGISTERED",
            metadata: { source: "excel-import" },
          },
        });
        created.push(reg);
      } catch (e: any) {
        errors.push({ row: i + 2, field: "", message: e.message });
      }
    }

    await logAudit({
      entityType: "Registration",
      entityId: eventId,
      action: "IMPORT",
      newData: { totalRows: result.totalRows, imported: created.length, errors: errors.length },
    });

    res.json({
      success: true,
      data: {
        imported: created.length,
        errors: errors.length,
        totalRows: result.totalRows,
        errorDetails: errors,
      },
    });
  })
);

// GET /api/registrations/export?eventId=xxx — Export to Excel
registrationsRouter.get(
  "/export",
  asyncHandler(async (req, res) => {
    const eventId = String(req.query.eventId || "");
    if (!eventId) throw createError(400, "eventId is required");

    const registrations = await prisma.registration.findMany({
      where: { eventId },
      include: { checkins: { include: { checkinPoint: true } }, drawWinners: { include: { prize: true } } },
      orderBy: { createdAt: "asc" },
    });

    const columns: ExcelColumn[] = [
      { key: "fullName", header: "ชื่อ-นามสกุล", width: 25 },
      { key: "email", header: "อีเมล", width: 25 },
      { key: "phone", header: "เบอร์โทร", width: 15 },
      { key: "company", header: "บริษัท", width: 20 },
      { key: "department", header: "แผนก", width: 15 },
      { key: "employeeType", header: "ประเภทพนักงาน", width: 15 },
      { key: "status", header: "สถานะ", width: 12 },
      { key: "qrCode", header: "QR Code", width: 20 },
      { key: "checkedIn", header: "เช็กอิน", width: 10 },
      { key: "prize", header: "รางวัลที่ได้", width: 25 },
      { key: "createdAt", header: "วันที่ลงทะเบียน", width: 20 },
    ];

    const data = registrations.map((r) => ({
      ...r,
      checkedIn: r.checkins.length > 0 ? "✓" : "-",
      prize: r.drawWinners.map((w) => w.prize.name).join(", ") || "-",
      createdAt: new Date(r.createdAt).toLocaleString("th-TH"),
    }));

    const buffer = generateExcel(data as any, columns, "Registrations");

    await logAudit({
      entityType: "Registration",
      entityId: eventId,
      action: "EXPORT",
      newData: { count: registrations.length },
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=registrations-${eventId}.xlsx`);
    res.send(buffer);
  })
);

// DELETE /api/registrations/:id
registrationsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    await prisma.registration.delete({ where: { id } });
    await logAudit({
      entityType: "Registration",
      entityId: id,
      action: "DELETE",
    });
    res.json({ success: true, message: "Registration deleted" });
  })
);

// GET /api/registrations/lookup?qrCode=xxx — Lookup by QR code
registrationsRouter.get(
  "/lookup",
  asyncHandler(async (req, res) => {
    const qrCode = String(req.query.qrCode || "");
    if (!qrCode) throw createError(400, "qrCode is required");

    const reg = await prisma.registration.findUnique({
      where: { qrCode },
      include: {
        event: true,
        checkins: { include: { checkinPoint: true } },
        groupMembers: true,
      },
    });

    if (!reg) {
      res.status(404).json({ success: false, error: "Registration not found" });
      return;
    }

    res.json({ success: true, data: reg });
  })
);
