// ===================================
// Socket.io Event Types
// ===================================

export interface ServerToClientEvents {
  "checkin:new": (data: CheckinEvent) => void;
  "checkin:count": (data: CheckinCountEvent) => void;
  "draw:start": (data: DrawStartEvent) => void;
  "draw:spinning": (data: DrawSpinningEvent) => void;
  "draw:result": (data: DrawResultEvent) => void;
  "draw:redraw": (data: DrawRedrawEvent) => void;
  "notification:sent": (data: NotificationEvent) => void;
}

export interface ClientToServerEvents {
  "checkin:subscribe": (eventId: string) => void;
  "draw:subscribe": (eventId: string) => void;
  "draw:spin-request": (sessionId: string) => void;
}

export interface CheckinEvent {
  registrationId: string;
  fullName: string;
  department?: string;
  checkinPointId: string;
  checkinPointName: string;
  checkinTime: string;
  eventId: string;
}

export interface CheckinCountEvent {
  eventId: string;
  total: number;
  checkedIn: number;
  percentage: number;
}

export interface DrawStartEvent {
  sessionId: string;
  eventId: string;
  prizeName: string;
  prizeImage?: string;
}

export interface DrawSpinningEvent {
  sessionId: string;
  candidates: { id: string; fullName: string; department?: string }[];
  duration: number;
}

export interface DrawResultEvent {
  sessionId: string;
  winners: {
    id: string;
    fullName: string;
    department?: string;
    company?: string;
    prizeName: string;
  }[];
}

export interface DrawRedrawEvent {
  sessionId: string;
  previousWinner: string;
  reason?: string;
  newWinner?: {
    id: string;
    fullName: string;
    department?: string;
  };
}

export interface NotificationEvent {
  type: "email" | "sms" | "line";
  registrationId: string;
  status: "sent" | "failed";
  message?: string;
}
