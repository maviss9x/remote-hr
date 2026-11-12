import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasAnyRole } from "@/lib/auth";
import { parseJsonArray, stringifyJsonArray, parseJsonObject, stringifyJsonObject } from "@/lib/json-fields";
import { isUrlInList, matchUrls } from "@/lib/url-matcher";
import {
  evaluateSubmission,
  getShiftTimeRange,
  getRequiredLinks,
  type SubmissionDecision,
} from "@/lib/reportSubmissionPolicy";
import {
  getEffectiveShiftRules,
  getEffectiveShiftTimes,
  getEffectiveKpiConfig,
} from "@/lib/shiftRulesHelper";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "15")));
    const skip = (page - 1) * limit;

    const queryYear = year ? parseInt(year) : new Date().getFullYear();
    const queryMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const monthStartDate = new Date(queryYear, queryMonth - 1, 1);
    const monthEndDate = new Date(queryYear, queryMonth, 0, 23, 59, 59, 999);

    const where: any = {
      userId: session.userId,
    };

    const date = searchParams.get("date")?.trim() || "";
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      where.reportDate = {
        gte: startOfDay,
        lte: endOfDay,
      };
    } else if (month && year) {
      where.reportDate = {
        gte: monthStartDate,
        lte: monthEndDate,
      };
    }

    const [reports, total, pendingEligibleShifts, rawMonthShifts, shiftTimes, rules, kpi] = await Promise.all([
      // 1. Danh sách báo cáo đã nộp
      prisma.dailyReport.findMany({
        where,
        include: {
          shiftRegistration: {
            select: {
              id: true,
              shiftDate: true,
              shiftType: true,
              workMode: true,
              status: true,
            },
          },
          qcReview: {
            select: {
              id: true,
              result: true,
              fbApproved: true,
              threadApproved: true,
              commentApproved: true,
              feedback: true,
              invalidLinks: true,
              reviewedAt: true,
              reviewer: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          },
        },
        orderBy: { reportDate: "desc" },
        skip,
        take: limit,
      }),

      // 2. Tổng số báo cáo
      prisma.dailyReport.count({ where }),

      // 3. Danh sách ca làm việc của nhân sự chưa nộp báo cáo (trong vòng 14 ngày gần nhất)
      prisma.shiftRegistration.findMany({
        where: {
          userId: session.userId,
          dailyReport: null,
          OR: [
            { status: { in: ["REGISTERED", "APPROVED", "COMPLETED"] } },
            { reopenedBy: { not: null } },
          ],
          shiftDate: {
            gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          },
        },
        include: {
          loginSession: true,
        },
        orderBy: { shiftDate: "desc" },
      }),

      // 4. Danh sách toàn bộ ca làm việc của nhân sự trong tháng được chọn
      prisma.shiftRegistration.findMany({
        where: {
          userId: session.userId,
          shiftDate: {
            gte: monthStartDate,
            lte: monthEndDate,
          },
        },
        include: {
          loginSession: true,
          dailyReport: {
            select: {
              id: true,
              reportDate: true,
              shiftType: true,
              fbLinks: true,
              fbSupplementLinks: true,
              threadLinks: true,
              commentDriveLink: true,
              femaleContentLinks: true,
              viralPostLinks: true,
              viralProposals: true,
              postTags: true,
              submittedAt: true,
              endFbCount: true,
              endThreadCount: true,
              thresholdMet: true,
              endSnapshotAt: true,
              qcReview: {
                select: {
                  id: true,
                  result: true,
                  fbApproved: true,
                  threadApproved: true,
                  commentApproved: true,
                  feedback: true,
                  invalidLinks: true,
                  reviewedAt: true,
                  reviewer: {
                    select: {
                      id: true,
                      fullName: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ shiftDate: "asc" }, { shiftType: "asc" }],
      }),

      getEffectiveShiftTimes(),
      getEffectiveShiftRules(),
      getEffectiveKpiConfig(session.role === "NHAN_SU_HYBRID" ? session.userId : undefined),
    ]);

    const now = new Date();

    // Xử lý cơ chế chốt lười (lazy snapshot) cho các ca đã hết giờ mà chưa có bản chốt
    const monthShifts = await Promise.all(
      rawMonthShifts.map(async (shift) => {
        const shiftTime = shiftTimes[shift.shiftType] || { startTime: "08:30", endTime: "12:30" };
        const { end: shiftEnd } = getShiftTimeRange(shift.shiftDate, shiftTime);

        let report = shift.dailyReport;
        if (report && now > shiftEnd && !report.endSnapshotAt) {
          const fbCount = parseJsonArray<string>(report.fbLinks).length;
          const threadCount = parseJsonArray<string>(report.threadLinks).length;
          const req = getRequiredLinks(kpi, rules.participationThresholdPercent);
          const thresholdMet = fbCount >= req.fb && threadCount >= req.thread;

          await prisma.dailyReport.update({
            where: { id: report.id },
            data: {
              endFbCount: fbCount,
              endThreadCount: threadCount,
              thresholdMet,
              endSnapshotAt: shiftEnd,
            },
          });

          report = {
            ...report,
            endFbCount: fbCount,
            endThreadCount: threadCount,
            thresholdMet,
            endSnapshotAt: shiftEnd,
          };
        }

        // Tính toán quyết định nộp theo policy
        const linkCountsAtShiftEnd =
          report?.endSnapshotAt !== null && report?.endSnapshotAt !== undefined
            ? {
                fb: report.endFbCount ?? 0,
                thread: report.endThreadCount ?? 0,
              }
            : report
            ? {
                fb: parseJsonArray<string>(report.fbLinks).length,
                thread: parseJsonArray<string>(report.threadLinks).length,
              }
            : null;

        const specialReopen = shift.reopenedBy
          ? { until: shift.reopenedUntil ? new Date(shift.reopenedUntil) : null }
          : null;

        const decision: SubmissionDecision = evaluateSubmission({
          shiftDate: shift.shiftDate,
          shiftTime,
          checkInAt: shift.loginSession?.loginTime
            ? new Date(shift.loginSession.loginTime)
            : report?.submittedAt
            ? new Date(report.submittedAt)
            : null,
          linkCountsAtShiftEnd,
          hasSubmittedReport: Boolean(report),
          specialReopen,
          now,
          rules,
          kpi,
        });

        return {
          ...shift,
          dailyReport: report,
          submissionDecision: decision,
        };
      })
    );

    // Tính decision cho pendingEligibleShifts
    const formattedEligibleShifts = pendingEligibleShifts.map((shift) => {
      const shiftTime = shiftTimes[shift.shiftType] || { startTime: "08:30", endTime: "12:30" };
      const specialReopen = shift.reopenedBy
        ? { until: shift.reopenedUntil ? new Date(shift.reopenedUntil) : null }
        : null;

      const decision: SubmissionDecision = evaluateSubmission({
        shiftDate: shift.shiftDate,
        shiftTime,
        checkInAt: shift.loginSession?.loginTime ? new Date(shift.loginSession.loginTime) : null,
        linkCountsAtShiftEnd: null,
        specialReopen,
        now,
        rules,
        kpi,
      });

      return {
        ...shift,
        submissionDecision: decision,
      };
    });

    const formattedReports = reports.map((r) => ({
      ...r,
      fbLinks: parseJsonArray<string>(r.fbLinks),
      fbSupplementLinks: parseJsonArray<string>(r.fbSupplementLinks),
      threadLinks: parseJsonArray<string>(r.threadLinks),
      femaleContentLinks: parseJsonArray<string>(r.femaleContentLinks),
      viralPostLinks: parseJsonArray<string>(r.viralPostLinks),
      viralProposals: parseJsonArray<any>(r.viralProposals),
      postTags: parseJsonObject<Record<string, string>>(r.postTags, {}),
      qcReview: r.qcReview
        ? {
            ...r.qcReview,
            invalidLinks: parseJsonArray<string>(r.qcReview.invalidLinks),
          }
        : null,
    }));

    const formattedMonthShifts = monthShifts.map((s) => ({
      ...s,
      reopenedBy: s.reopenedBy,
      reopenedUntil: s.reopenedUntil ? s.reopenedUntil.toISOString() : null,
      dailyReport: s.dailyReport
        ? {
            ...s.dailyReport,
            fbLinks: parseJsonArray<string>(s.dailyReport.fbLinks),
            fbSupplementLinks: parseJsonArray<string>(s.dailyReport.fbSupplementLinks),
            threadLinks: parseJsonArray<string>(s.dailyReport.threadLinks),
            femaleContentLinks: parseJsonArray<string>(s.dailyReport.femaleContentLinks),
            viralPostLinks: parseJsonArray<string>(s.dailyReport.viralPostLinks),
            viralProposals: parseJsonArray<any>(s.dailyReport.viralProposals),
            postTags: parseJsonObject<Record<string, string>>(s.dailyReport.postTags, {}),
            qcReview: s.dailyReport.qcReview
              ? {
                  ...s.dailyReport.qcReview,
                  invalidLinks: parseJsonArray<string>(s.dailyReport.qcReview.invalidLinks),
                }
              : null,
          }
        : null,
    }));

    return NextResponse.json({
      reports: formattedReports,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      eligibleShifts: formattedEligibleShifts,
      monthShifts: formattedMonthShifts,
      kpiConfig: {
        fbPerShift: kpi.fbPerShift,
        threadPerShift: kpi.threadPerShift,
        commentPerShift: kpi.commentPerShift,
      },
      shiftRules: {
        lateCheckinMinutes: rules.lateCheckinMinutes,
        postShiftEditMinutes: rules.postShiftEditMinutes,
        participationThresholdPercent: rules.participationThresholdPercent,
        tagPostGraceDays: Number(rules.tagPostGraceDays) || 7,
        viralPostGraceDays: Number(rules.viralPostGraceDays) || 30,
      },
      shiftTimes,
      graceConfig: {
        tagPostGraceDays: Number(rules.tagPostGraceDays) || 7,
        viralPostGraceDays: Number(rules.viralPostGraceDays) || 30,
      },
    });
  } catch (error: any) {
    console.error("Lỗi khi tải dữ liệu báo cáo seeding:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi tải báo cáo" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await request.json();
    const {
      shiftRegistrationId,
      fbLinks = [],
      fbSupplementLinks = [],
      threadLinks = [],
      commentDriveLink = "",
      femaleContentLinks = [],
      viralPostLinks = [],
      viralProposals = [],
      postTags = {},
    } = body;

    const parsedShiftId = Number(shiftRegistrationId);
    if (!parsedShiftId || Number.isNaN(parsedShiftId)) {
      return NextResponse.json({ error: "Vui lòng chọn ca làm việc để nộp báo cáo" }, { status: 400 });
    }

    // Kiểm tra ca làm việc và session điểm danh
    const shift = await prisma.shiftRegistration.findUnique({
      where: { id: parsedShiftId },
      include: {
        loginSession: true,
      },
    });

    if (!shift) {
      return NextResponse.json({ error: "Không tìm thấy ca làm việc" }, { status: 404 });
    }

    const isManagerRole = hasAnyRole(session.role, ["SUPER_ADMIN", "ADMIN", "MANAGER", "HR"]);
    if (shift.userId !== session.userId && !isManagerRole) {
      return NextResponse.json(
        { error: "Bạn không có quyền nộp báo cáo cho ca làm việc này" },
        { status: 403 }
      );
    }

    // Đọc cấu hình ca, rules và KPI áp dụng riêng cho nhân sự của ca này
    const [shiftTimes, rules, kpi] = await Promise.all([
      getEffectiveShiftTimes(),
      getEffectiveShiftRules(),
      getEffectiveKpiConfig(shift.userId),
    ]);

    const shiftTime = shiftTimes[shift.shiftType] || { startTime: "08:30", endTime: "12:30" };
    const { end: shiftEnd } = getShiftTimeRange(shift.shiftDate, shiftTime);
    const now = new Date();

    // Lấy báo cáo hiện tại (nếu có)
    let existingReport = await prisma.dailyReport.findUnique({
      where: { shiftRegistrationId: shift.id },
      include: { qcReview: true },
    });

    // Lazy Snapshot: nếu hết giờ ca mà chưa có bản chốt thì chốt số link tại thời điểm hết ca
    if (existingReport && now > shiftEnd && !existingReport.endSnapshotAt) {
      const fbCount = parseJsonArray<string>(existingReport.fbLinks).length;
      const threadCount = parseJsonArray<string>(existingReport.threadLinks).length;
      const req = getRequiredLinks(kpi, rules.participationThresholdPercent);
      const thresholdMet = fbCount >= req.fb && threadCount >= req.thread;

      existingReport = await prisma.dailyReport.update({
        where: { id: existingReport.id },
        data: {
          endFbCount: fbCount,
          endThreadCount: threadCount,
          thresholdMet,
          endSnapshotAt: shiftEnd,
        },
        include: { qcReview: true },
      });
    }

    // Xác định quyền nộp bằng policy thuần evaluateSubmission
    const linkCountsAtShiftEnd =
      existingReport?.endSnapshotAt !== null && existingReport?.endSnapshotAt !== undefined
        ? {
            fb: existingReport.endFbCount ?? 0,
            thread: existingReport.endThreadCount ?? 0,
          }
        : existingReport
        ? {
            fb: parseJsonArray<string>(existingReport.fbLinks).length,
            thread: parseJsonArray<string>(existingReport.threadLinks).length,
          }
        : null;

    const specialReopen = shift.reopenedBy
      ? { until: shift.reopenedUntil ? new Date(shift.reopenedUntil) : null }
      : null;

    const decision = evaluateSubmission({
      shiftDate: shift.shiftDate,
      shiftTime,
      checkInAt: shift.loginSession?.loginTime
        ? new Date(shift.loginSession.loginTime)
        : existingReport?.submittedAt
        ? new Date(existingReport.submittedAt)
        : null,
      linkCountsAtShiftEnd,
      hasSubmittedReport: Boolean(existingReport),
      specialReopen,
      now,
      rules,
      kpi,
    });

    // 1. Chặn nếu policy từ chối quyền nộp
    if (!decision.canSubmit) {
      return NextResponse.json(
        {
          error: decision.reason,
          phase: decision.phase,
        },
        { status: 403 }
      );
    }

    const invalidLinks = existingReport?.qcReview?.invalidLinks
      ? parseJsonArray<string>(existingReport.qcReview.invalidLinks)
      : [];

    // Sanitize link mảng
    const cleanFbLinks = (fbLinks as string[]).map((l) => l.trim()).filter((l) => l.length > 0);
    const cleanFbSupp = (fbSupplementLinks as string[]).map((l) => l.trim()).filter((l) => l.length > 0);
    const cleanThreadLinks = (threadLinks as string[]).map((l) => l.trim()).filter((l) => l.length > 0);
    const cleanCommentLink = (commentDriveLink as string).trim();
    const cleanFemaleLinks = (femaleContentLinks as string[]).map((l) => l.trim()).filter((l) => l.length > 0);
    const cleanViralLinks = (viralPostLinks as string[])
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !isUrlInList(l, invalidLinks));

    // Validate số lượng cơ bản
    if (cleanFbLinks.length === 0 && cleanThreadLinks.length === 0) {
      return NextResponse.json(
        { error: "Vui lòng nhập ít nhất 1 link bài viết để nộp báo cáo" },
        { status: 400 }
      );
    }

    // 2. Chặn chỉnh sửa link cũ khi đã kết thúc ca (sau 1h nộp bù, chỉnh sửa ngay sau ca)
    if (!decision.canEditOldLinks && existingReport) {
      const oldFb = [
        ...parseJsonArray<string>(existingReport.fbLinks),
        ...parseJsonArray<string>(existingReport.fbSupplementLinks),
      ]
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const oldThread = parseJsonArray<string>(existingReport.threadLinks)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const allSubmittedFb = [...cleanFbLinks, ...cleanFbSupp];
      const allSubmittedThread = [...cleanThreadLinks];

      // Chỉ bắt buộc giữ lại các link hợp lệ cũ; link bị QC báo lỗi được phép thay thế/bỏ đi
      const oldValidFb = oldFb.filter((oldUrl) => !isUrlInList(oldUrl, invalidLinks));
      const oldValidThread = oldThread.filter((oldUrl) => !isUrlInList(oldUrl, invalidLinks));

      const missingFb = oldValidFb.filter((oldUrl) => !isUrlInList(oldUrl, allSubmittedFb));
      const missingThread = oldValidThread.filter((oldUrl) => !isUrlInList(oldUrl, allSubmittedThread));

      if (missingFb.length > 0 || missingThread.length > 0) {
        return NextResponse.json(
          {
            error:
              "Theo quy định nhân sự sau khi kết thúc ca: Toàn bộ link hợp lệ cũ đã nộp được lưu cố định, không được phép xóa! Bạn chỉ được phép sửa link lỗi QC hoặc nộp bổ sung thêm link mới.",
          },
          { status: 400 }
        );
      }
    } else if (!decision.canDeleteApprovedLinks && existingReport) {
      // Trong cửa sổ sửa sau ca (60 phút ngay sau ca): không được xóa link đã được duyệt hợp lệ
      const oldFbLinks = [
        ...parseJsonArray<string>(existingReport.fbLinks),
        ...parseJsonArray<string>(existingReport.fbSupplementLinks),
      ];
      const oldThreadLinks = parseJsonArray<string>(existingReport.threadLinks);

      // Các link hợp lệ cũ là link không nằm trong danh sách lỗi
      const oldApprovedFb = oldFbLinks.filter((l) => !isUrlInList(l, invalidLinks));
      const oldApprovedThread = oldThreadLinks.filter((l) => !isUrlInList(l, invalidLinks));

      const allSubmittedFb = [...cleanFbLinks, ...cleanFbSupp];
      const allSubmittedThread = [...cleanThreadLinks];

      const missingFb = oldApprovedFb.filter((l) => !isUrlInList(l, allSubmittedFb));
      const missingThread = oldApprovedThread.filter((l) => !isUrlInList(l, allSubmittedThread));

      if (missingFb.length > 0 || missingThread.length > 0) {
        return NextResponse.json(
          {
            error:
              "Quy định sau giờ ca: Bạn không được xóa các link đã được ghi nhận hợp lệ! Bạn chỉ có thể sửa/thay thế các link bị QC báo lỗi hoặc nộp bổ sung link mới.",
          },
          { status: 400 }
        );
      }
    }

    // 3. Giới hạn bài chính tối đa bằng KPI ca trong giai đoạn Nộp bù tuần (vẫn cho phép nhân sự thêm link dự phòng)
    if (decision.capAtKpi) {
      const validMainFb = cleanFbLinks.filter((l) => !isUrlInList(l, invalidLinks)).length;
      if (validMainFb > kpi.fbPerShift) {
        return NextResponse.json(
          {
            error: `Trong giai đoạn Nộp bù tuần, danh sách bài chính chỉ nộp tối đa ${kpi.fbPerShift} link Facebook. Vui lòng bấm "+ Thêm Link Dự Phòng" nếu muốn nộp thêm link dự phòng!`,
          },
          { status: 400 }
        );
      }
      const validMainThread = cleanThreadLinks
        .slice(0, kpi.threadPerShift)
        .filter((l) => !isUrlInList(l, invalidLinks)).length;
      if (validMainThread > kpi.threadPerShift) {
        return NextResponse.json(
          {
            error: `Trong giai đoạn Nộp bù tuần, danh sách bài chính chỉ nộp tối đa ${kpi.threadPerShift} link Threads. Vui lòng bấm "+ Thêm Link Dự Phòng" nếu muốn nộp thêm link dự phòng!`,
          },
          { status: 400 }
        );
      }
    }

    // Sanitize viralProposals
    const allSubmittedUrls = [...cleanFbLinks, ...cleanFbSupp, ...cleanThreadLinks];
    const cleanViralProposals: Array<{
      url: string;
      likes: number;
      platform: "FACEBOOK" | "THREADS";
      contentType: "POST" | "COMMENT";
    }> = [];

    if (Array.isArray(viralProposals)) {
      const addedUrls = new Set<string>();
      for (const item of viralProposals) {
        if (!item || typeof item !== "object") continue;
        const rawUrl = String(item.url || "").trim();
        const likes = Math.max(0, parseInt(item.likes, 10) || 0);
        if (!rawUrl || likes <= 0) continue;

        if (!isUrlInList(rawUrl, allSubmittedUrls)) continue;
        if (isUrlInList(rawUrl, invalidLinks)) continue;

        const matchedOriginalUrl = allSubmittedUrls.find((u) => matchUrls(u, rawUrl)) || rawUrl;
        if (addedUrls.has(matchedOriginalUrl)) continue;
        addedUrls.add(matchedOriginalUrl);

        const isFb = matchedOriginalUrl.includes("facebook.com") || matchedOriginalUrl.includes("fb.watch");
        const platform = isFb ? "FACEBOOK" : "THREADS";
        const contentType = item.contentType === "COMMENT" ? "COMMENT" : "POST";

        cleanViralProposals.push({
          url: matchedOriginalUrl,
          likes,
          platform,
          contentType,
        });
      }
    }

    // Sanitize postTags map
    const cleanPostTags: Record<string, string> = {};
    if (postTags && typeof postTags === "object") {
      for (const [url, tagId] of Object.entries(postTags)) {
        const cleanUrl = url.trim();
        const cleanTag = String(tagId || "").trim();
        if (cleanUrl && cleanTag) {
          cleanPostTags[cleanUrl] = cleanTag;
        }
      }
    }

    // Transaction tạo / cập nhật báo cáo và cập nhật trạng thái ca làm việc
    const savedReport = await prisma.$transaction(async (tx) => {
      // Upsert DailyReport
      const report = await tx.dailyReport.upsert({
        where: { shiftRegistrationId: shift.id },
        update: {
          fbLinks: stringifyJsonArray(cleanFbLinks),
          fbSupplementLinks: stringifyJsonArray(cleanFbSupp),
          threadLinks: stringifyJsonArray(cleanThreadLinks),
          commentDriveLink: cleanCommentLink || null,
          femaleContentLinks: stringifyJsonArray(cleanFemaleLinks),
          viralPostLinks: stringifyJsonArray(cleanViralLinks),
          viralProposals: stringifyJsonArray(cleanViralProposals),
          postTags: stringifyJsonObject(cleanPostTags),
          submittedAt: existingReport?.submittedAt || now,
        },
        create: {
          userId: session.userId,
          shiftRegistrationId: shift.id,
          reportDate: shift.shiftDate,
          shiftType: shift.shiftType,
          fbLinks: stringifyJsonArray(cleanFbLinks),
          fbSupplementLinks: stringifyJsonArray(cleanFbSupp),
          threadLinks: stringifyJsonArray(cleanThreadLinks),
          commentDriveLink: cleanCommentLink || null,
          femaleContentLinks: stringifyJsonArray(cleanFemaleLinks),
          viralPostLinks: stringifyJsonArray(cleanViralLinks),
          viralProposals: stringifyJsonArray(cleanViralProposals),
          postTags: stringifyJsonObject(cleanPostTags),
        },
      });

      // Cập nhật trạng thái ca làm việc thành COMPLETED
      // Nếu ca có hạn reopenedUntil và vẫn còn hiệu lực (hoặc mở bù đặc cách không giới hạn thời gian) thì giữ lại
      const shouldKeepSpecialReopen = Boolean(
        shift.reopenedBy && (!shift.reopenedUntil || new Date(shift.reopenedUntil) > now)
      );

      await tx.shiftRegistration.update({
        where: { id: shift.id },
        data: {
          status: "COMPLETED",
          reopenedBy: shouldKeepSpecialReopen ? shift.reopenedBy : null,
          reopenedUntil: shouldKeepSpecialReopen ? shift.reopenedUntil : null,
        },
      });

      // Khởi tạo hoặc chuyển QcReview về PENDING để QC kiểm duyệt
      await tx.qcReview.upsert({
        where: { dailyReportId: report.id },
        update: {
          result: "PENDING",
        },
        create: {
          dailyReportId: report.id,
          reviewerId: session.userId,
          result: "PENDING",
        },
      });

      return report;
    });

    return NextResponse.json({
      message: "Nộp báo cáo ca làm việc thành công! Báo cáo đang chờ QC kiểm duyệt.",
      report: savedReport,
      phase: decision.phase,
    });
  } catch (error: any) {
    console.error("Lỗi khi nộp báo cáo ca:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi máy chủ khi lưu báo cáo", details: error.message },
      { status: 500 }
    );
  }
}
