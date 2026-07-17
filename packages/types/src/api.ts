// ===================================
// API Types (Request / Response / Pagination)
// ===================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = unknown> {
  success: boolean;
  data: T[];
  pagination: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface EventQuery extends PaginationQuery {
  status?: string;
}

export interface RegistrationQuery extends PaginationQuery {
  eventId: string;
  status?: string;
  department?: string;
  employeeType?: string;
}

export interface CheckinStats {
  total: number;
  checkedIn: number;
  percentage: number;
  byPoint: {
    pointId: string;
    pointName: string;
    count: number;
  }[];
}

export interface DashboardStats {
  events: {
    total: number;
    active: number;
  };
  registrations: {
    total: number;
    today: number;
  };
  checkins: {
    total: number;
    today: number;
  };
  prizes: {
    total: number;
    awarded: number;
  };
}

export interface NotificationPayload {
  type: "email" | "sms" | "line";
  registrationId: string;
  template?: string;
}

export interface BulkNotificationPayload {
  type: "email" | "sms" | "line";
  eventId: string;
  filter?: {
    status?: string;
    department?: string;
  };
  template?: string;
}
