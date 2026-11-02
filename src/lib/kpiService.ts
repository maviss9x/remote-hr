import { prisma } from "@/lib/prisma";

export interface EffectiveUserKpi {
  fbPerShift: number;
  threadPerShift: number;
  commentPerShift: number;
  minShiftsPerWeek: number;
  isCustom: boolean;
  note?: string | null;
  configId?: number;
}

export interface DefaultKpiConfig {
  fbPerShift: number;
  threadPerShift: number;
  commentPerShift: number;
  minShiftsPerWeek: number;
  maxAbsentsPerMonth: number;
  minDaysForSalary: number;
  lateThresholdMinutes: number;
}

export const FALLBACK_KPI: DefaultKpiConfig = {
  fbPerShift: 10,
  threadPerShift: 4,
  commentPerShift: 50,
  minShiftsPerWeek: 5,
  maxAbsentsPerMonth: 3,
  minDaysForSalary: 3,
  lateThresholdMinutes: 60,
};

/**
 * Lấy cấu hình KPI mặc định toàn hệ thống có hiệu lực tại thời điểm asOfDate.
 */
export async function getDefaultKpiConfig(asOfDate: Date = new Date()): Promise<DefaultKpiConfig> {
  try {
    const config = await prisma.kpiConfig.findFirst({
      where: {
        effectiveFrom: { lte: asOfDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
      },
      orderBy: [{ effectiveFrom: "desc" }, { id: "desc" }],
    });

    if (!config) return { ...FALLBACK_KPI };

    return {
      fbPerShift: config.fbPerShift ?? FALLBACK_KPI.fbPerShift,
      threadPerShift: config.threadPerShift ?? FALLBACK_KPI.threadPerShift,
      commentPerShift: config.commentPerShift ?? FALLBACK_KPI.commentPerShift,
      minShiftsPerWeek: config.minShiftsPerWeek ?? FALLBACK_KPI.minShiftsPerWeek,
      maxAbsentsPerMonth: config.maxAbsentsPerMonth ?? FALLBACK_KPI.maxAbsentsPerMonth,
      minDaysForSalary: config.minDaysForSalary ?? FALLBACK_KPI.minDaysForSalary,
      lateThresholdMinutes: config.lateThresholdMinutes ?? FALLBACK_KPI.lateThresholdMinutes,
    };
  } catch (error) {
    console.error("Lỗi khi lấy Default KPI Config:", error);
    return { ...FALLBACK_KPI };
  }
}

/**
 * Lấy Map cấu hình KPI cho danh sách userIds tại thời điểm asOfDate (chống N+1 query).
 * Nếu nhân sự có UserKpiConfig riêng còn hiệu lực thì ưu tiên ghi đè, nếu không sẽ dùng KPI mặc định.
 */
export async function getUsersEffectiveKpiMap(
  userIds: number[],
  asOfDate: Date = new Date()
): Promise<Map<number, EffectiveUserKpi>> {
  const result = new Map<number, EffectiveUserKpi>();
  if (!userIds || userIds.length === 0) return result;

  const defaultKpi = await getDefaultKpiConfig(asOfDate);

  // Khởi tạo mặc định cho tất cả user
  for (const id of userIds) {
    result.set(id, {
      fbPerShift: defaultKpi.fbPerShift,
      threadPerShift: defaultKpi.threadPerShift,
      commentPerShift: defaultKpi.commentPerShift,
      minShiftsPerWeek: defaultKpi.minShiftsPerWeek,
      isCustom: false,
      note: null,
    });
  }

  try {
    // Truy vấn các bản ghi KPI riêng của danh sách user còn hiệu lực
    const userConfigs = await prisma.userKpiConfig.findMany({
      where: {
        userId: { in: userIds },
        effectiveFrom: { lte: asOfDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
      },
      orderBy: [{ effectiveFrom: "desc" }, { id: "desc" }],
    });

    // Gom bản ghi mới nhất cho từng user
    for (const uc of userConfigs) {
      const current = result.get(uc.userId);
      // Nếu user đã nhận cấu hình riêng mới nhất thì bỏ qua các bản ghi cũ hơn
      if (current && current.isCustom) continue;

      result.set(uc.userId, {
        fbPerShift: uc.fbPerShift ?? defaultKpi.fbPerShift,
        threadPerShift: uc.threadPerShift ?? defaultKpi.threadPerShift,
        commentPerShift: uc.commentPerShift ?? defaultKpi.commentPerShift,
        minShiftsPerWeek: uc.minShiftsPerWeek ?? defaultKpi.minShiftsPerWeek,
        isCustom: true,
        note: uc.note,
        configId: uc.id,
      });
    }
  } catch (error) {
    console.error("Lỗi khi lấy UserKpiConfig Map:", error);
  }

  return result;
}

/**
 * Lấy KPI hiệu lực cho một nhân sự duy nhất.
 */
export async function getUserEffectiveKpi(
  userId: number,
  asOfDate: Date = new Date()
): Promise<EffectiveUserKpi> {
  const map = await getUsersEffectiveKpiMap([userId], asOfDate);
  return (
    map.get(userId) || {
      fbPerShift: FALLBACK_KPI.fbPerShift,
      threadPerShift: FALLBACK_KPI.threadPerShift,
      commentPerShift: FALLBACK_KPI.commentPerShift,
      minShiftsPerWeek: FALLBACK_KPI.minShiftsPerWeek,
      isCustom: false,
      note: null,
    }
  );
}

