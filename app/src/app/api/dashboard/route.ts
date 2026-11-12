import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isManager } from "@/lib/auth";
import { getISOWeekAndYear, getWeekDateRange } from "@/lib/dateUtils";
import { parseJsonArray } from "@/lib/json-fields";
import { getUsersEffectiveKpiMap, getDefaultKpiConfig } from "@/lib/kpiService";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paramMonth = searchParams.get("month");
    const paramYear = searchParams.get("year");

    const now = new Date();
    const currentMonth = paramMonth && !isNaN(parseInt(paramMonth)) ? Math.min(12, Math.max(1, parseInt(paramMonth))) : now.getMonth() + 1;
    const currentYear = paramYear && !isNaN(parseInt(paramYear)) ? parseInt(paramYear) : now.getFullYear();

    const { weekNumber, year } = getISOWeekAndYear(now);
    const { startDate: weekStart, endDate: weekEnd } = getWeekDateRange(weekNumber, year);

    // Bắt đầu và kết thúc của ngày hôm nay (00:00:00 -> 23:59:59 UTC cho các trường @db.Date)
    const startOfToday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
    const endOfToday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));

    // Bắt đầu và kết thúc của tháng đang xem xét (Chuẩn UTC cho các trường @db.Date như reportDate, shiftDate)
    const startOfMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999));

    const isManagerRole = isManager(session.role) || session.role === "HR";

    // =========================================================================
    // 1. DÀNH CHO NHÂN SỰ HYBRID (CHỈ TRUY VẤN VÀ TRẢ VỀ DỮ LIỆU CỦA TÀI KHOẢN LOGIN)
    // =========================================================================
    if (!isManagerRole) {
      const userId = session.userId;

      // 1.1. Lấy thông tin tài khoản và hợp đồng cá nhân
      const [currentUser, contract] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            fullName: true,
            phone: true,
            role: true,
            status: true,
            startDate: true,
            avatarUrl: true,
          },
        }),
        prisma.contract.findFirst({
          where: { userId, status: "ACTIVE" },
          orderBy: { endDate: "desc" },
          select: {
            id: true,
            contractType: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        }),
      ]);

      // Tính ngày còn lại của hợp đồng
      let contractDaysRemaining: number | null = null;
      let contractIsExpiringSoon = false;
      if (contract?.endDate) {
        const diffMs = new Date(contract.endDate).getTime() - now.getTime();
        contractDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        contractIsExpiringSoon = contractDaysRemaining <= 14;
      }

      // 1.2. Ca làm việc trong tuần hiện tại của riêng nhân sự này
      const myShifts = await prisma.shiftRegistration.findMany({
        where: {
          userId,
          weekNumber,
          year,
        },
        include: {
          dailyReport: {
            select: {
              id: true,
              submittedAt: true,
              fbLinks: true,
              threadLinks: true,
              viralPostLinks: true,
              qcReview: {
                select: {
                  result: true,
                  fbApproved: true,
                  threadApproved: true,
                  commentApproved: true,
                  feedback: true,
                  reviewedAt: true,
                },
              },
            },
          },
          loginSession: {
            select: {
              loginTime: true,
              isLate: true,
              lateMinutes: true,
            },
          },
        },
        orderBy: [{ shiftDate: "asc" }, { shiftType: "asc" }],
      });

      // 1.3. Ca làm việc của ngày hôm nay
      const todayShifts = myShifts.filter((s) => {
        const sDate = new Date(s.shiftDate);
        return (
          sDate.getUTCFullYear() === now.getFullYear() &&
          sDate.getUTCMonth() === now.getMonth() &&
          sDate.getUTCDate() === now.getDate()
        );
      });

      // 1.4. Báo cáo trong tháng hiện tại của nhân sự này (chính xác theo tháng hiện tại)
      const monthlyReports = await prisma.dailyReport.findMany({
        where: {
          userId,
          reportDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        include: {
          qcReview: {
            select: {
              result: true,
              fbApproved: true,
              threadApproved: true,
              commentApproved: true,
              reviewedAt: true,
            },
          },
        },
        orderBy: { reportDate: "desc" },
      });

      const totalSubmitted = monthlyReports.length;
      const passCount = monthlyReports.filter((r) => r.qcReview?.result === "PASS").length;
      const pendingCount = monthlyReports.filter(
        (r) => !r.qcReview || r.qcReview.result === "PENDING"
      ).length;
      const failCount = monthlyReports.filter((r) => r.qcReview?.result === "FAIL").length;

      const totalFbApproved = monthlyReports.reduce(
        (sum, r) => sum + (r.qcReview?.fbApproved || 0),
        0
      );
      const totalThreadApproved = monthlyReports.reduce(
        (sum, r) => sum + (r.qcReview?.threadApproved || 0),
        0
      );
      const totalCommentApproved = monthlyReports.reduce(
        (sum, r) => sum + (r.qcReview?.commentApproved || 0),
        0
      );

      // 1.5. Lịch sử hoạt động gần đây của chính tài khoản (lấy 5 báo cáo gần nhất)
      const recentStaffReports = await prisma.dailyReport.findMany({
        where: { userId },
        take: 5,
        orderBy: { reportDate: "desc" },
        include: {
          qcReview: {
            select: {
              result: true,
              fbApproved: true,
              threadApproved: true,
              commentApproved: true,
              reviewedAt: true,
            },
          },
        },
      });

      const recentActivities: Array<{
        time: string;
        action: string;
        type: "shift" | "report" | "qc" | "contract";
        accent: string;
      }> = [];

      // Gom hoạt động từ báo cáo gần nhất
      for (const r of recentStaffReports) {
        const repDate = new Date(r.reportDate).toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        });

        if (r.qcReview) {
          recentActivities.push({
            time: repDate,
            action:
              r.qcReview.result === "PASS"
                ? `QC đã duyệt ĐẠT ca ngày ${repDate} (${r.qcReview.fbApproved} FB, ${r.qcReview.threadApproved} Threads)`
                : r.qcReview.result === "FAIL"
                ? `QC đánh giá KHÔNG ĐẠT ca ngày ${repDate}`
                : `Báo cáo ca ngày ${repDate} đang chờ QC xét duyệt`,
            type: "qc",
            accent:
              r.qcReview.result === "PASS"
                ? "#10b981"
                : r.qcReview.result === "FAIL"
                ? "#f43f5e"
                : "#f59e0b",
          });
        }

        recentActivities.push({
          time: repDate,
          action: `Bạn đã nộp báo cáo kết quả ca làm việc ngày ${repDate}`,
          type: "report",
          accent: "#38bdf8",
        });
      }

      // Gom hoạt động đăng ký ca tuần này
      if (myShifts.length > 0) {
        recentActivities.push({
          time: `Tuần ${weekNumber}`,
          action: `Đã đăng ký ${myShifts.length} ca làm việc trong tuần`,
          type: "shift",
          accent: "#a855f7",
        });
      }

      return NextResponse.json({
        isManager: false,
        role: session.role,
        user: currentUser,
        contract: contract
          ? {
              ...contract,
              daysRemaining: contractDaysRemaining,
              isExpiringSoon: contractIsExpiringSoon,
            }
          : null,
        stats: {
          shiftsCountThisWeek: myShifts.length,
          shiftsApprovedThisWeek: myShifts.filter((s) => s.status === "APPROVED" || s.status === "COMPLETED").length,
          monthlyReportsSubmitted: totalSubmitted,
          monthlyReportsPass: passCount,
          monthlyReportsPending: pendingCount,
          monthlyReportsFail: failCount,
          totalFbApproved,
          totalThreadApproved,
          totalCommentApproved,
        },
        todayShifts: todayShifts.map((s) => ({
          id: s.id,
          shiftDate: s.shiftDate,
          shiftType: s.shiftType,
          workMode: s.workMode,
          status: s.status,
          hasSubmittedReport: !!s.dailyReport,
          qcResult: s.dailyReport?.qcReview?.result || null,
        })),
        shiftsThisWeekList: myShifts.map((s) => ({
          id: s.id,
          shiftDate: s.shiftDate,
          shiftType: s.shiftType,
          workMode: s.workMode,
          status: s.status,
          hasSubmittedReport: !!s.dailyReport,
        })),
        recentActivities: recentActivities.slice(0, 6),
      });
    }

    // =========================================================================
    // 2. DÀNH CHO CẤP QUẢN LÝ (SUPER_ADMIN, ADMIN, HR, MANAGER, QC)
    // =========================================================================
    const fourteenDaysLater = new Date(now);
    fourteenDaysLater.setDate(now.getDate() + 14);

    // 2.1. Xác định các tuần rơi vào tháng này để tổng hợp WeeklyEvaluation (thưởng Viral)
    const weeksInMonth = new Set<number>();
    const curDay = new Date(startOfMonth);
    while (curDay <= endOfMonth) {
      const iso = getISOWeekAndYear(curDay);
      if (
        iso.year === currentYear ||
        (currentMonth === 1 && iso.year === currentYear - 1) ||
        (currentMonth === 12 && iso.year === currentYear + 1)
      ) {
        weeksInMonth.add(iso.weekNumber);
      }
      curDay.setDate(curDay.getDate() + 1);
    }
    const weekList = Array.from(weeksInMonth);

    const [
      totalStaff,
      activeStaff,
      pendingQcCount,
      expiringContractsCount,
      shiftsThisWeekCount,
      reportsTodayCount,
      todayShiftList,
      recentReports,
      kpiConfig,
      confirmedAcceptances,
      savedWeeklyEvals,
      viralPostsInMonth,
      monthShiftsWithQc,
      currentManagerUser,
    ] = await Promise.all([
      // Tổng số nhân sự Hybrid
      prisma.user.count({
        where: { role: "NHAN_SU_HYBRID" },
      }),
      // Nhân sự Hybrid đang hoạt động
      prisma.user.count({
        where: {
          role: "NHAN_SU_HYBRID",
          status: { in: ["ACTIVE", "PROBATION"] },
        },
      }),
      // Ca chờ QC duyệt trong tháng (Chưa có review hoặc PENDING)
      prisma.dailyReport.count({
        where: {
          reportDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
          OR: [{ qcReview: null }, { qcReview: { result: "PENDING" } }],
        },
      }),
      // Hợp đồng còn hiệu lực nhưng sẽ hết hạn trong vòng 14 ngày tới
      prisma.contract.count({
        where: {
          status: "ACTIVE",
          endDate: {
            gte: now,
            lte: fourteenDaysLater,
          },
        },
      }),
      // Tổng ca đăng ký trong tuần này toàn hệ thống
      prisma.shiftRegistration.count({
        where: {
          weekNumber,
          year,
        },
      }),
      // Báo cáo nộp hôm nay
      prisma.dailyReport.count({
        where: {
          reportDate: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
      }),
      // Danh sách ca hôm nay để thống kê điều phối theo buổi
      prisma.shiftRegistration.findMany({
        where: {
          shiftDate: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
        select: {
          id: true,
          shiftType: true,
          workMode: true,
          status: true,
        },
      }),
      // 6 báo cáo gần nhất của hệ thống
      prisma.dailyReport.findMany({
        take: 6,
        orderBy: { submittedAt: "desc" },
        include: {
          user: {
            select: {
              fullName: true,
              role: true,
            },
          },
          qcReview: {
            select: {
              result: true,
              fbApproved: true,
              threadApproved: true,
            },
          },
        },
      }),
      // Cấu hình KPI hiện hành
      prisma.kpiConfig.findFirst({
        orderBy: [{ effectiveFrom: "desc" }, { id: "desc" }],
      }),
      // Biên bản nghiệm thu tháng đã chốt (nếu có)
      prisma.monthlyAcceptance.findMany({
        where: {
          month: currentMonth,
          year: currentYear,
          status: { in: ["CONFIRMED", "EXPORTED"] },
        },
        select: {
          viralBonus: true,
        },
      }),
      // Đánh giá tuần đã lưu thuộc các tuần trong tháng này
      prisma.weeklyEvaluation.findMany({
        where: {
          year: currentYear,
          weekNumber: { in: weekList },
        },
        select: {
          userId: true,
          weekNumber: true,
          viralBonus: true,
        },
      }),
      // Các bài viral được nộp trong tháng này (tính dự kiến theo tier)
      prisma.viralPost.findMany({
        where: {
          dailyReport: {
            reportDate: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
        },
        select: {
          userId: true,
          bonusAmount: true,
          dailyReport: {
            select: {
              shiftRegistration: {
                select: {
                  weekNumber: true,
                  year: true,
                },
              },
            },
          },
        },
      }),
      // Ca làm việc trong tháng đã có QC duyệt
      prisma.shiftRegistration.findMany({
        where: {
          shiftDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
          dailyReport: {
            qcReview: { isNot: null },
          },
        },
        include: {
          dailyReport: {
            include: { qcReview: true },
          },
        },
      }),
      // Thông tin tài khoản người dùng hiện tại
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { fullName: true, role: true },
      }),
    ]);

    // 2.2. Tính toán Thưởng Viral tháng (Phương án A: Chốt chính thức + Tự động dự kiến theo ca)
    let totalViralBonus = 0;
    if (confirmedAcceptances.length > 0) {
      totalViralBonus = confirmedAcceptances.reduce((sum, a) => sum + (a.viralBonus || 0), 0);
    } else {
      const evaluatedUserWeeks = new Set(
        savedWeeklyEvals.map((e) => `${e.userId}_${e.weekNumber}`)
      );
      totalViralBonus = savedWeeklyEvals.reduce((sum, e) => sum + (e.viralBonus || 0), 0);

      for (const p of viralPostsInMonth) {
        const w = p.dailyReport?.shiftRegistration?.weekNumber;
        if (w && !evaluatedUserWeeks.has(`${p.userId}_${w}`)) {
          totalViralBonus += p.bonusAmount || 0;
        }
      }
    }

    // 2.3. Tính toán KPI trung bình (Phương án A: Tự động tính realtime từ kết quả QC duyệt)
    const activeKpiConfig = kpiConfig || {
      fbPerShift: 10,
      threadPerShift: 4,
      commentPerShift: 50,
      minShiftsPerWeek: 5,
    };

    let shiftsForKpi = monthShiftsWithQc;
    // Nếu trong tháng chưa có ca duyệt (ví dụ đầu tháng mới), fallback sang tuần có dữ liệu gần nhất
    if (shiftsForKpi.length === 0) {
      const latestShift = await prisma.shiftRegistration.findFirst({
        where: { dailyReport: { qcReview: { isNot: null } } },
        orderBy: [{ year: "desc" }, { weekNumber: "desc" }],
        select: { weekNumber: true, year: true },
      });
      if (latestShift) {
        shiftsForKpi = await prisma.shiftRegistration.findMany({
          where: {
            weekNumber: latestShift.weekNumber,
            year: latestShift.year,
            dailyReport: { qcReview: { isNot: null } },
          },
          include: {
            dailyReport: {
              include: { qcReview: true },
            },
          },
        });
      }
    }

    const userShiftMap = new Map<number, typeof shiftsForKpi>();
    for (const s of shiftsForKpi) {
      const list = userShiftMap.get(s.userId) || [];
      list.push(s);
      userShiftMap.set(s.userId, list);
    }

    const userKpiMap = await getUsersEffectiveKpiMap(Array.from(userShiftMap.keys()), now);

    let totalCompletionRate = 0;
    let evaluatedPersonnelCount = 0;

    for (const [userId, userShifts] of userShiftMap.entries()) {
      let fbApproved = 0;
      let threadApproved = 0;
      let commentApproved = 0;

      for (const s of userShifts) {
        const rev = s.dailyReport?.qcReview;
        if (rev) {
          fbApproved += rev.fbApproved || 0;
          threadApproved += rev.threadApproved || 0;
          commentApproved += rev.commentApproved || 0;
        }
      }

      const userKpi = userKpiMap.get(userId) || activeKpiConfig;
      const shiftCount = userShifts.length;
      const targetFb = shiftCount * userKpi.fbPerShift;
      const targetThread = shiftCount * userKpi.threadPerShift;
      const targetComment = shiftCount * userKpi.commentPerShift;

      const fbRate = targetFb > 0 ? (fbApproved / targetFb) * 100 : 0;
      const threadRate = targetThread > 0 ? (threadApproved / targetThread) * 100 : 0;
      const commentRate = targetComment > 0 ? (commentApproved / targetComment) * 100 : 0;
      const overallRate = (fbRate + threadRate + commentRate) / 3;

      totalCompletionRate += overallRate;
      evaluatedPersonnelCount++;
    }

    const avgKpiRate =
      evaluatedPersonnelCount > 0
        ? Math.round((totalCompletionRate / evaluatedPersonnelCount) * 10) / 10
        : 0;

    // Thống kê ca hôm nay theo ca
    const morningCount = todayShiftList.filter((s) => s.shiftType === "MORNING").length;
    const afternoonCount = todayShiftList.filter((s) => s.shiftType === "AFTERNOON").length;
    const eveningCount = todayShiftList.filter((s) => s.shiftType === "EVENING").length;

    // Nhật ký hoạt động hệ thống
    const managerActivities = recentReports.map((r) => {
      const timeStr = new Date(r.submittedAt).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return {
        time: timeStr,
        user: r.user.fullName,
        action: `Đã nộp báo cáo ca (FB: ${parseJsonArray(r.fbLinks).length}, Threads: ${parseJsonArray(r.threadLinks).length})`,
        role: "Nhân sự Remote",
        type: "report",
        accent: "#38bdf8",
      };
    });

    return NextResponse.json({
      isManager: true,
      role: session.role,
      month: currentMonth,
      year: currentYear,
      user: {
        id: session.userId,
        fullName: currentManagerUser?.fullName || session.fullName,
        role: currentManagerUser?.role || session.role,
      },
      stats: {
        totalStaff,
        activeStaff,
        pendingReviews: pendingQcCount,
        expiringContracts: expiringContractsCount,
        shiftsThisWeek: shiftsThisWeekCount,
        totalReportsToday: reportsTodayCount,
        avgKpiRate,
        totalViralBonus,
      },
      shiftDistributionToday: {
        morning: morningCount,
        afternoon: afternoonCount,
        evening: eveningCount,
        total: todayShiftList.length,
      },
      recentActivities: managerActivities,
    });
  } catch (error: any) {
    console.error("Lỗi khi tải dữ liệu Dashboard:", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi tải dữ liệu Dashboard" },
      { status: 500 }
    );
  }
}
