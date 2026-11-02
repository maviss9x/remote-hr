/**
 * Quản lý bộ nhớ đệm (Cache) kết quả quét bài viết trực tiếp tại trình duyệt máy QC.
 * Sử dụng IndexedDB để lưu trữ kết quả và Blob hình ảnh xem trước,
 * đảm bảo máy chủ (Server) không phải lưu trữ bất kỳ file hình ảnh nào.
 */

const DB_NAME = "WebHybrid_QC_Cache";
const DB_VERSION = 1;
const STORE_NAME = "report_scans";

export interface QCLocalScanItem {
  url: string;
  platform: string;
  index: number;
  isValid: boolean;
  httpCode?: number;
  title?: string | null;
  description?: string | null;
  ogImage?: string | null;
  screenshotUrl?: string | null;
  errorMessage?: string | null;
  imageBlob?: Blob;
  localBlobUrl?: string | null;
  inspectedAt?: number;
}

export interface QCReportCacheRecord {
  reportId: number;
  updatedAt: number;
  results: Record<string, QCLocalScanItem>;
}

// Khởi tạo hoặc kết nối IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("Trình duyệt không hỗ trợ IndexedDB"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "reportId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Lấy dữ liệu scan đã lưu trong IndexedDB máy QC
 */
export async function getQCScanFromIndexedDB(
  reportId: number
): Promise<Record<string, QCLocalScanItem> | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(reportId);

      request.onsuccess = () => {
        const record = request.result as QCReportCacheRecord | undefined;
        if (!record || !record.results) {
          return resolve(null);
        }

        // Tạo Object URL cho các Blob ảnh đã lưu để hiển thị trên thẻ <img>
        const map: Record<string, QCLocalScanItem> = {};
        for (const [key, item] of Object.entries(record.results)) {
          let blobUrl: string | null = null;
          if (item.imageBlob && typeof window !== "undefined") {
            try {
              blobUrl = URL.createObjectURL(item.imageBlob);
            } catch {
              blobUrl = null;
            }
          }
          map[key] = {
            ...item,
            localBlobUrl: blobUrl,
          };
        }
        resolve(map);
      };

      request.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn("Không thể đọc cache IndexedDB:", err);
    return null;
  }
}

/**
 * Lưu kết quả scan vào IndexedDB máy QC.
 * Đồng thời tự động tải ảnh về dạng Blob để lưu giữ làm bằng chứng trên máy QC.
 */
export async function saveQCScanToIndexedDB(
  reportId: number,
  scanList: QCLocalScanItem[]
): Promise<void> {
  try {
    const db = await openDB();
    const resultsMap: Record<string, QCLocalScanItem> = {};

    // Xử lý nạp ảnh Blob ở client (nếu có ogImage)
    await Promise.all(
      scanList.map(async (item) => {
        let savedBlob: Blob | undefined = item.imageBlob;

        // Ưu tiên nạp Blob từ screenshotUrl thực tế (Data URL từ Playwright)
        if (!savedBlob && item.screenshotUrl && item.screenshotUrl.startsWith("data:")) {
          try {
            const res = await fetch(item.screenshotUrl);
            savedBlob = await res.blob();
          } catch {
            savedBlob = undefined;
          }
        }

        // Nếu chưa có blob và có link ogImage, tải blob về qua proxy để lưu cache IndexedDB
        if (!savedBlob && item.ogImage) {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 8000);
            const proxyUrl = `/api/qc/image-proxy?url=${encodeURIComponent(item.ogImage)}`;
            const res = await fetch(proxyUrl, { signal: controller.signal });
            clearTimeout(timer);
            if (res.ok) {
              savedBlob = await res.blob();
            }
          } catch {
            savedBlob = undefined;
          }
        }

        resultsMap[item.url] = {
          ...item,
          imageBlob: savedBlob,
          localBlobUrl: undefined, // Không lưu URL tạm vào IndexedDB
        };
      })
    );

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const record: QCReportCacheRecord = {
        reportId,
        updatedAt: Date.now(),
        results: resultsMap,
      };

      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("Không thể ghi vào IndexedDB:", err);
  }
}

/**
 * Xóa toàn bộ bộ nhớ đệm máy QC để giải phóng dung lượng trình duyệt
 */
export async function clearAllQCIndexedDBCache(): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Lấy số lượng báo cáo đang được cache trên máy QC
 */
export async function countQCCachedReports(): Promise<number> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}
