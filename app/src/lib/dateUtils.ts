/**
 * Utility functions for Date and ISO Week calculation.
 */

export function getISOWeekAndYear(d: Date = new Date()): { weekNumber: number; year: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number (making Sunday 7)
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { weekNumber: weekNo, year: date.getUTCFullYear() };
}

export function getWeekDateRange(weekNumber: number, year: number): {
  startDate: Date;
  endDate: Date;
  startDateStr: string;
  endDateStr: string;
} {
  // Simple algorithm to get Monday of the given ISO week in pure UTC
  const simple = new Date(Date.UTC(year, 0, 1 + (weekNumber - 1) * 7));
  const dow = simple.getUTCDay();
  const ISOweekStart = simple;
  if (dow <= 4) {
    ISOweekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  } else {
    ISOweekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  }

  const startDate = new Date(Date.UTC(
    ISOweekStart.getUTCFullYear(),
    ISOweekStart.getUTCMonth(),
    ISOweekStart.getUTCDate(),
    0, 0, 0, 0
  ));

  const endDate = new Date(Date.UTC(
    ISOweekStart.getUTCFullYear(),
    ISOweekStart.getUTCMonth(),
    ISOweekStart.getUTCDate() + 6,
    23, 59, 59, 999
  ));

  const startDateStr = startDate.toISOString().slice(0, 10);
  const endDateStr = endDate.toISOString().slice(0, 10);

  return { startDate, endDate, startDateStr, endDateStr };
}

export function getWeekRange(weekNumber: number, year: number) {
  const { startDate, endDate, startDateStr, endDateStr } = getWeekDateRange(weekNumber, year);
  return { monday: startDate, sunday: endDate, startDateStr, endDateStr };
}

export function getISOWeek(date: Date) {
  return getISOWeekAndYear(date).weekNumber;
}

export interface MonthWeekOption {
  weekNumber: number;
  year: number;
  weekIndexInMonth: number; // 1, 2, 3, 4, 5
  startDate: Date;
  endDate: Date;
  startDateStr: string; // "DD/MM"
  endDateStr: string;   // "DD/MM"
  label: string;        // "Tuần 1: 31/08 - 06/09 (Tuần 36)"
  isCurrentWeek: boolean;
}

/**
 * Sinh danh sách tất cả các tuần ISO có ngày thuộc tháng và năm chỉ định.
 */
export function getWeeksInMonth(month: number, year: number): MonthWeekOption[] {
  const currentIso = getISOWeekAndYear(new Date());
  const firstDate = new Date(Date.UTC(year, month - 1, 1));
  const lastDate = new Date(Date.UTC(year, month, 0));

  // Tìm Thứ Hai của tuần chứa ngày mùng 1
  const dayOfWeek = firstDate.getUTCDay() || 7;
  let curMonday = new Date(firstDate.getTime() - (dayOfWeek - 1) * 86400000);

  const weeks: MonthWeekOption[] = [];
  let index = 1;

  while (curMonday <= lastDate) {
    const curSunday = new Date(curMonday.getTime() + 6 * 86400000);
    // Lấy Thursday để tính chuẩn ISO week & year
    const thursday = new Date(curMonday.getTime() + 3 * 86400000);
    const { weekNumber, year: isoYear } = getISOWeekAndYear(thursday);

    const startD = String(curMonday.getUTCDate()).padStart(2, "0");
    const startM = String(curMonday.getUTCMonth() + 1).padStart(2, "0");
    const endD = String(curSunday.getUTCDate()).padStart(2, "0");
    const endM = String(curSunday.getUTCMonth() + 1).padStart(2, "0");

    const startDateFormatted = `${startD}/${startM}`;
    const endDateFormatted = `${endD}/${endM}`;

    const isCurrent = weekNumber === currentIso.weekNumber && isoYear === currentIso.year;

    weeks.push({
      weekNumber,
      year: isoYear,
      weekIndexInMonth: index,
      startDate: new Date(curMonday),
      endDate: new Date(curSunday),
      startDateStr: startDateFormatted,
      endDateStr: endDateFormatted,
      label: `Tuần ${index}: ${startDateFormatted} - ${endDateFormatted} (Tuần ${weekNumber})`,
      isCurrentWeek: isCurrent,
    });

    index++;
    curMonday = new Date(curMonday.getTime() + 7 * 86400000);
  }

  return weeks;
}
