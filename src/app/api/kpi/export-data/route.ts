import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getISOWeekAndYear, getWeekDateRange } from "@/lib/dateUtils";
import { parseJsonArray } from "@/lib/json-fields";
import { getUsersEffectiveKpiMap, getDefaultKpiConfig } from "@/lib/kpiService";

export interface KpiExportPersonnel {
  user: {
    id: number;
    fullName: string;
    phone: string;
    role: string;
    status: string;
    driveFolderUrl?: string | null;
  };
  totalShifts: number;
  kpiTargets: {
    facebook: number;
    threads: number;
    comments: number;
  };
  targetsPerShift?: {
    facebook: number;
    threads: number;
    comments: number;
  };
  isCustomKpi?: boolean;
  actual: {
    facebook: number;
    threads: number;
    comments: number;
  };
  growth: {
    facebook: number | null;
    threads: number | null;
    comments: number | null;
  };
  qualityReview: {
    facebook: string;
    threads: string;
    comments: string;
  };
  completionRates: {
    facebook: number | null;
    threads: number | null;
    comments: number | null;
  };
  postCareReview: {
    facebook: string;
    threads: string;
  };
  viralLinks: string[];
  badLinks: string[];
  viralBonusLinkNote?: string;
  viralBonusAmount: number;
  overallRating: string;
}

export interface KpiExportPayload {
  reportType: "WEEK" | "MONTH";
  title: string;
  periodText: string;
  startDateStr: string;
  endDateStr: string;
  weekNumber?: number;
  month: number;
  year: number;
  isSplitByMonth: boolean;
  cutOffDateStr?: string;
  summary: {
    totalPersonnel: number;
    totalShifts: number;
    workingTimeNote: string;
    attitudeNote: string;
    registeredUserCount?: number;
    registeredUserText?: string;
    femaleContentNotes?: string[];
    contentEvaluationNote?: string;
    highestStaffName?: string;
    lowestStaffName?: string;
  };
  personnelList: KpiExportPersonnel[];
}

function mapRatingToVietnamese(rating?: string | null): string {
  if (!rating) return "Tốt";
  switch (rating.toUpperCase()) {
    case "EXCELLENT":
      return "Rất tốt";
    case "GOOD":
      return "Tốt";
    case "FAIR":
      return "Khá";
    case "NEEDS_IMPROVEMENT":
      return "Cần cải thiện";
    case "POOR":
      return "Chưa tốt";
    default:
      return rating;
  }
}

function calcGrowth(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function calcCompletionRate(actual: number, target: number, totalShifts: number): number | null {
  // Nếu nhân sự không có ca làm việc nào trong kỳ
  if (totalShifts === 0) {
    return actual > 0 ? 1 : null; // null = không áp dụng KPI do không có ca, hiển thị "-"
  }
  return target > 0 ? actual / target : 0;
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const currentISO = getISOWeekAndYear(now);

    const type = (searchParams.get("type") || "week").toUpperCase(); // "WEEK" | "MONTH"
    const weekNumber = parseInt(searchParams.get("week") || String(currentISO.weekNumber));
    const year = parseInt(searchParams.get("year") || String(currentISO.year));
    const splitByMonthParam = searchParams.get("splitByMonth");
    const isSplitByMonth = splitByMonthParam !== "false"; // Default true for Phương án B
    const cutOffDateStr = searchParams.get("cutOffDate") || undefined;

    // 1. Cấu hình KPI
    const kpiConfig = (await prisma.kpiConfig.findFirst({
      orderBy: [{ effectiveFrom: "desc" }, { id: "desc" }],
    })) || {
      fbPerShift: 10,
      threadPerShift: 4,
      commentPerShift: 50,
      minShiftsPerWeek: 5,
    };

    // 2. Lấy danh sách nhân sự active & probation
    const users = await prisma.user.findMany({
      where: {
        role: "NHAN_SU_HYBRID",
        status: { in: ["ACTIVE", "PROBATION"] },
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        role: true,
        status: true,
        startDate: true,
        driveFolderUrl: true,
      },
      orderBy: { fullName: "asc" },
    });
    const userIds = users.map((u) => u.id);

    if (type === "WEEK") {
      // Xác định khoảng ngày của tuần
      const { startDate: rawMonday, endDate: rawSunday } = getWeekDateRange(weekNumber, year);

      // Cấu hình KPI hiệu lực của từng nhân sự tại tuần này
      const userKpiMap = await getUsersEffectiveKpiMap(userIds, rawSunday);

      // Tháng của tuần (thường lấy theo Thứ Năm của tuần)
      const midWeekThursday = new Date(rawMonday.getTime() + 3 * 86400000);
      const targetMonth = searchParams.get("month")
        ? parseInt(searchParams.get("month")!)
        : midWeekThursday.getUTCMonth() + 1;

      let actualStartDate = new Date(rawMonday);
      let actualEndDate = new Date(rawSunday);

      if (isSplitByMonth) {
        const monthStart = new Date(Date.UTC(year, targetMonth - 1, 1, 0, 0, 0, 0));
        const monthEnd = new Date(Date.UTC(year, targetMonth, 0, 23, 59, 59, 999));

        if (actualStartDate < monthStart) actualStartDate = monthStart;
        if (actualEndDate > monthEnd) actualEndDate = monthEnd;
      }

      if (cutOffDateStr) {
        const [coY, coM, coD] = cutOffDateStr.split("-").map(Number);
        const cutOffTime = new Date(Date.UTC(coY, coM - 1, coD, 23, 59, 59, 999));
        if (actualEndDate > cutOffTime) {
          actualEndDate = cutOffTime;
        }
      }

      // Xác định tuần trước để so sánh tăng trưởng
      let prevWeekNumber = weekNumber - 1;
      let prevYear = year;
      if (prevWeekNumber < 1) {
        prevYear -= 1;
        prevWeekNumber = 52;
      }

      // Query ca làm việc hiện tại, tuần trước và WeeklyEvaluation
      const [currentShifts, prevShifts, currentEvaluations, prevEvaluations] = await Promise.all([
        prisma.shiftRegistration.findMany({
          where: {
            userId: { in: userIds },
            shiftDate: {
              gte: actualStartDate,
              lte: actualEndDate,
            },
          },
          include: {
            dailyReport: {
              include: {
                qcReview: true,
                viralPosts: true,
              },
            },
          },
        }),
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
        prisma.weeklyEvaluation.findMany({
          where: {
            userId: { in: userIds },
            weekNumber,
            year,
          },
        }),
        prisma.weeklyEvaluation.findMany({
          where: {
            userId: { in: userIds },
            weekNumber: prevWeekNumber,
            year: prevYear,
          },
        }),
      ]);

      const currentEvalMap = new Map(currentEvaluations.map((e) => [e.userId, e]));
      const prevEvalMap = new Map(prevEvaluations.map((e) => [e.userId, e]));

      const shiftsByUser = new Map<number, typeof currentShifts>();
      for (const s of currentShifts) {
        const list = shiftsByUser.get(s.userId) || [];
        list.push(s);
        shiftsByUser.set(s.userId, list);
      }

      const prevShiftsByUser = new Map<number, typeof prevShifts>();
      for (const s of prevShifts) {
        const list = prevShiftsByUser.get(s.userId) || [];
        list.push(s);
        prevShiftsByUser.set(s.userId, list);
      }

      // Tính số ca cao nhất / thấp nhất
      let maxShifts = -1;
      let minShifts = 999;
      let highestStaff = "";
      let lowestStaff = "";

      const personnelList: KpiExportPersonnel[] = users.map((u) => {
        const userShifts = shiftsByUser.get(u.id) || [];
        const userPrevShifts = prevShiftsByUser.get(u.id) || [];
        const savedEval = currentEvalMap.get(u.id);
        const prevSavedEval = prevEvalMap.get(u.id);

        const totalShifts = userShifts.length;
        if (totalShifts > maxShifts) {
          maxShifts = totalShifts;
          highestStaff = u.fullName;
        }
        if (totalShifts < minShifts) {
          minShifts = totalShifts;
          lowestStaff = u.fullName;
        }

        let fbActual = 0;
        let threadActual = 0;
        let commentActual = 0;
        const driveFolderUrl: string | null = u.driveFolderUrl?.trim() || null;
        const viralLinksSet = new Set<string>();

        for (const s of userShifts) {
          if (s.dailyReport) {
            if (s.dailyReport.qcReview) {
              fbActual += s.dailyReport.qcReview.fbApproved || 0;
              threadActual += s.dailyReport.qcReview.threadApproved || 0;
              commentActual += s.dailyReport.qcReview.commentApproved || 0;
            }
            // Viral links
            const vLinks = parseJsonArray<string>(s.dailyReport.viralPostLinks);
            vLinks.forEach((l) => {
              if (l && l.trim()) viralLinksSet.add(l.trim());
            });
            if (s.dailyReport.viralPosts && s.dailyReport.viralPosts.length > 0) {
              s.dailyReport.viralPosts.forEach((vp) => {
                if (vp.postUrl) viralLinksSet.add(vp.postUrl.trim());
              });
            }
          }
        }

        // Nếu có savedEval, ưu tiên lấy viralLinks & badLinks đã lưu
        if (savedEval) {
          const evalViral = parseJsonArray<string>(savedEval.viralLinks);
          evalViral.forEach((l) => {
            if (l && l.trim()) viralLinksSet.add(l.trim());
          });
        }

        const userKpi = userKpiMap.get(u.id) || {
          fbPerShift: kpiConfig.fbPerShift,
          threadPerShift: kpiConfig.threadPerShift,
          commentPerShift: kpiConfig.commentPerShift,
          minShiftsPerWeek: kpiConfig.minShiftsPerWeek,
          isCustom: false,
        };

        const kpiTargets = {
          facebook: totalShifts * userKpi.fbPerShift,
          threads: totalShifts * userKpi.threadPerShift,
          comments: totalShifts * userKpi.commentPerShift,
        };

        const completionRates = {
          facebook: calcCompletionRate(fbActual, kpiTargets.facebook, totalShifts),
          threads: calcCompletionRate(threadActual, kpiTargets.threads, totalShifts),
          comments: calcCompletionRate(commentActual, kpiTargets.comments, totalShifts),
        };

        // Tuần trước để tính tăng trưởng
        let prevFb = 0;
        let prevThread = 0;
        let prevComment = 0;
        if (prevSavedEval) {
          prevFb = prevSavedEval.fbActual;
          prevThread = prevSavedEval.threadActual;
          prevComment = prevSavedEval.commentActual;
        } else {
          for (const ps of userPrevShifts) {
            if (ps.dailyReport?.qcReview) {
              prevFb += ps.dailyReport.qcReview.fbApproved || 0;
              prevThread += ps.dailyReport.qcReview.threadApproved || 0;
              prevComment += ps.dailyReport.qcReview.commentApproved || 0;
            }
          }
        }

        const growth = {
          facebook: userPrevShifts.length > 0 || prevSavedEval ? calcGrowth(fbActual, prevFb) : null,
          threads: userPrevShifts.length > 0 || prevSavedEval ? calcGrowth(threadActual, prevThread) : null,
          comments: userPrevShifts.length > 0 || prevSavedEval ? calcGrowth(commentActual, prevComment) : null,
        };

        const qualityReview = {
          facebook: savedEval?.fbQualityReview || (fbActual > 0 ? "Tiếp cận đúng đối tượng mục tiêu, bài viết có tương tác" : "Chưa có bài viết"),
          threads: savedEval?.threadQualityReview || (threadActual > 0 ? "Nội dung kể chuyện, giữ tương tác ổn định" : "Chưa có bài viết"),
          comments: savedEval?.commentQualityReview || (commentActual > 0 ? "Duy trì ổn định" : "Chưa có tương tác"),
        };

        const postCareReview = {
          facebook: savedEval?.postCareReview || "Có sự tương tác phản hồi bài viết",
          threads: savedEval?.postCareReview || "Chăm sóc bài viết ở mức ổn định",
        };

        const viralLinks = Array.from(viralLinksSet);
        const badLinks = savedEval ? parseJsonArray<string>(savedEval.badLinks) : [];
        const viralBonusAmount = savedEval?.viralBonus || 0;
        const overallRating = savedEval?.overallRating
          ? mapRatingToVietnamese(savedEval.overallRating)
          : (totalShifts === 0 && fbActual === 0
            ? "Không có ca"
            : mapRatingToVietnamese(completionRates.facebook != null && completionRates.facebook >= 1 ? "GOOD" : "FAIR"));

        return {
          user: {
            id: u.id,
            fullName: u.fullName,
            phone: u.phone,
            role: u.role,
            status: u.status,
            driveFolderUrl,
          },
          totalShifts,
          kpiTargets,
          actual: {
            facebook: fbActual,
            threads: threadActual,
            comments: commentActual,
          },
          growth,
          qualityReview,
          completionRates,
          postCareReview,
          viralLinks,
          badLinks,
          viralBonusAmount,
          overallRating,
          targetsPerShift: {
            facebook: userKpi.fbPerShift,
            threads: userKpi.threadPerShift,
            comments: userKpi.commentPerShift,
          },
          isCustomKpi: userKpi.isCustom,
        };
      });

      const startD = actualStartDate.getUTCDate();
      const startM = actualStartDate.getUTCMonth() + 1;
      const endD = actualEndDate.getUTCDate();
      const endM = actualEndDate.getUTCMonth() + 1;
      const periodText = `từ ${startD}/${startM} đến ngày ${endD}/${endM}`;

      const payload: KpiExportPayload = {
        reportType: "WEEK",
        title: `BÁO CÁO TEAM TRANING + REMOTE TUẦN ${weekNumber} ( THÁNG ${targetMonth})`,
        periodText,
        startDateStr: actualStartDate.toISOString().slice(0, 10),
        endDateStr: actualEndDate.toISOString().slice(0, 10),
        weekNumber,
        month: targetMonth,
        year,
        isSplitByMonth,
        cutOffDateStr,
        summary: {
          totalPersonnel: users.length,
          totalShifts: currentShifts.length,
          workingTimeNote: "Nhân sự vào làm đúng giờ",
          attitudeNote: "Nghiêm túc trong công việc, có trách nhiệm",
          registeredUserCount: 0,
          registeredUserText: `Số lượng user đăng ký ${periodText}`,
          femaleContentNotes: [
            "Nhóm 1: Tâm sự, chữa lành và tình cảm, hôn nhân, Single Mom",
            "Nhóm 2: Địa điểm hẹn hò, ăn chơi, du lịch",
            "Nhóm 3: Cộng đồng về giới tính, sinh viên, gen Z",
            "Nhóm 4: Drama, Hóng hớt",
          ],
          contentEvaluationNote: "Tuần này các bạn mới và cũ làm việc tương đối tốt hầu hết các bài đều có tương tác",
          highestStaffName: highestStaff || undefined,
          lowestStaffName: lowestStaff || undefined,
        },
        personnelList,
      };

      return NextResponse.json(payload);
    }

    // ==========================================
    // BÁO CÁO THÁNG (MONTH)
    // ==========================================
    const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1));
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const naturalMonthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    let endDate = naturalMonthEnd;
    if (cutOffDateStr) {
      const [coY, coM, coD] = cutOffDateStr.split("-").map(Number);
      const cutOffTime = new Date(Date.UTC(coY, coM - 1, coD, 23, 59, 59, 999));
      if (cutOffTime < endDate) {
        endDate = cutOffTime;
      }
    }

    // Tháng trước để so sánh tăng trưởng
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevStartDate = new Date(Date.UTC(prevYear, prevMonth - 1, 1, 0, 0, 0, 0));
    const prevEndDate = new Date(Date.UTC(prevYear, prevMonth, 0, 23, 59, 59, 999));

    const [currentShifts, prevShifts, weeklyEvals, monthlyAcceptances, userKpiMap] = await Promise.all([
      prisma.shiftRegistration.findMany({
        where: {
          userId: { in: userIds },
          shiftDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          dailyReport: {
            include: {
              qcReview: true,
              viralPosts: true,
            },
          },
        },
      }),
      prisma.shiftRegistration.findMany({
        where: {
          userId: { in: userIds },
          shiftDate: {
            gte: prevStartDate,
            lte: prevEndDate,
          },
        },
        include: {
          dailyReport: {
            include: {
              qcReview: true,
            },
          },
        },
      }),
      // Lấy các WeeklyEvaluation có updatedAt hoặc thuộc năm/tháng này
      prisma.weeklyEvaluation.findMany({
        where: {
          userId: { in: userIds },
          year,
        },
      }),
      prisma.monthlyAcceptance.findMany({
        where: {
          userId: { in: userIds },
          month,
          year,
        },
      }),
      // Cấu hình KPI hiệu lực của từng nhân sự tại tháng này
      getUsersEffectiveKpiMap(userIds, endDate),
    ]);

    const acceptanceMap = new Map(monthlyAcceptances.map((a) => [a.userId, a]));

    const shiftsByUser = new Map<number, typeof currentShifts>();
    for (const s of currentShifts) {
      const list = shiftsByUser.get(s.userId) || [];
      list.push(s);
      shiftsByUser.set(s.userId, list);
    }

    const prevShiftsByUser = new Map<number, typeof prevShifts>();
    for (const s of prevShifts) {
      const list = prevShiftsByUser.get(s.userId) || [];
      list.push(s);
      prevShiftsByUser.set(s.userId, list);
    }

    // Weekly evals by user
    const weeklyEvalsByUser = new Map<number, typeof weeklyEvals>();
    for (const we of weeklyEvals) {
      const list = weeklyEvalsByUser.get(we.userId) || [];
      list.push(we);
      weeklyEvalsByUser.set(we.userId, list);
    }

    let maxShifts = -1;
    let minShifts = 999;
    let highestStaff = "";
    let lowestStaff = "";

    const personnelList: KpiExportPersonnel[] = users.map((u) => {
      const userShifts = shiftsByUser.get(u.id) || [];
      const userPrevShifts = prevShiftsByUser.get(u.id) || [];
      const userWeeklyEvals = weeklyEvalsByUser.get(u.id) || [];
      const savedAcc = acceptanceMap.get(u.id);

      const totalShifts = userShifts.length;
      if (totalShifts > maxShifts) {
        maxShifts = totalShifts;
        highestStaff = u.fullName;
      }
      if (totalShifts < minShifts) {
        minShifts = totalShifts;
        lowestStaff = u.fullName;
      }

      let fbActual = 0;
      let threadActual = 0;
      let commentActual = 0;
      const driveFolderUrl: string | null = u.driveFolderUrl?.trim() || null;
      const viralLinksSet = new Set<string>();

      for (const s of userShifts) {
        if (s.dailyReport) {
          if (s.dailyReport.qcReview) {
            fbActual += s.dailyReport.qcReview.fbApproved || 0;
            threadActual += s.dailyReport.qcReview.threadApproved || 0;
            commentActual += s.dailyReport.qcReview.commentApproved || 0;
          }
          const vLinks = parseJsonArray<string>(s.dailyReport.viralPostLinks);
          vLinks.forEach((l) => {
            if (l && l.trim()) viralLinksSet.add(l.trim());
          });
          if (s.dailyReport.viralPosts && s.dailyReport.viralPosts.length > 0) {
            s.dailyReport.viralPosts.forEach((vp) => {
              if (vp.postUrl) viralLinksSet.add(vp.postUrl.trim());
            });
          }
        }
      }

      // KPI targets tháng áp dụng riêng cho nhân sự này
      const userKpi = userKpiMap.get(u.id) || {
        fbPerShift: kpiConfig.fbPerShift,
        threadPerShift: kpiConfig.threadPerShift,
        commentPerShift: kpiConfig.commentPerShift,
        minShiftsPerWeek: kpiConfig.minShiftsPerWeek,
        isCustom: false,
      };

      const kpiTargets = {
        facebook: totalShifts * userKpi.fbPerShift,
        threads: totalShifts * userKpi.threadPerShift,
        comments: totalShifts * userKpi.commentPerShift,
      };

      const completionRates = {
        facebook: calcCompletionRate(fbActual, kpiTargets.facebook, totalShifts),
        threads: calcCompletionRate(threadActual, kpiTargets.threads, totalShifts),
        comments: calcCompletionRate(commentActual, kpiTargets.comments, totalShifts),
      };

      // Tháng trước để tính tăng trưởng
      let prevFb = 0;
      let prevThread = 0;
      let prevComment = 0;
      for (const ps of userPrevShifts) {
        if (ps.dailyReport?.qcReview) {
          prevFb += ps.dailyReport.qcReview.fbApproved || 0;
          prevThread += ps.dailyReport.qcReview.threadApproved || 0;
          prevComment += ps.dailyReport.qcReview.commentApproved || 0;
        }
      }

      const growth = {
        facebook: userPrevShifts.length > 0 ? calcGrowth(fbActual, prevFb) : null,
        threads: userPrevShifts.length > 0 ? calcGrowth(threadActual, prevThread) : null,
        comments: userPrevShifts.length > 0 ? calcGrowth(commentActual, prevComment) : null,
      };

      // Tổng hợp nhận xét từ các tuần
      const latestWeeklyEval = userWeeklyEvals[userWeeklyEvals.length - 1];
      const qualityReview = {
        facebook: latestWeeklyEval?.fbQualityReview || "Nội dung ổn định, một số bài viết có mức tương tác tốt",
        threads: latestWeeklyEval?.threadQualityReview || "Duy trì tương đối tốt",
        comments: latestWeeklyEval?.commentQualityReview || "Tương tác ổn định",
      };

      const postCareReview = {
        facebook: latestWeeklyEval?.postCareReview || "Cần chủ động chăm sóc bài viết hơn",
        threads: latestWeeklyEval?.postCareReview || "Chăm sóc bài viết ở mức ổn định",
      };

      // Thưởng viral: lấy từ MonthlyAcceptance hoặc tổng từ WeeklyEvaluation
      let viralBonusAmount = savedAcc?.viralBonus || 0;
      if (!viralBonusAmount && userWeeklyEvals.length > 0) {
        viralBonusAmount = userWeeklyEvals.reduce((sum, we) => sum + (we.viralBonus || 0), 0);
      }

      const overallRating = savedAcc?.bonusNote
        ? savedAcc.bonusNote
        : (totalShifts === 0 && fbActual === 0
          ? "Không có ca"
          : (completionRates.facebook != null && completionRates.facebook >= 1 ? "Tốt" : "Khá"));

      return {
        user: {
          id: u.id,
          fullName: u.fullName,
          phone: u.phone,
          role: u.role,
          status: u.status,
          driveFolderUrl,
        },
        totalShifts,
        kpiTargets,
        actual: {
          facebook: fbActual,
          threads: threadActual,
          comments: commentActual,
        },
        growth,
        qualityReview,
        completionRates,
        postCareReview,
        viralLinks: Array.from(viralLinksSet),
        badLinks: latestWeeklyEval ? parseJsonArray<string>(latestWeeklyEval.badLinks) : [],
        viralBonusAmount,
        overallRating,
        targetsPerShift: {
          facebook: userKpi.fbPerShift,
          threads: userKpi.threadPerShift,
          comments: userKpi.commentPerShift,
        },
        isCustomKpi: userKpi.isCustom,
      };
    });

    const startD = startDate.getUTCDate();
    const endD = endDate.getUTCDate();
    const periodText = `từ ${startD}/${month} đến ngày ${endD}/${month}`;

    const payload: KpiExportPayload = {
      reportType: "MONTH",
      title: `BÁO CÁO TEAM TRAINING + REMOTE THÁNG ${month}`,
      periodText,
      startDateStr: startDate.toISOString().slice(0, 10),
      endDateStr: endDate.toISOString().slice(0, 10),
      month,
      year,
      isSplitByMonth: false,
      cutOffDateStr,
      summary: {
        totalPersonnel: users.length,
        totalShifts: currentShifts.length,
        workingTimeNote: "Nhân sự vào làm đúng giờ",
        attitudeNote: "Có trách nhiệm với công việc",
        registeredUserCount: 10294,
        registeredUserText: `Số lượng user đăng ký ${periodText}`,
        femaleContentNotes: [
          "Nhóm 1: Tâm sự, chữa lành và tình cảm, hôn nhân, Single Mom",
          "Nhóm 2: Địa điểm hẹn hò, ăn chơi, du lịch",
          "Nhóm 3: Cộng đồng về giới tính, sinh viên, gen Z",
          "Nhóm 4: Drama, Hóng hớt",
        ],
        contentEvaluationNote:
          "Tháng này các bạn tập trung viết bài về các tính năng của freetrip nên lượt tương tác các bài đó giảm chất lượng, tuy nhiên có những bài viral đạt rất cao so với các tháng trước.",
        highestStaffName: highestStaff || undefined,
        lowestStaffName: lowestStaff || undefined,
      },
      personnelList,
    };

    return NextResponse.json(payload);
  } catch (error: any) {
    console.error("Lỗi get kpi export data:", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi lấy dữ liệu xuất KPI: " + error.message },
      { status: 500 }
    );
  }
}
