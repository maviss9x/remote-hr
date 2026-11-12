"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

export default function SessionWatcher() {
  const pathname = usePathname();
  const isRedirectingRef = useRef(false);
  const expirationTimeRef = useRef<number | null>(null);
  const checkTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Tự động đăng xuất và chuyển hướng ngay về trang /login
   */
  const handleAutoLogout = useCallback(() => {
    if (isRedirectingRef.current || pathname === "/login") return;
    isRedirectingRef.current = true;

    // Dọn dẹp cookie ở phía server nếu có thể
    try {
      fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    } catch {
      // Bỏ qua lỗi mạng
    }

    // Dùng replace để ghi đè history, tránh ấn Back bị quay lại trang lỗi
    window.location.replace("/login");
  }, [pathname]);

  /**
   * Đồng bộ thời hạn token từ API session
   */
  const syncSession = useCallback(async () => {
    if (isRedirectingRef.current || pathname === "/login") return;

    try {
      const res = await fetch("/api/auth/session");
      if (res.status === 401) {
        handleAutoLogout();
        return;
      }

      if (res.ok) {
        const data = await res.json();
        if (data?.user?.exp) {
          const expMs = data.user.exp * 1000;
          expirationTimeRef.current = expMs;
          const delay = expMs - Date.now();

          if (delay <= 0) {
            handleAutoLogout();
          } else {
            if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
            // Giới hạn max 32-bit integer của setTimeout (~24.8 ngày)
            const safeDelay = Math.min(delay, 2147483647);
            checkTimerRef.current = setTimeout(() => {
              handleAutoLogout();
            }, safeDelay);
          }
        }
      }
    } catch {
      // Bỏ qua lỗi mạng ngầm
    }
  }, [pathname, handleAutoLogout]);

  // Kiểm tra thời hạn khi tab active lại (visibilitychange, window focus và pageshow trên di động)
  useEffect(() => {
    if (pathname === "/login") return;

    const checkExpiration = () => {
      if (isRedirectingRef.current) return;
      if (expirationTimeRef.current && Date.now() >= expirationTimeRef.current) {
        handleAutoLogout();
      } else {
        syncSession();
      }
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        checkExpiration();
      }
    };

    const handlePageShow = () => {
      checkExpiration();
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [pathname, syncSession, handleAutoLogout]);

  // Khởi tạo kiểm tra phiên ban đầu & cài đặt Global Fetch Interceptor
  useEffect(() => {
    if (pathname === "/login") return;

    syncSession();

    // Hook vào window.fetch để tự động chuyển về login khi gặp bất kỳ lỗi 401 nào
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        if (response.status === 401) {
          const rawUrl = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url || "";
          if (!rawUrl.includes("/api/auth/login") && !rawUrl.includes("/api/auth/logout")) {
            handleAutoLogout();
          }
        }
        return response;
      } catch (error) {
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
      if (checkTimerRef.current) {
        clearTimeout(checkTimerRef.current);
      }
    };
  }, [pathname, syncSession, handleAutoLogout]);

  return null;
}
