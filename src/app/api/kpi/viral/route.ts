import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getISOWeekAndYear } from "@/lib/dateUtils";

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

    // 1. Lấy danh sách bậc thưởng viral
    const bonusTiers = await prisma.viralBonusTier.findMany({
      orderBy: [{ platform: "asc" }, { contentType: "asc" }, { minLikes: "asc" }],
    });

    // 2. Lấy các bài viral từ bảng quan hệ viral_posts
    const whereCondition: any = {
      dailyReport: {
        shiftRegistration: {
          weekNumber,
          year,
        },
      },
    };

    // Nếu là nhân sự thường, chỉ xem bài viral của chính mình
    if (session.role === "NHAN_SU_HYBRID") {
      whereCondition.userId = session.userId;
    }

    const posts = await prisma.viralPost.findMany({
      where: whereCondition,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
        dailyReport: {
          select: {
            id: true,
            reportDate: true,
            shiftType: true,
            submittedAt: true,
            shiftRegistration: {
              select: {
                shiftDate: true,
                shiftType: true,
                weekNumber: true,
                year: true,
              },
            },
          },
        },
      },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
    });

    const mappedPosts = posts.map((p) => ({
      id: p.id,
      link: p.postUrl,
      userId: p.userId,
      authorName: p.user?.fullName || "Không rõ",
      userPhone: p.user?.phone || "",
      reportDate: p.dailyReport?.reportDate || p.dailyReport?.shiftRegistration?.shiftDate,
      reportId: p.dailyReportId,
      shiftType: p.shiftType || p.dailyReport?.shiftType || p.dailyReport?.shiftRegistration?.shiftType || "MORNING",
      submittedAt: p.submittedAt || p.dailyReport?.submittedAt,
      isFemaleContent: p.isFemaleContent,
      platform: p.platform,
      contentType: p.contentType,
      likes: p.likes,
      bonusAmount: p.bonusAmount,
    }));

    return NextResponse.json({
      week: weekNumber,
      year,
      tiers: bonusTiers,
      posts: mappedPosts,
    });
  } catch (error) {
    console.error("Lỗi lấy thông tin bài viral:", error);
    return NextResponse.json({ error: "Lỗi nội bộ khi lấy bài viral" }, { status: 500 });
  }
}

// POST: Hỗ trợ tính toán mức thưởng theo lượt like
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await request.json();
    const { platform = "FACEBOOK", contentType = "POST", likes = 0 } = body;

    const likeCount = Math.max(0, parseInt(likes) || 0);

    // Tìm bậc thưởng cao nhất mà likeCount >= minLikes
    const matchedTier = await prisma.viralBonusTier.findFirst({
      where: {
        platform,
        contentType,
        minLikes: { lte: likeCount },
      },
      orderBy: { minLikes: "desc" },
    });

    return NextResponse.json({
      likes: likeCount,
      platform,
      contentType,
      bonusAmount: matchedTier ? matchedTier.bonusAmount : 0,
      matchedTier,
    });
  } catch (error) {
    console.error("Lỗi tính tiền thưởng viral:", error);
    return NextResponse.json({ error: "Lỗi nội bộ khi tính tiền thưởng" }, { status: 500 });
  }
}

// PATCH: Cập nhật số like / tiền thưởng cho từng bài viral từ Bảng Vàng
const ALLOWED_ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "QC"];

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || !ALLOWED_ADMIN_ROLES.includes(session.role)) {
      return NextResponse.json({ error: "Không có quyền cập nhật bài viral" }, { status: 403 });
    }

    const body = await request.json();
    const { id, likes, bonusAmount: customBonus } = body;

    if (!id || typeof likes === "undefined") {
      return NextResponse.json({ error: "Thiếu ID hoặc số like bài viết" }, { status: 400 });
    }

    const post = await prisma.viralPost.findUnique({
      where: { id: parseInt(id) },
      include: {
        dailyReport: {
          include: {
            shiftRegistration: true,
          },
        },
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Không tìm thấy bài viết viral" }, { status: 404 });
    }

    const nextLikes = Math.max(0, parseInt(likes) || 0);

    // Tự động tính tiền thưởng nếu không truyền customBonus
    let calculatedBonus = 0;
    if (typeof customBonus === "number") {
      calculatedBonus = Math.max(0, customBonus);
    } else {
      const matchedTier = await prisma.viralBonusTier.findFirst({
        where: {
          platform: post.platform,
          contentType: post.contentType,
          minLikes: { lte: nextLikes },
        },
        orderBy: { minLikes: "desc" },
      });
      calculatedBonus = matchedTier ? matchedTier.bonusAmount : 0;
    }

    // Cập nhật bài viral
    const updatedPost = await prisma.viralPost.update({
      where: { id: post.id },
      data: {
        likes: nextLikes,
        bonusAmount: calculatedBonus,
      },
    });

    // Đồng bộ lại tổng viralBonus của user này trong tuần vào WeeklyEvaluation (nếu có)
    const weekNumber = post.dailyReport?.shiftRegistration?.weekNumber;
    const year = post.dailyReport?.shiftRegistration?.year;

    if (weekNumber && year) {
      // Tính tổng tiền thưởng các bài viral của user trong tuần này
      const userWeekPosts = await prisma.viralPost.findMany({
        where: {
          userId: post.userId,
          dailyReport: {
            shiftRegistration: {
              weekNumber,
              year,
            },
          },
        },
        select: {
          bonusAmount: true,
        },
      });

      const totalBonus = userWeekPosts.reduce((sum, p) => sum + p.bonusAmount, 0);

      await prisma.weeklyEvaluation.updateMany({
        where: {
          userId: post.userId,
          weekNumber,
          year,
        },
        data: {
          viralBonus: totalBonus,
        },
      });
    }

    return NextResponse.json({
      message: "Cập nhật bài viết viral thành công!",
      post: updatedPost,
    });
  } catch (error: any) {
    console.error("Lỗi khi cập nhật bài viral:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi cập nhật bài viral", details: error.message },
      { status: 500 }
    );
  }
}
