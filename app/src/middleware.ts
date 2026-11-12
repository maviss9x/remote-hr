import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, createToken, getTokenCookieOptions, shouldRefreshToken } from "@/lib/auth";
import type { Role } from "@/generated/prisma";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout", "/api/qc/image-proxy"];

const ROLE_PATHS: Record<string, Role[]> = {
  "/nhan-su": ["SUPER_ADMIN", "ADMIN", "HR"],
  "/kiem-duyet": ["SUPER_ADMIN", "ADMIN", "MANAGER", "QC"],
  "/theo-doi-ca": ["SUPER_ADMIN", "ADMIN", "MANAGER", "QC"],
  "/api/shifts/monitoring": ["SUPER_ADMIN", "ADMIN", "MANAGER", "QC"],
  "/nghiem-thu": ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER"],
  "/bao-cao-nhan-su": ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER"],
  "/admin/import": ["SUPER_ADMIN"],
  "/api/admin/import": ["SUPER_ADMIN"],
  "/api/admin/backup": ["SUPER_ADMIN"],
  "/admin": ["SUPER_ADMIN", "ADMIN", "KPI", "SHIFTS", "VIRAL", "POST_TAGS"],
  "/api/admin": ["SUPER_ADMIN", "ADMIN", "KPI", "SHIFTS", "VIRAL", "POST_TAGS"],
};

/**
 * Lấy Base URL chuẩn xác nhất dựa trên Header của Reverse Proxy (Cloudflare Tunnel, Nginx)
 * hoặc Host của Request nhằm tránh mất Port hoặc sai Protocol khi redirect.
 */
function getBaseUrl(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host") || request.nextUrl.host;
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto = forwardedProto || (request.nextUrl.protocol ? request.nextUrl.protocol.replace(":", "") : "http");
  return `${proto}://${host}`;
}

/**
 * Xóa sạch triệt để cookie xác thực cả về giá trị lẫn thời hạn
 */
function clearAuthCookie(response: NextResponse) {
  response.cookies.set("hybrid-token", "", {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

/**
 * Tạo redirect response chuẩn xác bảo toàn Origin (host:port và protocol)
 */
function createRedirect(targetPath: string, request: NextRequest) {
  const baseUrl = getBaseUrl(request);
  const targetUrl = new URL(targetPath, baseUrl);
  return NextResponse.redirect(targetUrl);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Tự động chuyển hướng HTTP sang HTTPS nếu đang qua tunnel / domain công khai (không áp dụng cho IP LAN / Localhost)
  const proto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const isLocalOrPrivateIp =
    host.includes("localhost") ||
    host.includes("127.0.0.1") ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);

  if (proto === "http" && host && !isLocalOrPrivateIp) {
    const baseUrl = `https://${host}`;
    const httpsUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, baseUrl);
    return NextResponse.redirect(httpsUrl, 301);
  }

  // Nếu đã có token hợp lệ mà truy cập /login thì tự động chuyển về trang chủ
  if (pathname === "/login") {
    const token = request.cookies.get("hybrid-token")?.value;
    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        return createRedirect("/", request);
      }
    }
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check authentication
  const token = request.cookies.get("hybrid-token")?.value;
  if (!token) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Phiên làm việc đã hết hạn hoặc chưa đăng nhập." },
        { status: 401 }
      );
    }
    const response = createRedirect("/login", request);
    clearAuthCookie(response);
    return response;
  }

  const payload = await verifyToken(token);
  if (!payload) {
    if (pathname.startsWith("/api")) {
      const response = NextResponse.json(
        { error: "SESSION_EXPIRED", message: "Phiên đăng nhập đã hết hạn." },
        { status: 401 }
      );
      clearAuthCookie(response);
      return response;
    }
    const response = createRedirect("/login", request);
    clearAuthCookie(response);
    return response;
  }

  // Check role-based access
  const userRoles = (payload.role || "").split(",").map((r: string) => r.trim()).filter(Boolean);
  for (const [path, allowedRoles] of Object.entries(ROLE_PATHS)) {
    if (pathname.startsWith(path)) {
      const hasPermission = userRoles.some((r) => allowedRoles.includes(r as Role));
      if (!hasPermission) {
        if (pathname.startsWith("/api")) {
          return NextResponse.json(
            { error: "FORBIDDEN", message: "Bạn không có quyền truy cập tài nguyên này." },
            { status: 403 }
          );
        }
        return createRedirect("/", request);
      }
    }
  }

  // Add user info to headers for downstream use
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", String(payload.userId));
  requestHeaders.set("x-user-role", payload.role);
  requestHeaders.set("x-user-name", encodeURIComponent(payload.fullName || ""));

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Rolling session: Gia hạn cookie nếu remember = true và đã trôi qua quá nửa chu kỳ 7 ngày
  if (shouldRefreshToken(payload)) {
    const newToken = await createToken(
      {
        userId: payload.userId,
        role: payload.role,
        fullName: payload.fullName,
        displayRole: payload.displayRole,
        tokenVersion: payload.tokenVersion,
      },
      true
    );
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const isHttps = forwardedProto === "https" || request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production";
    const cookieOptions = {
      ...getTokenCookieOptions(true),
      secure: isHttps,
    };
    response.cookies.set(cookieOptions.name, newToken, cookieOptions);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
