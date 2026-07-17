import type { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";

/**
 * Middleware to automatically log audit entries for mutating operations
 */
export function auditMiddleware(entityType: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    // Only audit mutating methods
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      return next();
    }

    // Store audit context for use after the route handler
    req.auditContext = {
      entityType,
      action: `${req.method} ${req.originalUrl}`,
      performedBy: (req as any).user?.id || "system",
      ipAddress: req.ip || req.socket.remoteAddress || "",
      userAgent: req.get("user-agent") || "",
    };

    next();
  };
}

/**
 * Log an audit entry directly
 */
export async function logAudit(params: {
  entityType: string;
  entityId: string;
  action: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  performedBy?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        oldData: (params.oldData as any) ?? undefined,
        newData: (params.newData as any) ?? undefined,
        performedBy: params.performedBy || "system",
        ipAddress: params.ipAddress || "",
        userAgent: params.userAgent || "",
      },
    });
  } catch (error) {
    console.error("[AUDIT] Failed to log audit entry:", error);
  }
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      auditContext?: {
        entityType: string;
        action: string;
        performedBy: string;
        ipAddress: string;
        userAgent: string;
      };
    }
  }
}
