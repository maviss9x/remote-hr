"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Info,
  XCircle,
  X,
} from "lucide-react";

export type DialogType = "primary" | "danger" | "warning" | "info" | "success";
export type DialogMode = "alert" | "confirm" | "prompt";

export interface DialogOptions {
  title?: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
  placeholder?: string;
  defaultValue?: string;
}

interface DialogState extends DialogOptions {
  isOpen: boolean;
  mode: DialogMode;
  resolve: (value: any) => void;
}

// Global dispatcher listener
type DialogListener = (state: DialogState) => void;
let globalListener: DialogListener | null = null;

export function showDialog(mode: DialogMode, options: DialogOptions | string): Promise<any> {
  return new Promise((resolve) => {
    const opts: DialogOptions =
      typeof options === "string" ? { message: options } : options;

    const state: DialogState = {
      ...opts,
      mode,
      isOpen: true,
      resolve,
    };

    if (globalListener) {
      globalListener(state);
    } else {
      // Fallback nếu component chưa mount (vd: lúc SSR hoặc lỗi)
      if (mode === "confirm") {
        resolve(window.confirm(opts.message));
      } else if (mode === "prompt") {
        resolve(window.prompt(opts.message, opts.defaultValue));
      } else {
        window.alert(opts.message);
        resolve(undefined);
      }
    }
  });
}

/**
 * Hiển thị Popup Xác nhận (Thay thế cho window.confirm)
 */
export function confirmModal(options: DialogOptions | string): Promise<boolean> {
  return showDialog("confirm", options);
}

/**
 * Hiển thị Popup Thông báo (Thay thế cho window.alert)
 */
export function alertModal(options: DialogOptions | string): Promise<void> {
  return showDialog("alert", options);
}

/**
 * Hiển thị Popup Nhập dữ liệu (Thay thế cho window.prompt)
 */
export function promptModal(options: DialogOptions | string): Promise<string | null> {
  return showDialog("prompt", options);
}

export function GlobalDialog() {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [promptInput, setPromptInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    globalListener = (state: DialogState) => {
      setDialog(state);
      setPromptInput(state.defaultValue || "");
    };

    return () => {
      globalListener = null;
    };
  }, []);

  useEffect(() => {
    if (dialog?.isOpen) {
      // Khóa cuộn trang khi dialog mở
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      // Focus tự động
      const timer = setTimeout(() => {
        if (dialog.mode === "prompt") {
          inputRef.current?.focus();
          inputRef.current?.select();
        } else {
          confirmBtnRef.current?.focus();
        }
      }, 50);

      return () => {
        const hasOtherModal = !!document.querySelector(".modal-overlay, .contract-modal-overlay");
        document.body.style.overflow = hasOtherModal ? originalOverflow : "";
        clearTimeout(timer);
      };
    }
  }, [dialog?.isOpen, dialog?.mode]);

  if (!dialog || !dialog.isOpen) return null;

  const handleClose = (value: any) => {
    const resolve = dialog.resolve;
    setDialog(null);
    resolve(value);
  };

  const handleConfirm = () => {
    if (dialog.mode === "prompt") {
      handleClose(promptInput);
    } else if (dialog.mode === "confirm") {
      handleClose(true);
    } else {
      handleClose(undefined);
    }
  };

  const handleCancel = () => {
    if (dialog.mode === "prompt") {
      handleClose(null);
    } else if (dialog.mode === "confirm") {
      handleClose(false);
    } else {
      handleClose(undefined);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    } else if (e.key === "Enter" && dialog.mode !== "prompt") {
      e.preventDefault();
      handleConfirm();
    }
  };

  const type = dialog.type || (dialog.mode === "prompt" ? "primary" : dialog.mode === "confirm" ? "warning" : "info");

  // Định nghĩa màu sắc & icon theo từng type
  const config = {
    primary: {
      icon: HelpCircle,
      iconColor: "#f97316",
      iconBg: "rgba(249, 115, 22, 0.15)",
      borderColor: "rgba(249, 115, 22, 0.3)",
      confirmBg: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
      confirmHover: "#ea580c",
      defaultTitle: "Xác nhận hành động",
      defaultConfirmText: "Xác nhận",
    },
    danger: {
      icon: XCircle,
      iconColor: "#f43f5e",
      iconBg: "rgba(244, 63, 94, 0.15)",
      borderColor: "rgba(244, 63, 94, 0.3)",
      confirmBg: "linear-gradient(135deg, #e11d48 0%, #be123c 100%)",
      confirmHover: "#be123c",
      defaultTitle: "Cảnh báo nguy hiểm",
      defaultConfirmText: "Đồng ý",
    },
    warning: {
      icon: AlertTriangle,
      iconColor: "#f59e0b",
      iconBg: "rgba(245, 158, 11, 0.15)",
      borderColor: "rgba(245, 158, 11, 0.3)",
      confirmBg: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
      confirmHover: "#b45309",
      defaultTitle: "Xác nhận thao tác",
      defaultConfirmText: "Xác nhận",
    },
    info: {
      icon: Info,
      iconColor: "#38bdf8",
      iconBg: "rgba(56, 189, 248, 0.15)",
      borderColor: "rgba(56, 189, 248, 0.3)",
      confirmBg: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
      confirmHover: "#0369a1",
      defaultTitle: "Thông báo",
      defaultConfirmText: "Đã hiểu",
    },
    success: {
      icon: CheckCircle2,
      iconColor: "#10b981",
      iconBg: "rgba(16, 185, 129, 0.15)",
      borderColor: "rgba(16, 185, 129, 0.3)",
      confirmBg: "linear-gradient(135deg, #059669 0%, #047857 100%)",
      confirmHover: "#047857",
      defaultTitle: "Thành công",
      defaultConfirmText: "Hoàn tất",
    },
  }[type];

  const IconComponent = config.icon;
  const title = dialog.title || config.defaultTitle;
  const confirmText = dialog.confirmText || (dialog.mode === "alert" ? "Đã hiểu" : config.defaultConfirmText);
  const cancelText = dialog.cancelText || "Hủy bỏ";

  return (
    <div
      className="modal-alert-overlay"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        backgroundColor: "rgba(8, 12, 22, 0.82)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        animation: "modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div
        className="modal-alert-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "460px",
          backgroundColor: "#131726",
          backgroundImage: "linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(0, 0, 0, 0.1) 100%)",
          borderRadius: "18px",
          border: `1px solid ${config.borderColor}`,
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.05)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "modalZoomIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* MODAL HEADER & CONTENT */}
        <div style={{ padding: "1.5rem 1.5rem 1.25rem 1.5rem", display: "flex", gap: "1rem" }}>
          {/* Icon Badge */}
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              backgroundColor: config.iconBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              border: `1px solid ${config.borderColor}`,
            }}
          >
            <IconComponent size={24} style={{ color: config.iconColor }} />
          </div>

          {/* Texts */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  color: "#f8fafc",
                  letterSpacing: "-0.01em",
                }}
              >
                {title}
              </h3>
              <button
                type="button"
                onClick={handleCancel}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  padding: "4px",
                  borderRadius: "6px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#f8fafc")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
                title="Đóng (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                marginTop: "0.625rem",
                fontSize: "0.915rem",
                lineHeight: "1.55",
                color: "#94a3b8",
                whiteSpace: "pre-line",
                wordBreak: "break-word",
              }}
            >
              {dialog.message}
            </div>

            {/* Prompt Input */}
            {dialog.mode === "prompt" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleConfirm();
                }}
                style={{ marginTop: "1rem" }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder={dialog.placeholder || "Nhập giá trị..."}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    backgroundColor: "#0d101a",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "10px",
                    padding: "0.65rem 0.85rem",
                    color: "#f8fafc",
                    fontSize: "0.9rem",
                    outline: "none",
                    transition: "border-color 0.15s ease",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#f97316")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255, 255, 255, 0.15)")}
                />
              </form>
            )}
          </div>
        </div>

        {/* MODAL ACTIONS (FOOTER) */}
        <div
          style={{
            padding: "0.875rem 1.5rem",
            backgroundColor: "rgba(10, 13, 22, 0.6)",
            borderTop: "1px solid rgba(255, 255, 255, 0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "0.75rem",
          }}
        >
          {dialog.mode !== "alert" && (
            <button
              type="button"
              onClick={handleCancel}
              style={{
                padding: "0.55rem 1.1rem",
                borderRadius: "9px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                backgroundColor: "rgba(255, 255, 255, 0.04)",
                color: "#cbd5e1",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.04)";
                e.currentTarget.style.color = "#cbd5e1";
              }}
            >
              {cancelText}
            </button>
          )}

          <button
            ref={confirmBtnRef}
            type="button"
            onClick={handleConfirm}
            style={{
              padding: "0.55rem 1.25rem",
              borderRadius: "9px",
              border: "none",
              background: config.confirmBg,
              color: "#ffffff",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
              transition: "transform 0.15s ease, filter 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = "brightness(1.1)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "none";
              e.currentTarget.style.transform = "none";
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes modalFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes modalZoomIn {
          from {
            opacity: 0;
            transform: scale(0.94) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
