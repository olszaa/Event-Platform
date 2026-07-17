import { z } from "zod";

// ===================================
// Registration Validation
// ===================================
export const registrationSchema = z.object({
  fullName: z
    .string()
    .min(2, "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร")
    .max(100, "ชื่อยาวเกินไป"),
  email: z
    .string()
    .email("รูปแบบอีเมลไม่ถูกต้อง")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .regex(/^0[0-9]{8,9}$/, "รูปแบบเบอร์โทรไม่ถูกต้อง")
    .optional()
    .or(z.literal("")),
  company: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  employeeType: z.string().max(50).optional(),
  groupName: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const groupMemberSchema = z.object({
  fullName: z.string().min(2, "ชื่อสมาชิกต้องมีอย่างน้อย 2 ตัวอักษร"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  role: z.string().optional(),
});

export const groupRegistrationSchema = registrationSchema.extend({
  groupMembers: z
    .array(groupMemberSchema)
    .min(1, "ต้องมีสมาชิกอย่างน้อย 1 คน")
    .max(50, "สมาชิกไม่เกิน 50 คน"),
});

// ===================================
// Event Validation
// ===================================
export const eventSchema = z.object({
  name: z
    .string()
    .min(3, "ชื่องานต้องมีอย่างน้อย 3 ตัวอักษร")
    .max(200),
  description: z.string().max(5000).optional(),
  venue: z.string().max(200).optional(),
  startDate: z.string().datetime({ message: "รูปแบบวันที่เริ่มไม่ถูกต้อง" }),
  endDate: z.string().datetime({ message: "รูปแบบวันที่สิ้นสุดไม่ถูกต้อง" }),
  status: z
    .enum(["DRAFT", "PUBLISHED", "ACTIVE", "CLOSED", "ARCHIVED"])
    .optional(),
  settings: z.record(z.unknown()).optional(),
});

// ===================================
// Prize Validation
// ===================================
export const prizeSchema = z.object({
  name: z.string().min(2, "ชื่อรางวัลต้องมีอย่างน้อย 2 ตัวอักษร"),
  description: z.string().max(1000).optional(),
  image: z.string().url().optional().or(z.literal("")),
  quantity: z.number().int().min(1, "จำนวนรางวัลต้องมีอย่างน้อย 1"),
  sortOrder: z.number().int().optional(),
  conditions: z
    .object({
      mustCheckedIn: z.boolean().optional(),
      onePerPerson: z.boolean().optional(),
      filterByDepartment: z.array(z.string()).optional(),
      filterByEmployeeType: z.array(z.string()).optional(),
      excludeWinners: z.boolean().optional(),
    })
    .optional(),
});

// ===================================
// Checkin Validation
// ===================================
export const checkinSchema = z.object({
  qrCode: z.string().optional(),
  registrationId: z.string().optional(),
  checkinPointId: z.string().min(1, "กรุณาเลือกจุดเช็กอิน"),
  method: z.enum(["QR_SCAN", "MANUAL", "SEARCH"]).optional(),
  checkedBy: z.string().optional(),
}).refine(
  (data) => data.qrCode || data.registrationId,
  { message: "ต้องระบุ QR code หรือ Registration ID" }
);

export type RegistrationInput = z.infer<typeof registrationSchema>;
export type GroupRegistrationInput = z.infer<typeof groupRegistrationSchema>;
export type EventInput = z.infer<typeof eventSchema>;
export type PrizeInput = z.infer<typeof prizeSchema>;
export type CheckinInput = z.infer<typeof checkinSchema>;
