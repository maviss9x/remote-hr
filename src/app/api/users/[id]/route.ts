import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import type { Role, UserStatus } from "@/generated/prisma";

const ALLOWED_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "HR"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "ID nhân sự không hợp lệ" }, { status: 400 });
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
        dateOfBirth: true,
        cccdDate: true,
        cccdPlace: true,
        currentAddress: true,
        permanentAddress: true,
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
      return NextResponse.json({ error: "Không tìm thấy nhân sự" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error("Lỗi khi lấy chi tiết nhân sự:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi lấy chi tiết nhân sự" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: "Không có quyền thực hiện thao tác này" }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "ID nhân sự không hợp lệ" }, { status: 400 });
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
      dateOfBirth,
      cccdDate,
      cccdPlace,
      currentAddress,
      permanentAddress,
      driveFolderUrl,
      newPassword,
      customPassword,
      contractStartDate,
      contractEndDate,
    } = body;

    // Check user existence
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "Không tìm thấy nhân sự cần sửa" }, { status: 404 });
    }

    // Check phone uniqueness
    if (phone && phone.trim() !== existingUser.phone) {
      const duplicatePhone = await prisma.user.findUnique({
        where: { phone: phone.trim() },
      });
      if (duplicatePhone) {
        return NextResponse.json(
          { error: `Số điện thoại ${phone} đã được sử dụng bởi nhân sự khác` },
          { status: 400 }
        );
      }
    }

    // Check CCCD uniqueness
    if (cccd && cccd.trim() !== existingUser.cccd) {
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

    // Check Email uniqueness
    if (email && email.trim().toLowerCase() !== existingUser.email?.toLowerCase()) {
      const duplicateEmail = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
      });
      if (duplicateEmail) {
        return NextResponse.json(
          { error: `Email ${email} đã tồn tại trên hệ thống` },
          { status: 400 }
        );
      }
    }

    const updateData: any = {
      fullName: fullName ? fullName.trim() : existingUser.fullName,
      phone: phone ? phone.trim() : existingUser.phone,
      email: email !== undefined ? (email ? email.trim().toLowerCase() : null) : existingUser.email,
      cccd: cccd !== undefined ? (cccd ? cccd.trim() : null) : existingUser.cccd,
      bankAccount: bankAccount !== undefined ? (bankAccount ? bankAccount.trim() : null) : existingUser.bankAccount,
      bankName: bankName !== undefined ? (bankName ? bankName.trim() : null) : existingUser.bankName,
      role: role ? (role as Role) : existingUser.role,
      status: status ? (status as UserStatus) : existingUser.status,
      startDate: startDate ? new Date(startDate) : existingUser.startDate,
      dateOfBirth: dateOfBirth !== undefined ? (dateOfBirth ? new Date(dateOfBirth) : null) : existingUser.dateOfBirth,
      cccdDate: cccdDate !== undefined ? (cccdDate ? new Date(cccdDate) : null) : existingUser.cccdDate,
      cccdPlace: cccdPlace !== undefined ? (cccdPlace ? cccdPlace.trim() : null) : existingUser.cccdPlace,
      currentAddress: currentAddress !== undefined ? (currentAddress ? currentAddress.trim() : null) : existingUser.currentAddress,
      permanentAddress: permanentAddress !== undefined ? (permanentAddress ? permanentAddress.trim() : null) : existingUser.permanentAddress,
      driveFolderUrl: driveFolderUrl !== undefined ? (driveFolderUrl ? driveFolderUrl.trim() : null) : existingUser.driveFolderUrl,
    };

    const passwordToChange = newPassword || customPassword;
    if (passwordToChange && passwordToChange.trim()) {
      updateData.passwordHash = await bcrypt.hash(passwordToChange.trim(), 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Cập nhật hoặc tạo mới hợp đồng nếu có ngày hợp đồng
    if (contractStartDate) {
      const parsedContractStart = new Date(contractStartDate);
      let parsedContractEnd: Date;
      const isProbation = updatedUser.status === "PROBATION";

      if (contractEndDate) {
        parsedContractEnd = new Date(contractEndDate);
      } else if (isProbation) {
        parsedContractEnd = new Date(parsedContractStart);
        parsedContractEnd.setDate(parsedContractEnd.getDate() + 6);
      } else {
        parsedContractEnd = new Date(parsedContractStart);
        parsedContractEnd.setMonth(parsedContractEnd.getMonth() + 3);
      }

      const latestContract = await prisma.contract.findFirst({
        where: { userId },
        orderBy: { endDate: "desc" },
      });

      if (latestContract) {
        await prisma.contract.update({
          where: { id: latestContract.id },
          data: {
            startDate: parsedContractStart,
            endDate: parsedContractEnd,
            status: "ACTIVE",
            contractType: isProbation ? "thu_viec" : latestContract.contractType,
          },
        });
      } else {
        await prisma.contract.create({
          data: {
            userId,
            startDate: parsedContractStart,
            endDate: parsedContractEnd,
            status: "ACTIVE",
            contractType: isProbation ? "thu_viec" : "khoan_viec",
            note: isProbation ? "Hợp đồng thử việc 1 tuần" : "Hợp đồng khởi tạo khi cập nhật hồ sơ",
          },
        });
      }
    }

    return NextResponse.json({
      message: "Cập nhật hồ sơ nhân sự thành công",
      user: {
        id: updatedUser.id,
        fullName: updatedUser.fullName,
        phone: updatedUser.phone,
        role: updatedUser.role,
        status: updatedUser.status,
      },
    });
  } catch (error: any) {
    console.error("Lỗi khi cập nhật hồ sơ nhân sự:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi cập nhật hồ sơ" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.role)) {
      return NextResponse.json(
        { error: "Chỉ Quản trị viên mới có quyền vô hiệu hóa/xóa nhân sự" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const userId = parseInt(id);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "ID nhân sự không hợp lệ" }, { status: 400 });
    }

    // Soft delete by switching status to INACTIVE
    const user = await prisma.user.update({
      where: { id: userId },
      data: { status: "INACTIVE" },
    });

    return NextResponse.json({
      message: `Đã chuyển nhân sự ${user.fullName} sang trạng thái Ngừng hoạt động (INACTIVE)`,
    });
  } catch (error: any) {
    console.error("Lỗi khi xóa nhân sự:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi thực hiện thao tác xóa" }, { status: 500 });
  }
}
