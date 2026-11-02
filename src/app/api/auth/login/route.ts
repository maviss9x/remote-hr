import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createToken, getTokenCookieOptions } from "@/lib/auth";
import type { Role } from "@/generated/prisma";

export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Dữ liệu yêu cầu không hợp lệ" },
        { status: 400 }
      );
    }

    const { identifier, phone, password, remember = false } = body || {};
    const rawIdentifier = String(identifier || phone || "").trim();

    if (!rawIdentifier || !password) {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ thông tin" },
        { status: 400 }
      );
    }

    // Chuẩn hóa số điện thoại (bỏ khoảng trắng, dấu gạch nối, chuẩn hóa +84 thành 0)
    let normalizedPhone = rawIdentifier.replace(/[\s\.\-\(\)]/g, "");
    if (normalizedPhone.startsWith("+84")) {
      normalizedPhone = "0" + normalizedPhone.slice(3);
    } else if (normalizedPhone.startsWith("84") && normalizedPhone.length > 9) {
      normalizedPhone = "0" + normalizedPhone.slice(2);
    }

    // Tìm user linh hoạt theo username "admin", email, hoặc phone
    let user = null;
    const lowerIdentifier = rawIdentifier.toLowerCase();
    if (lowerIdentifier === "admin" || lowerIdentifier === "superadmin") {
      user = await prisma.user.findFirst({
        where: { role: "SUPER_ADMIN" },
      });
    } else if (rawIdentifier.includes("@")) {
      user = await prisma.user.findUnique({
        where: { email: lowerIdentifier },
      });
    }

    if (!user) {
      user = await prisma.user.findUnique({
        where: { phone: normalizedPhone },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: "Tài khoản hoặc mật khẩu không đúng" },
        { status: 401 }
      );
    }

    if (user.status === "INACTIVE" || user.status === "SUSPENDED") {
      return NextResponse.json(
        { error: "Tài khoản đã bị khóa hoặc ngừng hoạt động" },
        { status: 403 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Tài khoản hoặc mật khẩu không đúng" },
        { status: 401 }
      );
    }

    const isRemember = Boolean(remember);
    const token = await createToken(
      {
        userId: user.id,
        role: user.role as Role,
        fullName: user.fullName,
      },
      isRemember
    );

    const forwardedProto = request.headers.get("x-forwarded-proto");
    const isHttps = forwardedProto === "https" || request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production";
    const cookieOptions = {
      ...getTokenCookieOptions(isRemember),
      secure: isHttps,
    };
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
      },
    });

    response.cookies.set(cookieOptions.name, token, cookieOptions);
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Lỗi hệ thống, vui lòng thử lại" },
      { status: 500 }
    );
  }
}
