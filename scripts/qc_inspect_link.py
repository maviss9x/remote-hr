import os
import sys
import time
import json
import hashlib
import urllib.request
import urllib.error
import re
import argparse
import html as html_parser
from playwright.sync_api import sync_playwright

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def get_link_hash(url):
    return hashlib.md5(url.strip().encode('utf-8')).hexdigest()[:10]

def inspect_opengraph(url):
    """
    Gửi request kiểm tra tính hợp lệ của link và lấy metadata OpenGraph.
    """
    headers = {
        "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8",
    }
    req = urllib.request.Request(url, headers=headers)
    result = {
        "is_valid": True,
        "http_code": 200,
        "title": None,
        "description": None,
        "og_image": None,
        "error_message": None,
    }
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            result["http_code"] = response.getcode()
            html = response.read().decode("utf-8", errors="ignore")
            
            # Kiểm tra các dấu hiệu trang lỗi hoặc bài viết không tồn tại
            lower_html = html.lower()
            if "nội dung này hiện không khả dụng" in lower_html or \
               "this content isn't available right now" in lower_html or \
               "liên kết bạn đã theo dõi có thể bị hỏng" in lower_html or \
               "the link you followed may be broken" in lower_html or \
               ("đã xảy ra lỗi, hãy thử lại sau" in lower_html and len(html) < 2000):
                result["is_valid"] = False
                result["error_message"] = "Bài viết bị gỡ, không khả dụng hoặc liên kết hỏng"
            
            # Trích xuất title
            t_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE)
            if t_match:
                result["title"] = html_parser.unescape(t_match.group(1).strip())

            # Trích xuất og:title
            og_t = re.search(r'<meta[^>]*property=["\']og:title["\'][^>]*content=["\']([^"\']*)["\']', html, re.IGNORECASE)
            if og_t:
                result["title"] = html_parser.unescape(og_t.group(1).strip())

            # Trích xuất og:description
            og_d = re.search(r'<meta[^>]*property=["\']og:description["\'][^>]*content=["\']([^"\']*)["\']', html, re.IGNORECASE)
            if og_d:
                result["description"] = html_parser.unescape(og_d.group(1).strip())

            # Trích xuất og:image
            og_img = re.search(r'<meta[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']*)["\']', html, re.IGNORECASE)
            if og_img:
                result["og_image"] = html_parser.unescape(og_img.group(1).strip())

    except urllib.error.HTTPError as e:
        result["is_valid"] = False
        result["http_code"] = e.code
        result["error_message"] = f"Lỗi HTTP {e.code}: Không thể truy cập bài viết"
    except urllib.error.URLError as e:
        result["is_valid"] = False
        result["error_message"] = f"Lỗi mạng / URL không hợp lệ: {e.reason}"
    except Exception as e:
        result["is_valid"] = False
        result["error_message"] = f"Lỗi truy cập: {str(e)}"

    return result

def capture_with_playwright(browser, url, output_img_path):
    """
    Sử dụng Playwright để chụp ảnh màn hình cho link Facebook hoặc web.
    """
    context = browser.new_context(
        viewport={"width": 1200, "height": 850},
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        locale="vi-VN"
    )
    page = context.new_page()
    captured = False
    try:
        page.goto(url, wait_until="load", timeout=20000)
        page.wait_for_timeout(2000)
        
        # Thử đóng popup cookie / login dialog nếu có
        try:
            close_btn = page.locator('div[role="dialog"] div[aria-label="Đóng"], div[role="dialog"] div[aria-label="Close"]')
            if close_btn.count() > 0:
                close_btn.first.click(timeout=1000)
        except Exception:
            pass

        page.screenshot(path=output_img_path, type="jpeg", quality=75)
        captured = True
    except Exception as e:
        sys.stderr.write(f"Playwright capture error for {url}: {e}\n")
    finally:
        context.close()
    return captured

def main():
    parser = argparse.ArgumentParser(description="QC Inspect & Capture Tool")
    parser.add_argument("--links-file", required=True, help="Path to JSON file containing list of links")
    parser.add_argument("--output-dir", required=True, help="Directory to save captures and metadata")
    parser.add_argument("--force", action="store_true", help="Force refresh even if cache exists")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.links_file):
        print(json.dumps({"error": f"Links file not found: {args.links_file}"}))
        sys.exit(1)

    with open(args.links_file, "r", encoding="utf-8") as f:
        links_data = json.load(f)

    os.makedirs(args.output_dir, exist_ok=True)
    cache_index_path = os.path.join(args.output_dir, "cache_index.json")
    
    # Đọc cache hiện có nếu không force
    cache_index = {}
    if os.path.exists(cache_index_path) and not args.force:
        try:
            with open(cache_index_path, "r", encoding="utf-8") as f:
                cache_index = json.load(f)
        except Exception:
            cache_index = {}

    results = []
    browser = None
    playwright_instance = None

    for item in links_data:
        url = item.get("url", "").strip()
        platform = item.get("platform", "facebook") # facebook, threads, other
        index = item.get("index", 0)

        if not url:
            continue

        link_hash = get_link_hash(url)
        img_filename = f"cap_{platform}_{index}_{link_hash}.jpg"
        img_full_path = os.path.join(args.output_dir, img_filename)

        # Kiểm tra xem link này đã có trong cache chưa
        if not args.force and url in cache_index:
            cached_item = cache_index[url]
            # Nếu item có screenshot thì check file còn tồn tại không
            if not cached_item.get("hasScreenshot") or os.path.exists(img_full_path):
                results.append(cached_item)
                continue

        # Tiến hành kiểm tra link và cào metadata
        og_info = inspect_opengraph(url)
        
        has_screenshot = False
        # Nếu link sống và là Facebook (hoặc web khác), khởi tạo Playwright chụp ảnh
        if og_info["is_valid"] and platform == "facebook":
            if browser is None:
                playwright_instance = sync_playwright().start()
                browser = playwright_instance.chromium.launch(
                    headless=True,
                    args=["--disable-blink-features=AutomationControlled", "--no-sandbox"]
                )
            has_screenshot = capture_with_playwright(browser, url, img_full_path)
            
        record = {
            "url": url,
            "platform": platform,
            "index": index,
            "isValid": og_info["is_valid"],
            "httpCode": og_info["http_code"],
            "title": og_info["title"],
            "description": og_info["description"],
            "ogImage": og_info["og_image"],
            "errorMessage": og_info["error_message"],
            "hasScreenshot": has_screenshot and os.path.exists(img_full_path),
            "screenshotFilename": img_filename if (has_screenshot and os.path.exists(img_full_path)) else None,
            "inspectedAt": int(time.time()),
        }

        cache_index[url] = record
        results.append(record)

    # Đóng browser nếu có mở
    if browser:
        browser.close()
    if playwright_instance:
        playwright_instance.stop()

    # Cập nhật cache index
    with open(cache_index_path, "w", encoding="utf-8") as f:
        json.dump(cache_index, f, ensure_ascii=False, indent=2)

    # Xuất kết quả ra stdout cho API Next.js tiếp nhận
    print(json.dumps({"success": True, "results": results}, ensure_ascii=False))

if __name__ == "__main__":
    main()
