/**
 * Chính sách nộp link báo cáo theo ca (xem docs/plan_nop_bu_tu_dong.md và CONTEXT.md).
 * Hàm thuần, không truy cập DB: dùng chung cho API (chặn) và UI (hiển thị).
 */

export type SubmissionPhase =
  | "BEFORE_SHIFT"
  | "AWAITING_CHECKIN"
  | "LATE_LOCKED"
  | "ABSENT"
  | "IN_SHIFT"
  | "BELOW_THRESHOLD"
  | "POST_SHIFT_EDIT"
  | "WEEKLY_MAKEUP"
  | "SPECIAL_REOPEN"
  | "CLOSED";

export interface ShiftTime {
  startTime: string; // "HH:mm" giờ Việt Nam
  endTime: string; // "HH:mm", cho phép "24:00"
}

export interface LinkCounts {
  fb: number;
  thread: number;
}

export interface SubmissionRules {
  lateCheckinMinutes: number;
  postShiftEditMinutes: number;
  participationThresholdPercent: number;
}

export interface SubmissionInput {
  /** Ngày ca (cột @db.Date, mốc 00:00 UTC đại diện cho ngày theo giờ Việt Nam). */
  shiftDate: Date;
  shiftTime: ShiftTime;
  checkInAt: Date | null;
  /** Số link nộp trong giờ ca, chốt tại lúc hết ca. null = chưa có báo cáo. */
  linkCountsAtShiftEnd: LinkCounts | null;
  /** Đã có báo cáo ca làm việc nộp trước đó hay chưa */
  hasSubmittedReport?: boolean;
  /** Mở bù đặc cách do Quản lý/QC cấp. until = null nghĩa là không giới hạn. */
  specialReopen: { until: Date | null } | null;
  now: Date;
  rules: SubmissionRules;
  kpi: { fbPerShift: number; threadPerShift: number };
  isLate?: boolean;
  lateMinutes?: number;
}

export interface SubmissionDecision {
  phase: SubmissionPhase;
  canSubmit: boolean;
  canDeleteApprovedLinks: boolean;
  canEditOldLinks: boolean;
  capAtKpi: boolean;
  closesAt: Date | null;
  reason: string;
}

const MINUTE_MS = 60_000;
const VN_OFFSET_MS = 7 * 60 * MINUTE_MS;

function parseMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((part) => parseInt(part, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function getShiftTimeRange(shiftDate: Date, shiftTime: ShiftTime): { start: Date; end: Date } {
  const vnMidnight = Date.UTC(shiftDate.getUTCFullYear(), shiftDate.getUTCMonth(), shiftDate.getUTCDate()) - VN_OFFSET_MS;
  const startMin = parseMinutes(shiftTime.startTime);
  let endMin = parseMinutes(shiftTime.endTime);
  if (endMin <= startMin) endMin += 24 * 60;
  return {
    start: new Date(vnMidnight + startMin * MINUTE_MS),
    end: new Date(vnMidnight + endMin * MINUTE_MS),
  };
}

/** Lấy mốc Chủ Nhật 23:59:59.999 theo múi giờ Việt Nam của tuần chứa ca */
export function getEndOfWeekSundayVN(shiftDate: Date): Date {
  const y = shiftDate.getUTCFullYear();
  const m = shiftDate.getUTCMonth();
  const d = shiftDate.getUTCDate();
  // Tính thứ trong tuần của ngày ca (0: Chủ Nhật, 1: Thứ 2, ..., 6: Thứ 7)
  const dayOfWeek = new Date(Date.UTC(y, m, d)).getUTCDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  // 23:59:59.999 VN = 16:59:59.999 UTC
  return new Date(Date.UTC(y, m, d + daysUntilSunday, 16, 59, 59, 999));
}

function closed(phase: SubmissionPhase, reason: string, closesAt: Date | null = null): SubmissionDecision {
  return { phase, canSubmit: false, canDeleteApprovedLinks: false, canEditOldLinks: false, capAtKpi: false, closesAt, reason };
}

/** Số link tối thiểu từng loại để đạt Ngưỡng tham gia ca (làm tròn lên). */
export function getRequiredLinks(kpi: SubmissionInput["kpi"], thresholdPercent: number): LinkCounts {
  const ratio = thresholdPercent / 100;
  return {
    fb: Math.ceil(kpi.fbPerShift * ratio),
    thread: Math.ceil(kpi.threadPerShift * ratio),
  };
}

export function evaluateSubmission(input: SubmissionInput): SubmissionDecision {
  const { now, checkInAt, rules, specialReopen } = input;

  // 1. Nếu có Mở bù đặc cách
  if (specialReopen) {
    if (!specialReopen.until || now <= specialReopen.until) {
      return {
        phase: "SPECIAL_REOPEN",
        canSubmit: true,
        canDeleteApprovedLinks: false,
        canEditOldLinks: false,
        capAtKpi: false,
        closesAt: specialReopen.until,
        reason: "Cấp Quản lý / QC đã mở quyền nộp bù đặc cách cho ca này (chỉ được nộp bổ sung thêm link, không chỉnh sửa link cũ).",
      };
    } else {
      const expiredStr = specialReopen.until.toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      });
      return closed("CLOSED", `Thời hạn cho phép nộp bù đặc cách ca này đã kết thúc lúc ${expiredStr}. Vui lòng liên hệ Quản lý nếu cần mở lại!`);
    }
  }

  const { start, end } = getShiftTimeRange(input.shiftDate, input.shiftTime);
  const checkInDeadline = new Date(start.getTime() + rules.lateCheckinMinutes * MINUTE_MS);

  // 2. Trước giờ ca
  if (now < start) {
    return closed("BEFORE_SHIFT", "Chưa đến giờ bắt đầu ca. Bạn chỉ được nộp link khi đến ca đã đăng ký.");
  }

  // 3. Đang trong giờ ca
  if (now <= end) {
    if (!checkInAt && !input.hasSubmittedReport) {
      if (now <= checkInDeadline) {
        return closed("AWAITING_CHECKIN", "Vui lòng bấm \"Vào ca\" trước khi nộp link.", checkInDeadline);
      }
      return closed("LATE_LOCKED", `Ca đã bị khóa do không Vào ca trong ${rules.lateCheckinMinutes} phút đầu ca. Liên hệ Quản lý nếu cần mở nộp bù.`);
    }

    if (checkInAt && checkInAt > checkInDeadline && !input.hasSubmittedReport) {
      return closed("LATE_LOCKED", `Ca đã bị khóa do Vào ca muộn quá ${rules.lateCheckinMinutes} phút. Liên hệ Quản lý nếu cần mở nộp bù.`);
    }

    return {
      phase: "IN_SHIFT",
      canSubmit: true,
      canDeleteApprovedLinks: true,
      canEditOldLinks: true,
      capAtKpi: false,
      closesAt: end,
      reason: "Đang trong giờ ca.",
    };
  }

  // 4. Sau khi ca đã kết thúc (now > end)
  const vnMidnight = Date.UTC(input.shiftDate.getUTCFullYear(), input.shiftDate.getUTCMonth(), input.shiftDate.getUTCDate()) - VN_OFFSET_MS;
  const endOfDayVN = new Date(vnMidnight + 24 * 60 * MINUTE_MS);
  const isPastShiftDay = now > endOfDayVN;

  const required = getRequiredLinks(input.kpi, rules.participationThresholdPercent);
  const counts = input.linkCountsAtShiftEnd ?? { fb: 0, thread: 0 };
  const metThreshold =
    Boolean(input.hasSubmittedReport) ||
    (counts.fb >= required.fb && counts.thread >= required.thread);

  // 4.1 Ca đạt Ngưỡng tham gia ca (hoặc đã có báo cáo nộp thành công)
  if (metThreshold) {
    // Cửa sổ sửa sau ca (60 phút sau khi kết thúc ca)
    const editWindowEnd = new Date(end.getTime() + rules.postShiftEditMinutes * MINUTE_MS);
    if (now <= editWindowEnd) {
      return {
        phase: "POST_SHIFT_EDIT",
        canSubmit: true,
        canDeleteApprovedLinks: false,
        canEditOldLinks: true,
        capAtKpi: false,
        closesAt: editWindowEnd,
        reason: `Cửa sổ sửa sau ca: được thêm hoặc thay link trong ${rules.postShiftEditMinutes} phút sau khi hết ca.`,
      };
    }

    // Nộp bù tuần (đến hết Chủ Nhật 23:59:59.999 VN)
    const sundayEnd = getEndOfWeekSundayVN(input.shiftDate);
    if (now <= sundayEnd) {
      return {
        phase: "WEEKLY_MAKEUP",
        canSubmit: true,
        canDeleteApprovedLinks: false,
        canEditOldLinks: false,
        capAtKpi: true,
        closesAt: sundayEnd,
        reason: "Nộp bù tuần: khóa chỉnh sửa link cũ, cho phép nộp bổ sung và thêm link dự phòng đến hết Chủ nhật.",
      };
    }

    // Đã đóng nộp bù tuần
    return closed("CLOSED", "Ca làm việc đã kết thúc và đóng nộp bù tuần. Liên hệ Quản lý nếu cần mở bù.");
  }

  // 4.2 Ca KHÔNG đạt ngưỡng hoặc KHÔNG nộp bài
  // Nếu đã quá ngày diễn ra ca (quá 1 ngày): Báo Vắng ca
  if (isPastShiftDay) {
    return closed(
      "ABSENT",
      "Ca làm việc đã kết thúc. Nhân sự không tham gia ca (Vắng ca). Vui lòng liên hệ Quản lý nếu cần hỗ trợ mở bù."
    );
  }

  // Nếu vẫn trong ngày hôm đó (ngày diễn ra ca): Báo Vào muộn / Dưới ngưỡng
  if (counts.fb === 0 && counts.thread === 0) {
    if (input.isLate || (input.lateMinutes && input.lateMinutes > 0)) {
      return closed(
        "LATE_LOCKED",
        `Ca đã bị khóa do Vào ca muộn${input.lateMinutes ? ` ${input.lateMinutes} phút` : ""} và chưa nộp link nào trong giờ ca. Liên hệ Quản lý nếu cần mở nộp bù.`
      );
    }
    if (!checkInAt) {
      return closed(
        "LATE_LOCKED",
        `Ca đã bị khóa do không Vào ca trong ${rules.lateCheckinMinutes} phút đầu ca và chưa nộp bài. Liên hệ Quản lý nếu cần mở nộp bù.`
      );
    }
    return closed(
      "BELOW_THRESHOLD",
      "Ca làm việc đã kết thúc nhưng bạn chưa nộp bài viết nào trong giờ ca. Vui lòng liên hệ Quản lý nếu cần mở nộp bù."
    );
  }

  return closed(
    "BELOW_THRESHOLD",
    `Ca không đạt Ngưỡng tham gia ca (mới nộp ${counts.fb}/${required.fb} link FB, ${counts.thread}/${required.thread} link Thread). Vui lòng liên hệ Quản lý nếu cần mở nộp bù.`
  );
}
