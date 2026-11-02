import { NextResponse } from "next/server";

// Chỉ cho phép proxy hình ảnh từ các CDN uy tín của Facebook, Threads và Instagram
const ALLOWED_HOSTS = [
  "fbcdn.net",
  "fbsbx.com",
  "facebook.com",
  "instagram.com",
  "cdninstagram.com",
  "threads.net",
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get("url");

    if (!imageUrl || (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://"))) {
      return new NextResponse("Invalid URL", { status: 400 });
    }

    const parsedUrl = new URL(imageUrl);
    const isAllowedHost = ALLOWED_HOSTS.some((h) => parsedUrl.hostname.endsWith(h));
    if (!isAllowedHost) {
      return new NextResponse("Forbidden domain", { status: 403 });
    }

    // Stream ảnh trực tiếp từ CDN Meta mà không kèm Referer ngoài
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return new NextResponse(`Upstream error: ${res.status}`, { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const imageBuffer = await res.arrayBuffer();

    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.warn("Lỗi Image Proxy:", error);
    return new NextResponse("Error fetching image", { status: 500 });
  }
}
