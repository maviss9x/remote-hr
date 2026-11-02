// Prisma-compatible Enums for SQL Server

export const Role = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  HR: "HR",
  MANAGER: "MANAGER",
  QC: "QC",
  NHAN_SU_HYBRID: "NHAN_SU_HYBRID",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const UserStatus = {
  PROBATION: "PROBATION",
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  SUSPENDED: "SUSPENDED",
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const ContractStatus = {
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
  TERMINATED: "TERMINATED",
  RENEWED: "RENEWED",
} as const;
export type ContractStatus = (typeof ContractStatus)[keyof typeof ContractStatus];

export const ShiftType = {
  MORNING: "MORNING",
  AFTERNOON: "AFTERNOON",
  EVENING: "EVENING",
} as const;
export type ShiftType = (typeof ShiftType)[keyof typeof ShiftType];

export const ShiftStatus = {
  REGISTERED: "REGISTERED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  COMPLETED: "COMPLETED",
  ABSENT: "ABSENT",
  EXCUSED_ABSENT: "EXCUSED_ABSENT",
  UNEXCUSED_ABSENT: "UNEXCUSED_ABSENT",
  LOCKED: "LOCKED",
} as const;
export type ShiftStatus = (typeof ShiftStatus)[keyof typeof ShiftStatus];

export const WorkMode = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
} as const;
export type WorkMode = (typeof WorkMode)[keyof typeof WorkMode];

export const ReviewResult = {
  PENDING: "PENDING",
  PASS: "PASS",
  FAIL: "FAIL",
} as const;
export type ReviewResult = (typeof ReviewResult)[keyof typeof ReviewResult];

export const WeeklyRating = {
  EXCELLENT: "EXCELLENT",
  GOOD: "GOOD",
  FAIR: "FAIR",
  NEEDS_IMPROVEMENT: "NEEDS_IMPROVEMENT",
  POOR: "POOR",
} as const;
export type WeeklyRating = (typeof WeeklyRating)[keyof typeof WeeklyRating];

export const AcceptanceStatus = {
  DRAFT: "DRAFT",
  CONFIRMED: "CONFIRMED",
  EXPORTED: "EXPORTED",
} as const;
export type AcceptanceStatus = (typeof AcceptanceStatus)[keyof typeof AcceptanceStatus];

export const ContentType = {
  POST: "POST",
  COMMENT: "COMMENT",
} as const;
export type ContentType = (typeof ContentType)[keyof typeof ContentType];

export const Platform = {
  FACEBOOK: "FACEBOOK",
  THREADS: "THREADS",
} as const;
export type Platform = (typeof Platform)[keyof typeof Platform];

export const NotificationType = {
  CONTRACT_EXPIRING: "CONTRACT_EXPIRING",
  SHIFT_REMINDER: "SHIFT_REMINDER",
  QC_OVERDUE: "QC_OVERDUE",
  QC_RESULT: "QC_RESULT",
  LATE_WARNING: "LATE_WARNING",
  ABSENT_MARKED: "ABSENT_MARKED",
  GENERAL: "GENERAL",
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];
