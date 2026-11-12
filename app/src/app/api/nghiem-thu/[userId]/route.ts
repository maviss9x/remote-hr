import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parseJsonArray } from "@/lib/json-fields";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { userId: paramUserId } = await params;
    const userId = parseInt(paramUserId);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "userId không hợp lệ" }, { status: 400 });
    }

    // RBAC: Nhân viên thường chỉ xem được ca của chính mình
    if (session.role === "NHAN_SU_HYBRID" && session.userId !== userId) {
      return NextResponse.json({ error: "Không có quyền xem thông tin nhân sự khác" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1));
    const year = parseInt(searchParams.get("year") || String(now.getFullYear()));

    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        phone: true,
        role: true,
        status: true,
        avatarUrl: true,
        startDate: true,
        bankAccount: true,
        bankName: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Không tìm thấy nhân sự" }, { status: 404 });
    }

    const shifts = await prisma.shiftRegistration.findMany({
      where: {
        userId,
        shiftDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
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
        loginSession: true,
      },
      orderBy: { shiftDate: "asc" },
    });

    return NextResponse.json({
      user,
      month,
      year,
      totalShifts: shifts.length,
      shifts: shifts.map((s) => ({
        id: s.id,
        shiftDate: s.shiftDate,
        shiftType: s.shiftType,
        workMode: s.workMode,
        status: s.status,
        loginSession: s.loginSession
          ? {
              loginTime: s.loginSession.loginTime,
              isLate: s.loginSession.isLate,
              lateMinutes: s.loginSession.lateMinutes,
              autoMarkedAbsent: s.loginSession.autoMarkedAbsent,
            }
          : null,
        dailyReport: s.dailyReport
          ? {
              id: s.dailyReport.id,
              submittedAt: s.dailyReport.submittedAt,
              fbCount: parseJsonArray(s.dailyReport.fbLinks).length + parseJsonArray(s.dailyReport.fbSupplementLinks).length,
              threadCount: parseJsonArray(s.dailyReport.threadLinks).length,
              hasCommentDrive: !!s.dailyReport.commentDriveLink,
              viralCount: parseJsonArray(s.dailyReport.viralPostLinks).length,
              femaleCount: parseJsonArray(s.dailyReport.femaleContentLinks).length,
              qcReview: s.dailyReport.qcReview
                ? {
                    id: s.dailyReport.qcReview.id,
                    result: s.dailyReport.qcReview.result,
                    fbApproved: s.dailyReport.qcReview.fbApproved,
                    threadApproved: s.dailyReport.qcReview.threadApproved,
                    commentApproved: s.dailyReport.qcReview.commentApproved,
                    feedback: s.dailyReport.qcReview.feedback,
                    reviewerName: s.dailyReport.qcReview.reviewer.fullName,
                    reviewedAt: s.dailyReport.qcReview.reviewedAt,
                  }
                : null,
            }
          : null,
      })),
    });
  } catch (error: any) {
    console.error("GET /api/nghiem-thu/[userId] error:", error);
    return NextResponse.json(
      { error: "Lỗi lấy chi tiết ca làm việc: " + (error?.message || error) },
      { status: 500 }
    );
  }
}
