import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasAnyRole } from "@/lib/auth";

const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "QC"];

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !hasAnyRole(session.role, ALLOWED_ROLES)) {
      return NextResponse.json({ error: "Không có quyền thực hiện thao tác này" }, { status: 403 });
    }

    const body = await request.json();
    const { shiftRegistrationId, shiftRegistrationIds, action, reason } = body;

    // Chuẩn hóa danh sách ID ca làm việc (hỗ trợ cả đơn lẻ và hàng loạt)
    const targetIds: number[] = [];
    if (Array.isArray(shiftRegistrationIds)) {
      for (const id of shiftRegistrationIds) {
        const num = parseInt(id);
        if (!isNaN(num)) targetIds.push(num);
      }
    } else if (shiftRegistrationId) {
      const num = parseInt(shiftRegistrationId);
      if (!isNaN(num)) targetIds.push(num);
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ error: "Thiếu ID ca làm việc" }, { status: 400 });
    }

    const shifts = await prisma.shiftRegistration.findMany({
      where: { id: { in: targetIds } },
      include: { user: true },
    });

    if (shifts.length === 0) {
      return NextResponse.json({ error: "Không tìm thấy ca làm việc hợp lệ" }, { status: 404 });
    }

    // ============================================
    // Action 1: Đánh vắng ca (MARK_ABSENT) do vào muộn > 60 phút hoặc không có báo cáo
    // ============================================
    if (action === "MARK_ABSENT") {
      await prisma.$transaction(async (tx) => {
        for (const shift of shifts) {
          const shiftDateStr = new Date(shift.shiftDate).toLocaleDateString("vi-VN");

          // Cập nhật trạng thái ca thành ABSENT
          await tx.shiftRegistration.update({
            where: { id: shift.id },
            data: { status: "ABSENT" },
          });

          // Upsert LoginSession đánh dấu vắng ca
          await tx.loginSession.upsert({
            where: { shiftRegistrationId: shift.id },
            update: {
              autoMarkedAbsent: true,
              isLate: true,
            },
            create: {
              userId: shift.userId,
              shiftRegistrationId: shift.id,
              loginTime: new Date(),
              autoMarkedAbsent: true,
              isLate: true,
              lateMinutes: 65,
            },
          });

          // Tạo thông báo cảnh báo cho nhân sự
          await tx.notification.create({
            data: {
              userId: shift.userId,
              type: "ABSENT_MARKED",
              title: `Đã đánh vắng ca ngày ${shiftDateStr}`,
              message: `Bạn bị ghi nhận VẮNG CA ngày ${shiftDateStr} (${shift.shiftType}) do vào ca muộn quá 60 phút hoặc không nộp báo cáo ca. Lý do: ${reason || "Không đăng nhập đúng giờ quy định"}.`,
            },
          });
        }
      });

      return NextResponse.json({
        message:
          shifts.length === 1
            ? `Đã chuyển ca ngày ${new Date(shifts[0].shiftDate).toLocaleDateString("vi-VN")} của ${shifts[0].user.fullName} sang trạng thái VẮNG CA (ABSENT)!`
            : `Đã đánh vắng ca cho ${shifts.length} nhân sự thành công!`,
      });
    }

    // ============================================
    // Action 2: Mở khóa nộp bù ca cho nhân sự (REOPEN_SHIFT)
    // ============================================
    if (action === "REOPEN_SHIFT") {
      const { durationMinutes, reopenedUntil: inputReopenedUntil } = body;
      let targetUntil: Date | null = null;

      if (inputReopenedUntil) {
        targetUntil = new Date(inputReopenedUntil);
      } else if (durationMinutes && Number(durationMinutes) > 0) {
        targetUntil = new Date(Date.now() + Number(durationMinutes) * 60 * 1000);
      }

      const untilStr = targetUntil
        ? targetUntil.toLocaleString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
        : "";

      await prisma.$transaction(async (tx) => {
        await tx.shiftRegistration.updateMany({
          where: { id: { in: shifts.map((s) => s.id) } },
          data: {
            reopenedBy: session.userId,
            reopenedUntil: targetUntil,
            status: "REGISTERED",
          },
        });

        // Tạo thông báo mở quyền cho từng nhân sự
        for (const shift of shifts) {
          const shiftDateStr = new Date(shift.shiftDate).toLocaleDateString("vi-VN");
          await tx.notification.create({
            data: {
              userId: shift.userId,
              type: "GENERAL",
              title: `Mở khóa nộp bù báo cáo ca ${shiftDateStr}`,
              message: `QC/Quản lý đã cấp quyền cho bạn nộp bù báo cáo ca ngày ${shiftDateStr} (${shift.shiftType})${untilStr ? `, hạn chót đến ${untilStr}` : ""}. Vui lòng hoàn thành nộp link đúng hạn!`,
            },
          });
        }
      });

      return NextResponse.json({
        message:
          shifts.length === 1
            ? `Đã mở quyền nộp bù báo cáo ca ngày ${new Date(shifts[0].shiftDate).toLocaleDateString("vi-VN")} cho ${shifts[0].user.fullName}!`
            : `Đã mở quyền nộp bù ca cho ${shifts.length} nhân sự thành công!`,
        reopenedUntil: targetUntil ? targetUntil.toISOString() : null,
        count: shifts.length,
      });
    }

    // ============================================
    // Action 2.1: Đóng quyền nộp bù ca (CLOSE_REOPEN_SHIFT)
    // ============================================
    if (action === "CLOSE_REOPEN_SHIFT") {
      await prisma.$transaction(async (tx) => {
        await tx.shiftRegistration.updateMany({
          where: { id: { in: shifts.map((s) => s.id) } },
          data: {
            reopenedBy: null,
            reopenedUntil: null,
          },
        });

        for (const shift of shifts) {
          const shiftDateStr = new Date(shift.shiftDate).toLocaleDateString("vi-VN");
          await tx.notification.create({
            data: {
              userId: shift.userId,
              type: "GENERAL",
              title: `Đã đóng nộp bù ca ${shiftDateStr}`,
              message: `QC/Quản lý đã đóng quyền nộp bù báo cáo ca ngày ${shiftDateStr} (${shift.shiftType}).`,
            },
          });
        }
      });

      return NextResponse.json({
        message:
          shifts.length === 1
            ? `Đã đóng quyền nộp bù ca ngày ${new Date(shifts[0].shiftDate).toLocaleDateString("vi-VN")} của ${shifts[0].user.fullName}!`
            : `Đã đóng quyền nộp bù ca cho ${shifts.length} nhân sự!`,
      });
    }

    // ============================================
    // Action 3: Nhắc nhở nhân sự nộp báo cáo ca (REMIND)
    // ============================================
    if (action === "REMIND") {
      for (const shift of shifts) {
        const shiftDateStr = new Date(shift.shiftDate).toLocaleDateString("vi-VN");
        await prisma.notification.create({
          data: {
            userId: shift.userId,
            type: "GENERAL",
            title: `Nhắc nhở nộp báo cáo ca ${shiftDateStr}`,
            message: `QC/Quản lý nhắc nhở: Ca làm việc ngày ${shiftDateStr} (${shift.shiftType}) của bạn hiện CHƯA nộp báo cáo bài viết. Vui lòng truy cập trang Báo Cáo và nộp link ngay!`,
          },
        });
      }

      return NextResponse.json({
        message:
          shifts.length === 1
            ? `Đã gửi thông báo nhắc nhở nộp link tới nhân sự ${shifts[0].user.fullName}!`
            : `Đã gửi thông báo nhắc nhở tới ${shifts.length} nhân sự!`,
      });
    }

    return NextResponse.json({ error: "Thao tác không hợp lệ" }, { status: 400 });
  } catch (error: any) {
    console.error("Lỗi khi xử lý điểm danh/vắng ca:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi máy chủ", details: error.message },
      { status: 500 }
    );
  }
}
