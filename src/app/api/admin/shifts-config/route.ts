import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parseJsonObject, stringifyJsonObject } from "@/lib/json-fields";

import { DEFAULT_SHIFT_TIMES } from "@/lib/shifts-constants";

const DEFAULT_SHIFT_RULES = {
  openDayOfWeek: 5, // Thứ Sáu
  openTime: "00:00",
  closeDayOfWeek: 0, // Chủ Nhật
  closeTime: "23:59",
  maxShiftsPerDay: 1, // Chính sách chuẩn áp dụng từ Tháng 09/2026 (1 ca/ngày)
  minShiftsPerWeek: 5,
  allowCancelHoursBefore: 4,
  maxAbsentsPerMonth: 3,
  maxUsersPerShift: 10, // Tổng số người tối đa đăng ký mỗi ca làm việc
  tagPostGraceDays: 7, // Hạn gắn thẻ loại bài viết sau ca (ngày)
  viralPostGraceDays: 30, // Hạn gắn cờ bài viết viral sau ca (ngày)
  lateCheckinMinutes: 60, // Vào muộn quá N phút sẽ khóa form
  postShiftEditMinutes: 60, // Cửa sổ sửa sau ca (phút)
  participationThresholdPercent: 70, // Ngưỡng tham gia ca (%)
};

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Chỉ Quản trị viên cấp cao nhất (SUPER_ADMIN) mới có quyền truy cập" },
        { status: 403 }
      );
    }

    const [timesSetting, rulesSetting] = await Promise.all([
      prisma.systemSetting.findUnique({
        where: { key: "shift_times" },
      }),
      prisma.systemSetting.findUnique({
        where: { key: "shift_rules" },
      }),
    ]);

    const rawShiftTimes = parseJsonObject(timesSetting?.value, DEFAULT_SHIFT_TIMES) || {};
    const shiftTimes = {
      MORNING: {
        ...DEFAULT_SHIFT_TIMES.MORNING,
        ...rawShiftTimes.MORNING,
        hourlyRate:
          rawShiftTimes.MORNING?.hourlyRate !== undefined
            ? Number(rawShiftTimes.MORNING.hourlyRate)
            : DEFAULT_SHIFT_TIMES.MORNING.hourlyRate,
      },
      AFTERNOON: {
        ...DEFAULT_SHIFT_TIMES.AFTERNOON,
        ...rawShiftTimes.AFTERNOON,
        hourlyRate:
          rawShiftTimes.AFTERNOON?.hourlyRate !== undefined
            ? Number(rawShiftTimes.AFTERNOON.hourlyRate)
            : DEFAULT_SHIFT_TIMES.AFTERNOON.hourlyRate,
      },
      EVENING: {
        ...DEFAULT_SHIFT_TIMES.EVENING,
        ...rawShiftTimes.EVENING,
        hourlyRate:
          rawShiftTimes.EVENING?.hourlyRate !== undefined
            ? Number(rawShiftTimes.EVENING.hourlyRate)
            : DEFAULT_SHIFT_TIMES.EVENING.hourlyRate,
      },
    };

    return NextResponse.json({
      shiftTimes,
      shiftRules: parseJsonObject(rulesSetting?.value, DEFAULT_SHIFT_RULES),
      updatedAt: timesSetting?.updatedAt || rulesSetting?.updatedAt || null,
    });
  } catch (error: any) {
    console.error("Lỗi API GET /api/admin/shifts-config:", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi lấy cấu hình ca làm việc" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Chỉ Quản trị viên cấp cao nhất (SUPER_ADMIN) mới có quyền cập nhật cấu hình ca" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { shiftTimes, shiftRules } = body;

    const operations = [];

    if (shiftTimes) {
      const stringifiedTimes = stringifyJsonObject(shiftTimes);
      operations.push(
        prisma.systemSetting.upsert({
          where: { key: "shift_times" },
          update: {
            value: stringifiedTimes,
            description: "Cấu hình khung giờ các ca làm việc (Sáng, Chiều, Tối)",
          },
          create: {
            key: "shift_times",
            value: stringifiedTimes,
            description: "Cấu hình khung giờ các ca làm việc (Sáng, Chiều, Tối)",
          },
        })
      );
    }

    if (shiftRules) {
      const stringifiedRules = stringifyJsonObject(shiftRules);
      operations.push(
        prisma.systemSetting.upsert({
          where: { key: "shift_rules" },
          update: {
            value: stringifiedRules,
            description: "Quy định đăng ký, chốt ca và số ca tối thiểu/tối đa",
          },
          create: {
            key: "shift_rules",
            value: stringifiedRules,
            description: "Quy định đăng ký, chốt ca và số ca tối thiểu/tối đa",
          },
        })
      );
    }

    await Promise.all(operations);

    // Kích hoạt đồng bộ mốc khóa form và quét tự động duyệt ca theo quy định mới
    let autoApprovalInfo = null;
    if (shiftRules) {
      const { scanAndAutoApproveAllPendingWeeks } = await import("@/lib/shiftAutoApproval");
      autoApprovalInfo = await scanAndAutoApproveAllPendingWeeks();
    }

    return NextResponse.json({
      message: autoApprovalInfo && autoApprovalInfo.totalApprovedShifts > 0
        ? `Đã lưu cài đặt ca! Đồng thời hệ thống đã tự động duyệt ${autoApprovalInfo.totalApprovedShifts} ca làm việc theo giờ khóa form mới.`
        : "Đã lưu cài đặt ca làm việc thành công!",
      shiftTimes: shiftTimes || DEFAULT_SHIFT_TIMES,
      shiftRules: shiftRules || DEFAULT_SHIFT_RULES,
      autoApprovalInfo,
    });
  } catch (error: any) {
    console.error("Lỗi API POST /api/admin/shifts-config:", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi lưu cấu hình ca làm việc" },
      { status: 500 }
    );
  }
}
