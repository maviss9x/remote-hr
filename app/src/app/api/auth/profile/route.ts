import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, createToken, getTokenCookieOptions } from "@/lib/auth";
import type { Role } from "@/generated/prisma";
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
        displayRole: true,
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
      cccd,
      bankAccount,
      bankName,
      currentAddress,
      permanentAddress,
      dateOfBirth,
      cccdDate,
      cccdPlace,
      driveFolderUrl,
      avatarUrl,
      displayRole,
      currentPassword,
      newPassword,
    } = body;

    const existingUser = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });
    }

    const updateData: Record<string, any> = {};

    // 1. Kiểm tra họ và tên
    if (fullName !== undefined) {
      const trimmedName = fullName?.trim();
      if (!trimmedName) {
        return NextResponse.json({ error: "Họ và tên không được để trống" }, { status: 400 });
      }
      updateData.fullName = trimmedName;
    }

    // 2. Kiểm tra số điện thoại
    if (phone !== undefined) {
      const trimmedPhone = phone?.trim();
      if (!trimmedPhone) {
        return NextResponse.json({ error: "Số điện thoại không được để trống" }, { status: 400 });
      }
      if (!/^[0-9]{9,11}$/.test(trimmedPhone)) {
        return NextResponse.json(
          { error: "Số điện thoại không hợp lệ (cần từ 9 đến 11 chữ số)" },
          { status: 400 }
        );
      }
      if (trimmedPhone !== existingUser.phone) {
        const duplicatePhone = await prisma.user.findUnique({
          where: { phone: trimmedPhone },
        });
        if (duplicatePhone) {
          return NextResponse.json(
            { error: `Số điện thoại ${trimmedPhone} đã được sử dụng bởi tài khoản khác` },
            { status: 400 }
          );
        }
        updateData.phone = trimmedPhone;
      }
    }

    // 3. Kiểm tra Email (cho phép null)
    if (email !== undefined) {
      const trimmedEmail = email?.trim().toLowerCase() || null;
      if (trimmedEmail) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
          return NextResponse.json({ error: "Định dạng email không hợp lệ" }, { status: 400 });
        }
        if (trimmedEmail !== existingUser.email?.toLowerCase()) {
          const duplicateEmail = await prisma.user.findUnique({
            where: { email: trimmedEmail },
          });
          if (duplicateEmail) {
            return NextResponse.json(
              { error: `Email ${trimmedEmail} đã được đăng ký bởi tài khoản khác` },
              { status: 400 }
            );
          }
        }
      }
      updateData.email = trimmedEmail;
    }

    // 4. Kiểm tra CCCD (cho phép null)
    if (cccd !== undefined) {
      const trimmedCccd = cccd?.trim() || null;
      if (trimmedCccd) {
        if (!/^[0-9]{9,12}$/.test(trimmedCccd)) {
          return NextResponse.json(
            { error: "Số CCCD/CMND không hợp lệ (cần 9 hoặc 12 số)" },
            { status: 400 }
          );
        }
        if (trimmedCccd !== existingUser.cccd) {
          const duplicateCccd = await prisma.user.findFirst({
            where: {
              cccd: trimmedCccd,
              NOT: { id: session.userId },
            },
          });
          if (duplicateCccd) {
            return NextResponse.json(
              { error: `Số CCCD ${trimmedCccd} đã được sử dụng bởi tài khoản khác` },
              { status: 400 }
            );
          }
        }
      }
      updateData.cccd = trimmedCccd;
    }

    // 5. Kiểm tra ngày sinh & ngày cấp CCCD (chỉ cập nhật khi có giá trị hợp lệ)
    if (dateOfBirth !== undefined) {
      if (dateOfBirth) {
        const parsedDob = new Date(dateOfBirth);
        if (isNaN(parsedDob.getTime())) {
          return NextResponse.json(
            { error: "Ngày sinh không đúng định dạng ngày hợp lệ" },
            { status: 400 }
          );
        }
        updateData.dateOfBirth = parsedDob;
      } else if (body.clearDateOfBirth) {
        updateData.dateOfBirth = null;
      }
    }

    if (cccdDate !== undefined) {
      if (cccdDate) {
        const parsedCccdDate = new Date(cccdDate);
        if (isNaN(parsedCccdDate.getTime())) {
          return NextResponse.json(
            { error: "Ngày cấp CCCD không đúng định dạng ngày hợp lệ" },
            { status: 400 }
          );
        }
        updateData.cccdDate = parsedCccdDate;
      } else if (body.clearCccdDate) {
        updateData.cccdDate = null;
      }
    }

    // 6. Các trường thông tin bổ sung: Chỉ cập nhật khi có giá trị thực tế để tránh xóa trắng
    if (bankAccount !== undefined) {
      if (bankAccount.trim()) updateData.bankAccount = bankAccount.trim();
      else if (body.clearBankAccount) updateData.bankAccount = null;
    }
    if (bankName !== undefined) {
      if (bankName.trim()) updateData.bankName = bankName.trim();
      else if (body.clearBankName) updateData.bankName = null;
    }
    if (currentAddress !== undefined) {
      if (currentAddress.trim()) updateData.currentAddress = currentAddress.trim();
      else if (body.clearAddress) updateData.currentAddress = null;
    }
    if (permanentAddress !== undefined) {
      if (permanentAddress.trim()) updateData.permanentAddress = permanentAddress.trim();
      else if (body.clearAddress) updateData.permanentAddress = null;
    }
    if (cccdPlace !== undefined) {
      if (cccdPlace.trim()) updateData.cccdPlace = cccdPlace.trim();
      else if (body.clearCccdPlace) updateData.cccdPlace = null;
    }
    if (avatarUrl !== undefined) {
      if (avatarUrl.trim()) updateData.avatarUrl = avatarUrl.trim();
      else if (body.clearAvatar) updateData.avatarUrl = null;
    }
    if (displayRole !== undefined) {
      if (displayRole.trim()) updateData.displayRole = displayRole.trim();
      else if (body.clearDisplayRole) updateData.displayRole = null;
    }

    if (driveFolderUrl !== undefined) {
      const trimmedDrive = driveFolderUrl?.trim();
      if (trimmedDrive) {
        if (trimmedDrive.length > 1000) {
          return NextResponse.json(
            { error: "Đường dẫn Google Drive không được vượt quá 1000 ký tự" },
            { status: 400 }
          );
        }
        updateData.driveFolderUrl = trimmedDrive;
      } else if (body.clearDrive) {
        updateData.driveFolderUrl = null;
      }
    }

    // 7. Đổi mật khẩu
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
      (updateData as any).tokenVersion = { increment: 1 };
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
        displayRole: true,
        status: true,
        startDate: true,
        avatarUrl: true,
        driveFolderUrl: true,
        tokenVersion: true,
        createdAt: true,
      },
    });

    const isRemember = session.remember ?? false;
    const newToken = await createToken(
      {
        userId: updatedUser.id,
        role: updatedUser.role as Role,
        fullName: updatedUser.fullName,
        displayRole: updatedUser.displayRole,
        tokenVersion: (updatedUser as any).tokenVersion ?? 1,
      },
      isRemember
    );

    const response = NextResponse.json({
      success: true,
      message: "Cập nhật hồ sơ cá nhân thành công!",
      user: updatedUser,
    });

    response.cookies.set({
      ...getTokenCookieOptions(isRemember),
      value: newToken,
    });

    return response;
  } catch (error: any) {
    if (error?.code === "P2002") {
      const target = (error.meta?.target as string[])?.join(", ") || "thông tin";
      return NextResponse.json(
        { error: `Giá trị của ${target} đã tồn tại trong hệ thống` },
        { status: 400 }
      );
    }
    console.error("Lỗi khi cập nhật hồ sơ cá nhân:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi cập nhật hồ sơ" }, { status: 500 });
  }
}
