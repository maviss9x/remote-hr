import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@/generated/prisma";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "hybrid-hr-secret-key-change-in-production"
);

const TOKEN_NAME = "hybrid-token";
const SHORT_EXPIRATION = "12h";
const LONG_EXPIRATION = "7d";

export interface TokenPayload {
  userId: number;
  role: string;
  fullName: string;
  displayRole?: string | null;
  tokenVersion?: number;
  remember?: boolean;
  exp?: number;
  iat?: number;
}

export async function createToken(payload: TokenPayload, remember: boolean = false): Promise<string> {
  const expiration = remember ? LONG_EXPIRATION : SHORT_EXPIRATION;
  return new SignJWT({ ...payload, remember })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export const getCurrentUser = getSession;

export function getTokenCookieOptions(remember: boolean = false) {
  return {
    name: TOKEN_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: remember ? 60 * 60 * 24 * 7 : 60 * 60 * 12, // 7 days vs 12 hours
  };
}

/**
 * Kiểm tra xem token có đủ điều kiện để rolling gia hạn phiên không.
 * Điều kiện: Có bật rememberMe và thời gian hết hạn còn lại dưới 3.5 ngày (một nửa chu kỳ 7 ngày).
 */
export function shouldRefreshToken(payload: TokenPayload): boolean {
  if (!payload.remember || !payload.exp) return false;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const remainingSeconds = payload.exp - nowInSeconds;
  // Dưới 3.5 ngày (302,400 giây) và chưa hết hạn
  return remainingSeconds < 3.5 * 24 * 60 * 60 && remainingSeconds > 0;
}

// Role hierarchy for access control
const ROLE_HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 90,
  HR: 70,
  MANAGER: 60,
  QC: 50,
  NHAN_SU_HYBRID: 10,
};

export function hasAnyRole(userRole: string | undefined | null, targetRoles: string[]): boolean {
  if (!userRole) return false;
  const roles = userRole.split(",").map((r) => r.trim()).filter(Boolean);
  return roles.some((r) => targetRoles.includes(r));
}

export function hasAccess(userRole: string, requiredRole: string): boolean {
  if (!userRole) return false;
  const roles = userRole.split(",").map((r) => r.trim()).filter(Boolean);
  const maxUserLevel = Math.max(...roles.map((r) => ROLE_HIERARCHY[r] || 0), 0);
  return maxUserLevel >= (ROLE_HIERARCHY[requiredRole] || 0);
}

export function isManager(role: string): boolean {
  return hasAnyRole(role, ["SUPER_ADMIN", "ADMIN", "MANAGER", "QC"]);
}

export function isAdmin(role: string): boolean {
  return hasAnyRole(role, ["SUPER_ADMIN", "ADMIN"]);
}
