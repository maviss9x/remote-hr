import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getShiftTimeRange } from "@/lib/reportSubmissionPolicy";
import { getEffectiveShiftRules, getEffectiveShiftTimes } from "@/lib/shiftRulesHelper";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await request.json();
    const shiftRegistrationId = Number(body.shiftRegistrationId);

    if (!shiftRegistrationId || Number.isNaN(shiftRegistrationId)) {
      return NextResponse.json({ error: "Vui lòng chọn ca làm việc hợp lệ" }, { status: 400 });
    }

    const shift = await prisma.shiftRegistration.findUnique({
      where: { id: shiftRegistrationId },
    });

    if (!shift) {
      return NextResponse.json({ error: "Không tìm thấy thông tin ca làm việc" }, { status: 404 });
    }

    if (shift.userId !== session.userId) {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện Vào ca cho ca làm việc này" },
        { status: 403 }
      );
    }

    if (shift.status === "CANCELLED") {
      return NextResponse.json({ error: "Ca làm việc này đã bị hủy" }, { status: 400 });
    }

    // Kiểm tra xem đã có phiên Vào ca chưa
    const existingSession = await prisma.loginSession.findUnique({
      where: { shiftRegistrationId: shift.id },
    });

    if (existingSession) {
      const loginTimeStr = new Date(existingSession.loginTime).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return NextResponse.json({
        success: true,
        alreadyCheckedIn: true,
        message: `Bạn đã bấm Vào ca này lúc ${loginTimeStr}.`,
        loginSession: existingSession,
      });
    }

    // Đọc cấu hình ca và thời gian
    const [shiftTimes, rules] = await Promise.all([
      getEffectiveShiftTimes(),
      getEffectiveShiftRules(),
    ]);

    const shiftTime = shiftTimes[shift.shiftType] || {
      startTime: "08:30",
      endTime: "12:30",
    };

    const { start: shiftStart } = getShiftTimeRange(shift.shiftDate, shiftTime);
    const checkInDeadline = new Date(shiftStart.getTime() + rules.lateCheckinMinutes * 60_000);
    const now = new Date();

    // Kiểm tra xem ca có được cấp quyền mở nộp bù đặc cách bởi Quản lý hay không
    const isSpecialReopened = Boolean(
      shift.reopenedBy &&
      shift.reopenedUntil &&
      now <= new Date(shift.reopenedUntil)
    );

    // 1. Không được bấm Vào ca trước giờ bắt đầu (trừ khi ca đã được Quản lý duyệt mở bù)
    if (now < shiftStart && !isSpecialReopened) {
      return NextResponse.json(
        {
          error: `Chưa đến giờ bắt đầu ca (${shiftTime.startTime}). Bạn chỉ được bấm Vào ca khi ca bắt đầu!`,
        },
        { status: 400 }
      );
    }

    // 2. Không được Vào ca quá thời hạn quy định (mặc định 60 phút đầu ca), TRỪ KHI được Quản lý mở nộp bù
    if (now > checkInDeadline && !isSpecialReopened) {
      return NextResponse.json(
        {
          error: `Đã quá thời gian cho phép Vào ca (${rules.lateCheckinMinutes} phút đầu ca). Ca đã bị khóa, vui lòng liên hệ Quản lý nếu cần mở nộp bù.`,
        },
        { status: 403 }
      );
    }

    // Tính toán trễ
    const isLate = now > shiftStart;
    const lateMinutes = Math.max(0, Math.floor((now.getTime() - shiftStart.getTime()) / 60_000));

    // Ghi nhận LoginSession
    const loginSession = await prisma.loginSession.create({
      data: {
        userId: session.userId,
        shiftRegistrationId: shift.id,
        loginTime: now,
        isLate,
        lateMinutes,
        autoMarkedAbsent: false,
      },
    });

    const successMessage = isSpecialReopened
      ? `Vào ca thành công (diện nộp bù được Quản lý cấp phép)! Ghi nhận vào muộn ${lateMinutes} phút.`
      : isLate
      ? `Vào ca thành công! Ghi nhận bạn vào muộn ${lateMinutes} phút.`
      : "Vào ca thành công! Bạn có thể bắt đầu nộp báo cáo link.";

    return NextResponse.json({
      success: true,
      alreadyCheckedIn: false,
      message: successMessage,
      loginSession,
    });
  } catch (error: any) {
    console.error("Lỗi API POST /api/shifts/check-in:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi ghi nhận Vào ca" }, { status: 500 });
  }
}
