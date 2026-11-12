import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasAnyRole } from "@/lib/auth";
import { invalidateKpiCache } from "@/lib/kpiCache";
import { stringifyJsonArray } from "@/lib/json-fields";
import { getUserEffectiveKpi } from "@/lib/kpiService";
import { getWeekDateRange } from "@/lib/dateUtils";
const WeeklyRating = {
  EXCELLENT: "EXCELLENT",
  GOOD: "GOOD",
  FAIR: "FAIR",
  NEEDS_IMPROVEMENT: "NEEDS_IMPROVEMENT",
  POOR: "POOR",
} as const;
type WeeklyRating = (typeof WeeklyRating)[keyof typeof WeeklyRating];

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    // Chỉ Quản lý, QC, HR, Admin mới có quyền đánh giá
    const allowedRoles = ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER", "QC"];
    if (!hasAnyRole(session.role, allowedRoles)) {
      return NextResponse.json({ error: "Bạn không có quyền thực hiện đánh giá KPI" }, { status: 403 });
    }

    const body = await request.json();
    const {
      userId,
      weekNumber,
      year,
      overallRating,
      fbQualityReview,
      threadQualityReview,
      commentQualityReview,
      postCareReview,
      viralBonus = 0,
      viralLinks = [],
      badLinks = [],
    } = body;

    if (!userId || !weekNumber || !year) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc (userId, weekNumber, year)" }, { status: 400 });
    }

    // Validate overallRating enum
    const validRatings: WeeklyRating[] = [
      WeeklyRating.EXCELLENT,
      WeeklyRating.GOOD,
      WeeklyRating.FAIR,
      WeeklyRating.NEEDS_IMPROVEMENT,
      WeeklyRating.POOR,
    ];
    if (overallRating && !validRatings.includes(overallRating as WeeklyRating)) {
      return NextResponse.json({ error: "Xếp loại không hợp lệ" }, { status: 400 });
    }

    // 1. Tính toán lại số liệu thực tế của nhân sự trong tuần để snapshot vào WeeklyEvaluation
    const weekRange = getWeekDateRange(weekNumber, year);
    const userKpi = await getUserEffectiveKpi(userId, weekRange.endDate);

    const userShifts = await prisma.shiftRegistration.findMany({
      where: {
        userId,
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
    });

    const totalShifts = userShifts.length;
    let totalShiftsPassed = 0;
    let fbActual = 0;
    let threadActual = 0;
    let commentActual = 0;

    for (const s of userShifts) {
      const report = s.dailyReport;
      if (report?.qcReview) {
        if (report.qcReview.result === "PASS") totalShiftsPassed++;
        fbActual += report.qcReview.fbApproved || 0;
        threadActual += report.qcReview.threadApproved || 0;
        commentActual += report.qcReview.commentApproved || 0;
      }
    }

    const shiftTarget = Math.max(totalShifts, userKpi.minShiftsPerWeek);
    const targetFb = shiftTarget * userKpi.fbPerShift;
    const targetThread = shiftTarget * userKpi.threadPerShift;
    const targetComment = shiftTarget * userKpi.commentPerShift;

    const fbCompletionRate = targetFb > 0 ? Math.round((fbActual / targetFb) * 1000) / 10 : 0;
    const threadCompletionRate = targetThread > 0 ? Math.round((threadActual / targetThread) * 1000) / 10 : 0;
    const commentCompletionRate = targetComment > 0 ? Math.round((commentActual / targetComment) * 1000) / 10 : 0;

    // 2. Lưu hoặc Cập nhật vào WeeklyEvaluation
    const evaluation = await prisma.weeklyEvaluation.upsert({
      where: {
        userId_weekNumber_year: {
          userId,
          weekNumber,
          year,
        },
      },
      update: {
        totalShifts,
        totalShiftsPassed,
        fbActual,
        threadActual,
        commentActual,
        fbCompletionRate,
        threadCompletionRate,
        commentCompletionRate,
        overallRating: (overallRating as WeeklyRating) || WeeklyRating.GOOD,
        fbQualityReview: fbQualityReview || null,
        threadQualityReview: threadQualityReview || null,
        commentQualityReview: commentQualityReview || null,
        postCareReview: postCareReview || null,
        viralBonus: Number(viralBonus) || 0,
        viralLinks: stringifyJsonArray(Array.isArray(viralLinks) ? viralLinks : []),
        badLinks: stringifyJsonArray(Array.isArray(badLinks) ? badLinks : []),
      },
      create: {
        userId,
        weekNumber,
        year,
        totalShifts,
        totalShiftsPassed,
        fbActual,
        threadActual,
        commentActual,
        fbCompletionRate,
        threadCompletionRate,
        commentCompletionRate,
        overallRating: (overallRating as WeeklyRating) || WeeklyRating.GOOD,
        fbQualityReview: fbQualityReview || null,
        threadQualityReview: threadQualityReview || null,
        commentQualityReview: commentQualityReview || null,
        postCareReview: postCareReview || null,
        viralBonus: Number(viralBonus) || 0,
        viralLinks: stringifyJsonArray(Array.isArray(viralLinks) ? viralLinks : []),
        badLinks: stringifyJsonArray(Array.isArray(badLinks) ? badLinks : []),
      },
    });

    // 3. Xóa cache của tuần này để dữ liệu cập nhật tức thì
    invalidateKpiCache(`kpi_w${weekNumber}_y${year}`);

    // 4. Tạo thông báo cho nhân sự
    const ratingLabels: Record<string, string> = {
      EXCELLENT: "Xuất sắc (Rất tốt)",
      GOOD: "Tốt",
      FAIR: "Khá",
      NEEDS_IMPROVEMENT: "Cần cố gắng",
      POOR: "Chưa đạt (Không tốt)",
    };

    await prisma.notification.create({
      data: {
        userId,
        type: "GENERAL",
        title: `Đánh giá KPI Tuần ${weekNumber}/${year}`,
        message: `Quản lý đã hoàn tất đánh giá tuần ${weekNumber}. Xếp loại: ${ratingLabels[evaluation.overallRating] || evaluation.overallRating}. Tiền thưởng viral: ${evaluation.viralBonus.toLocaleString("vi-VN")} đ.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Đã lưu đánh giá tuần thành công",
      evaluation,
    });
  } catch (error) {
    console.error("Lỗi lưu đánh giá KPI:", error);
    return NextResponse.json({ error: "Lỗi nội bộ khi lưu đánh giá" }, { status: 500 });
  }
}
