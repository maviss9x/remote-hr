const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json({ limit: "50mb" }));

const PORT = process.env.PORT || 4000;
let browser = null;

// Khởi tạo Chromium Browser Instance dùng chung
async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    console.log("Khởi chạy Playwright Chromium headless...");
    browser = await chromium.launch({
      headless: true,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  }
  return browser;
}

function decodeBasicEntities(text) {
  if (!text) return "";
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
    .replace(/&#xe0;/g, "à")
    .replace(/&#xec;/g, "ì")
    .replace(/&#xf3;/g, "ó")
    .replace(/&#x1edb;/g, "ớ")
    .replace(/&#x1b0;/g, "ư")
    .replace(/&#xe1;/g, "á")
    .replace(/&#x1ee3;/g, "ợ")
    .replace(/&#x1ed9;/g, "ộ")
    .replace(/&#x1ea3;/g, "ả")
    .replace(/&#x1ed1;/g, "ố")
    .replace(/&#x1eaf;/g, "ắ");
}

function validateUrl(url) {
  const clean = (url || "").trim();
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    return { ok: false, error: "URL không hợp lệ: thiếu tiền tố http/https" };
  }
  // Kiểm tra khoảng trắng hoặc xuống dòng (thường do dán nhầm văn bản nội dung)
  if (/\s/.test(clean)) {
    return { ok: false, error: "URL không hợp lệ: chứa khoảng trắng hoặc dính nội dung bài viết" };
  }
  // Kiểm tra ký tự unicode tiếng Việt trong phần path trước dấu '?'
  const pathPart = clean.split("?")[0];
  if (/[\u0080-\uffff]/.test(pathPart)) {
    return { ok: false, error: "URL không hợp lệ: chứa ký tự tiếng Việt hoặc dính nội dung bài viết" };
  }
  // Chống SSRF: Không cho phép crawler mở mạng nội bộ / metadata service
  try {
    const parsed = new URL(clean);
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
      return { ok: false, error: "URL không hợp lệ: từ chối truy cập tài nguyên nội bộ" };
    }
  } catch (e) {
    return { ok: false, error: "URL không hợp lệ" };
  }
  return { ok: true, cleanUrl: clean };
}

// ========================================================
// 1. LOGIC XỬ LÝ CHUYÊN BIỆT CHO THREADS
// ========================================================
async function inspectThreadsLink(item) {
  const { url, platform = "threads", index = 1 } = item;
  const result = {
    url,
    platform: "threads",
    index,
    isValid: true,
    httpCode: 200,
    title: null,
    description: null,
    ogImage: null,
    screenshotUrl: null,
    errorMessage: null,
    inspectedAt: Math.floor(Date.now() / 1000),
  };

  const val = validateUrl(url);
  if (!val.ok) {
    result.isValid = false;
    result.httpCode = 400;
    result.errorMessage = val.error;
    return result;
  }
  const cleanUrl = val.cleanUrl;

  console.log(`[Threads] Bắt đầu quét: ${cleanUrl}`);

  let resolvedPostUrl = cleanUrl;
  let html = "";

  // Bước 1: Fetch OpenGraph để lấy link bài viết đích (giải mã redirect /share/) và metadata
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(cleanUrl, {
      headers: {
        "User-Agent":
          "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    result.httpCode = res.status;

    // Fast exit: Nếu HTTP code lỗi (404, 410, 500...)
    if (!res.ok && res.status >= 400) {
      result.isValid = false;
      result.errorMessage = `Lỗi HTTP ${res.status}: Liên kết Threads không tồn tại hoặc bị lỗi`;
      return result;
    }

    resolvedPostUrl = res.url || cleanUrl;
    html = await res.text();

    const lowerHtml = html.toLowerCase();
    // Dấu hiệu bài viết Threads bị gỡ hoặc liên kết chết
    if (
      lowerHtml.includes("trang này thì mất tích thật rồi") ||
      lowerHtml.includes("liên kết không hoạt động hoặc trang này không còn nữa") ||
      lowerHtml.includes("không tìm thấy trang") ||
      lowerHtml.includes("sorry, this page isn't available") ||
      (lowerHtml.includes("not found") && html.length < 3000) ||
      (cleanUrl.includes("/share/") && resolvedPostUrl.includes("/share/") && html.length < 250000)
    ) {
      result.isValid = false;
      result.errorMessage = "Bài viết Threads đã bị gỡ hoặc liên kết không tồn tại";
      return result;
    }

    // Bóc tách og:title, og:description, og:image từ OpenGraph của Threads
    const ogTitleMatch =
      html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i);
    if (ogTitleMatch && ogTitleMatch[1]) {
      result.title = decodeBasicEntities(ogTitleMatch[1].trim());
    }

    const ogDescMatch =
      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i);
    if (ogDescMatch && ogDescMatch[1]) {
      result.description = decodeBasicEntities(ogDescMatch[1].trim());
    }

    const ogImgMatch =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["']/i);
    if (ogImgMatch && ogImgMatch[1]) {
      result.ogImage = ogImgMatch[1].trim().replace(/&amp;/g, "&");
    }
  } catch (fetchErr) {
    console.warn(`[Threads] Lỗi fetch OpenGraph cho ${cleanUrl}:`, fetchErr.message);
  }

  // Bước 2: Chụp ảnh màn hình Playwright cho bài viết còn sống (mở thẳng resolvedPostUrl)
  if (result.isValid) {
    try {
      const b = await getBrowser();
      const context = await b.newContext({
        viewport: { width: 1200, height: 950 },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        locale: "vi-VN",
      });
      const page = await context.newPage();

      try {
        // Mở thẳng URL bài viết đích để không bị gián đoạn context do redirect
        const pRes = await page.goto(resolvedPostUrl, { waitUntil: "domcontentloaded", timeout: 10000 });
        if (pRes && pRes.status() >= 400) {
          result.isValid = false;
          result.httpCode = pRes.status();
          result.errorMessage = `Lỗi HTTP ${pRes.status()}: Bài viết Threads không tồn tại`;
          return result;
        }

        await page.waitForTimeout(1500);

        // Loại bỏ triệt để popup đăng nhập Instagram / Threads, backdrop tối mờ và thanh cookie
        await page.evaluate(() => {
          document.querySelectorAll('div[role="dialog"], [aria-modal="true"]').forEach((d) => d.remove());
          document.querySelectorAll('*').forEach((el) => {
            const s = window.getComputedStyle(el);
            if (s.position === "fixed" && el.children.length === 0) {
              const bg = s.backgroundColor || "";
              if (
                bg.includes("rgba(0, 0, 0") ||
                bg.includes("rgb(0, 0, 0") ||
                bg === "black"
              ) {
                el.remove();
              }
            }
          });
          document.querySelectorAll("div, section, footer").forEach((el) => {
            if ((el.innerText || "").includes("Bằng việc tiếp tục, bạn đồng ý với Điều khoản")) {
              el.remove();
            }
          });
          document.body.style.overflow = "auto";
          if (document.documentElement) document.documentElement.style.overflow = "auto";
        }).catch(() => {});

        await page.waitForTimeout(200);

        const shotBuffer = await page.screenshot({ type: "jpeg", quality: 80 });
        if (shotBuffer) {
          result.screenshotUrl = `data:image/jpeg;base64,${shotBuffer.toString("base64")}`;
        }
      } catch (shotErr) {
        console.warn(`[Threads] Không thể chụp ảnh Playwright: ${shotErr.message}`);
      } finally {
        await context.close().catch(() => {});
      }
    } catch (e) {
      console.warn(`[Threads] Lỗi khởi tạo context Playwright:`, e.message);
    }
  }

  return result;
}

// ========================================================
// 2. LOGIC XỬ LÝ CHUYÊN BIỆT CHO FACEBOOK
// ========================================================
async function inspectFacebookLink(item) {
  const { url, platform = "facebook", index = 1 } = item;
  const result = {
    url,
    platform: "facebook",
    index,
    isValid: true,
    httpCode: 200,
    title: null,
    description: null,
    ogImage: null,
    screenshotUrl: null,
    errorMessage: null,
    inspectedAt: Math.floor(Date.now() / 1000),
  };

  const val = validateUrl(url);
  if (!val.ok) {
    result.isValid = false;
    result.httpCode = 400;
    result.errorMessage = val.error;
    console.log(`[Facebook #${index}] Bỏ qua ngay: ${val.error} (${url})`);
    return result;
  }
  const cleanUrl = val.cleanUrl;

  console.log(`[Facebook #${index}] Bắt đầu quét: ${cleanUrl}`);

  // Bước 1: Fast HTTP Pre-check (5 giây) - Bắt nhanh link 404/Not Found mà không cần mở Chromium nặng
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const preRes = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8",
      },
      redirect: "follow",
    });
    clearTimeout(timeoutId);

    result.httpCode = preRes.status;

    if (!preRes.ok && preRes.status >= 400) {
      result.isValid = false;
      result.errorMessage = `Lỗi HTTP ${preRes.status}: Bài viết Facebook không tồn tại (Not Found)`;
      console.log(`[Facebook #${index}] Bỏ qua nhanh qua Pre-check (HTTP ${preRes.status})`);
      return result; // Bỏ qua ngay lập tức, không mở Chromium!
    }

    const preHtml = await preRes.text();
    const lowerPre = preHtml.toLowerCase();
    if (
      (lowerPre.includes("not found") && preHtml.length < 3000) ||
      lowerPre.includes("nội dung này hiện không khả dụng") ||
      lowerPre.includes("this content isn't available right now") ||
      lowerPre.includes("liên kết bạn đã theo dõi có thể bị hỏng") ||
      lowerPre.includes("the link you followed may be broken")
    ) {
      result.isValid = false;
      result.errorMessage = "Bài viết Facebook bị gỡ, không khả dụng hoặc liên kết hỏng";
      console.log(`[Facebook #${index}] Bỏ qua nhanh qua Pre-check (Nội dung báo lỗi/gỡ)`);
      return result; // Bỏ qua ngay lập tức!
    }
  } catch (preErr) {
    // Nếu timeout hoặc lỗi mạng ở pre-check, tiếp tục kiểm tra qua Playwright
  }

  // Bước 2: Kiểm tra & Chụp ảnh qua Playwright Chromium (chỉ chạy với link còn sống)
  const b = await getBrowser();
  const context = await b.newContext({
    viewport: { width: 1200, height: 950 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    deviceScaleFactor: 1.25,
  });

  const page = await context.newPage();

  try {
    // Mở trang với timeout ngắn 12s
    const pageRes = await page.goto(cleanUrl, { waitUntil: "domcontentloaded", timeout: 12000 });
    if (pageRes && pageRes.status() >= 400) {
      result.isValid = false;
      result.httpCode = pageRes.status();
      result.errorMessage = `Lỗi HTTP ${pageRes.status()}: Bài viết Facebook không tồn tại`;
      console.log(`[Facebook #${index}] Bỏ qua: HTTP ${pageRes.status()}`);
      await context.close().catch(() => {});
      return result; // Bỏ qua ngay, không capture ảnh/text!
    }

    // Chờ 1.5s để Facebook thực thi JavaScript cơ bản
    await page.waitForTimeout(1500);

    // Kiểm tra nhanh title và nội dung body xem có phải trang lỗi Not Found không
    const pageTitle = (await page.title().catch(() => "")).toLowerCase();
    let bodyTextLower = "";
    try {
      bodyTextLower = await page.evaluate(() => (document.body?.innerText || "").toLowerCase());
    } catch (evalErr) {
      bodyTextLower = "";
    }

    if (
      pageTitle.includes("not found") ||
      pageTitle.includes("không tìm thấy") ||
      bodyTextLower.includes("not found") ||
      bodyTextLower.includes("nội dung này hiện không khả dụng") ||
      bodyTextLower.includes("this content isn't available right now") ||
      bodyTextLower.includes("liên kết bạn đã theo dõi có thể bị hỏng") ||
      bodyTextLower.includes("the link you followed may be broken") ||
      (bodyTextLower.includes("bạn hiện không xem được nội dung này") && bodyTextLower.length < 800)
    ) {
      result.isValid = false;
      result.errorMessage = "Bài viết Facebook bị gỡ, không khả dụng hoặc liên kết hỏng";
      console.log(`[Facebook #${index}] Bỏ qua: Phát hiện trang lỗi (${result.errorMessage})`);
      await context.close().catch(() => {});
      return result; // Bỏ qua ngay, không capture ảnh/text!
    }

    // 1. Tự động click đóng tất cả các popup / dialog nếu có
    try {
      const dismissSelectors = [
        'div[role="dialog"] [aria-label="Đóng"]',
        'div[role="dialog"] [aria-label="Close"]',
        '[aria-label="Đóng"]',
        '[aria-label="Close"]',
        'div[aria-label="Decline optional cookies"]',
        'div[aria-label="Từ chối các cookie không bắt buộc"]',
      ];
      for (const sel of dismissSelectors) {
        const locator = page.locator(sel);
        const count = await locator.count();
        for (let i = 0; i < count; i++) {
          const btn = locator.nth(i);
          if (await btn.isVisible().catch(() => false)) {
            await btn.click({ timeout: 1000 }).catch(() => {});
            await page.waitForTimeout(200);
          }
        }
      }
    } catch (_) {}

    // 2. Dọn dẹp DOM sạch sẽ
    await page.evaluate(() => {
      document.querySelectorAll('div[role="dialog"], [aria-modal="true"]').forEach((el) => el.remove());
      document.querySelectorAll("div, section").forEach((el) => {
        const text = el.innerText || "";
        if (
          (text.includes("Xem thêm trên Facebook") || text.includes("See more on Facebook")) &&
          (text.includes("Đăng nhập") || text.includes("Log In") || text.includes("Tạo tài khoản"))
        ) {
          let cur = el;
          while (cur && cur !== document.body && cur !== document.documentElement) {
            const pos = window.getComputedStyle(cur).position;
            if (pos === "fixed" || pos === "absolute") {
              cur.remove();
              break;
            }
            cur = cur.parentElement;
          }
        }
      });
      document.querySelectorAll("*").forEach((el) => {
        const s = window.getComputedStyle(el);
        if (s.position === "fixed") {
          const bg = s.backgroundColor || "";
          const text = el.innerText || "";
          if (
            bg.includes("rgba(0, 0, 0") ||
            bg.includes("rgb(0, 0, 0") ||
            bg === "black" ||
            (parseFloat(s.zIndex || "0") >= 10 && el.children.length === 0) ||
            text.includes("Hãy đăng nhập hoặc đăng ký Facebook") ||
            text.includes("Log In or Sign Up") ||
            (text.includes("Đăng nhập") && text.includes("Tạo tài khoản mới") && el.children.length < 15)
          ) {
            el.remove();
          }
        }
      });
      document.body.style.overflow = "auto";
      if (document.documentElement) document.documentElement.style.overflow = "auto";
    }).catch(() => {});

    await page.waitForTimeout(200);

    // 3. Cuộn nhẹ để nạp ảnh bài viết
    await page.evaluate(() => window.scrollBy(0, 300)).catch(() => {});
    await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    await page.waitForTimeout(200);

    // Kiểm tra trạng thái bài viết có bị xóa / gỡ / không khả dụng không
    try {
      bodyTextLower = await page.evaluate(() => (document.body?.innerText || "").toLowerCase());
    } catch (evalErr) {
      console.warn("[Facebook] Lỗi evaluate body, thử lại sau 1s:", evalErr.message);
      await page.waitForTimeout(1000);
      bodyTextLower = await page.evaluate(() => (document.body?.innerText || "").toLowerCase()).catch(() => "");
    }

    if (
      bodyTextLower.includes("not found") ||
      bodyTextLower.includes("nội dung này hiện không khả dụng") ||
      bodyTextLower.includes("this content isn't available right now") ||
      bodyTextLower.includes("liên kết bạn đã theo dõi có thể bị hỏng") ||
      bodyTextLower.includes("the link you followed may be broken") ||
      (bodyTextLower.includes("bạn hiện không xem được nội dung này") && bodyTextLower.length < 800)
    ) {
      result.isValid = false;
      result.errorMessage = "Bài viết Facebook bị gỡ, không khả dụng hoặc liên kết hỏng";
      await context.close().catch(() => {});
      return result;
    }

    // Bóc tách metadata và hình ảnh bài viết từ DOM đã render hoàn chỉnh
    const extracted = await page.evaluate(() => {
      // 1. Tiêu đề
      const metaTitle =
        document.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
        document.title ||
        "";

      // 2. Nội dung bài viết
      const articleEl =
        document.querySelector('div[role="article"]') ||
        document.querySelector('div[data-ad-preview="message"]') ||
        document.querySelector('div[role="main"]') ||
        document.body;

      const fullText = (articleEl ? articleEl.innerText : document.body.innerText) || "";

      // Làm sạch text để lấy nội dung bài viết thật
      const cleanedLines = fullText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => {
          if (!l) return false;
          const lower = l.toLowerCase();
          if (
            lower.includes("đăng nhập") ||
            lower.includes("tạo tài khoản mới") ||
            lower.includes("xem thêm trên facebook") ||
            lower.includes("hãy đăng nhập hoặc đăng ký") ||
            lower.includes("chia sẻ") ||
            lower.includes("bình luận") ||
            lower.includes("thích")
          ) {
            return false;
          }
          return true;
        });

      const postContent = cleanedLines.slice(0, 15).join("\n");

      // 3. Tìm tất cả ảnh có trong bài viết
      const allImgs = Array.from(document.querySelectorAll("img"));
      const postImages = [];

      for (const img of allImgs) {
        const src = img.currentSrc || img.src || "";
        if (!src.startsWith("http")) continue;

        const isCdn =
          src.includes("scontent") ||
          src.includes("fbcdn.net") ||
          src.includes("cdninstagram.com");
        if (!isCdn) continue;

        // Loại trừ icon rác, avatar hệ thống, emoji
        if (
          src.includes("rsrc.php") ||
          src.includes("static.xx") ||
          src.includes("s50x50") ||
          src.includes("s75x75") ||
          src.includes("p50x50") ||
          src.includes("s34x34") ||
          src.includes("emoji.php") ||
          src.includes("100037460401809") // Avatar anonymous mặc định
        ) {
          continue;
        }

        const rect = img.getBoundingClientRect();
        const w = rect.width || img.naturalWidth || 0;
        const h = rect.height || img.naturalHeight || 0;

        // Bỏ qua icon / avatar nhỏ dưới 80px
        if (w < 80 || h < 80) {
          continue;
        }

        postImages.push({
          src,
          width: w,
          height: h,
          area: w * h,
        });
      }

      postImages.sort((a, b) => b.area - a.area);
      const bestImage = postImages.length > 0 ? postImages[0].src : null;

      return {
        title: metaTitle.replace(/\s+/g, " ").trim(),
        description: postContent.slice(0, 500).trim(),
        bestImage,
      };
    }).catch(() => ({
      title: null,
      description: null,
      bestImage: null,
    }));

    result.title = extracted.title || null;
    result.description = extracted.description || null;
    result.ogImage = extracted.bestImage || null;

    // Chụp ảnh màn hình bài viết gốc (Playwright Real Inspection sạch sẽ, trọn vẹn số Like & Comment)
    try {
      // 1. Cô lập đúng card bài viết chính và dọn dẹp các bình luận phía dưới thanh action
      await page.evaluate(() => {
        const articles = Array.from(document.querySelectorAll('div[role="article"]'));
        let mainArticle = articles.find((a) => {
          const t = a.innerText || "";
          return (t.includes("Thích") || t.includes("Like")) && (t.includes("Bình luận") || t.includes("Comment"));
        }) || articles[0];

        if (!mainArticle) {
          mainArticle = document.querySelector('div[role="main"]');
        }

        if (!mainArticle) return;

        mainArticle.setAttribute("data-qc-main-article", "true");

        // Tìm thanh action bar (chứa Thích, Bình luận, Chia sẻ) của bài viết
        const actionBars = Array.from(mainArticle.querySelectorAll("*")).filter((el) => {
          const text = el.innerText || "";
          return (
            (text.includes("Thích") || text.includes("Like")) &&
            (text.includes("Bình luận") || text.includes("Comment")) &&
            (text.includes("Chia sẻ") || text.includes("Share")) &&
            el.children.length >= 2 && el.children.length <= 5 &&
            el.offsetHeight > 0 && el.offsetHeight < 70
          );
        });

        if (actionBars.length === 0) return;
        const actionBar = actionBars[0];

        // Đi lên cây DOM từ actionBar cho tới node con trực tiếp của mainArticle,
        // xóa tất cả các element nằm phía sau (phần danh sách bình luận) để card dừng chuẩn ở chân thanh action
        let cur = actionBar;
        while (cur && cur.parentElement && cur.parentElement !== mainArticle) {
          let next = cur.nextElementSibling;
          while (next) {
            const toRemove = next;
            next = next.nextElementSibling;
            toRemove.remove();
          }
          cur = cur.parentElement;
        }

        if (cur && cur.parentElement === mainArticle) {
          let next = cur.nextElementSibling;
          while (next) {
            const toRemove = next;
            next = next.nextElementSibling;
            toRemove.remove();
          }
        }
      }).catch(() => {});

      await page.waitForTimeout(200);

      const mainLocator = page.locator('div[data-qc-main-article="true"]').first();
      const articleFallback = page.locator('div[role="article"]').first();
      let screenshotBuffer = null;

      if ((await mainLocator.count()) > 0 && (await mainLocator.isVisible())) {
        await mainLocator.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(200);
        screenshotBuffer = await mainLocator.screenshot({
          type: "jpeg",
          quality: 85,
        });
      } else if ((await articleFallback.count()) > 0 && (await articleFallback.isVisible())) {
        await articleFallback.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(200);
        screenshotBuffer = await articleFallback.screenshot({
          type: "jpeg",
          quality: 85,
        });
      } else {
        screenshotBuffer = await page.screenshot({
          type: "jpeg",
          quality: 80,
        });
      }

      if (screenshotBuffer) {
        result.screenshotUrl = `data:image/jpeg;base64,${screenshotBuffer.toString("base64")}`;
      }
    } catch (shotErr) {
      console.warn(`[Facebook] Không thể chụp ảnh cho ${cleanUrl}:`, shotErr.message);
    }
  } catch (err) {
    console.error(`[Facebook] Lỗi khi mở ${cleanUrl}:`, err.message);
    result.isValid = false;
    result.errorMessage = `Lỗi kết nối bài viết: ${err.message}`;
  } finally {
    await context.close().catch(() => {});
  }

  return result;
}

// Router phân phối linh hoạt giữa Threads và Facebook
async function inspectSingleItem(item) {
  const url = (item.url || "").trim();
  const isThreads =
    item.platform === "threads" ||
    url.includes("threads.net") ||
    url.includes("threads.com");

  if (isThreads) {
    return inspectThreadsLink(item);
  }
  return inspectFacebookLink(item);
}

// Endpoint kiểm tra hoạt động (Healthcheck)
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "qc-crawler", timestamp: Date.now() });
});

// Endpoint quét danh sách link bài viết
app.post("/scan", async (req, res) => {
  const { links = [] } = req.body;
  if (!Array.isArray(links) || links.length === 0) {
    return res.status(400).json({ error: "Thiếu danh sách links cần quét" });
  }

  console.log(`[Crawler] Nhận yêu cầu quét ${links.length} liên kết...`);
  const startTime = Date.now();

  try {
    const results = [];
    const concurrency = 2;

    for (let i = 0; i < links.length; i += concurrency) {
      const chunk = links.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map((item) => inspectSingleItem(item))
      );
      results.push(...chunkResults);
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[Crawler] Hoàn tất quét ${results.length} liên kết sau ${elapsed}s!`);

    res.json({
      success: true,
      results,
      elapsedSeconds: elapsed,
      message: `Đã hoàn tất kiểm tra và chụp màn hình ${results.length} bài viết (${elapsed}s)!`,
    });
  } catch (error) {
    console.error("[Crawler] Lỗi xử lý:", error);
    res.status(500).json({ error: error.message || "Lỗi cào dữ liệu Playwright" });
  }
});

// Khởi động server
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`🚀 QC Crawler Service đang lắng nghe tại port ${PORT}...`);
  try {
    await getBrowser();
    console.log("✅ Playwright Chromium đã sẵn sàng!");
  } catch (e) {
    console.error("⚠️ Khởi tạo Chromium thất bại:", e);
  }
});

process.on("SIGTERM", async () => {
  if (browser) await browser.close();
  process.exit(0);
});
