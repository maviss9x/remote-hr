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

    // Thực hiện dọn dẹp theo thứ tự khóa ngoại
    await prisma.$transaction([
      prisma.viralPost.deleteMany(),
      prisma.qcReview.deleteMany(),
      prisma.dailyReport.deleteMany(),
      prisma.loginSession.deleteMany(),
      prisma.shiftRegistration.deleteMany(),
      prisma.weeklyEvaluation.deleteMany(),
      prisma.monthlyAcceptance.deleteMany(),
      prisma.notification.deleteMany(),
      prisma.contract.deleteMany(),
      prisma.shiftScheduleConfig.deleteMany(),
      prisma.user.deleteMany({
        where: {
          role: { notIn: ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER", "QC"] },
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
