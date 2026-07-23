import { Router } from "express";
import { prisma } from "../utils/prisma";
import { asyncHandler, createError } from "../middleware/errorHandler";
import { logAudit } from "../middleware/audit";
import type { Server } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "@event-platform/types";

export const checkinsRouter: Router = Router();

// POST /api/checkin — Check in a registration
checkinsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    let { qrCode, registrationId, checkinPointId, method = "QR_SCAN", checkedBy } = req.body;

    if (!qrCode && !registrationId) throw createError(400, "qrCode or registrationId is required");

    // Find registration first to validate and get eventId if pointId missing
    let reg;
    if (qrCode) {
      reg = await prisma.registration.findFirst({
        where: { qrCode },
        include: { event: true, checkins: true },
      });
    } else {
      reg = await prisma.registration.findUnique({
        where: { id: registrationId },
        include: { event: true, checkins: true },
      });
    }

    if (!reg) throw createError(404, "ไม่พบข้อมูลผู้ลงทะเบียน");

    if (reg.status === "CANCELLED") {
      throw createError(400, "ไม่สามารถเช็กอินได้ เนื่องจากสถานะผู้ลงทะเบียนถูกยกเลิก (CANCELLED)");
    }

    if (reg.status === "PENDING_APPROVAL") {
      throw createError(400, "ไม่สามารถเช็กอินได้ เนื่องจากสถานะผู้ลงทะเบียนอยู่ระหว่างรอการอนุมัติ (PENDING_APPROVAL)");
    }

    // Fallback checkinPointId if missing
    if (!checkinPointId) {
      let defaultPoint = await prisma.checkinPoint.findFirst({
        where: { eventId: reg.eventId, isActive: true },
        orderBy: { sortOrder: "asc" },
      });
      if (!defaultPoint) {
        defaultPoint = await prisma.checkinPoint.create({
          data: {
            eventId: reg.eventId,
            name: "จุดเช็กอินหลัก (Main Gate)",
            location: "ทางเข้าหลัก",
            isActive: true,
            sortOrder: 1,
          },
        });
      }
      checkinPointId = defaultPoint.id;
    }

    const eventSettings = (reg.event.settings as any) || {};
    const canCheckin =
      reg.event.status === "ACTIVE" ||
      (reg.event.status === "PUBLISHED" && eventSettings.enableCheckinWhenPublic !== false);

    if (!canCheckin) {
      throw createError(400, "จุดเช็กอินสำหรับงานนี้ยังไม่เปิดให้บริการในขณะนี้");
    }

    // Check if already checked in at this point
    const existingCheckin = reg.checkins.find((c) => c.checkinPointId === checkinPointId);
    if (existingCheckin) {
      res.json({
        success: true,
        data: existingCheckin,
        message: "Already checked in at this point",
        alreadyCheckedIn: true,
      });
      return;
    }

    // Verify checkin point exists
    const point = await prisma.checkinPoint.findUnique({
      where: { id: checkinPointId },
    });
    if (!point) throw createError(404, "Checkin point not found");
    if (!point.isActive) throw createError(400, "Checkin point is not active");

    // Calculate Running Number if not already assigned
    let assignedRunningNumber = reg.runningNumber;
    if (!assignedRunningNumber) {
      const nextSeq = point.currentSeq + 1;
      const pad = point.numberPadding || 5;
      const prefix = point.prefix || "A";
      assignedRunningNumber = `${prefix}${String(nextSeq).padStart(pad, "0")}`;

      // Update currentSeq for this checkin point
      await prisma.checkinPoint.update({
        where: { id: point.id },
        data: { currentSeq: nextSeq },
      });
    }

    // Create checkin
    const checkin = await prisma.checkin.create({
      data: {
        registrationId: reg.id,
        checkinPointId,
        method,
        checkedBy: checkedBy || null,
      },
    });

    // Update registration status and running numbers
    const updatedReg = await prisma.registration.update({
      where: { id: reg.id },
      data: {
        status: "CHECKED_IN",
        runningNumber: reg.runningNumber || assignedRunningNumber,
        ticketNumber: reg.ticketNumber || assignedRunningNumber,
        luckyDrawNumber: reg.luckyDrawNumber || assignedRunningNumber,
      },
    });

    await logAudit({
      entityType: "Checkin",
      entityId: checkin.id,
      action: "CHECKIN",
      newData: {
        registrationId: reg.id,
        fullName: reg.fullName,
        checkinPointId,
        pointName: point.name,
        runningNumber: assignedRunningNumber,
        method,
      },
    });

    // Emit realtime event
    const io: Server<ClientToServerEvents, ServerToClientEvents> = req.app.get("io");
    const eventId = reg.eventId;

    // Get updated stats
    const [totalReg, checkedInCount] = await Promise.all([
      prisma.registration.count({ where: { eventId } }),
      prisma.registration.count({ where: { eventId, status: "CHECKED_IN" } }),
    ]);

    io.to(`event:${eventId}`).emit("checkin:new", {
      registrationId: reg.id,
      fullName: reg.fullName,
      department: reg.department || undefined,
      checkinPointId: point.id,
      checkinPointName: point.name,
      checkinTime: checkin.checkinTime.toISOString(),
      eventId,
    });

    io.to(`event:${eventId}`).emit("checkin:count", {
      eventId,
      total: totalReg,
      checkedIn: checkedInCount,
      percentage: totalReg > 0 ? Math.round((checkedInCount / totalReg) * 100) : 0,
    });

    res.status(201).json({ success: true, data: { checkin, registration: updatedReg } });
  })
);

// POST /api/checkin/points — Create Checkin Point
checkinsRouter.post(
  "/points",
  asyncHandler(async (req, res) => {
    const { eventId, name, location, prefix = "A", numberPadding = 5, sortOrder = 0 } = req.body;
    if (!eventId || !name) throw createError(400, "eventId and name are required");

    const point = await prisma.checkinPoint.create({
      data: {
        eventId,
        name,
        location: location || null,
        prefix: prefix.toUpperCase().trim(),
        numberPadding: Number(numberPadding) || 5,
        sortOrder: Number(sortOrder) || 0,
        isActive: true,
      },
    });

    res.status(201).json({ success: true, data: point });
  })
);

// PUT /api/checkin/points/:id — Update Checkin Point
checkinsRouter.put(
  "/points/:id",
  asyncHandler(async (req, res) => {
    const { name, location, prefix, numberPadding, isActive, sortOrder } = req.body;
    const pointId = String(req.params.id);

    const dataToUpdate: Record<string, unknown> = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (location !== undefined) dataToUpdate.location = location;
    if (prefix !== undefined) dataToUpdate.prefix = String(prefix).toUpperCase().trim();
    if (numberPadding !== undefined) dataToUpdate.numberPadding = Number(numberPadding);
    if (isActive !== undefined) dataToUpdate.isActive = Boolean(isActive);
    if (sortOrder !== undefined) dataToUpdate.sortOrder = Number(sortOrder);

    const point = await prisma.checkinPoint.update({
      where: { id: pointId },
      data: dataToUpdate,
    });

    res.json({ success: true, data: point });
  })
);

// DELETE /api/checkin/points/:id — Delete Checkin Point
checkinsRouter.delete(
  "/points/:id",
  asyncHandler(async (req, res) => {
    const pointId = String(req.params.id);
    await prisma.checkinPoint.delete({ where: { id: pointId } });
    res.json({ success: true, message: "Checkin point deleted" });
  })
);

// GET /api/checkin/points?eventId=xxx — Get checkin points for event
checkinsRouter.get(
  "/points",
  asyncHandler(async (req, res) => {
    const eventId = String(req.query.eventId || "");
    if (!eventId) throw createError(400, "eventId is required");

    let points = await prisma.checkinPoint.findMany({
      where: { eventId },
      include: { _count: { select: { checkins: true } } },
      orderBy: { sortOrder: "asc" },
    });

    if (points.length === 0) {
      const defaultPoint = await prisma.checkinPoint.create({
        data: {
          eventId,
          name: "จุดเช็กอินหลัก (Main Gate)",
          location: "ทางเข้าหลัก",
          isActive: true,
          sortOrder: 1,
        },
      });
      points = [{ ...defaultPoint, _count: { checkins: 0 } }];
    }

    res.json({ success: true, data: points });
  })
);

// POST /api/checkin/points — Create checkin point
checkinsRouter.post(
  "/points",
  asyncHandler(async (req, res) => {
    const point = await prisma.checkinPoint.create({ data: req.body });
    await logAudit({
      entityType: "CheckinPoint",
      entityId: point.id,
      action: "CREATE",
      newData: point as any,
    });
    res.status(201).json({ success: true, data: point });
  })
);

// PUT /api/checkin/points/:id — Update checkin point
checkinsRouter.put(
  "/points/:id",
  asyncHandler(async (req, res) => {
    const point = await prisma.checkinPoint.update({
      where: { id: String(req.params.id) },
      data: req.body,
    });
    res.json({ success: true, data: point });
  })
);

// DELETE /api/checkin/points/:id — Delete checkin point
checkinsRouter.delete(
  "/points/:id",
  asyncHandler(async (req, res) => {
    await prisma.checkinPoint.delete({ where: { id: String(req.params.id) } });
    res.json({ success: true, message: "Checkin point deleted" });
  })
);

// GET /api/checkin/stats?eventId=xxx — Checkin statistics
checkinsRouter.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const eventId = String(req.query.eventId);
    if (!eventId || eventId === 'undefined') throw createError(400, "eventId is required");

    const [total, checkedIn, byPoint] = await Promise.all([
      prisma.registration.count({ where: { eventId } }),
      prisma.registration.count({ where: { eventId, status: "CHECKED_IN" } }),
      prisma.checkinPoint.findMany({
        where: { eventId },
        include: { _count: { select: { checkins: true } } },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        checkedIn,
        percentage: total > 0 ? Math.round((checkedIn / total) * 100) : 0,
        byPoint: byPoint.map((p) => ({
          pointId: p.id,
          pointName: p.name,
          count: p._count.checkins,
        })),
      },
    });
  })
);
