import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

import { parseJsonArray, parseJsonObject } from "@/lib/json-fields";
import { getEffectiveShiftRules, getEffectiveShiftTimes } from "@/lib/shiftRulesHelper";

const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "QC"];

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = (timeStr || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function getPastShiftCondition(now: Date = new Date(), shiftTimes?: Record<string, { startTime: string; endTime: string }>) {
  const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const vnYear = vnNow.getUTCFullYear();
  const vnMonth = vnNow.getUTCMonth();
  const vnDate = vnNow.getUTCDate();
  const vnMinutes = vnNow.getUTCHours() * 60 + vnNow.getUTCMinutes();

  const todayUtc = new Date(Date.UTC(vnYear, vnMonth, vnDate, 0, 0, 0));

  const morningEnd = shiftTimes?.MORNING ? parseTimeToMinutes(shiftTimes.MORNING.endTime) : 12 * 60 + 30;
  const afternoonEnd = shiftTimes?.AFTERNOON ? parseTimeToMinutes(shiftTimes.AFTERNOON.endTime) : 17 * 60 + 30;
  const eveningEnd = shiftTimes?.EVENING ? parseTimeToMinutes(shiftTimes.EVENING.endTime) : 22 * 60;

  const endedTypesToday: string[] = [];
  if (vnMinutes >= morningEnd) endedTypesToday.push("MORNING");
  if (vnMinutes >= afternoonEnd) endedTypesToday.push("AFTERNOON");
  if (vnMinutes >= eveningEnd) endedTypesToday.push("EVENING");

  if (endedTypesToday.length > 0) {
    return {
      OR: [
        { shiftDate: { lt: todayUtc } },
        { shiftDate: todayUtc, shiftType: { in: endedTypesToday } },
      ],
    };
  }

  return {
    shiftDate: { lt: todayUtc },
  };
}

function getReadyForQcReportCondition(
  now: Date,
  postShiftEditMinutes: number,
  shiftTimes: Record<string, { startTime: string; endTime: string }>
) {
  const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const vnYear = vnNow.getUTCFullYear();
  const vnMonth = vnNow.getUTCMonth();
  const vnDate = vnNow.getUTCDate();
  const vnMinutes = vnNow.getUTCHours() * 60 + vnNow.getUTCMinutes();

  const todayUtc = new Date(Date.UTC(vnYear, vnMonth, vnDate, 0, 0, 0));

  const readyTypesToday: string[] = [];
  for (const [st, time] of Object.entries(shiftTimes)) {
    const endMinutes = parseTimeToMinutes(time.endTime);
    if (vnMinutes >= endMinutes + postShiftEditMinutes) {
      readyTypesToday.push(st);
    }
  }

  const timeCondition =
    readyTypesToday.length > 0
      ? {
          OR: [
            { reportDate: { lt: todayUtc } },
            { reportDate: todayUtc, shiftType: { in: readyTypesToday } },
          ],
        }
      : {
          reportDate: { lt: todayUtc },
        };

  return {
    AND: [
      timeCondition,
      {
        shiftRegistration: {
          OR: [{ reopenedUntil: null }, { reopenedUntil: { lte: now } }],
        },
      },
    ],
  };
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: "Không có quyền truy cập hàng đợi QC" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "PENDING"; // PENDING, PASS, FAIL, ALL
    const search = searchParams.get("search")?.trim() || "";
    const fromDate = searchParams.get("fromDate")?.trim() || "";
    const toDate = searchParams.get("toDate")?.trim() || "";
    const date = searchParams.get("date")?.trim() || "";
    const slaUrgent = searchParams.get("slaUrgent") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "30")));
    const skip = (page - 1) * limit;

    const now = new Date();

    const [shiftRules, shiftTimes] = await Promise.all([
      getEffectiveShiftRules(),
      getEffectiveShiftTimes(),
    ]);
    const postShiftEditMinutes = shiftRules.postShiftEditMinutes ?? 60;

    // Điều kiện lọc
    const where: any = {};

    // Chuẩn hóa khoảng lọc ngày cho ca làm việc (ShiftDate)
    let shiftDateRange: { gte?: Date; lte?: Date } | null = null;
    if (fromDate || toDate) {
      const fromDateStr = fromDate ? fromDate.slice(0, 10) : "";
      const toDateStr = toDate ? toDate.slice(0, 10) : "";
      if (fromDateStr || toDateStr) {
        shiftDateRange = {};
        if (fromDateStr) shiftDateRange.gte = new Date(`${fromDateStr}T00:00:00.000Z`);
        if (toDateStr) shiftDateRange.lte = new Date(`${toDateStr}T23:59:59.999Z`);
      }
    } else if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      shiftDateRange = {
        gte: new Date(`${date}T00:00:00.000Z`),
        lte: new Date(`${date}T23:59:59.999Z`),
      };
    }

    // ========================================================
    // NHÁNH 1: LỌC RIÊNG CÁC CA CHƯA NỘP LINK (UNSUBMITTED)
    // ========================================================
    if (status === "UNSUBMITTED") {
      const pastCondition = getPastShiftCondition(now, shiftTimes);
      const shiftWhere: any = {
        dailyReport: null,
        status: { notIn: ["REJECTED", "CANCELLED"] },
        AND: [
          pastCondition,
          ...(shiftDateRange ? [{ shiftDate: shiftDateRange }] : []),
        ],
      };

      if (search) {
        shiftWhere.user = {
          OR: [
            { fullName: { contains: search } },
            { phone: { contains: search } },
          ],
        };
      }

      const [unsubmittedShifts, totalUnsub, viralTiers] = await Promise.all([
        prisma.shiftRegistration.findMany({
          where: shiftWhere,
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                phone: true,
                role: true,
                avatarUrl: true,
              },
            },
            loginSession: true,
          },
          orderBy: [{ shiftDate: "desc" }, { shiftType: "asc" }],
          skip,
          take: limit,
        }),
        prisma.shiftRegistration.count({ where: shiftWhere }),
        prisma.viralBonusTier.findMany({
          orderBy: [{ platform: "asc" }, { contentType: "asc" }, { minLikes: "asc" }],
        }),
      ]);

      const formattedUnsubmitted = unsubmittedShifts.map((shift) => ({
        id: -shift.id,
        userId: shift.userId,
        shiftRegistrationId: shift.id,
        reportDate: shift.shiftDate.toISOString(),
        shiftType: shift.shiftType as "MORNING" | "AFTERNOON" | "EVENING",
        submittedAt: "",
        fbLinks: [],
        fbSupplementLinks: [],
        threadLinks: [],
        commentDriveLink: null,
        femaleContentLinks: [],
        viralPostLinks: [],
        postTags: {},
        makeupUrls: [],
        slaRemainingDays: 0,
        slaStatus: "SAFE" as const,
        isUnsubmitted: true,
        user: shift.user,
        shiftRegistration: {
          id: shift.id,
          shiftDate: shift.shiftDate.toISOString(),
          shiftType: shift.shiftType,
          workMode: shift.workMode,
          status: shift.status,
          reopenedBy: shift.reopenedBy,
          reopenedUntil: shift.reopenedUntil ? shift.reopenedUntil.toISOString() : null,
          loginSession: shift.loginSession,
        },
        qcReview: null,
        viralPosts: [],
      }));

      // Thống kê nhanh
      const [totalPending, totalUrgent, reviewedToday, totalPassed, totalUnsubmitted] = await Promise.all([
        prisma.qcReview.count({ where: { result: "PENDING" } }),
        prisma.dailyReport.count({
          where: {
            qcReview: { result: "PENDING" },
            submittedAt: {
              lte: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
            },
          },
        }),
        prisma.qcReview.count({
          where: {
            reviewedAt: {
              gte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0),
            },
          },
        }),
        prisma.qcReview.count({ where: { result: "PASS" } }),
        totalUnsub,
      ]);

      return NextResponse.json({
        reports: formattedUnsubmitted,
        pagination: {
          total: totalUnsub,
          page,
          limit,
          totalPages: Math.ceil(totalUnsub / limit),
        },
        stats: {
          totalPending,
          totalUrgent,
          reviewedToday,
          totalPassed,
          totalUnsubmitted,
        },
        viralTiers,
      });
    }

    // ========================================================
    // NHÁNH 2: LỌC BÁO CÁO ĐÃ NỘP (PENDING, PASS, FAIL, ALL)
    // ========================================================
    if (fromDate || toDate) {
      if (shiftDateRange) {
        where.reportDate = shiftDateRange;
      }
    } else if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      if (!isNaN(startOfDay.getTime()) && !isNaN(endOfDay.getTime())) {
        where.reportDate = {
          gte: startOfDay,
          lte: endOfDay,
        };
      }
    }

    if (status === "PENDING") {
      where.OR = [
        { qcReview: { result: "PENDING" } },
        { qcReview: null },
      ];
      // R4: Ẩn báo cáo khi Cửa sổ sửa sau ca chưa đóng
      const readyCondition = getReadyForQcReportCondition(now, postShiftEditMinutes, shiftTimes);
      where.AND = [
        ...(where.AND || []),
        readyCondition,
      ];
    } else if (status !== "ALL") {
      where.qcReview = {
        result: status,
      };
    }

    if (search) {
      where.user = {
        OR: [
          { fullName: { contains: search } },
          { phone: { contains: search } },
        ],
      };
    }

    // Lấy danh sách báo cáo trong hàng đợi và cấu hình mức thưởng viral
    const [reports, total, viralTiers, unsubmittedCount] = await Promise.all([
      prisma.dailyReport.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              role: true,
              avatarUrl: true,
            },
          },
          shiftRegistration: {
            include: {
              loginSession: true,
            },
          },
          qcReview: {
            include: {
              reviewer: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          },
          viralPosts: true,
        },
        orderBy: { submittedAt: "asc" }, // Ca nộp trước cần duyệt trước
        skip,
        take: limit,
      }),
      prisma.dailyReport.count({ where }),
      prisma.viralBonusTier.findMany({
        orderBy: [{ platform: "asc" }, { contentType: "asc" }, { minLikes: "asc" }],
      }),
      // Đếm số ca chưa nộp báo cáo (theo khoảng ngày lọc nếu có và chỉ tính ca đã kết thúc)
      prisma.shiftRegistration.count({
        where: {
          dailyReport: null,
          status: { notIn: ["REJECTED", "CANCELLED"] },
          AND: [
            getPastShiftCondition(now, shiftTimes),
            ...(shiftDateRange ? [{ shiftDate: shiftDateRange }] : []),
          ],
        },
      }),
    ]);

    // Thống kê SLA & trạng thái
    const [totalPending, totalUrgent, reviewedToday, totalPassed] = await Promise.all([
      prisma.qcReview.count({ where: { result: "PENDING" } }),
      // Sắp hết hạn 7 ngày: nộp cách đây >= 5 ngày và chưa duyệt
      prisma.dailyReport.count({
        where: {
          qcReview: { result: "PENDING" },
          submittedAt: {
            lte: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // >= 5 ngày trôi qua (còn <= 2 ngày)
          },
        },
      }),
      // Đã duyệt hôm nay
      prisma.qcReview.count({
        where: {
          reviewedAt: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0),
          },
        },
      }),
      // Tổng số ca đạt
      prisma.qcReview.count({ where: { result: "PASS" } }),
    ]);

    // Format và tính toán SLA đếm ngược cho từng ca
    const formattedReports = reports.map((rep) => {
      const submittedTime = new Date(rep.submittedAt).getTime();
      const slaDeadline = submittedTime + 7 * 24 * 60 * 60 * 1000; // 7 ngày SLA
      const remainingMs = slaDeadline - now.getTime();
      const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

      let slaStatus: "SAFE" | "WARNING" | "OVERDUE" = "SAFE";
      if (remainingDays <= 0) {
        slaStatus = "OVERDUE";
      } else if (remainingDays <= 2) {
        slaStatus = "WARNING";
      }

      const fbLinks = parseJsonArray<string>(rep.fbLinks);
      const fbSupplementLinks = parseJsonArray<string>(rep.fbSupplementLinks);
      const threadLinks = parseJsonArray<string>(rep.threadLinks);

      // R4: Link thêm hoặc thay trong Nộp bù tuần (hoặc sau chốt ca)
      const makeupUrls: string[] = [
        ...fbSupplementLinks,
        ...(rep.endFbCount !== null && rep.endFbCount !== undefined
          ? fbLinks.slice(rep.endFbCount)
          : []),
        ...(rep.endThreadCount !== null && rep.endThreadCount !== undefined
          ? threadLinks.slice(rep.endThreadCount)
          : []),
      ];

      return {
        ...rep,
        fbLinks,
        fbSupplementLinks,
        threadLinks,
        femaleContentLinks: parseJsonArray<string>(rep.femaleContentLinks),
        viralPostLinks: parseJsonArray<string>(rep.viralPostLinks),
        viralProposals: parseJsonArray<any>(rep.viralProposals),
        postTags: parseJsonObject<Record<string, string>>(rep.postTags, {}),
        makeupUrls,
        qcReview: rep.qcReview
          ? {
              ...rep.qcReview,
              invalidLinks: parseJsonArray<string>(rep.qcReview.invalidLinks),
            }
          : null,
        slaRemainingDays: remainingDays,
        slaStatus,
        isUnsubmitted: false,
      };
    });

    // Nếu filter chỉ lấy ca khẩn cấp
    const finalReports = slaUrgent
      ? formattedReports.filter((r) => r.slaStatus === "WARNING" || r.slaStatus === "OVERDUE")
      : formattedReports;

    return NextResponse.json({
      reports: finalReports,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalPending,
        totalUrgent,
        reviewedToday,
        totalPassed,
        totalUnsubmitted: unsubmittedCount,
      },
      viralTiers,
    });
  } catch (error: any) {
    console.error("Lỗi khi tải hàng đợi kiểm duyệt QC:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi tải hàng đợi QC" }, { status: 500 });
  }
}
