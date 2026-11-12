import { NextResponse } from "next/server";
import { getSession, hasAnyRole } from "@/lib/auth";

const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "QC"];

interface LinkItemInput {
  url?: string;
  platform?: string;
  index?: number;
}

interface ScannedLinkResult {
  url: string;
  platform: string;
  index: number;
  isValid: boolean;
  httpCode: number;
  title: string | null;
  description: string | null;
  ogImage: string | null;
  screenshotUrl?: string | null;
  errorMessage: string | null;
  inspectedAt: number;
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#064;/g, "@")
    .replace(/&#x2022;/g, "•")
    .replace(/&#x1a1;/g, "ơ")
    .replace(/&#x1ec1;/g, "ề")
    .replace(/&#xe0;/g, "à");
}

async function inspectSingleLink(url: string, platform: string, index: number): Promise<ScannedLinkResult> {
  const result: ScannedLinkResult = {
    url,
    platform,
    index,
    isValid: true,
    httpCode: 200,
    title: null,
    description: null,
    ogImage: null,
    errorMessage: null,
    inspectedAt: Math.floor(Date.now() / 1000),
  };

  const cleanUrl = url.trim();
  if (!cleanUrl || (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://"))) {
    result.isValid = false;
    result.httpCode = 400;
    result.errorMessage = "Định dạng đường dẫn liên kết không hợp lệ";
    return result;
  }

  // Fast check: Kiểm tra khoảng trắng hoặc dính text tiếng Việt
  if (/\s/.test(cleanUrl)) {
    result.isValid = false;
    result.httpCode = 400;
    result.errorMessage = "URL không hợp lệ: chứa khoảng trắng hoặc dính nội dung bài viết";
    return result;
  }

  const pathPart = cleanUrl.split("?")[0];
  if (/[\u0080-\uffff]/.test(pathPart)) {
    result.isValid = false;
    result.httpCode = 400;
    result.errorMessage = "URL không hợp lệ: chứa ký tự tiếng Việt hoặc dính nội dung bài viết";
    return result;
  }

  // Chống tấn công SSRF: Ngăn chặn quét mạng nội bộ / metadata cloud
  try {
    const parsed = new URL(cleanUrl);
    const host = parsed.hostname.toLowerCase();
    const isPrivate =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
      host === "169.254.169.254" ||
      host.endsWith(".internal") ||
      host.endsWith(".local") ||
      host === "db" ||
      host === "app" ||
      host === "qc_crawler" ||
      host === "tunnel";

    if (isPrivate) {
      result.isValid = false;
      result.httpCode = 403;
      result.errorMessage = "Không được phép quét địa chỉ mạng nội bộ";
      return result;
    }
  } catch {
    result.isValid = false;
    result.httpCode = 400;
    result.errorMessage = "Định dạng URL không hợp lệ";
    return result;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s per link

    const res = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8",
      },
      redirect: "follow",
    });
    clearTimeout(timeoutId);

    result.httpCode = res.status;

    if (!res.ok && res.status >= 400) {
      result.isValid = false;
      result.errorMessage = `Lỗi HTTP ${res.status}: Liên kết bị lỗi hoặc không thể truy cập`;
      return result;
    }

    const html = await res.text();
    const lowerHtml = html.toLowerCase();

    // Dấu hiệu nhận biết bài viết Facebook / Threads bị gỡ, xóa hoặc không khả dụng
    if (
      lowerHtml.includes("trang này thì mất tích thật rồi") ||
      lowerHtml.includes("liên kết không hoạt động hoặc trang này không còn nữa") ||
      lowerHtml.includes("nội dung này hiện không khả dụng") ||
      lowerHtml.includes("this content isn't available right now") ||
      lowerHtml.includes("liên kết bạn đã theo dõi có thể bị hỏng") ||
      lowerHtml.includes("the link you followed may be broken") ||
      (lowerHtml.includes("not found") && html.length < 3000) ||
      (lowerHtml.includes("đã xảy ra lỗi, hãy thử lại sau") && html.length < 2500)
    ) {
      result.isValid = false;
      result.errorMessage = "Bài viết bị gỡ, không khả dụng hoặc liên kết hỏng";
      return result;
    }

    // Bóc tách og:title hoặc <title>
    const ogTitleMatch =
      html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i);
    if (ogTitleMatch && ogTitleMatch[1]) {
      result.title = decodeBasicEntities(ogTitleMatch[1].trim());
    } else {
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        result.title = decodeBasicEntities(titleMatch[1].trim());
      }
    }

    // Bóc tách og:description
    const ogDescMatch =
      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i);
    if (ogDescMatch && ogDescMatch[1]) {
      result.description = decodeBasicEntities(ogDescMatch[1].trim());
    }

    // Bóc tách og:image hoặc ảnh bài viết thực tế
    const ogImgMatch =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["']/i);

    let extractedImg: string | null = null;
    if (ogImgMatch && ogImgMatch[1]) {
      const raw = decodeBasicEntities(ogImgMatch[1].trim());
      // Nếu link không phải trang HTML redirect lookaside của FB thì dùng
      if (!raw.includes("lookaside.fbsbx.com")) {
        extractedImg = raw;
      }
    }

    // Nếu không có og:image hoặc og:image là link lookaside HTML redirect:
    // Tìm trực tiếp các link ảnh scontent thực sự trong trang bài viết Facebook
    if (!extractedImg) {
      const scontentMatches = html.match(
        /https:\/\/[^"'\s\\]*scontent[^"'\s\\]*\.(?:jpg|jpeg|png|webp)[^"'\s\\]*/gi
      );
      if (scontentMatches && scontentMatches.length > 0) {
        // Ưu tiên ảnh chất lượng cao (loại bỏ icon thu nhỏ s50x50, s75x75, p50x50, s34x34)
        const bestImg =
          scontentMatches.find(
            (u) =>
              !u.includes("s50x50") &&
              !u.includes("s75x75") &&
              !u.includes("p50x50") &&
              !u.includes("s34x34")
          ) || scontentMatches[0];
        extractedImg = decodeBasicEntities(bestImg.replace(/&amp;/g, "&"));
      }
    }

    result.ogImage = extractedImg;
  } catch (err: unknown) {
    result.isValid = false;
    const isAbort = err instanceof Error && err.name === "AbortError";
    result.errorMessage = isAbort
      ? "Quá thời gian phản hồi (Timeout 12s)"
      : `Lỗi kết nối: ${err instanceof Error ? err.message : String(err)}`;
  }

  return result;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !hasAnyRole(session.role, ALLOWED_ROLES)) {
      return NextResponse.json({ error: "Không có quyền thực hiện chức năng này" }, { status: 403 });
    }

    const body = await request.json();
    const { reportId, links = [] } = body;

    if (!reportId || !Array.isArray(links) || links.length === 0) {
      return NextResponse.json({ error: "Thiếu dữ liệu reportId hoặc danh sách link cần quét" }, { status: 400 });
    }

    // Chuẩn hóa danh sách link đầu vào
    const formattedLinks: Array<{ url: string; platform: string; index: number }> = links.map(
      (item: string | LinkItemInput, idx: number) => {
        if (typeof item === "string") {
          const u = item.trim();
          const isThreads = u.includes("threads.net") || u.includes("threads.com");
          return {
            url: u,
            platform: isThreads ? "threads" : "facebook",
            index: idx + 1,
          };
        }
        const u = (item.url || "").trim();
        const isThreads = (item.platform === "threads") || u.includes("threads.net") || u.includes("threads.com");
        return {
          url: u,
          platform: isThreads ? "threads" : "facebook",
          index: item.index ?? idx + 1,
        };
      }
    );

    // 1. Ưu tiên gọi sang Microservice Playwright Crawler (nếu đã cấu hình hoặc chạy cục bộ)
    const candidateCrawlerUrls = Array.from(
      new Set(
        [
          process.env.QC_CRAWLER_URL,
          "http://qc_crawler:4000",
          "http://localhost:4000",
          "http://127.0.0.1:4000",
        ].filter(Boolean) as string[]
      )
    );

    let crawlerSuccess = false;
    let results: ScannedLinkResult[] = [];

    for (const crawlerBaseUrl of candidateCrawlerUrls) {
      try {
        const controller = new AbortController();
        // Cho phép timeout tối đa 90 giây cho batch link
        const timeoutId = setTimeout(() => controller.abort(), 90000);

        const crawlerRes = await fetch(`${crawlerBaseUrl}/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ links: formattedLinks }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (crawlerRes.ok) {
          const crawlerData = await crawlerRes.json();
          if (crawlerData.success && Array.isArray(crawlerData.results)) {
            results = crawlerData.results;
            crawlerSuccess = true;
            console.log(`[QC Scan] Quét thành công qua Playwright Crawler (${crawlerBaseUrl}): ${results.length} links`);
            break;
          }
        }
      } catch (crawlerErr: any) {
        // Thử URL tiếp theo nếu không kết nối được
      }
    }

    // 2. Fallback sang OpenGraph scraper nếu Crawler chưa sẵn sàng
    if (!crawlerSuccess || results.length === 0) {
      const settledResults = await Promise.allSettled(
        formattedLinks.map((item) => inspectSingleLink(item.url, item.platform, item.index))
      );

      results = settledResults.map((r, idx) => {
        if (r.status === "fulfilled") {
          return r.value;
        }
        return {
          url: formattedLinks[idx].url,
          platform: formattedLinks[idx].platform,
          index: formattedLinks[idx].index,
          isValid: false,
          httpCode: 500,
          title: null,
          description: null,
          ogImage: null,
          errorMessage: "Lỗi nội bộ khi quét liên kết",
          inspectedAt: Math.floor(Date.now() / 1000),
        };
      });
    }

    return NextResponse.json({
      success: true,
      fromCache: false,
      results,
      message: `Hoàn tất kiểm tra ${results.length} liên kết thành công!`,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Lỗi API /api/qc/scan:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi kiểm tra các liên kết bài viết", details: errMsg },
      { status: 500 }
    );
  }
}
