// ===================================
// Event Types
// ===================================

export type EventStatus = "DRAFT" | "PUBLISHED" | "ACTIVE" | "CLOSED" | "ARCHIVED";

export interface EventSettings {
  maxRegistrations?: number;
  allowGroupRegistration?: boolean;
  maxGroupSize?: number;
  requireEmail?: boolean;
  requirePhone?: boolean;
  customFields?: CustomField[];
  themeColor?: string;
  registerBackground?: string;
  checkinBackground?: string;
  luckyDrawBackground?: string;
  luckyDrawAnimation?: "slot" | "pulse" | "random";
  isPinned?: boolean;
  enableRegisterWhenActive?: boolean;
  enableCheckinWhenPublic?: boolean;
}

export interface CustomField {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "checkbox";
  required?: boolean;
  options?: string[];
}

export interface Event {
  id: string;
  name: string;
  description?: string | null;
  venue?: string | null;
  startDate: string;
  endDate: string;
  status: EventStatus;
  settings?: EventSettings | null;
  coverImage?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    registrations?: number;
    checkinPoints?: number;
    prizes?: number;
  };
}

export interface CreateEventInput {
  name: string;
  description?: string;
  venue?: string;
  startDate: string;
  endDate: string;
  status?: EventStatus;
  settings?: EventSettings;
  coverImage?: string;
}

export interface UpdateEventInput extends Partial<CreateEventInput> {}
