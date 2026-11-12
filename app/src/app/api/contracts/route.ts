import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasAnyRole } from "@/lib/auth";
import type { Role, ContractStatus } from "@/generated/prisma";

const ALLOWED_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "HR"];

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || !hasAnyRole(session.role, ALLOWED_ROLES)) {
      return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const status = searchParams.get("status");
    const expiringSoon = searchParams.get("expiringSoon") === "true";

    const where: any = {};
    if (userId) {
      where.userId = parseInt(userId);
    }
    if (status) {
      where.status = status as ContractStatus;
    }

    if (expiringSoon) {
      const now = new Date();
      const fourteenDaysLater = new Date();
      fourteenDaysLater.setDate(now.getDate() + 14);

      where.status = "ACTIVE";
      where.endDate = {
        gte: now,
        lte: fourteenDaysLater,
      };
    }

    const contracts = await prisma.contract.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            role: true,
            status: true,
          },
        },
      },
      orderBy: { endDate: "asc" },
    });

    return NextResponse.json({ contracts });
  } catch (error: any) {
    console.error("Lỗi khi tải danh sách hợp đồng:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi tải danh sách hợp đồng" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !hasAnyRole(session.role, ALLOWED_ROLES)) {
      return NextResponse.json({ error: "Không có quyền thực hiện thao tác này" }, { status: 403 });
    }

    const body = await request.json();
    const {
      userId,
      startDate,
      endDate,
      contractType = "khoan_viec",
      note,
      action = "RENEW", // 'NEW' | 'RENEW'
      contractId,
    } = body;

    if (!userId) {
      return NextResponse.json({ error: "Thiếu ID nhân sự" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
    });

    if (!user) {
      return NextResponse.json({ error: "Không tìm thấy nhân sự" }, { status: 404 });
    }

    const parsedStartDate = startDate ? new Date(startDate) : new Date();
    let parsedEndDate: Date;

    if (endDate) {
      parsedEndDate = new Date(endDate);
    } else {
      // Mặc định thời hạn 3 tháng
      parsedEndDate = new Date(parsedStartDate);
      parsedEndDate.setMonth(parsedEndDate.getMonth() + 3);
    }

    if (parsedEndDate <= parsedStartDate) {
      return NextResponse.json(
        { error: "Ngày kết thúc hợp đồng phải sau ngày bắt đầu" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Nếu là gia hạn, đánh dấu hợp đồng cũ là RENEWED
      if (action === "RENEW") {
        if (contractId) {
          await tx.contract.update({
            where: { id: parseInt(contractId) },
            data: { status: "RENEWED" },
          });
        } else {
          // Tìm hợp đồng ACTIVE gần nhất để đổi thành RENEWED
          await tx.contract.updateMany({
            where: {
              userId: user.id,
              status: "ACTIVE",
            },
            data: { status: "RENEWED" },
          });
        }
      }

      // Tạo hợp đồng mới
      const newContract = await tx.contract.create({
        data: {
          userId: user.id,
          startDate: parsedStartDate,
          endDate: parsedEndDate,
          status: "ACTIVE",
          contractType,
          note: note || (action === "RENEW" ? "Gia hạn hợp đồng 3 tháng" : "Ký mới hợp đồng"),
        },
      });

      // Nếu nhân sự đang ở trạng thái PROBATION, chuyển sang ACTIVE khi ký HĐ
      if (user.status === "PROBATION") {
        await tx.user.update({
          where: { id: user.id },
          data: { status: "ACTIVE" },
        });
      }

      // Tạo thông báo cho nhân sự
      await tx.notification.create({
        data: {
          userId: user.id,
          type: "GENERAL",
          title: action === "RENEW" ? "Hợp đồng của bạn đã được gia hạn" : "Bạn có hợp đồng mới",
          message: `Hợp đồng ${contractType} của bạn có hiệu lực từ ${parsedStartDate.toLocaleDateString("vi-VN")} đến ${parsedEndDate.toLocaleDateString("vi-VN")}.`,
        },
      });

      return newContract;
    });

    return NextResponse.json({
      message: action === "RENEW" ? "Gia hạn hợp đồng thành công" : "Tạo hợp đồng mới thành công",
      contract: result,
    });
  } catch (error: any) {
    console.error("Lỗi khi tạo/gia hạn hợp đồng:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi thao tác hợp đồng" }, { status: 500 });
  }
}
