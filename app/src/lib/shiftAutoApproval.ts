import { prisma } from "@/lib/prisma";
import { parseJsonObject } from "@/lib/json-fields";
import { getISOWeekAndYear, getWeekRange } from "@/lib/dateUtils";

export interface ShiftRulesConfig {
  openDayOfWeek: number; // 0 = CN, 1 = T2, ..., 5 = T6, 6 = T7
  openTime: string; // "HH:mm"
  closeDayOfWeek: number; // 0 = CN, 1 = T2, ..., 6 = T7
  closeTime: string; // "HH:mm"
  maxShiftsPerDay?: number;
  minShiftsPerWeek?: number;
  allowCancelHoursBefore?: number;
  maxAbsentsPerMonth?: number;
  maxUsersPerShift?: number;
}

export const DEFAULT_SHIFT_RULES: ShiftRulesConfig = {
  openDayOfWeek: 5, // Thứ Sáu
  openTime: "00:00",
  closeDayOfWeek: 0, // Chủ Nhật
  closeTime: "23:59",
  maxShiftsPerDay: 1,
  minShiftsPerWeek: 5,
  allowCancelHoursBefore: 4,
  maxAbsentsPerMonth: 3,
  maxUsersPerShift: 10,
};

/**
 * Lấy cấu hình quy chế đăng ký ca tuần từ bảng SystemSetting
 */
export async function getShiftRules(): Promise<ShiftRulesConfig> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "shift_rules" },
    });
    const parsed = parseJsonObject<ShiftRulesConfig>(setting?.value, DEFAULT_SHIFT_RULES);
    return {
      ...DEFAULT_SHIFT_RULES,
      ...parsed,
      openDayOfWeek: parsed.openDayOfWeek !== undefined ? Number(parsed.openDayOfWeek) : DEFAULT_SHIFT_RULES.openDayOfWeek,
      closeDayOfWeek: parsed.closeDayOfWeek !== undefined ? Number(parsed.closeDayOfWeek) : DEFAULT_SHIFT_RULES.closeDayOfWeek,
      openTime: parsed.openTime || DEFAULT_SHIFT_RULES.openTime,
      closeTime: parsed.closeTime || DEFAULT_SHIFT_RULES.closeTime,
    };
  } catch (error) {
    console.error("Lỗi khi đọc shift_rules từ SystemSetting:", error);
    return DEFAULT_SHIFT_RULES;
  }
}

/**
 * Tính toán mốc thời gian mở form và khóa form đăng ký ca cho tuần (weekNumber, year)
 * dựa vào cấu hình shiftRules theo múi giờ Việt Nam (UTC+7).
 * 
 * Quy ước đăng ký:
 * Việc đăng ký ca cho tuần N (bắt đầu từ Thứ Hai) thường diễn ra ở tuần trước (N-1).
 * - closeDayOfWeek = 0 (Chủ Nhật trước Monday): monday - 1 ngày
 * - closeDayOfWeek = 6 (Thứ Bảy trước Monday): monday - 2 ngày
 * - closeDayOfWeek = 5 (Thứ Sáu trước Monday): monday - 3 ngày
 * - closeDayOfWeek = 1 (Thứ Hai bắt đầu tuần N): monday (0 ngày)
 */
export function calculateRegistrationWindow(
  weekNumber: number,
  year: number,
  rules: ShiftRulesConfig
): {
  monday: Date;
  sunday: Date;
  openDate: Date;
  closeDate: Date;
  formattedCloseVN: string;
} {
  const { monday, sunday } = getWeekRange(weekNumber, year);

  // Tính offset ngày so với Monday của tuần làm việc
  const getOffsetFromMonday = (dayOfWeek: number): number => {
    if (dayOfWeek === 0) return -1; // Chủ Nhật trước tuần làm việc
    if (dayOfWeek === 1) return 0;  // Đúng ngày Thứ Hai tuần làm việc
    return dayOfWeek - 8;           // 6 -> -2 ngày (T7), 5 -> -3 ngày (T6), 2 -> -6 ngày (T3)
  };

  const openOffset = getOffsetFromMonday(rules.openDayOfWeek);
  const closeOffset = getOffsetFromMonday(rules.closeDayOfWeek);

  // Ngày Monday theo UTC
  const mondayUtcTime = monday.getTime();

  const openTargetDate = new Date(mondayUtcTime + openOffset * 86400000);
  const closeTargetDate = new Date(mondayUtcTime + closeOffset * 86400000);

  const openDateStr = openTargetDate.toISOString().slice(0, 10);
  const closeDateStr = closeTargetDate.toISOString().slice(0, 10);

  // Ghép giờ theo múi giờ Việt Nam (+07:00)
  const cleanOpenTime = (rules.openTime || "00:00").trim();
  const cleanCloseTime = (rules.closeTime || "23:59").trim();

  const openDate = new Date(`${openDateStr}T${cleanOpenTime}:00+07:00`);
  // Đóng lúc HH:mm:59 để bao gồm trọn vẹn phút cuối cùng
  const closeDate = new Date(`${closeDateStr}T${cleanCloseTime}:59+07:00`);

  // Chuỗi mô tả dễ đọc tiếng Việt: "HH:mm Chủ Nhật (DD/MM)"
  const dayNames = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const closeDayName = dayNames[rules.closeDayOfWeek] || "Chủ Nhật";
  const [, cMonth, cDay] = closeDateStr.split("-");
  const formattedCloseVN = `${cleanCloseTime} ${closeDayName} (${cDay}/${cMonth})`;

  return { monday, sunday, openDate, closeDate, formattedCloseVN };
}

/**
 * Định dạng mốc thời gian đóng đăng ký theo chuỗi tiếng Việt dễ đọc (UTC+7)
 */
export function formatCloseDateVN(date: Date): string {
  const dayNames = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const vnTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const hours = String(vnTime.getUTCHours()).padStart(2, "0");
  const minutes = String(vnTime.getUTCMinutes()).padStart(2, "0");
  const dayName = dayNames[vnTime.getUTCDay()];
  const day = String(vnTime.getUTCDate()).padStart(2, "0");
  const month = String(vnTime.getUTCMonth() + 1).padStart(2, "0");
  return `${hours}:${minutes} ${dayName} (${day}/${month})`;
}

/**
 * Kiểm tra và tự động duyệt toàn bộ ca REGISTERED của tuần nếu thời gian đăng ký đã kết thúc.
 * Đảm bảo:
 * 1. Chuyển toàn bộ status = 'REGISTERED' thành 'APPROVED'.
 * 2. Khóa form đăng ký ca của tuần đó (isLocked = true, approvedAt = now).
 * 3. Tạo thông báo tới nhân sự có ca vừa được tự động phê duyệt.
 */
export async function checkAndAutoApproveWeekShifts(
  weekNumber: number,
  year: number,
  forceRules?: ShiftRulesConfig
): Promise<{
  autoApproved: boolean;
  approvedCount: number;
  isLocked: boolean;
  registrationCloseAt: Date;
  formattedCloseVN: string;
}> {
  const rules = forceRules || (await getShiftRules());
  const { openDate, closeDate, formattedCloseVN } = calculateRegistrationWindow(weekNumber, year, rules);
  const now = new Date();

  // 1. Tìm hoặc khởi tạo config tuần
  let config = await prisma.shiftScheduleConfig.findUnique({
    where: { weekNumber_year: { weekNumber, year } },
  });

  // Kiểm tra xem tuần này có đang được Quản lý chủ động mở khóa (isLocked === false) và hạn còn hiệu lực hay không
  const isManuallyOpen = Boolean(config && !config.isLocked && config.registrationCloseAt && config.registrationCloseAt > now);

  // Mốc thời hạn hiệu lực: nếu Quản lý đã mở khóa/gia hạn thì tôn trọng registrationCloseAt đã lưu
  const effectiveCloseDate = (isManuallyOpen && config?.registrationCloseAt)
    ? config.registrationCloseAt
    : (config?.registrationCloseAt && config.registrationCloseAt > closeDate ? config.registrationCloseAt : closeDate);

  const isPastRegistrationDeadline = isManuallyOpen ? false : (now >= effectiveCloseDate);
  const displayFormattedCloseVN = (isManuallyOpen && config?.registrationCloseAt)
    ? formatCloseDateVN(config.registrationCloseAt)
    : formattedCloseVN;

  if (!config) {
    config = await prisma.shiftScheduleConfig.create({
      data: {
        weekNumber,
        year,
        registrationOpenAt: openDate,
        registrationCloseAt: closeDate,
        isLocked: isPastRegistrationDeadline,
        reopenedUserIds: "[]",
      },
    });
  } else if (!isManuallyOpen) {
    // Chỉ đồng bộ lại thời điểm mở/khóa theo rule nếu tuần KHÔNG ở trạng thái mở khóa thủ công
    const isCloseDateDifferent = Math.abs(config.registrationCloseAt.getTime() - closeDate.getTime()) > 60000;
    const isOpenDateDifferent = Math.abs(config.registrationOpenAt.getTime() - openDate.getTime()) > 60000;

    if (isCloseDateDifferent || isOpenDateDifferent) {
      config = await prisma.shiftScheduleConfig.update({
        where: { weekNumber_year: { weekNumber, year } },
        data: {
          registrationOpenAt: openDate,
          registrationCloseAt: closeDate,
          isLocked: isPastRegistrationDeadline ? true : config.isLocked,
        },
      });
    }
  }

  // 2. Nếu CHƯA đến hạn chốt đăng ký (bao gồm cả trường hợp Quản lý chủ động mở khóa): Không tự động duyệt
  if (!isPastRegistrationDeadline) {
    return {
      autoApproved: false,
      approvedCount: 0,
      isLocked: config.isLocked,
      registrationCloseAt: config.registrationCloseAt,
      formattedCloseVN: displayFormattedCloseVN,
    };
  }

  // 3. ĐÃ ĐẾN / QUÁ HẠN CHỐT ĐĂNG KÝ: TỰ ĐỘNG DUYỆT CA
  // Tìm các ca REGISTERED cần duyệt
  const pendingShifts = await prisma.shiftRegistration.findMany({
    where: {
      weekNumber,
      year,
      status: "REGISTERED",
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (pendingShifts.length === 0) {
    // Không còn ca REGISTERED nào, nhưng đảm bảo tuần được khóa nếu chưa khóa
    if (!config.isLocked || !config.approvedAt) {
      await prisma.shiftScheduleConfig.update({
        where: { weekNumber_year: { weekNumber, year } },
        data: {
          isLocked: true,
          approvedAt: config.approvedAt || now,
        },
      });
    }

    return {
      autoApproved: false,
      approvedCount: 0,
      isLocked: true,
      registrationCloseAt: config.registrationCloseAt,
      formattedCloseVN: displayFormattedCloseVN,
    };
  }

  // Thực hiện Transaction tự động duyệt hàng loạt
  const uniqueUserIds = Array.from(new Set(pendingShifts.map((s) => s.userId)));

  const result = await prisma.$transaction(async (tx) => {
    // 3.1. Cập nhật tất cả ca REGISTERED thành APPROVED
    const updateResult = await tx.shiftRegistration.updateMany({
      where: {
        weekNumber,
        year,
        status: "REGISTERED",
      },
      data: {
        status: "APPROVED",
      },
    });

    // 3.2. Cập nhật ShiftScheduleConfig
    await tx.shiftScheduleConfig.update({
      where: { weekNumber_year: { weekNumber, year } },
      data: {
        isLocked: true,
        approvedAt: config?.approvedAt || now,
      },
    });

    // 3.3. Tạo thông báo tự động duyệt cho các nhân sự có ca được duyệt
    const notificationsData = uniqueUserIds.map((userId) => ({
      userId,
      type: "GENERAL",
      title: `Lịch ca tuần ${weekNumber} đã được tự động duyệt`,
      message: `Thời gian đăng ký ca tuần ${weekNumber} đã kết thúc (${formattedCloseVN}). Toàn bộ ca đăng ký hợp lệ của bạn đã được hệ thống tự động phê duyệt chốt lịch làm việc.`,
      metadata: JSON.stringify({
        action: "AUTO_APPROVE_SHIFTS",
        weekNumber,
        year,
        closedAt: closeDate.toISOString(),
        approvedAt: now.toISOString(),
      }),
    }));

    if (notificationsData.length > 0) {
      await tx.notification.createMany({
        data: notificationsData,
      });
    }

    return updateResult.count;
  });

  return {
    autoApproved: true,
    approvedCount: result,
    isLocked: true,
    registrationCloseAt: closeDate,
    formattedCloseVN,
  };
}

/**
 * Quét và tự động duyệt toàn bộ các ca làm việc của các tuần đã quá hạn đăng ký
 * nhưng vẫn còn ca REGISTERED trong hệ thống (chạy khi admin lưu cài đặt ca hoặc cron heartbeat).
 */
export async function scanAndAutoApproveAllPendingWeeks(): Promise<{
  processedWeeks: number;
  totalApprovedShifts: number;
}> {
  try {
    const rules = await getShiftRules();
    const nowIso = getISOWeekAndYear(new Date());

    // 1. Tìm tất cả các tuần đang có ca REGISTERED
    const pendingWeeks = await prisma.shiftRegistration.findMany({
      where: {
        status: "REGISTERED",
      },
      select: {
        weekNumber: true,
        year: true,
      },
      distinct: ["weekNumber", "year"],
    });

    // Bổ sung tuần hiện tại và tuần trước vào danh sách kiểm tra
    const weeksToCheck = new Map<string, { weekNumber: number; year: number }>();

    for (const pw of pendingWeeks) {
      weeksToCheck.set(`${pw.weekNumber}_${pw.year}`, pw);
    }

    // Tuần hiện tại
    weeksToCheck.set(`${nowIso.weekNumber}_${nowIso.year}`, {
      weekNumber: nowIso.weekNumber,
      year: nowIso.year,
    });

    let totalApproved = 0;
    let processedCount = 0;

    for (const target of Array.from(weeksToCheck.values())) {
      const res = await checkAndAutoApproveWeekShifts(target.weekNumber, target.year, rules);
      if (res.autoApproved) {
        totalApproved += res.approvedCount;
        processedCount++;
      }
    }

    return {
      processedWeeks: processedCount,
      totalApprovedShifts: totalApproved,
    };
  } catch (error) {
    console.error("Lỗi khi quét và tự động duyệt ca:", error);
    return { processedWeeks: 0, totalApprovedShifts: 0 };
  }
}
