import { Router } from "express";
import { prisma } from "../utils/prisma";
import { asyncHandler, createError } from "../middleware/errorHandler";
import { logAudit } from "../middleware/audit";
import { DrawEngine } from "../services/drawEngine";
import type { Server } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "@event-platform/types";

export const drawsRouter: Router = Router();

const handleStartDraw = asyncHandler(async (req, res) => {
  const { eventId, prizeId, drawCount = 1, performedBy } = req.body;

  if (!eventId || !prizeId) throw createError(400, "eventId and prizeId are required");

  // Verify prize has remaining quantity
  const prize = await prisma.prize.findUnique({ where: { id: prizeId } });
  if (!prize) throw createError(404, "Prize not found");
  if (prize.quantity - prize.awarded <= 0) throw createError(400, "No prizes remaining");

  const session = await prisma.drawSession.create({
    data: {
      eventId,
      prizeId,
      drawCount,
      status: "PENDING",
      performedBy: performedBy || null,
    },
    include: { prize: true },
  });

  await logAudit({
    entityType: "DrawSession",
    entityId: session.id,
    action: "DRAW_START",
    newData: { prizeId, prizeName: prize.name, drawCount },
    performedBy,
  });

  // Emit draw start event
  const io: Server<ClientToServerEvents, ServerToClientEvents> = req.app.get("io");
  io.to(`event:${eventId}`).emit("draw:start", {
    sessionId: session.id,
    eventId,
    prizeName: prize.name,
    prizeImage: prize.image || undefined,
  });

  res.status(201).json({ success: true, data: session });
});

// POST /api/draws and POST /api/draws/start — Start a new draw session
drawsRouter.post("/", handleStartDraw);
drawsRouter.post("/start", handleStartDraw);

// POST /api/draws/:id/spin — Perform the actual draw
drawsRouter.post(
  "/:id/spin",
  asyncHandler(async (req, res) => {
    const sessionId = String(req.params.id);
    const { count = 1 } = req.body;

    // Update session status
    await prisma.drawSession.update({
      where: { id: sessionId },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });

    const session = await prisma.drawSession.findUnique({
      where: { id: sessionId },
      include: { prize: true },
    });
    if (!session) throw createError(404, "Draw session not found");

    const io: Server<ClientToServerEvents, ServerToClientEvents> = req.app.get("io");

    // Get eligible candidates for animation
    const eligible = await DrawEngine.getEligibleCandidates(session.eventId, session.prizeId);
    if (eligible.length === 0) throw createError(400, "No eligible candidates");

    // Emit spinning animation (send candidate names for display)
    const animCandidates = eligible.slice(0, 20).map((c) => ({
      id: c.id,
      fullName: c.fullName,
      department: c.department || undefined,
    }));

    io.to(`event:${session.eventId}`).emit("draw:spinning", {
      sessionId,
      candidates: animCandidates,
      duration: 5000,
    });

    // Perform the actual draw
    const result = await DrawEngine.performDraw(sessionId, count);

    // Update session status
    await prisma.drawSession.update({
      where: { id: sessionId },
      data: { status: "COMPLETED", endedAt: new Date() },
    });

    // Emit result
    io.to(`event:${session.eventId}`).emit("draw:result", {
      sessionId,
      winners: result.winners.map((w) => ({
        id: w.id,
        fullName: w.fullName,
        department: w.department || undefined,
        company: w.company || undefined,
        prizeName: session.prize!.name,
      })),
    });

    await logAudit({
      entityType: "DrawSession",
      entityId: sessionId,
      action: "DRAW_RESULT",
      newData: {
        winners: result.winners.map((w) => w.fullName),
        candidateCount: result.candidates,
      },
    });

    res.json({ success: true, data: result });
  })
);

// POST /api/draws/:id/redraw — Redraw a specific winner
drawsRouter.post(
  "/:id/redraw",
  asyncHandler(async (req, res) => {
    const { winnerId, reason, performedBy } = req.body;
    if (!winnerId) throw createError(400, "winnerId is required");

    const result = await DrawEngine.redraw(winnerId, reason, performedBy);

    // Get session for Socket.io room
    const winner = await prisma.drawWinner.findFirst({
      where: { id: winnerId },
      include: { drawSession: true },
    });

    if (winner) {
      const io: Server<ClientToServerEvents, ServerToClientEvents> = req.app.get("io");
      io.to(`event:${winner.drawSession.eventId}`).emit("draw:redraw", {
        sessionId: winner.drawSessionId,
        previousWinner: result.oldWinner.fullName,
        reason,
        newWinner: result.newWinner
          ? {
              id: result.newWinner.id,
              fullName: result.newWinner.fullName,
              department: result.newWinner.department || undefined,
            }
          : undefined,
      });
    }

    await logAudit({
      entityType: "DrawSession",
      entityId: String(req.params.id),
      action: "DRAW_REDRAW",
      newData: {
        oldWinner: result.oldWinner.fullName,
        newWinner: result.newWinner?.fullName,
        reason,
      },
      performedBy,
    });

    res.json({ success: true, data: result });
  })
);

// GET /api/draws/:id — Get draw session details
drawsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const session = await prisma.drawSession.findUnique({
      where: { id: String(req.params.id) },
      include: {
        prize: true,
        winners: {
          include: {
            registration: {
              select: { id: true, fullName: true, department: true, company: true, employeeType: true, runningNumber: true, ticketNumber: true, luckyDrawNumber: true },
            },
          },
          orderBy: { drawnAt: "asc" },
        },
        history: { orderBy: { timestamp: "desc" } },
      },
    });

    if (!session) {
      res.status(404).json({ success: false, error: "Draw session not found" });
      return;
    }

    res.json({ success: true, data: session });
  })
);

// GET /api/draws?eventId=xxx — List all draw sessions for event
drawsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const eventId = String(req.query.eventId || "");
    if (!eventId) throw createError(400, "eventId is required");

    const sessions = await prisma.drawSession.findMany({
      where: { eventId },
      include: {
        prize: true,
        winners: {
          where: { status: { in: ["PENDING", "ACCEPTED"] } },
          include: {
            registration: {
              select: { id: true, fullName: true, department: true, company: true, runningNumber: true, ticketNumber: true, luckyDrawNumber: true },
            },
          },
        },
        _count: { select: { history: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: sessions });
  })
);

// GET /api/draws/:id/history — Draw history
drawsRouter.get(
  "/:id/history",
  asyncHandler(async (req, res) => {
    const history = await prisma.drawHistory.findMany({
      where: { drawSessionId: String(req.params.id) },
      orderBy: { timestamp: "desc" },
    });

    res.json({ success: true, data: history });
  })
);

// GET /api/draws/winners?eventId=xxx — All winners for event
drawsRouter.get(
  "/winners/all",
  asyncHandler(async (req, res) => {
    const eventId = String(req.query.eventId || "");
    if (!eventId) throw createError(400, "eventId is required");

    const winners = await prisma.drawWinner.findMany({
      where: {
        drawSession: { eventId },
        status: { in: ["PENDING", "ACCEPTED"] },
      },
      include: {
        registration: {
          select: { id: true, fullName: true, department: true, company: true },
        },
        prize: { select: { id: true, name: true, image: true } },
      },
      orderBy: { drawnAt: "desc" },
    });

    res.json({ success: true, data: winners });
  })
);

// PUT /api/draws/winners/:id — Update draw winner status
drawsRouter.put(
  "/winners/:id",
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    const winnerId = String(req.params.id);

    const oldWinner = await prisma.drawWinner.findUnique({
      where: { id: winnerId },
      include: { prize: true }
    });
    if (!oldWinner) throw createError(404, "Winner not found");

    const updatedWinner = await prisma.drawWinner.update({
      where: { id: winnerId },
      data: { status },
      include: {
        registration: { select: { fullName: true } },
        prize: true
      }
    });

    // Recalculate prize.awarded count
    const acceptedCount = await prisma.drawWinner.count({
      where: { prizeId: oldWinner.prizeId, status: { in: ["PENDING", "ACCEPTED"] } }
    });
    await prisma.prize.update({
      where: { id: oldWinner.prizeId },
      data: { awarded: acceptedCount }
    });

    await logAudit({
      entityType: "DrawWinner",
      entityId: winnerId,
      action: "UPDATE_STATUS",
      newData: {
        fullName: updatedWinner.registration.fullName,
        prizeName: updatedWinner.prize.name,
        oldStatus: oldWinner.status,
        newStatus: status
      }
    });

    res.json({ success: true, data: updatedWinner });
  })
);

// DELETE /api/draws/winners/:id — Delete a winner
drawsRouter.delete(
  "/winners/:id",
  asyncHandler(async (req, res) => {
    const winnerId = String(req.params.id);
    
    const winner = await prisma.drawWinner.findUnique({
      where: { id: winnerId },
      include: {
        registration: { select: { fullName: true } },
        prize: true
      }
    });
    if (!winner) throw createError(404, "Winner not found");

    await prisma.drawWinner.delete({ where: { id: winnerId } });

    // Recalculate prize.awarded count
    const acceptedCount = await prisma.drawWinner.count({
      where: { prizeId: winner.prizeId, status: { in: ["PENDING", "ACCEPTED"] } }
    });
    await prisma.prize.update({
      where: { id: winner.prizeId },
      data: { awarded: acceptedCount }
    });

    await logAudit({
      entityType: "DrawWinner",
      entityId: winnerId,
      action: "DELETE",
      newData: {
        fullName: winner.registration.fullName,
        prizeName: winner.prize.name
      }
    });

    res.json({ success: true, message: "Winner deleted successfully" });
  })
);

// DELETE /api/draws/sessions/:id — Delete draw session
drawsRouter.delete(
  "/sessions/:id",
  asyncHandler(async (req, res) => {
    const sessionId = String(req.params.id);

    const session = await prisma.drawSession.findUnique({
      where: { id: sessionId },
      include: { winners: true }
    });
    if (!session) throw createError(404, "Draw session not found");

    await prisma.drawSession.delete({ where: { id: sessionId } });

    // Recalculate awarded counts for affected prize
    const prizeId = session.prizeId;
    const acceptedCount = await prisma.drawWinner.count({
      where: { prizeId, status: { in: ["PENDING", "ACCEPTED"] } }
    });
    await prisma.prize.update({
      where: { id: prizeId },
      data: { awarded: acceptedCount }
    });

    await logAudit({
      entityType: "DrawSession",
      entityId: sessionId,
      action: "DELETE",
      newData: {
        prizeId: session.prizeId
      }
    });

    res.json({ success: true, message: "Draw session deleted successfully" });
  })
);
