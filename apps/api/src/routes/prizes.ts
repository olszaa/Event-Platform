import { Router } from "express";
import { prisma } from "../utils/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { logAudit } from "../middleware/audit";
import { DrawEngine } from "../services/drawEngine";

export const prizesRouter: Router = Router();

// GET /api/prizes?eventId=xxx
prizesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const eventId = req.query.eventId as string | undefined;
    const where: Record<string, unknown> = {};
    if (eventId) where.eventId = eventId;

    const prizes = await prisma.prize.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { drawWinners: true } },
      },
    });

    const data = await Promise.all(
      prizes.map(async (p) => {
        let eligibleCount = p.quantity - p.awarded;
        try {
          const eligibleCandidates = await DrawEngine.getEligibleCandidates(p.eventId, p.id);
          eligibleCount = eligibleCandidates.length;
        } catch {
          // fallback
        }
        return {
          ...p,
          remaining: p.quantity - p.awarded,
          eligibleCount,
        };
      })
    );

    res.json({ success: true, data });
  })
);

// GET /api/prizes/:id
prizesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const prize = await prisma.prize.findUnique({
      where: { id: String(req.params.id) },
      include: {
        drawSessions: {
          include: {
            winners: {
              include: { registration: { select: { id: true, fullName: true, department: true, company: true } } },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!prize) {
      res.status(404).json({ success: false, error: "Prize not found" });
      return;
    }

    res.json({ success: true, data: { ...prize, remaining: prize.quantity - prize.awarded } });
  })
);

// POST /api/prizes
prizesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const prize = await prisma.prize.create({ data: req.body });
    await logAudit({
      entityType: "Prize",
      entityId: prize.id,
      action: "CREATE",
      newData: prize as any,
    });
    res.status(201).json({ success: true, data: prize });
  })
);

// PUT /api/prizes/:id
prizesRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const old = await prisma.prize.findUnique({ where: { id: String(req.params.id) } });
    const prize = await prisma.prize.update({
      where: { id: String(req.params.id) },
      data: req.body,
    });
    await logAudit({
      entityType: "Prize",
      entityId: prize.id,
      action: "UPDATE",
      oldData: old as any,
      newData: prize as any,
    });
    res.json({ success: true, data: prize });
  })
);

// DELETE /api/prizes/:id
prizesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    await prisma.prize.delete({ where: { id } });
    await logAudit({
      entityType: "Prize",
      entityId: id,
      action: "DELETE",
    });
    res.json({ success: true, message: "Prize deleted" });
  })
);
