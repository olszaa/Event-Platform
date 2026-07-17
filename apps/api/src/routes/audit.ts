import { Router } from "express";
import { prisma } from "../utils/prisma";
import { asyncHandler, createError } from "../middleware/errorHandler";

export const auditRouter: Router = Router();

// GET /api/audit — Query audit logs
auditRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const {
      entityType,
      entityId,
      action,
      from,
      to,
      page = "1",
      limit = "50",
    } = req.query;

    const where: Record<string, unknown> = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (action) where.action = action;
    if (from || to) {
      where.timestamp = {};
      if (from) (where.timestamp as any).gte = new Date(from as string);
      if (to) (where.timestamp as any).lte = new Date(to as string);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { timestamp: "desc" },
      }),
      prisma.auditLog.count({ where }),
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
