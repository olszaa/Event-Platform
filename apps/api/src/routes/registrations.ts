import { Router } from "express";
import { prisma } from "../utils/prisma";
import { asyncHandler, createError } from "../middleware/errorHandler";
import { logAudit } from "../middleware/audit";
import { generateQRDataUrl, buildQRContent, generateCode, parseExcel, generateExcel, getDefaultRegistrationMapping } from "@event-platform/utils";
import type { ExcelColumn } from "@event-platform/utils";
import multer from "multer";

export const registrationsRouter: Router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/registrations — List registrations
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

// GET /api/registrations/template — Download Excel Template (Matching GAS Google Sheet 'apploval' tab structure)
registrationsRouter.get(
  "/template",
  asyncHandler(async (req, res) => {
    const columns: ExcelColumn[] = [
      { key: "timestamp", header: "Timestamp", width: 22 },
      { key: "qrCode", header: "Registration ID / QR Code", width: 25 },
      { key: "fullName", header: "ชื่อ-นามสกุล", width: 25 },
      { key: "email", header: "อีเมล", width: 25 },
      { key: "phone", header: "เบอร์โทร", width: 15 },
      { key: "company", header: "บริษัท/หน่วยงาน/องค์กร", width: 25 },
      { key: "ticketNumber", header: "Ticket Number", width: 18 },
      { key: "luckyDrawNumber", header: "Lucky Draw Number", width: 20 },
      { key: "status", header: "สถานะ", width: 15 },
    ];

    const sampleData = [
      {
        timestamp: "2026-07-23 10:00:00",
        qrCode: "EVT-100001",
        fullName: "สมชาย ใจดี",
        email: "somchai@example.com",
        phone: "0812345678",
        company: "บริษัท เทคโนโลยี จำกัด",
        ticketNumber: "A00001",
        luckyDrawNumber: "A00001",
        status: "อนุมัติ",
      },
      {
        timestamp: "2026-07-23 10:05:00",
        qrCode: "EVT-100002",
        fullName: "สมหญิง รักดี",
        email: "somying@example.com",
        phone: "0823456789",
        company: "องค์กรภาครัฐ",
        ticketNumber: "B00001",
        luckyDrawNumber: "B00001",
        status: "อนุมัติ",
      },
    ];

    const buffer = generateExcel(sampleData, columns, "apploval");

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=registration_template.xlsx");
    res.send(buffer);
  })
);

// GET /api/registrations/export?eventId=xxx — Export to Excel (Matching GAS Google Sheet structure)
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
      { key: "createdAt", header: "Timestamp", width: 22 },
      { key: "qrCode", header: "Registration ID / QR Code", width: 25 },
      { key: "fullName", header: "ชื่อ-นามสกุล", width: 25 },
      { key: "email", header: "อีเมล", width: 25 },
      { key: "phone", header: "เบอร์โทร", width: 15 },
      { key: "company", header: "บริษัท/หน่วยงาน/องค์กร", width: 25 },
      { key: "ticketNumber", header: "Ticket Number", width: 18 },
      { key: "luckyDrawNumber", header: "Lucky Draw Number", width: 20 },
      { key: "status", header: "สถานะ", width: 15 },
      { key: "checkedIn", header: "เช็กอิน", width: 10 },
      { key: "prize", header: "รางวัลที่ได้", width: 25 },
    ];

    const data = registrations.map((r) => ({
      ...r,
      checkedIn: r.checkins.length > 0 ? "✓" : "-",
      prize: r.drawWinners.map((w) => w.prize.name).join(", ") || "-",
      createdAt: new Date(r.createdAt).toLocaleString("th-TH"),
      status: r.status === "CHECKED_IN" ? "อนุมัติ (เช็กอินแล้ว)" : "อนุมัติ",
    }));

    const buffer = generateExcel(data as any, columns, "apploval");

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

// POST /api/registrations/import — Import from Excel (Supports GAS Google Sheet format & Duplicate Detection)
registrationsRouter.post(
  "/import",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw createError(400, "No file uploaded");
    const { eventId, confirmDuplicates, skipDuplicates, confirmedQrCodes: rawConfirmedQrCodes } = req.body;
    if (!eventId) throw createError(400, "eventId is required");

    let confirmedQrSet: Set<string> | null = null;
    if (rawConfirmedQrCodes) {
      try {
        const arr = typeof rawConfirmedQrCodes === "string" ? JSON.parse(rawConfirmedQrCodes) : rawConfirmedQrCodes;
        if (Array.isArray(arr)) confirmedQrSet = new Set(arr);
      } catch (e) {}
    }

    const isConfirmAll = String(confirmDuplicates) === "true";
    const isSkipAll = String(skipDuplicates) === "true";

    const mapping = getDefaultRegistrationMapping();
    const result = parseExcel<{
      fullName: string;
      email?: string;
      phone?: string;
      company?: string;
      department?: string;
      employeeType?: string;
      qrCode?: string;
      ticketNumber?: string;
      luckyDrawNumber?: string;
    }>(req.file.buffer, mapping);

    // Fetch existing registrations for this specific eventId
    const existingRegs = await prisma.registration.findMany({
      where: { eventId },
    });
    const existingMap = new Map<string, typeof existingRegs[0]>();
    for (const r of existingRegs) {
      if (r.qrCode) existingMap.set(r.qrCode.trim().toLowerCase(), r);
    }

    const duplicates: Array<{
      qrCode: string;
      rowNumber: number;
      existing: any;
      incoming: any;
    }> = [];

    const parsedItems: Array<{
      rowNumber: number;
      fullName: string;
      email: string | null;
      phone: string | null;
      company: string | null;
      department: string | null;
      employeeType: string | null;
      ticketNumber: string | null;
      luckyDrawNumber: string | null;
      qrCode: string;
      status: string;
      isDuplicate: boolean;
      existingRecord?: any;
    }> = [];

    const errors = [...result.errors];

    for (let i = 0; i < result.data.length; i++) {
      const row = result.data[i]!;
      if (!row.fullName) {
        errors.push({ row: i + 2, field: "fullName", message: "Name is required" });
        continue;
      }

      const fullName = String(row.fullName).trim();
      const email = row.email && String(row.email).trim() !== "-" ? String(row.email).trim() : null;
      
      let phone: string | null = null;
      if (row.phone !== undefined && row.phone !== null && String(row.phone).trim() !== "-") {
        const strPhone = String(row.phone).trim();
        if (/^\d{9}$/.test(strPhone)) {
          phone = "0" + strPhone;
        } else {
          phone = strPhone;
        }
      }

      const company = row.company && String(row.company).trim() !== "-" ? String(row.company).trim() : null;
      const department = row.department && String(row.department).trim() !== "-" ? String(row.department).trim() : null;
      const employeeType = row.employeeType && String(row.employeeType).trim() !== "-" ? String(row.employeeType).trim() : null;
      const ticketNumber = row.ticketNumber && String(row.ticketNumber).trim() !== "-" ? String(row.ticketNumber).trim() : null;
      const luckyDrawNumber = row.luckyDrawNumber && String(row.luckyDrawNumber).trim() !== "-" ? String(row.luckyDrawNumber).trim() : null;
      const qrCode = row.qrCode && String(row.qrCode).trim() !== "-" ? String(row.qrCode).trim() : generateCode("EVT");
      const status = (row as any).status === "CHECKED_IN" ? "CHECKED_IN" : "APPROVED";

      const existingMatch = existingMap.get(qrCode.trim().toLowerCase());
      const isDup = !!existingMatch;

      const item = {
        rowNumber: i + 2,
        fullName, email, phone, company, department, employeeType, ticketNumber, luckyDrawNumber, qrCode, status,
        isDuplicate: isDup,
        existingRecord: existingMatch,
      };

      parsedItems.push(item);

      if (isDup) {
        duplicates.push({
          qrCode,
          rowNumber: i + 2,
          existing: {
            fullName: existingMatch.fullName,
            email: existingMatch.email || "-",
            phone: existingMatch.phone || "-",
            company: existingMatch.company || "-",
            status: existingMatch.status,
          },
          incoming: {
            fullName, email: email || "-", phone: phone || "-", company: company || "-", status,
          },
        });
      }
    }

    // Check if we need to return duplicates prompt to user first
    const isFirstPass = !isConfirmAll && !isSkipAll && confirmedQrSet === null;
    if (isFirstPass && duplicates.length > 0) {
      res.json({
        success: true,
        hasDuplicates: true,
        duplicatesCount: duplicates.length,
        newRecordsCount: parsedItems.length - duplicates.length,
        duplicates,
        totalRows: result.totalRows,
        message: `พบรายการซ้ำในงานนี้จำนวน ${duplicates.length} รายการ กรุณายืนยันการอัปเดต`,
      });
      return;
    }

    // Perform actual Database writes
    const created = [];
    const updated = [];
    const skipped = [];

    for (const item of parsedItems) {
      try {
        const qrBaseUrl = process.env.QR_BASE_URL || "http://localhost:3002/checkin";
        const qrDataUrl = await generateQRDataUrl(buildQRContent(qrBaseUrl, item.qrCode));

        if (item.isDuplicate) {
          // Check if this duplicate is confirmed to be updated
          const shouldUpdate =
            isConfirmAll ||
            (confirmedQrSet !== null && confirmedQrSet.has(item.qrCode));

          if (shouldUpdate) {
            const reg = await prisma.registration.update({
              where: { id: item.existingRecord.id },
              data: {
                fullName: item.fullName,
                email: item.email || item.existingRecord.email,
                phone: item.phone || item.existingRecord.phone,
                company: item.company || item.existingRecord.company,
                department: item.department || item.existingRecord.department,
                employeeType: item.employeeType || item.existingRecord.employeeType,
                ticketNumber: item.ticketNumber || item.existingRecord.ticketNumber,
                luckyDrawNumber: item.luckyDrawNumber || item.existingRecord.luckyDrawNumber,
                status: item.status as any,
              },
            });
            updated.push(reg);
          } else {
            skipped.push(item);
          }
        } else {
          // New record creation
          const reg = await prisma.registration.create({
            data: {
              eventId,
              fullName: item.fullName,
              email: item.email,
              phone: item.phone,
              company: item.company,
              department: item.department,
              employeeType: item.employeeType,
              qrCode: item.qrCode,
              qrDataUrl,
              ticketNumber: item.ticketNumber,
              luckyDrawNumber: item.luckyDrawNumber,
              status: item.status as any,
              metadata: { source: "google-sheet-import" },
            },
          });
          created.push(reg);
        }
      } catch (e: any) {
        console.error("Error importing row", item.rowNumber, e);
        errors.push({ row: item.rowNumber, field: "", message: e.message });
      }
    }

    await logAudit({
      entityType: "Registration",
      entityId: eventId,
      action: "IMPORT",
      newData: { totalRows: result.totalRows, imported: created.length, updated: updated.length, skipped: skipped.length, errors: errors.length },
    });

    res.json({
      success: true,
      hasDuplicates: false,
      data: {
        imported: created.length,
        updated: updated.length,
        skipped: skipped.length,
        errors: errors.length,
        totalRows: result.totalRows,
        errorDetails: errors,
      },
    });
  })
);

// GET /api/registrations/lookup?qrCode=xxx — Lookup by QR code
registrationsRouter.get(
  "/lookup",
  asyncHandler(async (req, res) => {
    const qrCode = String(req.query.qrCode || "");
    if (!qrCode) throw createError(400, "qrCode is required");

    const reg = await prisma.registration.findFirst({
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

// GET /api/registrations/:id — Get single registration
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

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw createError(404, "ไม่พบข้อมูลงาน Event");

    const settings = (event.settings as any) || {};
    const canRegister =
      event.status === "PUBLISHED" ||
      (event.status === "ACTIVE" && settings.enableRegisterWhenActive !== false);

    if (!canRegister) {
      throw createError(400, "การลงทะเบียนสำหรับงานนี้ไม่ได้เปิดรับอยู่ในขณะนี้");
    }

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
