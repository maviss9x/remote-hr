import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Chỉ Super Admin mới có quyền truy cập dữ liệu sao lưu." },
        { status: 403 }
      );
    }

    const [
      usersCount,
      contractsCount,
      shiftsCount,
      loginSessionsCount,
      dailyReportsCount,
      qcReviewsCount,
      weeklyEvaluationsCount,
      monthlyAcceptancesCount,
      viralPostsCount,
      kpiConfigsCount,
      viralBonusTiersCount,
      shiftScheduleConfigsCount,
      systemSettingsCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.contract.count(),
      prisma.shiftRegistration.count(),
      prisma.loginSession.count(),
      prisma.dailyReport.count(),
      prisma.qcReview.count(),
      prisma.weeklyEvaluation.count(),
      prisma.monthlyAcceptance.count(),
      prisma.viralPost.count(),
      prisma.kpiConfig.count(),
      prisma.viralBonusTier.count(),
      prisma.shiftScheduleConfig.count(),
      prisma.systemSetting.count(),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        users: usersCount,
        contracts: contractsCount,
        shifts: shiftsCount,
        loginSessions: loginSessionsCount,
        dailyReports: dailyReportsCount,
        qcReviews: qcReviewsCount,
        weeklyEvaluations: weeklyEvaluationsCount,
        monthlyAcceptances: monthlyAcceptancesCount,
        viralPosts: viralPostsCount,
        configs: kpiConfigsCount + viralBonusTiersCount + shiftScheduleConfigsCount + systemSettingsCount,
      },
    });
  } catch (err: any) {
    console.error("Lỗi khi lấy thống kê dữ liệu sao lưu:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: `Lỗi máy chủ: ${err.message || String(err)}` },
      { status: 500 }
    );
  }
}
