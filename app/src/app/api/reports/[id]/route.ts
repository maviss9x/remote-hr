import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasAnyRole } from "@/lib/auth";
import { parseJsonArray, parseJsonObject, stringifyJsonArray, stringifyJsonObject } from "@/lib/json-fields";
import { isUrlInList, matchUrls } from "@/lib/url-matcher";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { id } = await params;
    const reportId = parseInt(id);
    if (isNaN(reportId)) {
      return NextResponse.json({ error: "ID báo cáo không hợp lệ" }, { status: 400 });
    }

    const report = await prisma.dailyReport.findUnique({
      where: { id: reportId },
      include: {
        shiftRegistration: true,
        qcReview: {
          include: {
            reviewer: {
              select: {
                id: true,
                fullName: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Không tìm thấy báo cáo" }, { status: 404 });
    }

    // Nhân sự chỉ xem được báo cáo của chính mình, Quản lý/QC xem được của mọi người
    const isManagerRole = hasAnyRole(session.role, ["SUPER_ADMIN", "ADMIN", "MANAGER", "QC", "HR"]);
    if (!isManagerRole && report.userId !== session.userId) {
      return NextResponse.json({ error: "Không có quyền xem báo cáo này" }, { status: 403 });
    }

    return NextResponse.json({
      report: {
        ...report,
        fbLinks: parseJsonArray<string>(report.fbLinks),
        fbSupplementLinks: parseJsonArray<string>(report.fbSupplementLinks),
        threadLinks: parseJsonArray<string>(report.threadLinks),
        femaleContentLinks: parseJsonArray<string>(report.femaleContentLinks),
        viralPostLinks: parseJsonArray<string>(report.viralPostLinks),
        viralProposals: parseJsonArray<any>(report.viralProposals),
        postTags: parseJsonObject<Record<string, string>>(report.postTags, {}),
        qcReview: report.qcReview
          ? {
              ...report.qcReview,
              invalidLinks: parseJsonArray<string>(report.qcReview.invalidLinks),
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error("Lỗi khi lấy chi tiết báo cáo:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi lấy chi tiết báo cáo" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { id } = await params;
    const reportId = parseInt(id);
    if (isNaN(reportId)) {
      return NextResponse.json({ error: "ID báo cáo không hợp lệ" }, { status: 400 });
    }

    const report = await prisma.dailyReport.findUnique({
      where: { id: reportId },
      include: {
        shiftRegistration: true,
        qcReview: true,
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Không tìm thấy báo cáo" }, { status: 404 });
    }

    // Nhân sự chỉ được sửa báo cáo của chính mình, Quản lý/Admin có thể hỗ trợ
    const isManagerRole = hasAnyRole(session.role, ["SUPER_ADMIN", "ADMIN", "MANAGER", "QC", "HR"]);
    if (!isManagerRole && report.userId !== session.userId) {
      return NextResponse.json({ error: "Bạn không có quyền chỉnh sửa báo cáo này" }, { status: 403 });
    }

    // Đọc cấu hình thời hạn cho phép gắn thẻ Loại bài và Bài viral từ SystemSetting
    const rulesSetting = await prisma.systemSetting.findUnique({
      where: { key: "shift_rules" },
    });
    const shiftRules = parseJsonObject<any>(rulesSetting?.value, {}) || {};
    const tagPostGraceDays = Number(shiftRules.tagPostGraceDays) || 7;
    const viralPostGraceDays = Number(shiftRules.viralPostGraceDays) || 30;

    const now = new Date();
    const submittedAt = new Date(report.submittedAt);
    const timeDiffMs = now.getTime() - submittedAt.getTime();
    const tagGraceMs = tagPostGraceDays * 24 * 60 * 60 * 1000;
    const viralGraceMs = viralPostGraceDays * 24 * 60 * 60 * 1000;

    const isWithinTagGrace = timeDiffMs <= tagGraceMs;
    const isWithinViralGrace = timeDiffMs <= viralGraceMs;

    if (!isManagerRole && !isWithinTagGrace && !isWithinViralGrace) {
      const expiredDateStr = new Date(submittedAt.getTime() + Math.max(tagGraceMs, viralGraceMs)).toLocaleString("vi-VN");
      return NextResponse.json(
        {
          error: `Thời hạn cho phép gắn thẻ loại bài và đề xuất viral sau ca đã kết thúc lúc ${expiredDateStr}.`,
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { postTags = {}, viralPostLinks = [], viralProposals = [] } = body;

    // Lấy toàn bộ danh sách link ĐÃ NỘP trong báo cáo để kiểm tra tính hợp lệ
    const existingFbLinks = parseJsonArray<string>(report.fbLinks);
    const existingFbSuppLinks = parseJsonArray<string>(report.fbSupplementLinks);
    const existingThreadLinks = parseJsonArray<string>(report.threadLinks);
    const allSubmittedUrls = [...existingFbLinks, ...existingFbSuppLinks, ...existingThreadLinks]
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Lấy danh sách link bị QC từ chối (invalidLinks)
    const invalidLinks = report.qcReview?.invalidLinks
      ? parseJsonArray<string>(report.qcReview.invalidLinks)
      : [];

    // Sanitize postTags map: Chỉ áp dụng cho các link đã được nộp
    const cleanPostTags: Record<string, string> = {};
    if (postTags && typeof postTags === "object") {
      for (const [url, tagId] of Object.entries(postTags)) {
        const cleanUrl = url.trim();
        const cleanTag = String(tagId || "").trim();
        if (cleanUrl && cleanTag && isUrlInList(cleanUrl, allSubmittedUrls)) {
          const matchedOriginalUrl = allSubmittedUrls.find((u) => matchUrls(u, cleanUrl)) || cleanUrl;
          cleanPostTags[matchedOriginalUrl] = cleanTag;
        }
      }
    }

    // Sanitize viralPostLinks:
    // 1. Phải thuộc các link đã nộp
    // 2. KHÔNG được thuộc danh sách link bị QC từ chối (RULE: link đã bị QC từ chối thì không cho phép gắn nổi bật)
    const cleanViralLinks: string[] = [];
    if (Array.isArray(viralPostLinks)) {
      for (const url of viralPostLinks) {
        if (typeof url !== "string") continue;
        const cleanUrl = url.trim();
        if (!cleanUrl) continue;

        // Bỏ qua nếu không phải link đã nộp
        if (!isUrlInList(cleanUrl, allSubmittedUrls)) continue;

        // Bỏ qua nếu link đã bị QC từ chối
        if (isUrlInList(cleanUrl, invalidLinks)) continue;

        const matchedOriginalUrl = allSubmittedUrls.find((u) => matchUrls(u, cleanUrl)) || cleanUrl;
        if (!cleanViralLinks.includes(matchedOriginalUrl)) {
          cleanViralLinks.push(matchedOriginalUrl);
        }
      }
    }

    // Sanitize viralProposals:
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

    // Cập nhật CSDL: Phân tách cập nhật postTags (trong hạn tagGrace) và viralPostLinks / viralProposals (trong hạn viralGrace)
    const updateData: Record<string, string> = {};
    if (isManagerRole || isWithinViralGrace) {
      updateData.viralPostLinks = stringifyJsonArray(cleanViralLinks);
      updateData.viralProposals = stringifyJsonArray(cleanViralProposals);
    }
    if (isManagerRole || isWithinTagGrace) {
      updateData.postTags = stringifyJsonObject(cleanPostTags);
    }

    const updated = await prisma.dailyReport.update({
      where: { id: report.id },
      data: updateData,
    });

    return NextResponse.json({
      message: "Cập nhật loại bài viết, bài nổi bật và đề xuất viral thành công!",
      report: {
        id: updated.id,
        postTags: cleanPostTags,
        viralPostLinks: cleanViralLinks,
        viralProposals: cleanViralProposals,
      },
    });
  } catch (error: any) {
    console.error("Lỗi khi cập nhật tags/nổi bật của báo cáo:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi máy chủ khi cập nhật dữ liệu", details: error.message },
      { status: 500 }
    );
  }
}

