"use client";

import { useState, FormEvent } from "react";
import { User, Lock, Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import BrandLogo from "@/components/BrandLogo";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const cleanIdentifier = identifier.trim();
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          identifier: cleanIdentifier,
          phone: cleanIdentifier,
          password,
          remember: rememberMe,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Tài khoản hoặc mật khẩu không chính xác");
        setLoading(false);
        return;
      }

      setSuccess(true);
      // Đợi ngắn để trình duyệt lưu cookie an toàn trước khi chuyển hướng sang Dashboard
      setTimeout(() => {
        window.location.replace("/");
      }, 300);
    } catch (err: unknown) {
      console.error("Login client error:", err);
      const message = err instanceof Error ? err.message : "";
      setError(message ? `Lỗi kết nối: ${message}` : "Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại đường truyền.");
      setLoading(false);
    }
  }


  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse at 50% 15%, rgba(249, 115, 22, 0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(56, 189, 248, 0.08) 0%, transparent 50%), var(--bg-primary)",
        padding: "1.5rem",
        position: "relative",
      }}
    >
      {/* Top-Right Theme Toggle Switcher */}
      <div style={{ position: "absolute", top: "1.25rem", right: "1.25rem", zIndex: 20 }}>
        <ThemeToggle />
      </div>

      <div
        className="animate-fadeIn"
        style={{
          width: "100%",
          maxWidth: "420px",
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "2.25rem" }}>
          <div style={{ display: "inline-flex", justifyContent: "center" }}>
            <BrandLogo variant="full" size="lg" priority />
          </div>
        </div>

        {/* Login Card */}
        <div
          className="card"
          style={{
            padding: "2.25rem",
            background: "var(--bg-card)",
            backdropFilter: "blur(20px)",
            border: "1px solid var(--border-color)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="label" htmlFor="identifier">
                Tài khoản
              </label>
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: "0.875rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    pointerEvents: "none",
                  }}
                >
                  <User size={17} />
                </div>
                <input
                  id="identifier"
                  type="text"
                  className={`input ${error ? "input-error" : ""}`}
                  placeholder="Nhập số điện thoại hoặc email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                  style={{ paddingLeft: "2.625rem" }}
                />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.375rem" }}>
                <label className="label" htmlFor="password" style={{ marginBottom: 0 }}>
                  Mật khẩu
                </label>
              </div>
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: "0.875rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    pointerEvents: "none",
                  }}
                >
                  <Lock size={17} />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className={`input ${error ? "input-error" : ""}`}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  style={{ paddingLeft: "2.625rem", paddingRight: "2.75rem" }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  onClick={() => setShowPassword((prev) => !prev)}
                  style={{
                    position: "absolute",
                    right: "0.75rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    padding: "0.25rem",
                    cursor: "pointer",
                    color: showPassword ? "var(--accent-primary, #f97316)" : "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "4px",
                    transition: "color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!showPassword) e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    if (!showPassword) e.currentTarget.style.color = "var(--text-muted)";
                  }}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Remember Me Option */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "0.875rem",
                marginBottom: "1.25rem",
              }}
            >
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  cursor: "pointer",
                  userSelect: "none",
                  fontSize: "0.8125rem",
                  color: "var(--text-secondary)",
                }}
              >
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{
                    width: "1rem",
                    height: "1rem",
                    borderRadius: "4px",
                    accentColor: "#f97316",
                    cursor: "pointer",
                  }}
                />
                <span>Ghi nhớ đăng nhập</span>
              </label>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: rememberMe ? "#fb923c" : "var(--text-dim)",
                  fontWeight: rememberMe ? 500 : 400,
                  transition: "color 0.2s ease",
                }}
              >
                 
              </span>
            </div>

            {error && (
              <div
                style={{
                  background: "var(--danger-bg)",
                  border: "1px solid rgba(244, 63, 94, 0.3)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.75rem 1rem",
                  marginBottom: "1.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  animation: "fadeIn 0.2s ease",
                }}
              >
                <AlertCircle size={17} style={{ color: "var(--danger)", flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: "0.8125rem",
                    color: "#fb7185",
                    fontWeight: 500,
                  }}
                >
                  {error}
                </span>
              </div>
            )}

            {success && (
              <div
                style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.75rem 1rem",
                  marginBottom: "1.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  animation: "fadeIn 0.2s ease",
                }}
              >
                <ShieldCheck size={17} style={{ color: "#10b981", flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: "0.8125rem",
                    color: "#34d399",
                    fontWeight: 500,
                  }}
                >
                  Đăng nhập thành công! Đang chuyển hướng...
                </span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading || success}
              style={{ width: "100%", gap: "0.625rem", marginTop: "0.5rem" }}
            >
              {success ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Đang vào hệ thống...</span>
                </>
              ) : loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Đang xác thực tài khoản...</span>
                </>
              ) : (
                <>
                  <span>Đăng nhập</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          {/* Secure note */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
              marginTop: "1.5rem",
              paddingTop: "1.25rem",
              borderTop: "1px solid var(--border-subtle)",
              color: "var(--text-muted)",
              fontSize: "0.75rem",
            }}
          >
            <ShieldCheck size={15} style={{ color: "#10b981" }} />
            <span>Hệ thống Remote Freetrip</span>
          </div>
        </div>

        {/* Footer */}
        <p
          style={{
            textAlign: "center",
            fontSize: "0.75rem",
            color: "var(--text-dim)",
            marginTop: "1.75rem",
          }}
        >
          © 2026 Freetrip Platform.
        </p>
      </div>
    </div>
  );
}
