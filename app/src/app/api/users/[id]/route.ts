import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasAnyRole } from "@/lib/auth";
import bcrypt from "bcryptjs";
import type { Role, UserStatus } from "@/generated/prisma";

const ALLOWED_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "HR"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !hasAnyRole(session.role, ALLOWED_ROLES)) {
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
    if (!session || !hasAnyRole(session.role, ALLOWED_ROLES)) {
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

    // Phân cấp quyền hạn bảo mật (Chống leo thang đặc quyền - Privilege Escalation)
    if (existingUser.role === "SUPER_ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Chỉ Super Admin mới có quyền thao tác trên tài khoản Super Admin" },
        { status: 403 }
      );
    }

    if (existingUser.role === "ADMIN" && session.role === "HR") {
      return NextResponse.json(
        { error: "HR không có quyền chỉnh sửa tài khoản Quản trị viên (Admin)" },
        { status: 403 }
      );
    }

    if (role && role !== existingUser.role) {
      if (session.role !== "SUPER_ADMIN") {
        return NextResponse.json(
          { error: "Chỉ Super Admin mới có quyền thay đổi vai trò (role) của tài khoản" },
          { status: 403 }
        );
      }
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

    // Chỉ cập nhật khi trường có giá trị thực tế (tránh gửi chuỗi rỗng làm xóa trắng dữ liệu CSDL)
    const updateData: any = {
      fullName: fullName && fullName.trim() ? fullName.trim() : existingUser.fullName,
      phone: phone && phone.trim() ? phone.trim() : existingUser.phone,
      email: email && email.trim() ? email.trim().toLowerCase() : (body.clearEmail ? null : existingUser.email),
      cccd: cccd && cccd.trim() ? cccd.trim() : (body.clearCccd ? null : existingUser.cccd),
      bankAccount: bankAccount && bankAccount.trim() ? bankAccount.trim() : (body.clearBankAccount ? null : existingUser.bankAccount),
      bankName: bankName && bankName.trim() ? bankName.trim() : (body.clearBankName ? null : existingUser.bankName),
      role: role ? (role as Role) : existingUser.role,
      status: status ? (status as UserStatus) : existingUser.status,
      startDate: startDate ? new Date(startDate) : existingUser.startDate,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : (body.clearDateOfBirth ? null : existingUser.dateOfBirth),
      cccdDate: cccdDate ? new Date(cccdDate) : (body.clearCccdDate ? null : existingUser.cccdDate),
      cccdPlace: cccdPlace && cccdPlace.trim() ? cccdPlace.trim() : (body.clearCccdPlace ? null : existingUser.cccdPlace),
      currentAddress: currentAddress && currentAddress.trim() ? currentAddress.trim() : (body.clearAddress ? null : existingUser.currentAddress),
      permanentAddress: permanentAddress && permanentAddress.trim() ? permanentAddress.trim() : (body.clearAddress ? null : existingUser.permanentAddress),
      driveFolderUrl: driveFolderUrl && driveFolderUrl.trim() ? driveFolderUrl.trim() : (body.clearDrive ? null : existingUser.driveFolderUrl),
    };

    const passwordToChange = newPassword || customPassword;
    if (passwordToChange && passwordToChange.trim()) {
      updateData.passwordHash = await bcrypt.hash(passwordToChange.trim(), 10);
      (updateData as any).tokenVersion = { increment: 1 };
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
    if (!session || !hasAnyRole(session.role, ["SUPER_ADMIN", "ADMIN"])) {
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

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Không tìm thấy nhân sự" }, { status: 404 });
    }

    // Bảo vệ: Quản trị viên không được tự xóa/vô hiệu hóa chính mình
    if (session.userId === userId) {
      return NextResponse.json(
        { error: "Bạn không thể tự vô hiệu hóa tài khoản của chính mình!" },
        { status: 400 }
      );
    }

    // Bảo vệ: Không ai được quyền vô hiệu hóa Super Admin trừ khi chính là Super Admin
    if (targetUser.role.includes("SUPER_ADMIN") && !hasAnyRole(session.role, ["SUPER_ADMIN"])) {
      return NextResponse.json(
        { error: "Chỉ Super Admin mới có quyền vô hiệu hóa tài khoản Super Admin" },
        { status: 403 }
      );
    }

    // Soft delete an toàn trong Transaction:
    // 1. Đổi status thành INACTIVE
    // 2. Chuyển hợp đồng ACTIVE thành TERMINATED (bảo lưu lịch sử hợp đồng)
    // 3. Hủy các ca REGISTERED trong tương lai (chưa phát sinh chấm công/báo cáo)
    // 4. BẢO VỆ TUYỆT ĐỐI toàn bộ lịch sử ca đã làm, chấm công và báo cáo đã nộp trong quá khứ
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { status: "INACTIVE" },
      });

      // Chuyển hợp đồng ACTIVE hiện tại sang TERMINATED
      await tx.contract.updateMany({
        where: { userId, status: "ACTIVE" },
        data: {
          status: "TERMINATED",
          note: "Chấm dứt hợp đồng khi chuyển trạng thái nhân sự sang Đã nghỉ (INACTIVE)",
        },
      });

      // Tìm và hủy các ca tương lai chưa điểm danh/chưa nộp báo cáo
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const futureRegisteredShifts = await tx.shiftRegistration.findMany({
        where: {
          userId,
          shiftDate: { gte: today },
          status: "REGISTERED",
          dailyReport: null,
          loginSession: null,
        },
        select: { id: true },
      });

      if (futureRegisteredShifts.length > 0) {
        await tx.shiftRegistration.updateMany({
          where: {
            id: { in: futureRegisteredShifts.map((s) => s.id) },
          },
          data: {
            status: "REJECTED",
            note: "Tự động hủy ca do nhân sự chuyển sang trạng thái Ngừng hoạt động (INACTIVE)",
          },
        });
      }

      return updated;
    });

    return NextResponse.json({
      message: `Đã chuyển nhân sự ${user.fullName} sang trạng thái Ngừng hoạt động (INACTIVE). Lịch sử ca làm việc, chấm công và hợp đồng đã được bảo lưu an toàn.`,
    });
  } catch (error: any) {
    console.error("Lỗi khi xóa nhân sự:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi thực hiện thao tác xóa" }, { status: 500 });
  }
}
