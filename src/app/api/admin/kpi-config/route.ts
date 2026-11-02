import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { invalidateKpiCache } from "@/lib/kpiCache";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Chỉ Quản trị viên cấp cao nhất (SUPER_ADMIN) mới có quyền truy cập" },
        { status: 403 }
      );
    }

    const currentConfig = await prisma.kpiConfig.findFirst({
      orderBy: [{ effectiveFrom: "desc" }, { id: "desc" }],
    });

    const defaultConfig = {
      fbPerShift: 10,
      threadPerShift: 4,
      commentPerShift: 50,
      minShiftsPerWeek: 5,
      maxAbsentsPerMonth: 3,
      minDaysForSalary: 3,
      lateThresholdMinutes: 60,
      effectiveFrom: new Date(),
    };

    const history = await prisma.kpiConfig.findMany({
      orderBy: [{ effectiveFrom: "desc" }, { id: "desc" }],
      take: 5,
    });

    return NextResponse.json({
      config: currentConfig || defaultConfig,
      history,
    });
  } catch (error: any) {
    console.error("Lỗi API GET /api/admin/kpi-config:", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi lấy cấu hình KPI" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Chỉ Quản trị viên cấp cao nhất (SUPER_ADMIN) mới có quyền cập nhật KPI" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      fbPerShift = 10,
      threadPerShift = 4,
      commentPerShift = 50,
      minShiftsPerWeek = 5,
      maxAbsentsPerMonth = 3,
      minDaysForSalary = 3,
      lateThresholdMinutes = 60,
      effectiveFrom,
    } = body;

    // Validation
    const parsedFb = Math.max(0, parseInt(fbPerShift) || 0);
    const parsedThread = Math.max(0, parseInt(threadPerShift) || 0);
    const parsedComment = Math.max(0, parseInt(commentPerShift) || 0);
    const parsedMinShifts = Math.max(0, parseInt(minShiftsPerWeek) || 0);
    const parsedMaxAbsents = Math.max(0, parseInt(maxAbsentsPerMonth) || 0);
    const parsedMinDays = Math.max(1, parseInt(minDaysForSalary) || 1);
    const parsedLate = Math.max(0, parseInt(lateThresholdMinutes) || 0);

    const effectiveDate = effectiveFrom ? new Date(effectiveFrom) : new Date();

    // Kiểm tra bản ghi cùng ngày hiệu lực
    const startOfDay = new Date(effectiveDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(effectiveDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const existingConfig = await prisma.kpiConfig.findFirst({
      where: {
        effectiveFrom: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { id: "desc" },
    });

    let savedConfig;
    if (existingConfig) {
      savedConfig = await prisma.kpiConfig.update({
        where: { id: existingConfig.id },
        data: {
          fbPerShift: parsedFb,
          threadPerShift: parsedThread,
          commentPerShift: parsedComment,
          minShiftsPerWeek: parsedMinShifts,
          maxAbsentsPerMonth: parsedMaxAbsents,
          minDaysForSalary: parsedMinDays,
          lateThresholdMinutes: parsedLate,
        },
      });
    } else {
      // Đóng hiệu lực của cấu hình liền trước nếu có
      const prevConfig = await prisma.kpiConfig.findFirst({
        where: { effectiveTo: null },
        orderBy: [{ effectiveFrom: "desc" }, { id: "desc" }],
      });
      if (prevConfig && prevConfig.effectiveFrom < effectiveDate) {
        await prisma.kpiConfig.update({
          where: { id: prevConfig.id },
          data: { effectiveTo: effectiveDate },
        });
      }

      savedConfig = await prisma.kpiConfig.create({
        data: {
          fbPerShift: parsedFb,
          threadPerShift: parsedThread,
          commentPerShift: parsedComment,
          minShiftsPerWeek: parsedMinShifts,
          maxAbsentsPerMonth: parsedMaxAbsents,
          minDaysForSalary: parsedMinDays,
          lateThresholdMinutes: parsedLate,
          effectiveFrom: effectiveDate,
        },
      });
    }

    // Xóa ngay toàn bộ KPI in-memory cache để áp dụng tức thì
    invalidateKpiCache();

    return NextResponse.json({
      message: "Cập nhật cấu hình chỉ tiêu KPI thành công!",
      config: savedConfig,
    });
  } catch (error: any) {
    console.error("Lỗi API POST /api/admin/kpi-config:", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi lưu cấu hình KPI" },
      { status: 500 }
    );
  }
}
