"use client";

import { useEffect } from "react";
import { AlertCircle, LogOut, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Nếu lỗi có dấu hiệu của session expired hoặc token không hợp lệ -> tự động chuyển hướng về /login
    const errorMsg = (error?.message || "").toLowerCase();
    if (
      errorMsg.includes("session") ||
      errorMsg.includes("unauthorized") ||
      errorMsg.includes("401") ||
      errorMsg.includes("token") ||
      errorMsg.includes("cookie")
    ) {
      window.location.replace("/login");
    }
  }, [error]);

  const handleGoLogin = () => {
    try {
      fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    } catch {
      // Bỏ qua lỗi mạng
    }
    window.location.replace("/login");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        background: "var(--bg-primary, #0c101c)",
        color: "var(--text-primary, #f8fafc)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          textAlign: "center",
          background: "var(--bg-card, #131726)",
          padding: "2rem",
          borderRadius: "16px",
          border: "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            margin: "0 auto 1.25rem",
            borderRadius: "50%",
            background: "rgba(244, 63, 94, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#f43f5e",
          }}
        >
          <AlertCircle size={32} />
        </div>

        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
          Phiên làm việc đã gián đoạn
        </h2>
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--text-secondary, #94a3b8)",
            lineHeight: 1.5,
            margin: "0 0 1.5rem",
          }}
        >
          Phiên đăng nhập của bạn có thể đã hết hạn hoặc kết nối bị gián đoạn. Vui lòng đăng nhập lại để tiếp tục sử dụng.
        </p>

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.65rem 1rem",
              borderRadius: "8px",
              border: "1px solid var(--border-color, rgba(255, 255, 255, 0.15))",
              background: "transparent",
              color: "inherit",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={15} />
            <span>Thử lại</span>
          </button>

          <button
            type="button"
            onClick={handleGoLogin}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.65rem 1.25rem",
              borderRadius: "8px",
              border: "none",
              background: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)",
              color: "#ffffff",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <LogOut size={15} />
            <span>Đăng nhập lại</span>
          </button>
        </div>
      </div>
    </div>
  );
}

