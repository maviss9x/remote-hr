import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isManager } from "@/lib/auth";
import { getISOWeekAndYear, getWeekDateRange } from "@/lib/dateUtils";
import { getKpiCache, setKpiCache } from "@/lib/kpiCache";
import { parseJsonArray } from "@/lib/json-fields";
import { getUsersEffectiveKpiMap, getDefaultKpiConfig } from "@/lib/kpiService";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const currentISO = getISOWeekAndYear(now);

    const weekNumber = parseInt(searchParams.get("week") || String(currentISO.weekNumber));
    const year = parseInt(searchParams.get("year") || String(currentISO.year));
    const requestedUserId = searchParams.get("userId") ? parseInt(searchParams.get("userId")!) : null;

    // RBAC: Nhân sự thường chỉ xem được chính mình
    const isStaff = session.role === "NHAN_SU_HYBRID";
    const targetUserId = isStaff ? session.userId : requestedUserId;

    // Cache key: chỉ cache view chung của Manager nếu không có filter user cụ thể
    const cacheKey = `kpi_w${weekNumber}_y${year}_u${targetUserId || "all"}`;
    const cachedData = getKpiCache(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    const weekRange = getWeekDateRange(weekNumber, year);

    // 1. Lấy cấu hình KPI mặc định toàn hệ thống
    const defaultKpi = await getDefaultKpiConfig(weekRange.endDate);

    // 2. Xác định tuần trước để so sánh tăng trưởng
    let prevWeekNumber = weekNumber - 1;
    let prevYear = year;
    if (prevWeekNumber < 1) {
      prevYear -= 1;
      prevWeekNumber = 52;
    }

    // 3. Lấy danh sách nhân sự cần tính
    const userWhere: any = {
      role: "NHAN_SU_HYBRID",
      status: { in: ["ACTIVE", "PROBATION"] },
    };
    if (targetUserId) {
      userWhere.id = targetUserId;
    }

    const users = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        fullName: true,
        phone: true,
        role: true,
        status: true,
        avatarUrl: true,
        startDate: true,
      },
      orderBy: { fullName: "asc" },
    });

    const userIds = users.map((u) => u.id);

    // 4. Query song song ca tuần này, tuần trước, các đánh giá đã lưu và cấu hình KPI hiệu lực của từng nhân sự
    const [currentShifts, prevShifts, currentEvaluations, prevEvaluations, userKpiMap] = await Promise.all([
      // Ca tuần này
      prisma.shiftRegistration.findMany({
        where: {
          userId: { in: userIds },
          weekNumber,
          year,
        },
        include: {
          dailyReport: {
            include: {
              qcReview: true,
            },
          },
        },
      }),
      // Ca tuần trước để tính tăng trưởng
      prisma.shiftRegistration.findMany({
        where: {
          userId: { in: userIds },
          weekNumber: prevWeekNumber,
          year: prevYear,
        },
        include: {
          dailyReport: {
            include: {
              qcReview: true,
            },
          },
        },
      }),
      // Bảng đánh giá đã lưu tuần này
      prisma.weeklyEvaluation.findMany({
        where: {
          userId: { in: userIds },
          weekNumber,
          year,
        },
      }),
      // Bảng đánh giá tuần trước
      prisma.weeklyEvaluation.findMany({
        where: {
          userId: { in: userIds },
          weekNumber: prevWeekNumber,
          year: prevYear,
        },
      }),
      // Cấu hình KPI hiệu lực của từng nhân sự
      getUsersEffectiveKpiMap(userIds, weekRange.endDate),
    ]);

    // Map evaluation theo userId
    const currentEvalMap = new Map(currentEvaluations.map((e) => [e.userId, e]));
    const prevEvalMap = new Map(prevEvaluations.map((e) => [e.userId, e]));

    // Nhóm ca làm việc theo userId
    const currentShiftsByUser = new Map<number, typeof currentShifts>();
    for (const shift of currentShifts) {
      const list = currentShiftsByUser.get(shift.userId) || [];
      list.push(shift);
      currentShiftsByUser.set(shift.userId, list);
    }

    const prevShiftsByUser = new Map<number, typeof prevShifts>();
    for (const shift of prevShifts) {
      const list = prevShiftsByUser.get(shift.userId) || [];
      list.push(shift);
      prevShiftsByUser.set(shift.userId, list);
    }

    // 5. Tính toán KPI cho từng nhân sự
    const personnelKpi = users.map((user) => {
      const userShifts = currentShiftsByUser.get(user.id) || [];
      const userPrevShifts = prevShiftsByUser.get(user.id) || [];
      const savedEval = currentEvalMap.get(user.id);
      const prevSavedEval = prevEvalMap.get(user.id);

      const totalShifts = userShifts.length;
      let totalShiftsPassed = 0;
      let fbActual = 0;
      let threadActual = 0;
      let commentActual = 0;
      const reportedViralLinks: string[] = [];

      for (const s of userShifts) {
        const report = s.dailyReport;
        if (report) {
          const viralLinks = parseJsonArray<string>(report.viralPostLinks);
          if (viralLinks.length > 0) {
            reportedViralLinks.push(...viralLinks.map((l) => l.trim()).filter((l) => l.length > 0));
          }
          if (report.qcReview) {
            if (report.qcReview.result === "PASS") {
              totalShiftsPassed++;
            }
            fbActual += report.qcReview.fbApproved || 0;
            threadActual += report.qcReview.threadApproved || 0;
            commentActual += report.qcReview.commentApproved || 0;
          }
        }
      }

      // Cấu hình KPI áp dụng riêng cho nhân sự này
      const userKpi = userKpiMap.get(user.id) || {
        fbPerShift: defaultKpi.fbPerShift,
        threadPerShift: defaultKpi.threadPerShift,
        commentPerShift: defaultKpi.commentPerShift,
        minShiftsPerWeek: defaultKpi.minShiftsPerWeek,
        isCustom: false,
        note: null,
      };

      // Chỉ tiêu tuần
      const shiftTarget = Math.max(totalShifts, userKpi.minShiftsPerWeek);
      const targetFb = shiftTarget * userKpi.fbPerShift;
      const targetThread = shiftTarget * userKpi.threadPerShift;
      const targetComment = shiftTarget * userKpi.commentPerShift;

      // Tỷ lệ hoàn thành %
      const fbCompletionRate = targetFb > 0 ? Math.round((fbActual / targetFb) * 1000) / 10 : 0;
      const threadCompletionRate = targetThread > 0 ? Math.round((threadActual / targetThread) * 1000) / 10 : 0;
      const commentCompletionRate = targetComment > 0 ? Math.round((commentActual / targetComment) * 1000) / 10 : 0;
      const overallCompletionRate = Math.round(((fbCompletionRate + threadCompletionRate + commentCompletionRate) / 3) * 10) / 10;

      // Tính sản lượng tuần trước
      let prevFbActual = 0;
      let prevThreadActual = 0;
      let prevCommentActual = 0;

      if (prevSavedEval) {
        prevFbActual = prevSavedEval.fbActual;
        prevThreadActual = prevSavedEval.threadActual;
        prevCommentActual = prevSavedEval.commentActual;
      } else {
        for (const ps of userPrevShifts) {
          if (ps.dailyReport?.qcReview) {
            prevFbActual += ps.dailyReport.qcReview.fbApproved || 0;
            prevThreadActual += ps.dailyReport.qcReview.threadApproved || 0;
            prevCommentActual += ps.dailyReport.qcReview.commentApproved || 0;
          }
        }
      }

      // Tốc độ tăng trưởng so với tuần trước (%)
      const calcGrowth = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 1000) / 10;
      };

      const fbGrowth = calcGrowth(fbActual, prevFbActual);
      const threadGrowth = calcGrowth(threadActual, prevThreadActual);
      const commentGrowth = calcGrowth(commentActual, prevCommentActual);
      const prevTotalPosts = prevFbActual + prevThreadActual;
      const currentTotalPosts = fbActual + threadActual;
      const overallGrowth = calcGrowth(currentTotalPosts, prevTotalPosts);

      // Xếp hạng đề xuất tự động dựa trên mức độ hoàn thành nếu chưa được Manager chấm
      let suggestedRating: "EXCELLENT" | "GOOD" | "FAIR" | "NEEDS_IMPROVEMENT" | "POOR" = "GOOD";
      if (overallCompletionRate >= 100 && totalShiftsPassed >= userKpi.minShiftsPerWeek) {
        suggestedRating = "EXCELLENT";
      } else if (overallCompletionRate >= 85) {
        suggestedRating = "GOOD";
      } else if (overallCompletionRate >= 70) {
        suggestedRating = "FAIR";
      } else if (overallCompletionRate >= 50) {
        suggestedRating = "NEEDS_IMPROVEMENT";
      } else {
        suggestedRating = "POOR";
      }

      return {
        user,
        kpi: {
          weekNumber,
          year,
          totalShifts,
          totalShiftsPassed,
          minRequiredShifts: userKpi.minShiftsPerWeek,
          targetsPerShift: {
            facebook: userKpi.fbPerShift,
            threads: userKpi.threadPerShift,
            comments: userKpi.commentPerShift,
          },
          isCustom: userKpi.isCustom,
          targets: {
            facebook: targetFb,
            threads: targetThread,
            comments: targetComment,
          },
          actual: {
            facebook: fbActual,
            threads: threadActual,
            comments: commentActual,
          },
          completionRates: {
            facebook: fbCompletionRate,
            threads: threadCompletionRate,
            comments: commentCompletionRate,
            overall: overallCompletionRate,
          },
          growth: {
            facebook: fbGrowth,
            threads: threadGrowth,
            comments: commentGrowth,
            overall: overallGrowth,
          },
        },
        evaluation: savedEval
          ? {
              id: savedEval.id,
              isSaved: true,
              overallRating: savedEval.overallRating,
              fbQualityReview: savedEval.fbQualityReview,
              threadQualityReview: savedEval.threadQualityReview,
              commentQualityReview: savedEval.commentQualityReview,
              postCareReview: savedEval.postCareReview,
              viralBonus: savedEval.viralBonus,
              viralLinks: parseJsonArray<string>(savedEval.viralLinks),
              badLinks: parseJsonArray<string>(savedEval.badLinks),
              updatedAt: savedEval.updatedAt,
            }
          : {
              id: null,
              isSaved: false,
              overallRating: suggestedRating,
              fbQualityReview: null,
              threadQualityReview: null,
              commentQualityReview: null,
              postCareReview: null,
              viralBonus: 0,
              viralLinks: Array.from(new Set(reportedViralLinks)),
              badLinks: [],
              updatedAt: null,
            },
      };
    });

    // 6. Tổng quan đội ngũ (Summary)
    const totalShiftsAll = personnelKpi.reduce((acc, item) => acc + item.kpi.totalShifts, 0);
    const totalPassedShiftsAll = personnelKpi.reduce((acc, item) => acc + item.kpi.totalShiftsPassed, 0);
    const totalFbAll = personnelKpi.reduce((acc, item) => acc + item.kpi.actual.facebook, 0);
    const totalThreadAll = personnelKpi.reduce((acc, item) => acc + item.kpi.actual.threads, 0);
    const totalCommentAll = personnelKpi.reduce((acc, item) => acc + item.kpi.actual.comments, 0);
    const totalViralBonusAll = personnelKpi.reduce((acc, item) => acc + (item.evaluation.viralBonus || 0), 0);
    const evaluatedCount = personnelKpi.filter((item) => item.evaluation.isSaved).length;

    const avgCompletionRate =
      personnelKpi.length > 0
        ? Math.round(
            (personnelKpi.reduce((acc, item) => acc + item.kpi.completionRates.overall, 0) / personnelKpi.length) * 10
          ) / 10
        : 0;

    const responseData = {
      week: weekNumber,
      year,
      summary: {
        totalPersonnel: personnelKpi.length,
        totalShifts: totalShiftsAll,
        totalPassedShifts: totalPassedShiftsAll,
        shiftPassRate: totalShiftsAll > 0 ? Math.round((totalPassedShiftsAll / totalShiftsAll) * 1000) / 10 : 0,
        totalFacebook: totalFbAll,
        totalThreads: totalThreadAll,
        totalComments: totalCommentAll,
        avgCompletionRate,
        totalViralBonus: totalViralBonusAll,
        evaluatedCount,
      },
      kpiConfig: defaultKpi,
      personnel: personnelKpi,
    };

    // Lưu vào cache 45 giây
    setKpiCache(cacheKey, responseData, 45);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Lỗi lấy dữ liệu KPI:", error);
    return NextResponse.json({ error: "Lỗi nội bộ khi tính toán KPI" }, { status: 500 });
  }
}
