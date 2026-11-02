import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parseJsonObject } from "@/lib/json-fields";
import { DEFAULT_SHIFT_TIMES } from "@/lib/shifts-constants";

function getShiftHours(startTime?: string, endTime?: string): number {
  if (!startTime || !endTime) return 4;
  try {
    const [sh, sm] = startTime.split(":").map(Number);
    let [eh, em] = endTime.split(":").map(Number);
    if (eh === 0 && em === 0) eh = 24;
    const hours = (eh * 60 + em - (sh * 60 + sm)) / 60;
    return hours > 0 ? hours : 4;
  } catch {
    return 4;
  }
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1));
    const year = parseInt(searchParams.get("year") || String(now.getFullYear()));

    if (isNaN(month) || month < 1 || month > 12 || isNaN(year) || year < 2020) {
      return NextResponse.json({ error: "Tháng hoặc năm không hợp lệ" }, { status: 400 });
    }

    // 1. Xác định khoảng thời gian đầu tháng đến cuối tháng (UTC chuẩn cho cột @db.Date)
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    // 2. Lấy cấu hình ca làm việc (khung giờ & đơn giá lương theo giờ)
    const timesSetting = await prisma.systemSetting.findUnique({
      where: { key: "shift_times" },
    });
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

    const morningHoursPerShift = getShiftHours(shiftTimes.MORNING.startTime, shiftTimes.MORNING.endTime);
    const afternoonHoursPerShift = getShiftHours(shiftTimes.AFTERNOON.startTime, shiftTimes.AFTERNOON.endTime);
    const eveningHoursPerShift = getShiftHours(shiftTimes.EVENING.startTime, shiftTimes.EVENING.endTime);

    const morningHourlyRate = shiftTimes.MORNING.hourlyRate;
    const afternoonHourlyRate = shiftTimes.AFTERNOON.hourlyRate;
    const eveningHourlyRate = shiftTimes.EVENING.hourlyRate;

    // 3. Lấy danh sách nhân viên Hybrid
    const users = await prisma.user.findMany({
      where: {
        role: "NHAN_SU_HYBRID",
        status: { in: ["ACTIVE", "PROBATION"] },
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        role: true,
        status: true,
        avatarUrl: true,
        startDate: true,
      },
      orderBy: { fullName: "asc" },
    });

    const userIds = users.map((u) => u.id);

    // 4. Lấy tất cả ca làm việc trong tháng kèm dailyReport, qcReview và viralPosts
    const shifts = await prisma.shiftRegistration.findMany({
      where: {
        userId: { in: userIds },
        shiftDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        dailyReport: {
          include: {
            qcReview: true,
            viralPosts: true,
          },
        },
      },
    });

    // 5. Lấy các bản ghi MonthlyAcceptance đã lưu cho tháng này
    const savedAcceptances = await prisma.monthlyAcceptance.findMany({
      where: {
        userId: { in: userIds },
        month,
        year,
      },
    });
    const acceptanceMap = new Map<number, (typeof savedAcceptances)[0]>();
    for (const acc of savedAcceptances) {
      acceptanceMap.set(acc.userId, acc);
    }

    // Group shifts by userId
    const shiftsByUser = new Map<number, typeof shifts>();
    for (const s of shifts) {
      const list = shiftsByUser.get(s.userId) || [];
      list.push(s);
      shiftsByUser.set(s.userId, list);
    }

    // 7. Tổng hợp chi tiết cho từng nhân sự
    let totalAllPosts = 0;
    let totalAllComments = 0;
    let totalAllShifts = 0;
    let totalAllShiftsPassed = 0;
    let totalAllPackages = 0;
    let totalAllViralBonus = 0;
    let totalAllWorkHours = 0;
    let totalAllMorningHours = 0;
    let totalAllAfternoonHours = 0;
    let totalAllEveningHours = 0;
    let totalAllBaseSalary = 0;
    let totalAllSalaryAndBonus = 0;
    let confirmedCount = 0;

    const items = users.map((user, index) => {
      const userShifts = shiftsByUser.get(user.id) || [];
      const saved = acceptanceMap.get(user.id);
      const isConfirmed = saved?.status === "CONFIRMED" || saved?.status === "EXPORTED";

      if (isConfirmed) {
        confirmedCount++;
      }

      let totalShifts = userShifts.length;
      let totalShiftsPassed = 0;
      let morningPassed = 0;
      let afternoonPassed = 0;
      let eveningPassed = 0;
      let totalFbPosts = 0;
      let totalThreadPosts = 0;
      let totalComments = 0;
      let absentShifts = 0;
      let viralBonus = 0;

      for (const s of userShifts) {
        if (s.status === "ABSENT") {
          absentShifts++;
        }
        const report = s.dailyReport;
        if (report?.qcReview) {
          if (report.qcReview.result === "PASS") {
            totalShiftsPassed++;
            if (s.shiftType === "MORNING") morningPassed++;
            else if (s.shiftType === "AFTERNOON") afternoonPassed++;
            else if (s.shiftType === "EVENING") eveningPassed++;

            // Thưởng viral của các ca đã duyệt PASS trong tháng này
            if (report.viralPosts && report.viralPosts.length > 0) {
              for (const vp of report.viralPosts) {
                viralBonus += vp.bonusAmount || 0;
              }
            }
          }
          totalFbPosts += report.qcReview.fbApproved || 0;
          totalThreadPosts += report.qcReview.threadApproved || 0;
          totalComments += report.qcReview.commentApproved || 0;
        }
      }

      let totalPosts = totalFbPosts + totalThreadPosts;
      let totalPackages = totalShiftsPassed;

      let morningHours = morningPassed * morningHoursPerShift;
      let afternoonHours = afternoonPassed * afternoonHoursPerShift;
      let eveningHours = eveningPassed * eveningHoursPerShift;
      let totalWorkHours = morningHours + afternoonHours + eveningHours;

      let morningSalary = morningHours * morningHourlyRate;
      let afternoonSalary = afternoonHours * afternoonHourlyRate;
      let eveningSalary = eveningHours * eveningHourlyRate;
      let totalBaseSalary = morningSalary + afternoonSalary + eveningSalary;
      let totalSalaryAndBonus = totalBaseSalary + viralBonus;

      // Nếu đã CONFIRMED, lấy giá trị đã đóng băng trong snapshot
      if (isConfirmed && saved) {
        totalPosts = saved.totalPosts;
        totalComments = saved.totalComments;
        totalShifts = saved.totalShifts;
        totalShiftsPassed = saved.totalShiftsPassed;
        totalPackages = saved.totalPackages;
        viralBonus = saved.viralBonus;

        if (saved.bonusNote) {
          try {
            const meta = JSON.parse(saved.bonusNote);
            if (meta && typeof meta === "object") {
              if (meta.morningHours !== undefined) morningHours = meta.morningHours;
              if (meta.afternoonHours !== undefined) afternoonHours = meta.afternoonHours;
              if (meta.eveningHours !== undefined) eveningHours = meta.eveningHours;
              if (meta.totalWorkHours !== undefined) totalWorkHours = meta.totalWorkHours;
              if (meta.totalBaseSalary !== undefined) totalBaseSalary = meta.totalBaseSalary;
              if (meta.totalSalaryAndBonus !== undefined) totalSalaryAndBonus = meta.totalSalaryAndBonus;
              if (meta.morningPassed !== undefined) morningPassed = meta.morningPassed;
              if (meta.afternoonPassed !== undefined) afternoonPassed = meta.afternoonPassed;
              if (meta.eveningPassed !== undefined) eveningPassed = meta.eveningPassed;
            }
          } catch (e) {
            // fallback tính toán động
          }
        }
      }

      // Đánh giá tình trạng công & ca
      let conditionStatus: "QUALIFIED" | "BELOW_MIN" | "EXCESS_ABSENT" = "QUALIFIED";
      let statusNote = "Đạt điều kiện nghiệm thu";

      if (totalShiftsPassed < 3) {
        conditionStatus = "BELOW_MIN";
        statusNote = `Chưa đủ 3 ca đạt (${totalShiftsPassed}/3 ca)`;
      } else if (absentShifts > 3) {
        conditionStatus = "EXCESS_ABSENT";
        statusNote = `Vắng vượt quá định mức (${absentShifts}/3 ca)`;
      } else if (totalShiftsPassed >= 20) {
        statusNote = `Hoàn thành tốt định mức (${totalShiftsPassed} ca)`;
      } else {
        statusNote = `Đạt (${totalShiftsPassed} ca)`;
      }

      totalAllPosts += totalPosts;
      totalAllComments += totalComments;
      totalAllShifts += totalShifts;
      totalAllShiftsPassed += totalShiftsPassed;
      totalAllPackages += totalPackages;
      totalAllViralBonus += viralBonus;
      totalAllWorkHours += totalWorkHours;
      totalAllMorningHours += morningHours;
      totalAllAfternoonHours += afternoonHours;
      totalAllEveningHours += eveningHours;
      totalAllBaseSalary += totalBaseSalary;
      totalAllSalaryAndBonus += totalSalaryAndBonus;

      return {
        stt: index + 1,
        user: {
          id: user.id,
          fullName: user.fullName,
          phone: user.phone,
          status: user.status,
          avatarUrl: user.avatarUrl,
        },
        totalShifts,
        totalShiftsPassed,
        morningPassed,
        afternoonPassed,
        eveningPassed,
        morningHours,
        afternoonHours,
        eveningHours,
        totalWorkHours,
        totalBaseSalary,
        totalSalaryAndBonus,
        totalPosts,
        totalFbPosts,
        totalThreadPosts,
        totalComments,
        totalPackages,
        viralBonus,
        absentShifts,
        conditionStatus,
        statusNote,
        status: saved?.status || "DRAFT",
        confirmedAt: saved?.confirmedAt || null,
      };
    });

    const overallStatus =
      users.length > 0 && confirmedCount === users.length
        ? "CONFIRMED"
        : confirmedCount > 0
        ? "PARTIAL"
        : "DRAFT";

    return NextResponse.json({
      month,
      year,
      overallStatus,
      summary: {
        totalStaff: users.length,
        totalShifts: totalAllShifts,
        totalShiftsPassed: totalAllShiftsPassed,
        totalPosts: totalAllPosts,
        totalComments: totalAllComments,
        totalPackages: totalAllPackages,
        totalViralBonus: totalAllViralBonus,
        totalWorkHours: totalAllWorkHours,
        totalMorningHours: totalAllMorningHours,
        totalAfternoonHours: totalAllAfternoonHours,
        totalEveningHours: totalAllEveningHours,
        totalBaseSalary: totalAllBaseSalary,
        totalSalaryAndBonus: totalAllSalaryAndBonus,
        hourlyRates: {
          MORNING: morningHourlyRate,
          AFTERNOON: afternoonHourlyRate,
          EVENING: eveningHourlyRate,
        },
        confirmedCount,
      },
      items,
    });
  } catch (error: any) {
    console.error("GET /api/nghiem-thu error:", error);
    return NextResponse.json(
      { error: "Lỗi tổng hợp dữ liệu nghiệm thu: " + (error?.message || error) },
      { status: 500 }
    );
  }
}

// POST: Chốt biên bản nghiệm thu (Snapshot Freeze)
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER"];
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json({ error: "Bạn không có quyền chốt biên bản nghiệm thu" }, { status: 403 });
    }

    const body = await request.json();
    const { month, year } = body;

    if (!month || !year || month < 1 || month > 12) {
      return NextResponse.json({ error: "Tháng hoặc năm không hợp lệ" }, { status: 400 });
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const users = await prisma.user.findMany({
      where: {
        role: "NHAN_SU_HYBRID",
        status: { in: ["ACTIVE", "PROBATION"] },
      },
      select: { id: true },
    });

    const userIds = users.map((u) => u.id);

    // Lấy ca làm việc kèm qcReview và viralPosts
    const shifts = await prisma.shiftRegistration.findMany({
      where: {
        userId: { in: userIds },
        shiftDate: { gte: startDate, lte: endDate },
      },
      include: {
        dailyReport: {
          include: {
            qcReview: true,
            viralPosts: true,
          },
        },
      },
    });

    const shiftsByUser = new Map<number, typeof shifts>();
    for (const s of shifts) {
      const list = shiftsByUser.get(s.userId) || [];
      list.push(s);
      shiftsByUser.set(s.userId, list);
    }

    // Lấy cấu hình ca làm việc để đóng băng đơn giá vào snapshot
    const timesSetting = await prisma.systemSetting.findUnique({
      where: { key: "shift_times" },
    });
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

    const morningHoursPerShift = getShiftHours(shiftTimes.MORNING.startTime, shiftTimes.MORNING.endTime);
    const afternoonHoursPerShift = getShiftHours(shiftTimes.AFTERNOON.startTime, shiftTimes.AFTERNOON.endTime);
    const eveningHoursPerShift = getShiftHours(shiftTimes.EVENING.startTime, shiftTimes.EVENING.endTime);

    const morningHourlyRate = shiftTimes.MORNING.hourlyRate;
    const afternoonHourlyRate = shiftTimes.AFTERNOON.hourlyRate;
    const eveningHourlyRate = shiftTimes.EVENING.hourlyRate;

    // Upsert MonthlyAcceptance cho từng user
    const now = new Date();
    const results = [];

    for (const user of users) {
      const userShifts = shiftsByUser.get(user.id) || [];
      let totalShiftsPassed = 0;
      let morningPassed = 0;
      let afternoonPassed = 0;
      let eveningPassed = 0;
      let totalFbPosts = 0;
      let totalThreadPosts = 0;
      let totalComments = 0;
      let viralBonus = 0;

      for (const s of userShifts) {
        const report = s.dailyReport;
        if (report?.qcReview) {
          if (report.qcReview.result === "PASS") {
            totalShiftsPassed++;
            if (s.shiftType === "MORNING") morningPassed++;
            else if (s.shiftType === "AFTERNOON") afternoonPassed++;
            else if (s.shiftType === "EVENING") eveningPassed++;

            // Thưởng viral của các ca đã duyệt PASS trong tháng này
            if (report.viralPosts && report.viralPosts.length > 0) {
              for (const vp of report.viralPosts) {
                viralBonus += vp.bonusAmount || 0;
              }
            }
          }
          totalFbPosts += report.qcReview.fbApproved || 0;
          totalThreadPosts += report.qcReview.threadApproved || 0;
          totalComments += report.qcReview.commentApproved || 0;
        }
      }

      const totalPosts = totalFbPosts + totalThreadPosts;
      const totalPackages = totalShiftsPassed;

      const morningHours = morningPassed * morningHoursPerShift;
      const afternoonHours = afternoonPassed * afternoonHoursPerShift;
      const eveningHours = eveningPassed * eveningHoursPerShift;
      const totalWorkHours = morningHours + afternoonHours + eveningHours;

      const morningSalary = morningHours * morningHourlyRate;
      const afternoonSalary = afternoonHours * afternoonHourlyRate;
      const eveningSalary = eveningHours * eveningHourlyRate;
      const totalBaseSalary = morningSalary + afternoonSalary + eveningSalary;
      const totalSalaryAndBonus = totalBaseSalary + viralBonus;

      const bonusNote = JSON.stringify({
        morningPassed,
        afternoonPassed,
        eveningPassed,
        morningHours,
        afternoonHours,
        eveningHours,
        totalWorkHours,
        morningSalary,
        afternoonSalary,
        eveningSalary,
        totalBaseSalary,
        totalSalaryAndBonus,
        morningHourlyRate,
        afternoonHourlyRate,
        eveningHourlyRate,
      });

      const record = await prisma.monthlyAcceptance.upsert({
        where: {
          userId_month_year: {
            userId: user.id,
            month,
            year,
          },
        },
        update: {
          totalPosts,
          totalComments,
          totalShifts: userShifts.length,
          totalShiftsPassed,
          totalPackages,
          viralBonus,
          bonusNote,
          status: "CONFIRMED",
          confirmedAt: now,
        },
        create: {
          userId: user.id,
          month,
          year,
          totalPosts,
          totalComments,
          totalShifts: userShifts.length,
          totalShiftsPassed,
          totalPackages,
          viralBonus,
          bonusNote,
          status: "CONFIRMED",
          confirmedAt: now,
        },
      });

      results.push(record);
    }

    return NextResponse.json({
      message: `Đã chốt thành công biên bản nghiệm thu Tháng ${month}/${year} cho ${results.length} nhân sự.`,
      count: results.length,
    });
  } catch (error: any) {
    console.error("POST /api/nghiem-thu error:", error);
    return NextResponse.json(
      { error: "Lỗi chốt biên bản nghiệm thu: " + (error?.message || error) },
      { status: 500 }
    );
  }
}

// PUT: Mở khóa biên bản nghiệm thu (Dành cho Admin/Manager)
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "ADMIN", "MANAGER"];
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json({ error: "Bạn không có quyền mở khóa biên bản nghiệm thu" }, { status: 403 });
    }

    const body = await request.json();
    const { month, year } = body;

    if (!month || !year) {
      return NextResponse.json({ error: "Thiếu tháng hoặc năm" }, { status: 400 });
    }

    await prisma.monthlyAcceptance.updateMany({
      where: { month, year },
      data: {
        status: "DRAFT",
        confirmedAt: null,
      },
    });

    return NextResponse.json({
      message: `Đã mở khóa biên bản nghiệm thu Tháng ${month}/${year}. Bạn có thể cập nhật và chốt lại.`,
    });
  } catch (error: any) {
    console.error("PUT /api/nghiem-thu error:", error);
    return NextResponse.json(
      { error: "Lỗi mở khóa biên bản: " + (error?.message || error) },
      { status: 500 }
    );
  }
}
