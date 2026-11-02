import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER"];
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const paramMonth = searchParams.get("month");
    const paramYear = searchParams.get("year");

    const now = new Date();
    const currentMonth = paramMonth && !isNaN(parseInt(paramMonth))
      ? Math.min(12, Math.max(1, parseInt(paramMonth)))
      : now.getMonth() + 1;
    const currentYear = paramYear && !isNaN(parseInt(paramYear))
      ? parseInt(paramYear)
      : now.getFullYear();

    // Xác định biên thời gian UTC của tháng
    const startOfMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999));

    // 1. Lấy danh sách nhân sự (chỉ cấp nhân sự NHAN_SU_HYBRID, loại bỏ cấp quản lý)
    const users = await prisma.user.findMany({
      where: {
        role: "NHAN_SU_HYBRID",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        role: true,
        status: true,
        startDate: true,
        createdAt: true,
        updatedAt: true,
        avatarUrl: true,
        contracts: {
          orderBy: { endDate: "desc" },
          select: {
            id: true,
            contractType: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        },
      },
    });

    // 2. Lấy dữ liệu ca làm việc trong tháng (chỉ của cấp nhân sự)
    const shiftsInMonth = await prisma.shiftRegistration.findMany({
      where: {
        shiftDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        user: {
          role: "NHAN_SU_HYBRID",
        },
      },
      include: {
        loginSession: {
          select: {
            isLate: true,
            lateMinutes: true,
            autoMarkedAbsent: true,
            loginTime: true,
          },
        },
        dailyReport: {
          select: {
            id: true,
            submittedAt: true,
            qcReview: {
              select: {
                result: true,
              },
            },
          },
        },
      },
    });

    // 3. Phân tích biến động nhân sự: Đầu vào / Đầu ra
    const inputStaff: any[] = [];
    const outputStaff: any[] = [];
    const activeStaffList: any[] = [];

    users.forEach((user) => {
      const uStart = user.startDate ? new Date(user.startDate) : null;
      const latestContract = user.contracts[0] || null;
      const contractStart = latestContract ? new Date(latestContract.startDate) : null;
      const contractEnd = latestContract ? new Date(latestContract.endDate) : null;

      // Xác định Đầu vào (New intake):
      // - Ngày bắt đầu thử việc/đi làm (startDate) nằm trong tháng
      // - HOẶC Hợp đồng mới được ký bắt đầu trong tháng
      const isInputThisMonth =
        (uStart && uStart >= startOfMonth && uStart <= endOfMonth) ||
        (contractStart && contractStart >= startOfMonth && contractStart <= endOfMonth);

      // Xác định Đầu ra (Resigned/Left):
      // - Trạng thái INACTIVE hoặc TERMINATED và ngày cập nhật trong tháng
      // - HOẶC hợp đồng kết thúc trong tháng (contractEnd trong tháng) và trạng thái không còn ACTIVE
      const isStatusInactive = user.status === "INACTIVE" || user.status === "TERMINATED";
      const uUpdated = new Date(user.updatedAt);
      const isOutputThisMonth =
        (isStatusInactive && uUpdated >= startOfMonth && uUpdated <= endOfMonth) ||
        (contractEnd && contractEnd >= startOfMonth && contractEnd <= endOfMonth && (isStatusInactive || latestContract?.status === "EXPIRED" || latestContract?.status === "TERMINATED"));

      const record = {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        role: user.role,
        status: user.status,
        avatarUrl: user.avatarUrl,
        probationStartDate: user.startDate,
        contractStartDate: latestContract?.startDate || null,
        contractEndDate: latestContract?.endDate || null,
        leaveDate: isOutputThisMonth ? (contractEnd || user.updatedAt) : null,
        contractType: latestContract?.contractType || "N/A",
        contractStatus: latestContract?.status || "NONE",
        isInput: isInputThisMonth,
        isOutput: isOutputThisMonth,
      };

      if (isInputThisMonth) {
        inputStaff.push(record);
      }
      if (isOutputThisMonth) {
        outputStaff.push(record);
      }
      if (user.status === "ACTIVE" || user.status === "PROBATION") {
        activeStaffList.push(record);
      }
    });

    // 4. Thống kê Chuyên cần / Ca làm việc theo từng nhân viên
    const userShiftMap = new Map<number, {
      totalRegistered: number;
      attended: number;
      absent: number;
      lateCount: number;
      passQcCount: number;
    }>();

    shiftsInMonth.forEach((shift) => {
      const prev = userShiftMap.get(shift.userId) || {
        totalRegistered: 0,
        attended: 0,
        absent: 0,
        lateCount: 0,
        passQcCount: 0,
      };

      prev.totalRegistered += 1;

      const isAbsent = shift.status === "ABSENT" || !!shift.loginSession?.autoMarkedAbsent;
      const isAttended = !isAbsent && (
        shift.status === "ATTENDED" ||
        shift.status === "APPROVED" ||
        shift.status === "COMPLETED" ||
        !!shift.loginSession ||
        !!shift.dailyReport
      );

      if (isAttended) prev.attended += 1;
      if (isAbsent) prev.absent += 1;
      if (shift.loginSession?.isLate) prev.lateCount += 1;
      if (shift.dailyReport?.qcReview?.result === "PASS") prev.passQcCount += 1;

      userShiftMap.set(shift.userId, prev);
    });

    // Tổng hợp bảng chấm công & chuyên cần theo nhân sự
    const attendanceRecords = users.map((user) => {
      const stats = userShiftMap.get(user.id) || {
        totalRegistered: 0,
        attended: 0,
        absent: 0,
        lateCount: 0,
        passQcCount: 0,
      };

      const attendanceRate = stats.totalRegistered > 0
        ? Math.round((stats.attended / stats.totalRegistered) * 100)
        : 0;

      const latestContract = user.contracts[0] || null;

      return {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        status: user.status,
        avatarUrl: user.avatarUrl,
        probationStartDate: user.startDate,
        contractStartDate: latestContract?.startDate || null,
        contractEndDate: latestContract?.endDate || null,
        totalRegistered: stats.totalRegistered,
        attended: stats.attended,
        absent: stats.absent,
        lateCount: stats.lateCount,
        passQcCount: stats.passQcCount,
        attendanceRate,
        isWorkingInMonth: stats.attended > 0,
        hasNoShift: stats.totalRegistered === 0,
      };
    });

    // 5. Thống kê phân chia theo 4 tuần trong tháng để vẽ biểu đồ
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const weekBuckets = [
      { name: "Tuần 1 (1-7)", start: 1, end: 7, attended: 0, absent: 0, total: 0 },
      { name: "Tuần 2 (8-14)", start: 8, end: 14, attended: 0, absent: 0, total: 0 },
      { name: "Tuần 3 (15-21)", start: 15, end: 21, attended: 0, absent: 0, total: 0 },
      { name: `Tuần 4+ (22-${daysInMonth})`, start: 22, end: daysInMonth, attended: 0, absent: 0, total: 0 },
    ];

    shiftsInMonth.forEach((shift) => {
      const day = new Date(shift.shiftDate).getUTCDate();
      const bucket = weekBuckets.find((b) => day >= b.start && day <= b.end);
      if (bucket) {
        bucket.total += 1;
        const isAbsent = shift.status === "ABSENT" || !!shift.loginSession?.autoMarkedAbsent;
        if (isAbsent) {
          bucket.absent += 1;
        } else {
          bucket.attended += 1;
        }
      }
    });

    // 6. Số liệu tổng quan (Summary KPI)
    const totalWorkingStaffCount = attendanceRecords.filter((r) => r.isWorkingInMonth).length;
    const totalAbsentStaffCount = attendanceRecords.filter((r) => r.absent > 0 || (r.status === "ACTIVE" && r.hasNoShift)).length;
    const totalShiftsCount = shiftsInMonth.length;
    const totalAttendedShifts = shiftsInMonth.filter(
      (s) => s.status !== "ABSENT" && !s.loginSession?.autoMarkedAbsent && (s.loginSession || s.dailyReport || ["ATTENDED", "APPROVED", "COMPLETED"].includes(s.status))
    ).length;
    const totalAbsentShifts = shiftsInMonth.filter(
      (s) => s.status === "ABSENT" || !!s.loginSession?.autoMarkedAbsent
    ).length;

    const overallAttendanceRate = totalShiftsCount > 0
      ? Math.round((totalAttendedShifts / totalShiftsCount) * 100)
      : 0;

    return NextResponse.json({
      month: currentMonth,
      year: currentYear,
      summary: {
        totalStaff: users.length,
        activeStaff: activeStaffList.length,
        inputCount: inputStaff.length,
        outputCount: outputStaff.length,
        workingStaffCount: totalWorkingStaffCount,
        absentStaffCount: totalAbsentStaffCount,
        totalShiftsCount,
        totalAttendedShifts,
        totalAbsentShifts,
        overallAttendanceRate,
      },
      inputStaff,
      outputStaff,
      attendanceRecords,
      weekBuckets,
    });
  } catch (error) {
    console.error("Error generating personnel report:", error);
    return NextResponse.json({ error: "Lỗi hệ thống khi tạo báo cáo nhân sự" }, { status: 500 });
  }
}
