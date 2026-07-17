import { Router } from "express";
import { prisma } from "../utils/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { logAudit } from "../middleware/audit";

export const eventsRouter: Router = Router();

// GET /api/events — List all events
eventsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = String(req.query.page || "1");
    const limit = String(req.query.limit || "10");
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { venue: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { registrations: true, checkinPoints: true, prizes: true },
          },
        },
      }),
      prisma.event.count({ where }),
    ]);

    const totalPages = Math.ceil(total / Number(limit));
    res.json({
      success: true,
      data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    });
  })
);

// GET /api/events/:id — Get single event
eventsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const event = await prisma.event.findUnique({
      where: { id: String(req.params.id) },
      include: {
        _count: {
          select: { registrations: true, checkinPoints: true, prizes: true },
        },
        checkinPoints: { orderBy: { sortOrder: "asc" } },
        prizes: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!event) {
      res.status(404).json({ success: false, error: "Event not found" });
      return;
    }

    res.json({ success: true, data: event });
  })
);

// POST /api/events — Create event
eventsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const event = await prisma.event.create({ data: req.body });

    await logAudit({
      entityType: "Event",
      entityId: event.id,
      action: "CREATE",
      newData: event as any,
      performedBy: req.auditContext?.performedBy,
    });

    res.status(201).json({ success: true, data: event });
  })
);

// PUT /api/events/:id — Update event
eventsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const old = await prisma.event.findUnique({ where: { id } });
    const event = await prisma.event.update({
      where: { id },
      data: req.body,
    });

    await logAudit({
      entityType: "Event",
      entityId: event.id,
      action: "UPDATE",
      oldData: old as any,
      newData: event as any,
      performedBy: req.auditContext?.performedBy,
    });

    res.json({ success: true, data: event });
  })
);

// DELETE /api/events/:id — Delete event
eventsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const old = await prisma.event.findUnique({ where: { id } });
    await prisma.event.delete({ where: { id } });

    await logAudit({
      entityType: "Event",
      entityId: id,
      action: "DELETE",
      oldData: old as any,
      performedBy: req.auditContext?.performedBy,
    });

    res.json({ success: true, message: "Event deleted" });
  })
);

// GET /api/events/:id/stats — Dashboard stats for event
eventsRouter.get(
  "/:id/stats",
  asyncHandler(async (req, res) => {
    const eventId = String(req.params.id);

    const [totalReg, checkedIn, checkinPoints, prizes] = await Promise.all([
      prisma.registration.count({ where: { eventId } }),
      prisma.registration.count({ where: { eventId, status: "CHECKED_IN" } }),
      prisma.checkinPoint.findMany({
        where: { eventId },
        include: { _count: { select: { checkins: true } } },
      }),
      prisma.prize.findMany({ where: { eventId } }),
    ]);

    const totalPrizes = prizes.reduce((acc, p) => acc + p.quantity, 0);
    const awardedPrizes = prizes.reduce((acc, p) => acc + p.awarded, 0);

    res.json({
      success: true,
      data: {
        registrations: { total: totalReg, checkedIn },
        checkins: {
          percentage: totalReg > 0 ? ((checkedIn / totalReg) * 100).toFixed(1) : "0",
          byPoint: checkinPoints.map((cp) => ({
            pointId: cp.id,
            pointName: cp.name,
            count: cp._count.checkins,
          })),
        },
        prizes: { total: totalPrizes, awarded: awardedPrizes },
      },
    });
  })
);
