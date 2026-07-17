// ===================================
// Audit Log Types
// ===================================

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "CHECKIN"
  | "DRAW_START"
  | "DRAW_SPIN"
  | "DRAW_RESULT"
  | "DRAW_REDRAW"
  | "DRAW_CANCEL"
  | "IMPORT"
  | "EXPORT"
  | "NOTIFICATION_SENT";

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  performedBy?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  timestamp: string;
}

export interface AuditLogQuery {
  entityType?: string;
  entityId?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}
