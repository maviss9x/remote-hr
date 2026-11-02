import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isManager } from "@/lib/auth";
import { parseJsonArray } from "@/lib/json-fields";
import { getShiftTimeRange } from "@/lib/reportSubmissionPolicy";
import {
  getEffectiveShiftRules,
  getEffectiveShiftTimes,
  getEffectiveKpiConfig,
} from "@/lib/shiftRulesHelper";
import { DEFAULT_SHIFT_TIMES } from "@/lib/shifts-constants";

export const dynamic = "force-dynamic";

/** Lấy chuỗi ngày YYYY-MM-DD theo giờ Việt Nam (GMT+7) */
function getTodayVNString(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    if (!isManager(session.role)) {
      return NextResponse.json(
        { error: "Không có quyền truy cập dữ liệu giám sát ca làm việc" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date")?.trim() || "";
    const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : getTodayVNString();

    const rawShiftType = searchParams.get("shiftType")?.toUpperCase() || "ALL";
    const workMode = searchParams.get("workMode")?.toUpperCase() || "ALL";
    const statusFilter = searchParams.get("status")?.toUpperCase() || "ALL";
    const searchQuery = searchParams.get("search")?.trim().toLowerCase() || "";

    // Chuẩn hóa loại ca: Cho phép cả tiếng Việt (SANG, CHIEU, TOI) và tiếng Anh
    const shiftTypeMap: Record<string, string> = {
      SANG: "MORNING",
      CHIEU: "AFTERNOON",
      TOI: "EVENING",
    };
    const normalizedShiftType = shiftTypeMap[rawShiftType] || rawShiftType;

    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    const where: any = {
      shiftDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };

    if (normalizedShiftType !== "ALL") {
      where.shiftType = normalizedShiftType;
    }

    if (workMode !== "ALL") {
      where.workMode = workMode;
    }

    // Lấy song song dữ liệu ca và các cấu hình hệ thống
    const [shifts, shiftTimes, rules, kpiConfig] = await Promise.all([
      prisma.shiftRegistration.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              email: true,
              role: true,
              status: true,
            },
          },
          loginSession: true,
          dailyReport: {
            include: {
              qcReview: {
                include: {
                  reviewer: {
                    select: {
                      id: true,
                      fullName: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [
          { shiftType: "asc" },
          { user: { fullName: "asc" } },
        ],
      }),
      getEffectiveShiftTimes(),
      getEffectiveShiftRules(),
      getEffectiveKpiConfig(),
    ]);

    const now = new Date();

    // Biến thống kê tổng hợp (Summary)
    let totalRegistered = 0;
    let checkedInCount = 0;
    let onTimeCount = 0;
    let lateCount = 0;
    let notCheckedInCount = 0;
    let lateRiskCount = 0; // Trễ > 15 phút nhưng chưa tới 60 phút
    let lockedOrAbsentCount = 0; // Quá 60 phút chưa vào ca hoặc ABSENT
    let reportedCount = 0;
    let reopenedCount = 0;
    let qcPendingCount = 0;
    let qcPassedCount = 0;
    let qcFailedCount = 0;
    let totalFbLinks = 0;
    let totalThreadLinks = 0;
    let totalCommentCount = 0;
    let totalViralCount = 0;

    const processedShifts = shifts.map((shift) => {
      totalRegistered++;

      const shiftConfig =
        shiftTimes[shift.shiftType] ||
        DEFAULT_SHIFT_TIMES[shift.shiftType as keyof typeof DEFAULT_SHIFT_TIMES] || {
          label: shift.shiftType,
          startTime: "08:30",
          endTime: "12:30",
          hourlyRate: 25000,
        };

      const { start: shiftStart, end: shiftEnd } = getShiftTimeRange(shift.shiftDate, shiftConfig);
      const checkInDeadline = new Date(shiftStart.getTime() + rules.lateCheckinMinutes * 60_000);

      // 1. Phân tích trạng thái Vào ca (Check-in)
      const hasLogin = Boolean(shift.loginSession);
      const loginTime = shift.loginSession?.loginTime ? new Date(shift.loginSession.loginTime) : null;
      let checkInStatus: "ON_TIME" | "LATE" | "PENDING" | "LATE_RISK" | "LOCKED" | "BEFORE_SHIFT" = "BEFORE_SHIFT";
      let lateMinutes = 0;

      if (hasLogin) {
        checkedInCount++;
        if (shift.loginSession?.isLate) {
          checkInStatus = "LATE";
          lateCount++;
          lateMinutes = shift.loginSession.lateMinutes || 0;
        } else {
          checkInStatus = "ON_TIME";
          onTimeCount++;
        }
      } else {
        notCheckedInCount++;
        if (now < shiftStart) {
          checkInStatus = "BEFORE_SHIFT";
        } else if (now <= checkInDeadline) {
          const currentLateMin = Math.floor((now.getTime() - shiftStart.getTime()) / 60_000);
          if (currentLateMin >= 15) {
            checkInStatus = "LATE_RISK";
            lateRiskCount++;
          } else {
            checkInStatus = "PENDING";
          }
          lateMinutes = currentLateMin;
        } else {
          checkInStatus = "LOCKED";
          lockedOrAbsentCount++;
          lateMinutes = Math.floor((now.getTime() - shiftStart.getTime()) / 60_000);
        }
      }

      if (shift.status === "ABSENT") {
        lockedOrAbsentCount++;
      }

      // 2. Phân tích quyền Mở nộp bù (Reopen Shift)
      const isReopenedValid = Boolean(
        shift.reopenedBy &&
        shift.reopenedUntil &&
        now <= new Date(shift.reopenedUntil)
      );

      const isReopenExpired = Boolean(
        shift.reopenedBy &&
        shift.reopenedUntil &&
        now > new Date(shift.reopenedUntil)
      );

      if (isReopenedValid) {
        reopenedCount++;
      }

      const remainingReopenSeconds = isReopenedValid && shift.reopenedUntil
        ? Math.max(0, Math.floor((new Date(shift.reopenedUntil).getTime() - now.getTime()) / 1000))
        : null;

      // Nút mở nộp bù nhanh khả dụng khi: ca đã quá hạn vào ca (>60p) hoặc đã kết thúc ca mà chưa nộp bài, hoặc ca đang bị khóa
      const canQuickReopen =
        !isReopenedValid &&
        (now > checkInDeadline || now > shiftEnd || shift.status === "ABSENT") &&
        (!shift.dailyReport || shift.dailyReport.qcReview?.result === "FAIL");

      // 3. Phân tích Báo cáo và Link đã nộp
      const report = shift.dailyReport;
      let linksSummary = {
        fbCount: 0,
        fbSuppCount: 0,
        threadCount: 0,
        commentCount: 0,
        commentDriveLink: null as string | null,
        viralCount: 0,
        total: 0,
      };

      let rawLinks = {
        fbLinks: [] as string[],
        fbSupplementLinks: [] as string[],
        threadLinks: [] as string[],
        femaleContentLinks: [] as string[],
        viralPostLinks: [] as string[],
      };

      if (report) {
        reportedCount++;

        rawLinks.fbLinks = parseJsonArray<string>(report.fbLinks);
        rawLinks.fbSupplementLinks = parseJsonArray<string>(report.fbSupplementLinks);
        rawLinks.threadLinks = parseJsonArray<string>(report.threadLinks);
        rawLinks.femaleContentLinks = parseJsonArray<string>(report.femaleContentLinks);
        rawLinks.viralPostLinks = parseJsonArray<string>(report.viralPostLinks);

        const fbCount = rawLinks.fbLinks.length;
        const fbSuppCount = rawLinks.fbSupplementLinks.length;
        const threadCount = rawLinks.threadLinks.length;
        const commentCount = report.commentDriveLink ? kpiConfig.commentPerShift : 0;
        const viralCount = rawLinks.viralPostLinks.length;

        linksSummary = {
          fbCount,
          fbSuppCount,
          threadCount,
          commentCount,
          commentDriveLink: report.commentDriveLink,
          viralCount,
          total: fbCount + fbSuppCount + threadCount + commentCount + viralCount,
        };

        totalFbLinks += fbCount + fbSuppCount;
        totalThreadLinks += threadCount;
        totalCommentCount += commentCount;
        totalViralCount += viralCount;
      }

      // 4. Phân tích QC Review
      const qc = report?.qcReview;
      let qcStatus: "NO_REPORT" | "PENDING" | "PASS" | "FAIL" | "CONDITIONAL" = "NO_REPORT";

      if (report) {
        if (!qc || qc.result === "PENDING") {
          qcStatus = "PENDING";
          qcPendingCount++;
        } else if (qc.result === "PASS") {
          qcStatus = "PASS";
          qcPassedCount++;
        } else if (qc.result === "FAIL") {
          qcStatus = "FAIL";
          qcFailedCount++;
        } else {
          qcStatus = "CONDITIONAL";
        }
      }

      return {
        id: shift.id,
        userId: shift.userId,
        userName: shift.user.fullName,
        userPhone: shift.user.phone,
        userRole: shift.user.role,
        workMode: shift.workMode,
        shiftType: shift.shiftType,
        shiftLabel: shiftConfig.label || shift.shiftType,
        shiftTime: {
          startTime: shiftConfig.startTime,
          endTime: shiftConfig.endTime,
        },
        shiftDate: shift.shiftDate.toISOString().slice(0, 10),
        status: shift.status,
        note: shift.note,

        timeContext: {
          isBeforeShift: now < shiftStart,
          isInShift: now >= shiftStart && now <= shiftEnd,
          isAfterShift: now > shiftEnd,
          shiftStart: shiftStart.toISOString(),
          shiftEnd: shiftEnd.toISOString(),
          checkInDeadline: checkInDeadline.toISOString(),
        },

        checkIn: {
          hasLogin,
          loginTime: loginTime ? loginTime.toISOString() : null,
          status: checkInStatus,
          isLate: shift.loginSession?.isLate ?? (checkInStatus === "LATE" || checkInStatus === "LOCKED"),
          lateMinutes,
          autoMarkedAbsent: shift.loginSession?.autoMarkedAbsent ?? false,
        },

        reopen: {
          isReopened: isReopenedValid,
          isExpired: isReopenExpired,
          reopenedBy: shift.reopenedBy,
          reopenedUntil: shift.reopenedUntil ? shift.reopenedUntil.toISOString() : null,
          remainingSeconds: remainingReopenSeconds,
          canQuickReopen,
        },

        report: report
          ? {
              id: report.id,
              submittedAt: report.submittedAt.toISOString(),
              updatedAt: report.updatedAt.toISOString(),
              linksSummary,
              rawLinks,
              thresholdMet: report.thresholdMet,
              endSnapshotAt: report.endSnapshotAt ? report.endSnapshotAt.toISOString() : null,
            }
          : null,

        qc: {
          status: qcStatus,
          id: qc?.id ?? null,
          fbApproved: qc?.fbApproved ?? 0,
          threadApproved: qc?.threadApproved ?? 0,
          commentApproved: qc?.commentApproved ?? 0,
          invalidLinks: qc ? parseJsonArray<string>(qc.invalidLinks) : [],
          feedback: qc?.feedback ?? null,
          reviewedAt: qc?.reviewedAt ? qc.reviewedAt.toISOString() : null,
          reviewerName: qc?.reviewer?.fullName ?? null,
        },
      };
    });

    // Lọc theo search và statusFilter sau khi đã tính toán trạng thái
    const filteredShifts = processedShifts.filter((item) => {
      if (searchQuery) {
        const matchesName = item.userName.toLowerCase().includes(searchQuery);
        const matchesPhone = item.userPhone.toLowerCase().includes(searchQuery);
        if (!matchesName && !matchesPhone) return false;
      }

      if (statusFilter !== "ALL") {
        switch (statusFilter) {
          case "CHECKED_IN":
            return item.checkIn.hasLogin;
          case "NOT_CHECKED_IN":
            return !item.checkIn.hasLogin;
          case "LATE":
            return item.checkIn.isLate;
          case "LATE_RISK":
            return item.checkIn.status === "LATE_RISK";
          case "LOCKED":
            return item.checkIn.status === "LOCKED" || item.status === "ABSENT";
          case "REPORTED":
            return item.report !== null;
          case "NOT_REPORTED":
            return item.report === null;
          case "REOPENED":
            return item.reopen.isReopened;
          case "QC_PENDING":
            return item.qc.status === "PENDING";
          case "QC_PASS":
            return item.qc.status === "PASS";
          case "QC_FAIL":
            return item.qc.status === "FAIL";
          default:
            return true;
        }
      }

      return true;
    });

    return NextResponse.json({
      success: true,
      date: dateStr,
      kpiConfig,
      summary: {
        totalRegistered,
        checkedInCount,
        onTimeCount,
        lateCount,
        notCheckedInCount,
        lateRiskCount,
        lockedOrAbsentCount,
        reportedCount,
        reopenedCount,
        qcPendingCount,
        qcPassedCount,
        qcFailedCount,
        links: {
          fb: totalFbLinks,
          thread: totalThreadLinks,
          comment: totalCommentCount,
          viral: totalViralCount,
          total: totalFbLinks + totalThreadLinks + totalCommentCount + totalViralCount,
        },
      },
      shifts: filteredShifts,
    });
  } catch (error: any) {
    console.error("Lỗi API GET /api/shifts/monitoring:", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi lấy dữ liệu giám sát ca" },
      { status: 500 }
    );
  }
}

