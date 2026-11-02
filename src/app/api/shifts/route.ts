import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isManager } from "@/lib/auth";
import { parseJsonArray, stringifyJsonArray, parseJsonObject } from "@/lib/json-fields";
import { getISOWeekAndYear, getWeekRange } from "@/lib/dateUtils";
import { checkAndAutoApproveWeekShifts, getShiftRules } from "@/lib/shiftAutoApproval";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const currentIso = getISOWeekAndYear(now);

    const weekNumber = parseInt(searchParams.get("weekNumber") || searchParams.get("week") || String(currentIso.weekNumber));
    const year = parseInt(searchParams.get("year") || String(currentIso.year));

    // 1. Tự động kiểm tra và duyệt toàn bộ ca nếu đã kết thúc thời gian đăng ký (giờ khóa form lấy từ shift_rules)
    const autoApprovalResult = await checkAndAutoApproveWeekShifts(weekNumber, year);

    // 2. Lấy cấu hình đăng ký tuần đã được cập nhật/đồng bộ
    const config = await prisma.shiftScheduleConfig.findUnique({
      where: {
        weekNumber_year: { weekNumber, year },
      },
    });

    const { monday, sunday } = getWeekRange(weekNumber, year);

    // Tuần được coi là khóa nếu: Đã duyệt toàn đội, hoặc cờ isLocked bật, hoặc đã qua hạn đóng đăng ký
    const isWeekLocked = Boolean(
      autoApprovalResult.isLocked ||
      config?.approvedAt ||
      config?.isLocked ||
      (config?.registrationCloseAt && now > config.registrationCloseAt)
    );

    // Lấy cấu hình quy chế ca từ CSDL (để lấy maxUsersPerShift)
    const shiftRulesSetting = await prisma.systemSetting.findUnique({
      where: { key: "shift_rules" },
    });
    const shiftRules = parseJsonObject<{ maxUsersPerShift?: number }>(shiftRulesSetting?.value, {});
    const maxUsersPerShift = Number(shiftRules.maxUsersPerShift) || 10;

    // Lấy danh sách toàn bộ ca trong tuần để tính occupancy (số người đã đăng ký mỗi ca)
    const weekShiftsForOccupancy = await prisma.shiftRegistration.findMany({
      where: {
        weekNumber,
        year,
        status: { in: ["REGISTERED", "APPROVED", "COMPLETED"] },
      },
      select: {
        shiftDate: true,
        shiftType: true,
        userId: true,
      },
    });

    const shiftOccupancy: Record<string, number> = {};
    for (const s of weekShiftsForOccupancy) {
      const dateStr = s.shiftDate.toISOString().slice(0, 10);
      const key = `${dateStr}_${s.shiftType}`;
      shiftOccupancy[key] = (shiftOccupancy[key] || 0) + 1;
    }

    // Xác định xem user có quyền Manager hay không
    const userIsManager = isManager(session.role) || session.role === "HR";

    // Truy vấn ca làm việc
    if (userIsManager) {
      // Manager: Lấy tất cả ca của tất cả nhân sự đang hoạt động
      const [allShifts, activeUsers] = await Promise.all([
        prisma.shiftRegistration.findMany({
          where: {
            weekNumber,
            year,
          },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                phone: true,
                role: true,
                status: true,
              },
            },
          },
          orderBy: [{ shiftDate: "asc" }, { shiftType: "asc" }],
        }),
        prisma.user.findMany({
          where: {
            status: { in: ["ACTIVE", "PROBATION"] },
            role: "NHAN_SU_HYBRID",
          },
          select: {
            id: true,
            fullName: true,
            phone: true,
            role: true,
            status: true,
          },
          orderBy: { fullName: "asc" },
        }),
      ]);

      const pendingCount = allShifts.filter((s) => s.status === "REGISTERED").length;
      const approvedCount = allShifts.filter((s) => s.status === "APPROVED").length;

      // Đếm số lượng nhân sự duy nhất đang có ca chờ duyệt
      const pendingUserIds = new Set(
        allShifts.filter((s) => s.status === "REGISTERED").map((s) => s.userId)
      );
      const pendingUsersCount = pendingUserIds.size;

      return NextResponse.json({
        weekNumber,
        year,
        weekStartDate: monday.toISOString(),
        weekEndDate: sunday.toISOString(),
        config: {
          ...config,
          isWeekLocked,
          pendingCount,
          pendingUsersCount,
          approvedCount,
          totalShiftsCount: allShifts.length,
          maxUsersPerShift,
          shiftOccupancy,
          formattedCloseVN: autoApprovalResult.formattedCloseVN,
          autoApproved: autoApprovalResult.autoApproved,
        },
        isManager: true,
        shifts: allShifts,
        users: activeUsers,
      });
    } else {
      // Nhân sự: Chỉ lấy ca của chính mình
      const myShifts = await prisma.shiftRegistration.findMany({
        where: {
          userId: session.userId,
          weekNumber,
          year,
        },
        orderBy: [{ shiftDate: "asc" }, { shiftType: "asc" }],
      });

      // Kiểm tra xem nhân sự có được mở quyền nộp bổ sung/sửa ca không
      const reopenedList = parseJsonArray<number>(config?.reopenedUserIds);
      const isReopenedUser = Boolean(
        reopenedList.includes(session.userId) ||
        myShifts.some((s) => s.reopenedBy !== null)
      );

      const myTotalShifts = myShifts.length;
      const myPendingCount = myShifts.filter((s) => s.status === "REGISTERED").length;
      const myApprovedCount = myShifts.filter((s) => s.status === "APPROVED").length;

      let personalStatus: "NOT_REGISTERED" | "PENDING_APPROVAL" | "APPROVED" = "NOT_REGISTERED";
      if (myTotalShifts > 0) {
        if (myPendingCount > 0) {
          personalStatus = "PENDING_APPROVAL";
        } else if (myApprovedCount > 0) {
          personalStatus = "APPROVED";
        }
      }

      return NextResponse.json({
        weekNumber,
        year,
        weekStartDate: monday.toISOString(),
        weekEndDate: sunday.toISOString(),
        config: {
          ...config,
          reopenedUserIds: reopenedList,
          isWeekLocked,
          isReopenedUser,
          isLockedForUser: isWeekLocked && !isReopenedUser,
          personalStatus,
          personalStats: {
            total: myTotalShifts,
            pending: myPendingCount,
            approved: myApprovedCount,
          },
          maxUsersPerShift,
          shiftOccupancy,
          formattedCloseVN: autoApprovalResult.formattedCloseVN,
          autoApproved: autoApprovalResult.autoApproved,
        },
        isManager: false,
        shifts: myShifts,
      });
    }
  } catch (error: any) {
    console.error("Lỗi khi tải dữ liệu ca làm việc:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi tải ca làm việc" }, { status: 500 });
  }
}
