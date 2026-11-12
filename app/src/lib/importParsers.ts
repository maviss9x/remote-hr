import * as XLSX from "xlsx";
import { getISOWeekAndYear } from "./dateUtils";

export function parseExcelDate(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val.toISOString().slice(0, 10);
  }
  if (typeof val === "number") {
    // Excel serial number (days since Dec 30 1899)
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(str)) {
    const parts = str.split("T")[0].split("-");
    return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
  }
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return null;
}

export function normalizeShiftType(str: any): "MORNING" | "AFTERNOON" | "EVENING" | null {
  if (!str) return null;
  const s = String(str).trim().toLowerCase();
  if (s.includes("sáng") || s.includes("sang") || s === "morning" || s === "ca sáng") return "MORNING";
  if (s.includes("chiều") || s.includes("chieu") || s === "afternoon" || s === "ca chiều") return "AFTERNOON";
  if (s.includes("tối") || s.includes("toi") || s === "evening" || s === "ca tối") return "EVENING";
  return null;
}

export function normalizeWorkMode(str: any): "ONLINE" | "OFFLINE" {
  if (!str) return "ONLINE";
  const s = String(str).trim().toLowerCase();
  if (s.includes("off") || s.includes("trực tiếp") || s.includes("tại chỗ") || s.includes("onsite")) {
    return "OFFLINE";
  }
  return "ONLINE";
}

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

export interface UserLookupItem {
  id: number;
  fullName: string;
  phone: string;
  email: string | null;
  role: string;
}

export function findUserByIdentifier(identifier: string, users: UserLookupItem[]): UserLookupItem | null {
  if (!identifier) return null;
  const raw = String(identifier).trim();
  const lower = raw.toLowerCase();
  const normalized = normalizeText(raw);

  // 1. Phone match
  const cleanPhone = raw.replace(/\D/g, "");
  if (cleanPhone.length >= 9) {
    const match = users.find((u) => u.phone.replace(/\D/g, "") === cleanPhone);
    if (match) return match;
  }

  // 2. Email match
  if (lower.includes("@")) {
    const match = users.find((u) => u.email && u.email.toLowerCase() === lower);
    if (match) return match;
  }

  // 3. Exact full name match
  const exact = users.find((u) => u.fullName.toLowerCase() === lower);
  if (exact) return exact;

  // 4. Normalized name match
  const normMatch = users.find((u) => normalizeText(u.fullName) === normalized);
  if (normMatch) return normMatch;

  // 5. Partial name / alias match
  const partial = users.find((u) => {
    const uNorm = normalizeText(u.fullName);
    return uNorm.includes(normalized) || normalized.includes(uNorm);
  });
  return partial || null;
}
