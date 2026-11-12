import { prisma } from "@/lib/prisma";
import { parseJsonObject } from "@/lib/json-fields";
import { DEFAULT_SHIFT_TIMES } from "@/lib/shifts-constants";
import type { ShiftTime, SubmissionRules } from "@/lib/reportSubmissionPolicy";

export const DEFAULT_SHIFT_RULES: SubmissionRules & Record<string, any> = {
  openDayOfWeek: 5,
  openTime: "00:00",
  closeDayOfWeek: 0,
  closeTime: "23:59",
  maxShiftsPerDay: 1,
  minShiftsPerWeek: 5,
  allowCancelHoursBefore: 4,
  maxAbsentsPerMonth: 3,
  maxUsersPerShift: 10,
  tagPostGraceDays: 7,
  viralPostGraceDays: 30,
  lateCheckinMinutes: 60,
  postShiftEditMinutes: 60,
  participationThresholdPercent: 70,
};

export async function getEffectiveShiftRules(): Promise<SubmissionRules & Record<string, any>> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: "shift_rules" },
  });
  const parsed = parseJsonObject(setting?.value, DEFAULT_SHIFT_RULES);
  return {
    ...DEFAULT_SHIFT_RULES,
    ...parsed,
    lateCheckinMinutes: Number(parsed?.lateCheckinMinutes ?? DEFAULT_SHIFT_RULES.lateCheckinMinutes),
    postShiftEditMinutes: Number(parsed?.postShiftEditMinutes ?? DEFAULT_SHIFT_RULES.postShiftEditMinutes),
    participationThresholdPercent: Number(
      parsed?.participationThresholdPercent ?? DEFAULT_SHIFT_RULES.participationThresholdPercent
    ),
  };
}

export async function getEffectiveShiftTimes(): Promise<Record<string, ShiftTime & { label: string; hourlyRate: number }>> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: "shift_times" },
  });
  const raw = parseJsonObject(setting?.value, DEFAULT_SHIFT_TIMES) || {};
  return {
    MORNING: {
      ...DEFAULT_SHIFT_TIMES.MORNING,
      ...raw.MORNING,
    },
    AFTERNOON: {
      ...DEFAULT_SHIFT_TIMES.AFTERNOON,
      ...raw.AFTERNOON,
    },
    EVENING: {
      ...DEFAULT_SHIFT_TIMES.EVENING,
      ...raw.EVENING,
    },
  };
}

import { getUserEffectiveKpi, getDefaultKpiConfig } from "@/lib/kpiService";

export async function getEffectiveKpiConfig(userId?: number): Promise<{ fbPerShift: number; threadPerShift: number; commentPerShift: number; minShiftsPerWeek?: number; isCustom?: boolean }> {
  if (userId) {
    const userKpi = await getUserEffectiveKpi(userId);
    return {
      fbPerShift: userKpi.fbPerShift,
      threadPerShift: userKpi.threadPerShift,
      commentPerShift: userKpi.commentPerShift,
      minShiftsPerWeek: userKpi.minShiftsPerWeek,
      isCustom: userKpi.isCustom,
    };
  }
  const defaultKpi = await getDefaultKpiConfig();
  return {
    fbPerShift: defaultKpi.fbPerShift,
    threadPerShift: defaultKpi.threadPerShift,
    commentPerShift: defaultKpi.commentPerShift,
    minShiftsPerWeek: defaultKpi.minShiftsPerWeek,
    isCustom: false,
  };
}
