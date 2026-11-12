import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin, hasAnyRole } from "@/lib/auth";
import { invalidateKpiCache } from "@/lib/kpiCache";
import { getDefaultKpiConfig, getUsersEffectiveKpiMap } from "@/lib/kpiService";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || (!isAdmin(session.role) && !hasAnyRole(session.role, ["KPI"]))) {
      return NextResponse.json(
        { error: "Bạn không có quyền truy cập cấu hình KPI nhân sự" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim().toLowerCase() || "";

    // 1. Lấy danh sách toàn bộ nhân sự Hybrid
    const users = await prisma.user.findMany({
      where: {
        role: "NHAN_SU_HYBRID",
        status: { in: ["ACTIVE", "PROBATION"] },
        ...(search
          ? {
              OR: [
                { fullName: { contains: search } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        status: true,
        startDate: true,
        avatarUrl: true,
      },
      orderBy: { fullName: "asc" },
    });

    const userIds = users.map((u) => u.id);

    // 2. Lấy cấu hình mặc định toàn hệ thống & Map KPI hiệu lực của từng nhân sự
    const now = new Date();
    const defaultKpi = await getDefaultKpiConfig(now);
    const kpiMap = await getUsersEffectiveKpiMap(userIds, now);

    // 3. Kết hợp dữ liệu
    const list = users.map((u) => {
      const kpi = kpiMap.get(u.id) || {
        fbPerShift: defaultKpi.fbPerShift,
        threadPerShift: defaultKpi.threadPerShift,
        commentPerShift: defaultKpi.commentPerShift,
        minShiftsPerWeek: defaultKpi.minShiftsPerWeek,
        isCustom: false,
        note: null,
      };

      return {
        user: u,
        kpi,
      };
    });

    return NextResponse.json({
      defaultKpi,
      users: list,
    });
  } catch (error: any) {
    console.error("Lỗi API GET /api/admin/user-kpi:", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi lấy danh sách KPI nhân sự" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (!isAdmin(session.role) && !hasAnyRole(session.role, ["KPI"]))) {
      return NextResponse.json(
        { error: "Bạn không có quyền cấu hình KPI nhân sự" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      userId,
      fbPerShift,
      threadPerShift,
      commentPerShift,
      minShiftsPerWeek,
      note,
      effectiveFrom,
      resetToDefault,
    } = body;

    const parsedUserId = parseInt(userId);
    if (!parsedUserId || isNaN(parsedUserId)) {
      return NextResponse.json({ error: "Thiếu mã nhân sự (userId) hợp lệ" }, { status: 400 });
    }

    // Nếu chọn Đặt lại về mặc định (reset to default)
    if (resetToDefault) {
      await prisma.userKpiConfig.deleteMany({
        where: { userId: parsedUserId },
      });
      invalidateKpiCache();
      return NextResponse.json({
        success: true,
        message: "Đã hủy bỏ KPI riêng, nhân sự sẽ áp dụng theo KPI mặc định toàn hệ thống",
      });
    }

    // Validate các chỉ số
    const parsedFb = fbPerShift !== undefined && fbPerShift !== null && fbPerShift !== "" ? Math.max(0, parseInt(fbPerShift) || 0) : null;
    const parsedThread = threadPerShift !== undefined && threadPerShift !== null && threadPerShift !== "" ? Math.max(0, parseInt(threadPerShift) || 0) : null;
    const parsedComment = commentPerShift !== undefined && commentPerShift !== null && commentPerShift !== "" ? Math.max(0, parseInt(commentPerShift) || 0) : null;
    const parsedMinShifts = minShiftsPerWeek !== undefined && minShiftsPerWeek !== null && minShiftsPerWeek !== "" ? Math.max(0, parseInt(minShiftsPerWeek) || 0) : null;

    const effectiveDate = effectiveFrom ? new Date(effectiveFrom) : new Date();

    // Tìm bản ghi hiện tại của nhân sự
    const existing = await prisma.userKpiConfig.findFirst({
      where: {
        userId: parsedUserId,
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveDate } }],
      },
      orderBy: { id: "desc" },
    });

    let savedConfig;
    if (existing) {
      savedConfig = await prisma.userKpiConfig.update({
        where: { id: existing.id },
        data: {
          fbPerShift: parsedFb,
          threadPerShift: parsedThread,
          commentPerShift: parsedComment,
          minShiftsPerWeek: parsedMinShifts,
          note: note !== undefined ? note : existing.note,
          effectiveFrom: effectiveDate,
        },
      });
    } else {
      savedConfig = await prisma.userKpiConfig.create({
        data: {
          userId: parsedUserId,
          fbPerShift: parsedFb,
          threadPerShift: parsedThread,
          commentPerShift: parsedComment,
          minShiftsPerWeek: parsedMinShifts,
          note: note || null,
          effectiveFrom: effectiveDate,
        },
      });
    }

    // Xóa cache tính toán KPI để cập nhật ngay lập tức trên dashboard & báo cáo
    invalidateKpiCache();

    return NextResponse.json({
      success: true,
      config: savedConfig,
      message: "Cập nhật KPI cho nhân sự thành công!",
    });
  } catch (error: any) {
    console.error("Lỗi API POST /api/admin/user-kpi:", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi lưu cấu hình KPI cho nhân sự" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || (!isAdmin(session.role) && !hasAnyRole(session.role, ["KPI"]))) {
      return NextResponse.json(
        { error: "Bạn không có quyền xóa cấu hình KPI nhân sự" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get("userId") || "");

    if (!userId || isNaN(userId)) {
      return NextResponse.json({ error: "Thiếu mã nhân sự (userId)" }, { status: 400 });
    }

    await prisma.userKpiConfig.deleteMany({
      where: { userId },
    });

    invalidateKpiCache();

    return NextResponse.json({
      success: true,
      message: "Đã xóa chỉ tiêu riêng, nhân sự quay về áp dụng KPI mặc định",
    });
  } catch (error: any) {
    console.error("Lỗi API DELETE /api/admin/user-kpi:", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi xóa cấu hình KPI nhân sự" },
      { status: 500 }
    );
  }
}

