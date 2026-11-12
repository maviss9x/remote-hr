import { NextResponse } from "next/server";
import { getSession, createToken, getTokenCookieOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma";

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

export async function GET() {
  const session = await getSession();
  if (!session) {
    const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    clearAuthCookie(res);
    return res;
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, fullName: true, role: true, status: true, displayRole: true, tokenVersion: true },
    });

    if (!dbUser || dbUser.status === "INACTIVE" || dbUser.status === "SUSPENDED") {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      clearAuthCookie(response);
      return response;
    }

    const currentTokenVersion = (dbUser as any).tokenVersion ?? 1;

    // Kiểm tra tính hợp lệ của tokenVersion:
    // 1. Nếu token có version nhưng khác với DB -> Mật khẩu đã đổi trên thiết bị khác -> Đăng xuất ngay
    // 2. Nếu token chưa có version (phiên cũ) nhưng DB đã tăng version > 1 -> Mật khẩu đã đổi -> Đăng xuất ngay
    const isTokenRevoked =
      (session.tokenVersion !== undefined && session.tokenVersion !== currentTokenVersion) ||
      (session.tokenVersion === undefined && currentTokenVersion > 1);

    if (isTokenRevoked) {
      const response = NextResponse.json(
        {
          error: "TOKEN_REVOKED",
          reason: "password_changed",
          message: "Mật khẩu đã được thay đổi. Vui lòng đăng nhập lại.",
        },
        { status: 401 }
      );
      clearAuthCookie(response);
      return response;
    }

    const updatedUser = {
      ...session,
      role: dbUser.role,
      fullName: dbUser.fullName,
      displayRole: dbUser.displayRole,
      tokenVersion: currentTokenVersion,
    };

    const response = NextResponse.json({ user: updatedUser });

    // Cập nhật lại cookie nếu thông tin user hoặc tokenVersion thay đổi
    const needTokenUpdate =
      dbUser.fullName !== session.fullName ||
      dbUser.role !== session.role ||
      dbUser.displayRole !== session.displayRole ||
      session.tokenVersion !== currentTokenVersion;

    if (needTokenUpdate) {
      const isRemember = session.remember ?? false;
      const newToken = await createToken(
        {
          userId: dbUser.id,
          role: dbUser.role as Role,
          fullName: dbUser.fullName,
          displayRole: dbUser.displayRole,
          tokenVersion: currentTokenVersion,
        },
        isRemember
      );
      response.cookies.set({
        ...getTokenCookieOptions(isRemember),
        value: newToken,
      });
    }

    return response;
  } catch (error) {
    console.error("Lỗi khi kiểm tra session từ DB:", error);
    // Dự phòng trường hợp DB tạm ngắt, vẫn trả về session từ token
    return NextResponse.json({ user: session });
  }
}
