import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { invalidateKpiCache } from "@/lib/kpiCache";
import { ContentType, Platform } from "@/generated/prisma";

export async function GET() {
  try {
    const session = await getSession();
    const ALLOWED_GET_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "QC"];
    if (!session || !ALLOWED_GET_ROLES.includes(session.role)) {
      return NextResponse.json(
        { error: "Không có quyền truy cập danh sách mức thưởng viral" },
        { status: 403 }
      );
    }

    const tiers = await prisma.viralBonusTier.findMany({
      orderBy: [
        { platform: "asc" },
        { contentType: "asc" },
        { minLikes: "asc" },
      ],
    });

    return NextResponse.json({ tiers });
  } catch (error: any) {
    console.error("Lỗi API GET /api/admin/viral-tiers:", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi lấy danh sách mức thưởng viral" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Chỉ Quản trị viên cấp cao nhất (SUPER_ADMIN) mới có quyền thêm mức thưởng" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { platform, contentType, minLikes, bonusAmount } = body;

    if (!platform || !["FACEBOOK", "THREADS"].includes(platform)) {
      return NextResponse.json({ error: "Nền tảng không hợp lệ (FACEBOOK hoặc THREADS)" }, { status: 400 });
    }

    if (!contentType || !["POST", "COMMENT"].includes(contentType)) {
      return NextResponse.json({ error: "Loại nội dung không hợp lệ (POST hoặc COMMENT)" }, { status: 400 });
    }

    const parsedLikes = parseInt(minLikes);
    const parsedBonus = parseInt(bonusAmount);

    if (isNaN(parsedLikes) || parsedLikes <= 0) {
      return NextResponse.json({ error: "Số lượt thích tối thiểu phải là số nguyên dương" }, { status: 400 });
    }

    if (isNaN(parsedBonus) || parsedBonus < 0) {
      return NextResponse.json({ error: "Mức tiền thưởng không hợp lệ" }, { status: 400 });
    }

    // Check duplicate tier
    const existing = await prisma.viralBonusTier.findUnique({
      where: {
        contentType_platform_minLikes: {
          contentType: contentType as ContentType,
          platform: platform as Platform,
          minLikes: parsedLikes,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Mốc ${parsedLikes} likes cho ${contentType} trên ${platform} đã tồn tại!` },
        { status: 400 }
      );
    }

    const newTier = await prisma.viralBonusTier.create({
      data: {
        platform: platform as Platform,
        contentType: contentType as ContentType,
        minLikes: parsedLikes,
        bonusAmount: parsedBonus,
      },
    });

    invalidateKpiCache();

    return NextResponse.json({
      message: "Thêm mốc thưởng viral thành công!",
      tier: newTier,
    });
  } catch (error: any) {
    console.error("Lỗi API POST /api/admin/viral-tiers:", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi thêm mức thưởng viral" },
      { status: 500 }
    );
  }
}
