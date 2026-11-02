import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        cccd: true,
        cccdDate: true,
        cccdPlace: true,
        dateOfBirth: true,
        currentAddress: true,
        permanentAddress: true,
        bankAccount: true,
        bankName: true,
        role: true,
        status: true,
        startDate: true,
        avatarUrl: true,
        driveFolderUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Không tìm thấy thông tin tài khoản" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error("Lỗi khi lấy thông tin cá nhân:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi lấy hồ sơ cá nhân" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await request.json();
    const {
      fullName,
      phone,
      email,
      bankAccount,
      bankName,
      currentAddress,
      permanentAddress,
      dateOfBirth,
      cccdDate,
      cccdPlace,
      driveFolderUrl,
      currentPassword,
      newPassword,
    } = body;

    const existingUser = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });
    }

    // Check phone uniqueness if changed
    if (phone && phone.trim() !== existingUser.phone) {
      const duplicatePhone = await prisma.user.findUnique({
        where: { phone: phone.trim() },
      });
      if (duplicatePhone) {
        return NextResponse.json(
          { error: `Số điện thoại ${phone} đã được sử dụng bởi tài khoản khác` },
          { status: 400 }
        );
      }
    }

    // Check email uniqueness if changed
    if (email && email.trim().toLowerCase() !== existingUser.email?.toLowerCase()) {
      const duplicateEmail = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
      });
      if (duplicateEmail) {
        return NextResponse.json(
          { error: `Email ${email} đã được đăng ký bởi tài khoản khác` },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};

    if (fullName && fullName.trim()) updateData.fullName = fullName.trim();
    if (phone && phone.trim()) updateData.phone = phone.trim();
    if (email !== undefined) updateData.email = email ? email.trim().toLowerCase() : null;
    if (bankAccount !== undefined) updateData.bankAccount = bankAccount ? bankAccount.trim() : null;
    if (bankName !== undefined) updateData.bankName = bankName ? bankName.trim() : null;
    if (currentAddress !== undefined) updateData.currentAddress = currentAddress ? currentAddress.trim() : null;
    if (permanentAddress !== undefined) updateData.permanentAddress = permanentAddress ? permanentAddress.trim() : null;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (cccdDate !== undefined) updateData.cccdDate = cccdDate ? new Date(cccdDate) : null;
    if (cccdPlace !== undefined) updateData.cccdPlace = cccdPlace ? cccdPlace.trim() : null;
    if (driveFolderUrl !== undefined) {
      const trimmedDrive = driveFolderUrl ? driveFolderUrl.trim() : null;
      if (trimmedDrive && trimmedDrive.length > 1000) {
        return NextResponse.json(
          { error: "Đường dẫn Google Drive không được vượt quá 1000 ký tự" },
          { status: 400 }
        );
      }
      updateData.driveFolderUrl = trimmedDrive;
    }

    // Handle password change
    if (newPassword && newPassword.trim()) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu mới" },
          { status: 400 }
        );
      }

      const isMatch = await bcrypt.compare(currentPassword, existingUser.passwordHash);
      if (!isMatch) {
        return NextResponse.json(
          { error: "Mật khẩu hiện tại không chính xác" },
          { status: 400 }
        );
      }

      if (newPassword.trim().length < 6) {
        return NextResponse.json(
          { error: "Mật khẩu mới phải có tối thiểu 6 ký tự" },
          { status: 400 }
        );
      }

      updateData.passwordHash = await bcrypt.hash(newPassword.trim(), 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        cccd: true,
        cccdDate: true,
        cccdPlace: true,
        dateOfBirth: true,
        currentAddress: true,
        permanentAddress: true,
        bankAccount: true,
        bankName: true,
        role: true,
        status: true,
        startDate: true,
        avatarUrl: true,
        driveFolderUrl: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Cập nhật hồ sơ cá nhân thành công!",
      user: updatedUser,
    });
  } catch (error: any) {
    console.error("Lỗi khi cập nhật hồ sơ cá nhân:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi cập nhật hồ sơ" }, { status: 500 });
  }
}

