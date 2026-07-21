// ===================================
// Prize & Draw Types
// ===================================

export interface Prize {
  id: string;
  eventId: string;
  name: string;
  description?: string | null;
  image?: string | null;
  quantity: number;
  awarded: number;
  sortOrder: number;
  conditions?: DrawConditions | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  remaining?: number;
  eligibleCount?: number;
}

export interface DrawConditions {
  mustCheckedIn?: boolean;
  onePerPerson?: boolean;
  filterByDepartment?: string[];
  filterByEmployeeType?: string[];
  excludeWinners?: boolean;
  customFilter?: Record<string, unknown>;
}

export type DrawSessionStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface DrawSession {
  id: string;
  eventId: string;
  prizeId: string;
  status: DrawSessionStatus;
  drawCount: number;
  startedAt?: string | null;
  endedAt?: string | null;
  performedBy?: string | null;
  createdAt: string;
  prize?: Prize;
  winners?: DrawWinner[];
}

export type DrawWinnerStatus = "PENDING" | "ACCEPTED" | "REDRAWN" | "CANCELLED";

export interface DrawWinner {
  id: string;
  drawSessionId: string;
  registrationId: string;
  prizeId: string;
  status: DrawWinnerStatus;
  drawNumber: number;
  drawnAt: string;
  registration?: {
    id: string;
    fullName: string;
    department?: string | null;
    company?: string | null;
    employeeType?: string | null;
  };
}

export interface DrawHistory {
  id: string;
  drawSessionId: string;
  action: string;
  data?: Record<string, unknown> | null;
  performedBy?: string | null;
  timestamp: string;
}

export interface StartDrawInput {
  eventId: string;
  prizeId: string;
  drawCount?: number;
  performedBy?: string;
}

export interface SpinDrawInput {
  count?: number;
}

export interface RedrawInput {
  winnerId: string;
  reason?: string;
  performedBy?: string;
}

export interface CreatePrizeInput {
  eventId: string;
  name: string;
  description?: string;
  image?: string;
  quantity: number;
  sortOrder?: number;
  conditions?: DrawConditions;
}

export interface UpdatePrizeInput extends Partial<Omit<CreatePrizeInput, "eventId">> {}
