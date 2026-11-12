import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasAnyRole } from "@/lib/auth";
import { invalidateKpiCache } from "@/lib/kpiCache";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !hasAnyRole(session.role, ["SUPER_ADMIN", "ADMIN", "VIRAL"])) {
      return NextResponse.json(
        { error: "Bạn không có quyền chỉnh sửa mức thưởng viral" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const tierId = parseInt(id);
    if (isNaN(tierId)) {
      return NextResponse.json({ error: "ID mức thưởng không hợp lệ" }, { status: 400 });
    }

    const existingTier = await prisma.viralBonusTier.findUnique({
      where: { id: tierId },
    });

    if (!existingTier) {
      return NextResponse.json({ error: "Không tìm thấy mức thưởng cần sửa" }, { status: 404 });
    }

    const body = await request.json();
    const { minLikes, bonusAmount } = body;

    const updateData: any = {};
    if (minLikes !== undefined) {
      const parsedLikes = parseInt(minLikes);
      if (isNaN(parsedLikes) || parsedLikes <= 0) {
        return NextResponse.json({ error: "Số lượt thích tối thiểu phải là số dương" }, { status: 400 });
      }
      updateData.minLikes = parsedLikes;
    }

    if (bonusAmount !== undefined) {
      const parsedBonus = parseInt(bonusAmount);
      if (isNaN(parsedBonus) || parsedBonus < 0) {
        return NextResponse.json({ error: "Mức tiền thưởng không hợp lệ" }, { status: 400 });
      }
      updateData.bonusAmount = parsedBonus;
    }

    const updated = await prisma.viralBonusTier.update({
      where: { id: tierId },
      data: updateData,
    });

    invalidateKpiCache();

    return NextResponse.json({
      message: "Cập nhật mức thưởng viral thành công!",
      tier: updated,
    });
  } catch (error: any) {
    console.error("Lỗi API PUT /api/admin/viral-tiers/[id]:", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi cập nhật mức thưởng viral" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !hasAnyRole(session.role, ["SUPER_ADMIN", "ADMIN", "VIRAL"])) {
      return NextResponse.json(
        { error: "Bạn không có quyền xóa mức thưởng viral" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const tierId = parseInt(id);
    if (isNaN(tierId)) {
      return NextResponse.json({ error: "ID mức thưởng không hợp lệ" }, { status: 400 });
    }

    await prisma.viralBonusTier.delete({
      where: { id: tierId },
    });

    invalidateKpiCache();

    return NextResponse.json({
      message: "Đã xóa mức thưởng viral thành công!",
    });
  } catch (error: any) {
    console.error("Lỗi API DELETE /api/admin/viral-tiers/[id]:", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi xóa mức thưởng viral" },
      { status: 500 }
    );
  }
}
