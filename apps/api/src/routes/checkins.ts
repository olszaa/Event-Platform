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
    const { qrCode, registrationId, checkinPointId, method = "QR_SCAN", checkedBy } = req.body;

    if (!checkinPointId) throw createError(400, "checkinPointId is required");
    if (!qrCode && !registrationId) throw createError(400, "qrCode or registrationId is required");

    // Find registration
    let reg;
    if (qrCode) {
      reg = await prisma.registration.findUnique({
        where: { qrCode },
        include: { event: true, checkins: true },
      });
    } else {
      reg = await prisma.registration.findUnique({
        where: { id: registrationId },
        include: { event: true, checkins: true },
      });
    }

    if (!reg) throw createError(404, "Registration not found");
    if (reg.status === "CANCELLED") throw createError(400, "Registration is cancelled");

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

    // Create checkin
    const checkin = await prisma.checkin.create({
      data: {
        registrationId: reg.id,
        checkinPointId,
        method,
        checkedBy: checkedBy || null,
      },
    });

    // Update registration status
    await prisma.registration.update({
      where: { id: reg.id },
      data: { status: "CHECKED_IN" },
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

    res.status(201).json({ success: true, data: { checkin, registration: reg } });
  })
);

// GET /api/checkin/points?eventId=xxx — Get checkin points for event
checkinsRouter.get(
  "/points",
  asyncHandler(async (req, res) => {
    const eventId = String(req.query.eventId || "");
    if (!eventId) throw createError(400, "eventId is required");

    const points = await prisma.checkinPoint.findMany({
      where: { eventId },
      include: { _count: { select: { checkins: true } } },
      orderBy: { sortOrder: "asc" },
    });

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
