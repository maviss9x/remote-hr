import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Chỉ Super Admin mới có quyền thực hiện thao tác xóa dữ liệu này." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { confirmationText } = body;

    if (confirmationText !== "XAC NHAN XOA") {
      return NextResponse.json(
        { error: "INVALID_CONFIRMATION", message: 'Vui lòng nhập chính xác cụm từ "XAC NHAN XOA" để xác nhận.' },
        { status: 400 }
      );
    }

    // 1. Phân loại tài khoản để bảo toàn tuyệt đối cấp Quản trị viên & Quản lý:
    // Tuyệt đối không bao giờ xóa bất kỳ ai mang bất kỳ vai trò quản lý nào
    // (kể cả khi vai trò là chuỗi ghép như "SUPER_ADMIN,ADMIN", "ADMIN,HR", "MANAGER,QC", v.v.)
    // và không bao giờ xóa tài khoản đang thực hiện thao tác.
    const MANAGEMENT_ROLES = [
      "SUPER_ADMIN",
      "ADMIN",
      "HR",
      "MANAGER",
      "QC",
      "KPI",
      "SHIFTS",
      "VIRAL",
      "POST_TAGS",
    ];

    const allUsers = await prisma.user.findMany({
      select: { id: true, role: true, fullName: true },
    });

    const preservedUserIds = new Set<number>();
    preservedUserIds.add(currentUser.userId);

    for (const u of allUsers) {
      const userRoles = (u.role || "").split(",").map((r) => r.trim());
      if (userRoles.some((r) => MANAGEMENT_ROLES.includes(r))) {
        preservedUserIds.add(u.id);
      }
    }

    const preservedList = Array.from(preservedUserIds);

    // 2. Thực hiện dọn dẹp theo thứ tự khóa ngoại an toàn
    await prisma.$transaction([
      prisma.viralPost.deleteMany(),
      prisma.qcReview.deleteMany(),
      prisma.dailyReport.deleteMany(),
      prisma.loginSession.deleteMany(),
      prisma.shiftRegistration.deleteMany(),
      prisma.weeklyEvaluation.deleteMany(),
      prisma.monthlyAcceptance.deleteMany(),
      prisma.notification.deleteMany({
        where: { userId: { notIn: preservedList } },
      }),
      prisma.contract.deleteMany({
        where: { userId: { notIn: preservedList } },
      }),
      prisma.shiftScheduleConfig.deleteMany(),
      // Chỉ xóa tài khoản nhân sự thường, bảo toàn 100% tài khoản quản lý
      prisma.user.deleteMany({
        where: {
          id: { notIn: preservedList },
        },
      }),
    ]);

    // Lấy danh sách tài khoản quản lý còn lại
    const remainingManagers = await prisma.user.findMany({
      select: { id: true, fullName: true, phone: true, role: true, status: true },
      orderBy: { id: "asc" },
    });

    return NextResponse.json({
      success: true,
      message: "Đã dọn sạch toàn bộ dữ liệu nghiệp vụ và tài khoản nhân sự thường. Bảo toàn tài khoản quản lý & cấu hình hệ thống.",
      remainingManagers,
    });
  } catch (err: any) {
    console.error("Lỗi khi reset dữ liệu:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: `Không thể dọn dẹp dữ liệu: ${err.message || String(err)}` },
      { status: 500 }
    );
  }
}
