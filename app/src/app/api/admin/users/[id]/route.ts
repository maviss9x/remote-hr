import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasAnyRole } from "@/lib/auth";
import bcrypt from "bcryptjs";
import type { Role, UserStatus } from "@/generated/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !hasAnyRole(session.role, ["SUPER_ADMIN", "ADMIN"])) {
      return NextResponse.json(
        { error: "Chỉ Quản trị viên (SUPER_ADMIN, ADMIN) mới có quyền truy cập" },
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
        displayRole: true,
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
    if (!session || !hasAnyRole(session.role, ["SUPER_ADMIN", "ADMIN"])) {
      return NextResponse.json(
        { error: "Chỉ Quản trị viên (SUPER_ADMIN, ADMIN) mới có quyền chỉnh sửa tài khoản" },
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

    // Bảo vệ SUPER_ADMIN: Quản trị viên thông thường không được chỉnh sửa tài khoản Super Admin
    if (!hasAnyRole(session.role, ["SUPER_ADMIN"]) && existingUser.role.includes("SUPER_ADMIN")) {
      return NextResponse.json(
        { error: "Chỉ Quản trị viên tối cao (SUPER_ADMIN) mới có quyền chỉnh sửa tài khoản Super Admin" },
        { status: 403 }
      );
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
      roles,
      displayRole,
      status,
      startDate,
      dateOfBirth,
      cccdDate,
      cccdPlace,
      currentAddress,
      permanentAddress,
      driveFolderUrl,
      newPassword,
    } = body;

    // PHÒNG TRÁNH SELF-LOCKOUT: Quản trị viên không được tự hạ quyền hoặc tự khóa chính mình
    const isEditingSelf = session.userId === userId;
    let finalRoleString: string | undefined = undefined;

    if (roles !== undefined || role !== undefined) {
      let finalRoles: string[] = [];
      if (Array.isArray(roles)) {
        finalRoles = roles.map((r: any) => String(r).trim()).filter(Boolean);
      } else if (role && typeof role === "string") {
        finalRoles = role.split(",").map((r: string) => r.trim()).filter(Boolean);
      }

      if (finalRoles.length > 0) {
        if (isEditingSelf && !finalRoles.includes("SUPER_ADMIN") && existingUser.role.includes("SUPER_ADMIN")) {
          return NextResponse.json(
            { error: "Bạn không thể tự hạ quyền vai trò SUPER_ADMIN của chính mình!" },
            { status: 400 }
          );
        }
        if (!hasAnyRole(session.role, ["SUPER_ADMIN"]) && finalRoles.includes("SUPER_ADMIN")) {
          return NextResponse.json(
            { error: "Chỉ Quản trị viên tối cao (SUPER_ADMIN) mới có quyền cấp quyền Super Admin" },
            { status: 403 }
          );
        }
        if (finalRoles.includes("NHAN_SU_HYBRID") && finalRoles.length > 1) {
          finalRoles = finalRoles.filter((r) => r !== "NHAN_SU_HYBRID");
        }
        finalRoleString = finalRoles.join(",");
      }
    }

    if (isEditingSelf) {
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
    if (fullName !== undefined && fullName.trim()) updateData.fullName = fullName.trim();
    if (phone !== undefined && phone.trim()) updateData.phone = phone.trim();
    if (email !== undefined) {
      if (email.trim()) updateData.email = email.trim().toLowerCase();
      else if (body.clearEmail) updateData.email = null;
    }
    if (cccd !== undefined) {
      if (cccd.trim()) updateData.cccd = cccd.trim();
      else if (body.clearCccd) updateData.cccd = null;
    }
    if (bankAccount !== undefined) {
      if (bankAccount.trim()) updateData.bankAccount = bankAccount.trim();
      else if (body.clearBankAccount) updateData.bankAccount = null;
    }
    if (bankName !== undefined) {
      if (bankName.trim()) updateData.bankName = bankName.trim();
      else if (body.clearBankName) updateData.bankName = null;
    }
    if (dateOfBirth !== undefined) {
      if (dateOfBirth) updateData.dateOfBirth = new Date(dateOfBirth);
      else if (body.clearDateOfBirth) updateData.dateOfBirth = null;
    }
    if (cccdDate !== undefined) {
      if (cccdDate) updateData.cccdDate = new Date(cccdDate);
      else if (body.clearCccdDate) updateData.cccdDate = null;
    }
    if (cccdPlace !== undefined) {
      if (cccdPlace.trim()) updateData.cccdPlace = cccdPlace.trim();
      else if (body.clearCccdPlace) updateData.cccdPlace = null;
    }
    if (currentAddress !== undefined) {
      if (currentAddress.trim()) updateData.currentAddress = currentAddress.trim();
      else if (body.clearAddress) updateData.currentAddress = null;
    }
    if (permanentAddress !== undefined) {
      if (permanentAddress.trim()) updateData.permanentAddress = permanentAddress.trim();
      else if (body.clearAddress) updateData.permanentAddress = null;
    }
    if (driveFolderUrl !== undefined) {
      if (driveFolderUrl.trim()) updateData.driveFolderUrl = driveFolderUrl.trim();
      else if (body.clearDrive) updateData.driveFolderUrl = null;
    }
    if (finalRoleString !== undefined) {
      updateData.role = finalRoleString;
    } else if (role !== undefined) {
      updateData.role = role as Role;
    }
    if (displayRole !== undefined) {
      updateData.displayRole = displayRole ? displayRole.trim() : null;
    }
    if (status !== undefined) updateData.status = status as UserStatus;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);

    // Cập nhật mật khẩu nếu có
    if (newPassword && newPassword.trim()) {
      if (newPassword.trim().length < 6) {
        return NextResponse.json({ error: "Mật khẩu mới phải có tối thiểu 6 ký tự" }, { status: 400 });
      }
      updateData.passwordHash = await bcrypt.hash(newPassword.trim(), 10);
      (updateData as any).tokenVersion = { increment: 1 };
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
        displayRole: true,
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !hasAnyRole(session.role, ["SUPER_ADMIN", "ADMIN"])) {
      return NextResponse.json(
        { error: "Chỉ Quản trị viên mới có quyền vô hiệu hóa/xóa tài khoản" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const userId = parseInt(id);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "ID tài khoản không hợp lệ" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản" }, { status: 404 });
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
    // 2. Chuyển hợp đồng ACTIVE thành TERMINATED (bảo lưu lịch sử)
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
          note: "Chấm dứt hợp đồng khi chuyển trạng thái tài khoản sang Đã nghỉ (INACTIVE)",
        },
      });

      // Hủy các ca tương lai chưa điểm danh/chưa nộp báo cáo
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
            note: "Tự động hủy ca do tài khoản chuyển sang trạng thái Ngừng hoạt động (INACTIVE)",
          },
        });
      }

      return updated;
    });

    return NextResponse.json({
      message: `Đã chuyển tài khoản ${user.fullName} sang trạng thái Ngừng hoạt động (INACTIVE). Lịch sử ca làm việc, chấm công và hợp đồng đã được bảo lưu an toàn.`,
    });
  } catch (error: any) {
    console.error("Lỗi khi xóa tài khoản:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi thực hiện thao tác xóa" }, { status: 500 });
  }
}
