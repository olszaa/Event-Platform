// ===================================
// Registration Types
// ===================================

export type RegistrationStatus = "REGISTERED" | "CONFIRMED" | "CHECKED_IN" | "CANCELLED";

export interface Registration {
  id: string;
  eventId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  department?: string | null;
  employeeType?: string | null;
  groupName?: string | null;
  groupId?: string | null;
  qrCode: string;
  qrDataUrl?: string | null;
  status: RegistrationStatus;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  groupMembers?: GroupMember[];
  checkins?: Checkin[];
}

export interface GroupMember {
  id: string;
  registrationId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  createdAt: string;
}

export interface Checkin {
  id: string;
  registrationId: string;
  checkinPointId: string;
  checkinTime: string;
  method: CheckinMethod;
  checkedBy?: string | null;
}

export type CheckinMethod = "QR_SCAN" | "MANUAL" | "SEARCH";

export interface CheckinPoint {
  id: string;
  eventId: string;
  name: string;
  location?: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  _count?: {
    checkins?: number;
  };
}

export interface CreateRegistrationInput {
  eventId: string;
  fullName: string;
  email?: string;
  phone?: string;
  company?: string;
  department?: string;
  employeeType?: string;
  groupName?: string;
  groupMembers?: CreateGroupMemberInput[];
  metadata?: Record<string, unknown>;
}

export interface CreateGroupMemberInput {
  fullName: string;
  email?: string;
  phone?: string;
  role?: string;
}

export interface CheckinInput {
  registrationId?: string;
  qrCode?: string;
  checkinPointId: string;
  method?: CheckinMethod;
  checkedBy?: string;
}
