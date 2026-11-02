import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import type { Role, UserStatus } from "@/generated/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Chỉ Quản trị viên cấp cao nhất (SUPER_ADMIN) mới có quyền truy cập" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const userId = parseInt(id);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "ID tài khoản không hợp lệ" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        cccd: true,
        bankAccount: true,
        bankName: true,
        role: true,
        status: true,
        startDate: true,
        avatarUrl: true,
        driveFolderUrl: true,
        createdAt: true,
        updatedAt: true,
        contracts: {
          orderBy: { endDate: "desc" },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error("Lỗi API GET /api/admin/users/[id]:", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi lấy thông tin tài khoản" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Chỉ Quản trị viên cấp cao nhất (SUPER_ADMIN) mới có quyền chỉnh sửa tài khoản" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const userId = parseInt(id);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "ID tài khoản không hợp lệ" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản cần chỉnh sửa" }, { status: 404 });
    }

    const body = await request.json();
    const {
      fullName,
      phone,
      email,
      cccd,
      bankAccount,
      bankName,
      role,
      status,
      startDate,
      newPassword,
    } = body;

    // PHÒNG TRÁNH SELF-LOCKOUT: Quản trị viên không được tự hạ quyền hoặc tự khóa chính mình
    const isEditingSelf = session.userId === userId;
    if (isEditingSelf) {
      if (role && role !== "SUPER_ADMIN") {
        return NextResponse.json(
          { error: "Bạn không thể tự hạ quyền vai trò SUPER_ADMIN của chính mình!" },
          { status: 400 }
        );
      }
      if (status && (status === "INACTIVE" || status === "SUSPENDED")) {
        return NextResponse.json(
          { error: "Bạn không thể tự vô hiệu hóa tài khoản quản trị viên của chính mình!" },
          { status: 400 }
        );
      }
    }

    // Check unique phone if changed
    if (phone && phone.trim() !== existingUser.phone) {
      const duplicatePhone = await prisma.user.findUnique({
        where: { phone: phone.trim() },
      });
      if (duplicatePhone) {
        return NextResponse.json(
          { error: `Số điện thoại ${phone} đã được sử dụng bởi người dùng khác` },
          { status: 400 }
        );
      }
    }

    // Check unique email if changed
    if (email && email.trim() && email.trim().toLowerCase() !== existingUser.email?.toLowerCase()) {
      const duplicateEmail = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
      });
      if (duplicateEmail) {
        return NextResponse.json(
          { error: `Email ${email} đã được sử dụng bởi người dùng khác` },
          { status: 400 }
        );
      }
    }

    // Check unique CCCD if changed
    if (cccd && cccd.trim() && cccd.trim() !== existingUser.cccd) {
      const duplicateCccd = await prisma.user.findUnique({
        where: { cccd: cccd.trim() },
      });
      if (duplicateCccd) {
        return NextResponse.json(
          { error: `CCCD ${cccd} đã tồn tại trên hệ thống` },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};
    if (fullName !== undefined) updateData.fullName = fullName.trim();
    if (phone !== undefined) updateData.phone = phone.trim();
    if (email !== undefined) updateData.email = email?.trim()?.toLowerCase() || null;
    if (cccd !== undefined) updateData.cccd = cccd?.trim() || null;
    if (bankAccount !== undefined) updateData.bankAccount = bankAccount?.trim() || null;
    if (bankName !== undefined) updateData.bankName = bankName?.trim() || null;
    if (role !== undefined) updateData.role = role as Role;
    if (status !== undefined) updateData.status = status as UserStatus;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);

    // Cập nhật mật khẩu nếu có
    if (newPassword && newPassword.trim()) {
      if (newPassword.trim().length < 6) {
        return NextResponse.json({ error: "Mật khẩu mới phải có tối thiểu 6 ký tự" }, { status: 400 });
      }
      updateData.passwordHash = await bcrypt.hash(newPassword.trim(), 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        cccd: true,
        bankAccount: true,
        bankName: true,
        role: true,
        status: true,
        startDate: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      message: `Đã cập nhật thông tin tài khoản ${updatedUser.fullName} thành công`,
      user: updatedUser,
    });
  } catch (error: any) {
    console.error("Lỗi API PUT /api/admin/users/[id]:", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi cập nhật tài khoản" },
      { status: 500 }
    );
  }
}
