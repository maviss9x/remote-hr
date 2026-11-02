import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isManager } from "@/lib/auth";
import { getWeekRange } from "@/lib/dateUtils";
import { parseJsonArray, stringifyJsonArray } from "@/lib/json-fields";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await request.json();
    const { action, weekNumber, year, targetUserId, shiftId, reason, revoke } = body;

    const parsedWeek = parseInt(weekNumber);
    const parsedYear = parseInt(year);

    // ============================================
    // Action 1: Đăng ký Nghỉ phép ca (Áp dụng cho cả Nhân sự & Quản lý)
    // ============================================
    if (action === "REQUEST_LEAVE") {
      if (!shiftId) {
        return NextResponse.json({ error: "Thiếu thông tin ca làm việc cần xin nghỉ" }, { status: 400 });
      }

      const shift = await prisma.shiftRegistration.findUnique({
        where: { id: parseInt(shiftId) },
        include: { user: true },
      });

      if (!shift) {
        return NextResponse.json({ error: "Không tìm thấy ca làm việc" }, { status: 404 });
      }

      // Nếu không phải Manager thì chỉ được xin nghỉ ca của chính mình
      const hasManagerPermission = isManager(session.role) || session.role === "HR";
      if (!hasManagerPermission && shift.userId !== session.userId) {
        return NextResponse.json({ error: "Bạn chỉ có thể xin nghỉ ca của chính mình" }, { status: 403 });
      }

      // Đếm số ca đã vắng/nghỉ trong tháng của ca đó
      const shiftDate = new Date(shift.shiftDate);
      const startOfMonth = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), 1);
      const endOfMonth = new Date(shiftDate.getFullYear(), shiftDate.getMonth() + 1, 0, 23, 59, 59);

      const absentsInMonth = await prisma.shiftRegistration.count({
        where: {
          userId: shift.userId,
          status: "ABSENT",
          shiftDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      });

      // Cập nhật trạng thái ca thành ABSENT
      await prisma.shiftRegistration.update({
        where: { id: shift.id },
        data: { status: "ABSENT" },
      });

      // Tạo thông báo
      await prisma.notification.create({
        data: {
          userId: shift.userId,
          type: "ABSENT_MARKED",
          title: "Xác nhận nghỉ phép ca",
          message: `Ca làm việc ngày ${shiftDate.toLocaleDateString("vi-VN")} (${shift.shiftType}) đã được ghi nhận nghỉ phép. Lý do: ${reason || "Báo bận"}.`,
        },
      });

      const totalAbsents = absentsInMonth + 1;
      let warningMessage = "";
      if (totalAbsents > 3) {
        warningMessage = `⚠️ CẢNH BÁO: Nhân sự đã nghỉ ${totalAbsents}/3 ca tối đa trong tháng! Vượt quá quy định Freetrip có thể ảnh hưởng đến nghiệm thu lương.`;
      }

      return NextResponse.json({
        message: `Đã xác nhận nghỉ ca ngày ${shiftDate.toLocaleDateString("vi-VN")}`,
        absentsInMonth: totalAbsents,
        warning: warningMessage || undefined,
      });
    }

    // ============================================
    // Các Action dưới đây BẮT BUỘC quyền Quản lý
    // ============================================
    if (!isManager(session.role) && session.role !== "HR") {
      return NextResponse.json({ error: "Không có quyền thực hiện thao tác quản lý ca" }, { status: 403 });
    }

    // Action 2: Khóa hoặc Mở khóa form đăng ký tuần
    if (action === "TOGGLE_LOCK") {
      const config = await prisma.shiftScheduleConfig.findUnique({
        where: { weekNumber_year: { weekNumber: parsedWeek, year: parsedYear } },
      });

      const now = new Date();
      // Tuần hiện tại có đang bị coi là khóa không (do cờ isLocked, đã duyệt approvedAt, hoặc quá hạn registrationCloseAt)
      const isCurrentlyLocked = Boolean(
        config?.isLocked ||
        config?.approvedAt ||
        (config?.registrationCloseAt && now > config.registrationCloseAt)
      );

      // Nếu client truyền explicit newLockState thì dùng, nếu không thì đảo ngược trạng thái khóa hiện tại
      const newLockState = typeof body.newLockState === "boolean" ? body.newLockState : !isCurrentlyLocked;
      const { monday, sunday } = getWeekRange(parsedWeek, parsedYear);

      // Nếu mở khóa (newLockState = false), gia hạn registrationCloseAt tới Chủ Nhật cuối tuần đó (hoặc ít nhất 7 ngày sau)
      // để không bị chặn bởi điều kiện tự động hết hạn
      let newCloseDate = config?.registrationCloseAt;
      if (!newLockState) {
        const endOfWeek = new Date(sunday);
        endOfWeek.setUTCHours(23, 59, 59, 999);
        newCloseDate = endOfWeek > now ? endOfWeek : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      }

      const updated = await prisma.shiftScheduleConfig.upsert({
        where: { weekNumber_year: { weekNumber: parsedWeek, year: parsedYear } },
        update: {
          isLocked: newLockState,
          approvedAt: newLockState ? undefined : null,
          approvedByManagerId: newLockState ? undefined : null,
          ...(newCloseDate ? { registrationCloseAt: newCloseDate } : {}),
        },
        create: {
          weekNumber: parsedWeek,
          year: parsedYear,
          registrationOpenAt: monday,
          registrationCloseAt: newCloseDate || sunday,
          isLocked: newLockState,
          reopenedUserIds: "[]",
        },
      });

      return NextResponse.json({
        message: newLockState ? `Đã KHÓA đăng ký ca tuần ${parsedWeek}` : `Đã MỞ LẠI đăng ký ca tuần ${parsedWeek}`,
        isLocked: updated.isLocked,
        registrationCloseAt: updated.registrationCloseAt,
      });
    }

    // Action 3: Duyệt toàn bộ ca tuần (APPROVE_WEEK)
    if (action === "APPROVE_WEEK") {
      const count = await prisma.$transaction(async (tx) => {
        // Cập nhật tất cả ca REGISTERED thành APPROVED
        const result = await tx.shiftRegistration.updateMany({
          where: {
            weekNumber: parsedWeek,
            year: parsedYear,
            status: "REGISTERED",
          },
          data: { status: "APPROVED" },
        });

        // Đánh dấu config tuần đã được duyệt và khóa
        await tx.shiftScheduleConfig.upsert({
          where: { weekNumber_year: { weekNumber: parsedWeek, year: parsedYear } },
          update: {
            approvedByManagerId: session.userId,
            approvedAt: new Date(),
            isLocked: true,
          },
          create: {
            weekNumber: parsedWeek,
            year: parsedYear,
            registrationOpenAt: new Date(),
            registrationCloseAt: new Date(),
            approvedByManagerId: session.userId,
            approvedAt: new Date(),
            isLocked: true,
            reopenedUserIds: "[]",
          },
        });

        return result.count;
      });

      return NextResponse.json({
        message: `Đã duyệt thành công ${count} ca làm việc cho toàn đội trong tuần ${parsedWeek}!`,
        approvedCount: count,
      });
    }

    // Action 4: Duyệt ca của 1 nhân sự cụ thể (APPROVE_USER)
    if (action === "APPROVE_USER") {
      if (!targetUserId) {
        return NextResponse.json({ error: "Thiếu ID nhân sự cần duyệt" }, { status: 400 });
      }

      const result = await prisma.shiftRegistration.updateMany({
        where: {
          userId: parseInt(targetUserId),
          weekNumber: parsedWeek,
          year: parsedYear,
          status: "REGISTERED",
        },
        data: { status: "APPROVED" },
      });

      return NextResponse.json({
        message: `Đã duyệt ${result.count} ca của nhân sự!`,
      });
    }

    // Action 5: Mở khóa / Thu hồi nộp bù cho 1 nhân sự (REOPEN_USER)
    if (action === "REOPEN_USER") {
      if (!targetUserId) {
        return NextResponse.json({ error: "Thiếu ID nhân sự cần mở khóa" }, { status: 400 });
      }

      const targetId = parseInt(targetUserId);

      // 1. Lấy hoặc tạo cấu hình tuần
      const { monday, sunday } = getWeekRange(parsedWeek, parsedYear);
      const existingConfig = await prisma.shiftScheduleConfig.findUnique({
        where: { weekNumber_year: { weekNumber: parsedWeek, year: parsedYear } },
      });

      const currentReopened = parseJsonArray<number>(existingConfig?.reopenedUserIds);

      // Nhánh THU HỒI QUYỀN
      if (revoke) {
        const updatedReopened = currentReopened.filter((id) => id !== targetId);

        await prisma.shiftScheduleConfig.upsert({
          where: { weekNumber_year: { weekNumber: parsedWeek, year: parsedYear } },
          update: {
            reopenedUserIds: stringifyJsonArray(updatedReopened),
          },
          create: {
            weekNumber: parsedWeek,
            year: parsedYear,
            registrationOpenAt: monday,
            registrationCloseAt: sunday,
            isLocked: true,
            reopenedUserIds: "[]",
          },
        });

        return NextResponse.json({
          message: `Đã thu hồi quyền sửa ca / khóa lại tuần ${parsedWeek} cho nhân sự!`,
          reopenedUserIds: updatedReopened,
        });
      }

      // Nhánh MỞ QUYỀN
      const updatedReopened = Array.from(new Set([...currentReopened, targetId]));

      await prisma.shiftScheduleConfig.upsert({
        where: { weekNumber_year: { weekNumber: parsedWeek, year: parsedYear } },
        update: {
          reopenedUserIds: stringifyJsonArray(updatedReopened),
        },
        create: {
          weekNumber: parsedWeek,
          year: parsedYear,
          registrationOpenAt: monday,
          registrationCloseAt: sunday,
          isLocked: true,
          reopenedUserIds: stringifyJsonArray([targetId]),
        },
      });

      // 2. Nếu nhân sự đã có các ca ở trạng thái APPROVED/REJECTED, chuyển về REGISTERED để nhân sự chỉnh sửa
      await prisma.shiftRegistration.updateMany({
        where: {
          userId: targetId,
          weekNumber: parsedWeek,
          year: parsedYear,
        },
        data: {
          status: "REGISTERED",
        },
      });

      // 3. Tạo thông báo cho nhân sự
      await prisma.notification.create({
        data: {
          userId: targetId,
          type: "GENERAL",
          title: "Mở khóa chỉnh sửa / nộp bù ca làm việc",
          message: `Quản lý đã mở quyền cho phép bạn nộp bù hoặc sửa đổi lịch ca tuần ${parsedWeek}. Vui lòng cập nhật sớm!`,
        },
      });

      return NextResponse.json({
        message: `Đã mở quyền nộp bù / chỉnh sửa ca tuần ${parsedWeek} cho nhân sự!`,
        reopenedUserIds: updatedReopened,
      });
    }

    return NextResponse.json({ error: "Thao tác không hợp lệ" }, { status: 400 });
  } catch (error: any) {
    console.error("Lỗi khi thực hiện thao tác quản lý ca:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi máy chủ", details: error.message },
      { status: 500 }
    );
  }
}
