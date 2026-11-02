import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import type { ReviewResult } from "@/generated/prisma";
import { parseJsonArray, stringifyJsonArray } from "@/lib/json-fields";

const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "QC"];

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: "Không có quyền thực hiện kiểm duyệt QC" }, { status: 403 });
    }

    const body = await request.json();
    const {
      dailyReportId,
      fbApproved = 0,
      threadApproved = 0,
      commentApproved = 0,
      result = "PASS",
      feedback = "",
      viralApprovedLinks = [],
      viralBonusAmount = 0,
      viralLikes = {},
      viralContentTypes = {},
      invalidLinks = [],
    } = body;

    const cleanInvalidLinks = Array.isArray(invalidLinks)
      ? invalidLinks.map((l: unknown) => String(l).trim()).filter(Boolean)
      : [];

    if (!dailyReportId) {
      return NextResponse.json({ error: "Thiếu ID báo cáo cần chấm điểm" }, { status: 400 });
    }

    const report = await prisma.dailyReport.findUnique({
      where: { id: parseInt(dailyReportId) },
      include: {
        user: true,
        shiftRegistration: true,
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Không tìm thấy báo cáo kiểm duyệt" }, { status: 404 });
    }

    // Lấy bậc thưởng viral để tính chính xác cho từng bài
    const bonusTiers = await prisma.viralBonusTier.findMany({
      orderBy: [{ platform: "asc" }, { contentType: "asc" }, { minLikes: "asc" }],
    });

    const calculateBonus = (platform: string, contentType: string, likes: number): number => {
      // 1. Thử match chính xác theo platform và contentType
      const matched = bonusTiers
        .filter((t) => t.platform === platform && t.contentType === contentType && likes >= t.minLikes)
        .sort((a, b) => b.minLikes - a.minLikes)[0];
      if (matched) return matched.bonusAmount;

      // 2. Fallback tìm theo platform nếu chưa khớp contentType
      const fallbackMatched = bonusTiers
        .filter((t) => t.platform === platform && likes >= t.minLikes)
        .sort((a, b) => b.minLikes - a.minLikes)[0];
      return fallbackMatched ? fallbackMatched.bonusAmount : 0;
    };

    // Transaction cập nhật kết quả chấm bài và bài viral
    const updatedReview = await prisma.$transaction(async (tx) => {
      // 1. Cập nhật danh sách bài Viral được Quản lý duyệt trong DailyReport
      const cleanViralLinks = Array.isArray(viralApprovedLinks)
        ? viralApprovedLinks.map((l: unknown) => String(l).trim()).filter(Boolean)
        : [];

      // Giữ nguyên viralPostLinks của nhân sự (đại diện cho Bài viết nổi bật của ca)
      // Danh sách bài Viral được Quản lý duyệt được lưu trữ và quản lý độc lập trong bảng viral_posts bên dưới.

      // 1.1 Đồng bộ bảng quan hệ viral_posts
      const femaleLinks = new Set(parseJsonArray<string>(report.femaleContentLinks).map((l) => l.trim()));

      // Xóa bài viral không còn được duyệt trong ca này
      await tx.viralPost.deleteMany({
        where: {
          dailyReportId: report.id,
          postUrl: {
            notIn: cleanViralLinks,
          },
        },
      });

      // Thêm hoặc cập nhật từng bài viral
      for (const url of cleanViralLinks) {
        const isFb = url.includes("facebook.com") || url.includes("fb.watch");
        const platform = isFb ? "FACEBOOK" : "THREADS";
        const rawType = (viralContentTypes as any)?.[url];
        const contentType = rawType === "COMMENT" ? "COMMENT" : "POST";
        const isFemaleContent = femaleLinks.has(url);
        const postLikes = Math.max(0, parseInt((viralLikes as any)[url]) || 500);
        const postBonus = calculateBonus(platform, contentType, postLikes);

        const existingViral = await tx.viralPost.findFirst({
          where: {
            dailyReportId: report.id,
            postUrl: url,
          },
        });

        if (existingViral) {
          await tx.viralPost.update({
            where: { id: existingViral.id },
            data: {
              contentType,
              likes: postLikes,
              bonusAmount: postBonus,
              isFemaleContent,
            },
          });
        } else {
          await tx.viralPost.create({
            data: {
              dailyReportId: report.id,
              userId: report.userId,
              postUrl: url,
              platform,
              contentType,
              likes: postLikes,
              bonusAmount: postBonus,
              isFemaleContent,
              shiftType: report.shiftType || report.shiftRegistration?.shiftType || "MORNING",
              submittedAt: report.submittedAt || new Date(),
            },
          });
        }
      }

      // 2. Cập nhật bản ghi QcReview
      const qc = await tx.qcReview.upsert({
        where: { dailyReportId: report.id },
        update: {
          reviewerId: session.userId,
          fbApproved: parseInt(fbApproved) || 0,
          threadApproved: parseInt(threadApproved) || 0,
          commentApproved: parseInt(commentApproved) || 0,
          result: result as ReviewResult,
          feedback: feedback ? feedback.trim() : null,
          invalidLinks: stringifyJsonArray(cleanInvalidLinks),
          reviewedAt: new Date(),
        },
        create: {
          dailyReportId: report.id,
          reviewerId: session.userId,
          fbApproved: parseInt(fbApproved) || 0,
          threadApproved: parseInt(threadApproved) || 0,
          commentApproved: parseInt(commentApproved) || 0,
          result: result as ReviewResult,
          feedback: feedback ? feedback.trim() : null,
          invalidLinks: stringifyJsonArray(cleanInvalidLinks),
          reviewedAt: new Date(),
        },
      });

      // 3. Cập nhật trạng thái ca làm việc
      await tx.shiftRegistration.update({
        where: { id: report.shiftRegistrationId },
        data: {
          status: result === "PASS" ? "COMPLETED" : "REJECTED",
        },
      });

      // 4. Đồng bộ lại WeeklyEvaluation (KPI tuần) của nhân sự dựa trên bài viral thực tế
      if (report.shiftRegistration) {
        const { weekNumber, year } = report.shiftRegistration;

        // Lấy tất cả bài viral của user trong tuần này thuộc các ca đã được duyệt PASS
        const userWeekViralPosts = await tx.viralPost.findMany({
          where: {
            userId: report.userId,
            dailyReport: {
              shiftRegistration: {
                weekNumber,
                year,
              },
              qcReview: {
                result: "PASS",
              },
            },
          },
          select: {
            postUrl: true,
            bonusAmount: true,
          },
        });

        const totalWeeklyViralBonus = userWeekViralPosts.reduce((sum, p) => sum + (p.bonusAmount || 0), 0);
        const distinctWeeklyViralLinks = Array.from(new Set(userWeekViralPosts.map((p) => p.postUrl)));

        const existingEval = await tx.weeklyEvaluation.findUnique({
          where: {
            userId_weekNumber_year: {
              userId: report.userId,
              weekNumber,
              year,
            },
          },
        });

        if (existingEval) {
          await tx.weeklyEvaluation.update({
            where: { id: existingEval.id },
            data: {
              viralLinks: stringifyJsonArray(distinctWeeklyViralLinks),
              viralBonus: totalWeeklyViralBonus,
            },
          });
        } else if (distinctWeeklyViralLinks.length > 0 || totalWeeklyViralBonus > 0) {
          await tx.weeklyEvaluation.create({
            data: {
              userId: report.userId,
              weekNumber,
              year,
              viralLinks: stringifyJsonArray(distinctWeeklyViralLinks),
              viralBonus: totalWeeklyViralBonus,
            },
          });
        }
      }

      // 5. Tạo thông báo kết quả cho nhân sự
      const bonusNumber = Math.max(0, parseInt(viralBonusAmount) || 0);
      const reportDateStr = new Date(report.reportDate).toLocaleDateString("vi-VN");
      const isPass = result === "PASS";
      const viralBonusText = bonusNumber > 0
        ? ` 🎉 Bạn được Quản lý duyệt ${cleanViralLinks.length} bài Viral (+${bonusNumber.toLocaleString("vi-VN")} đ thưởng)!`
        : cleanViralLinks.length > 0
        ? ` 🔥 Quản lý đã duyệt ${cleanViralLinks.length} bài Viral của ca này!`
        : "";

      await tx.notification.create({
        data: {
          userId: report.userId,
          type: "QC_RESULT",
          title: isPass
            ? `Ca làm việc ngày ${reportDateStr} đã ĐẠT`
            : `Ca làm việc ngày ${reportDateStr} KHÔNG ĐẠT`,
          message: isPass
            ? `QC đã duyệt ca của bạn: ${fbApproved}/10 FB, ${threadApproved}/4 Threads, ${commentApproved} comments đạt chuẩn.${viralBonusText} Lời nhắn: ${feedback || "Tốt!"}`
            : `QC đánh giá ca của bạn chưa đạt yêu cầu. Lời nhắn: ${feedback || "Vui lòng xem lại nội dung hoặc liên hệ QC."}`,
        },
      });

      return qc;
    });

    return NextResponse.json({
      message: `Đã lưu kết quả kiểm duyệt: ${result === "PASS" ? "ĐẠT (PASS)" : "KHÔNG ĐẠT (FAIL)"}!`,
      review: updatedReview,
    });
  } catch (error: any) {
    console.error("Lỗi khi lưu kết quả kiểm duyệt QC:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi máy chủ khi lưu đánh giá", details: error.message },
      { status: 500 }
    );
  }
}
