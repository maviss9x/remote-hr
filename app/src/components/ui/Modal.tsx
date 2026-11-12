"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string; // Ví dụ: "600px", "860px", "1280px"
  width?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  closeOnOutsideClick?: boolean; // Mặc định false: khóa đóng khi click outside
  showCloseButton?: boolean;
}

const sizeMaxWidthMap: Record<string, string> = {
  sm: "480px",
  md: "620px",
  lg: "860px",
  xl: "1080px",
  "2xl": "1280px",
  full: "96vw",
};

// Bộ đếm modal đang mở để quản lý scroll lock an toàn trên toàn ứng dụng
let activeModalCount = 0;

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  headerLeft,
  headerRight,
  children,
  footer,
  maxWidth,
  width = "95vw",
  size,
  className = "",
  bodyClassName = "",
  headerClassName = "",
  footerClassName = "",
  closeOnOutsideClick = false,
  showCloseButton = true,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Khóa scroll body khi modal mở với cơ chế đếm an toàn
  useEffect(() => {
    if (!isOpen) return;

    activeModalCount++;
    document.body.style.overflow = "hidden";
    document.body.classList.add("modal-open");

    return () => {
      activeModalCount = Math.max(0, activeModalCount - 1);
      if (activeModalCount === 0) {
        document.body.style.overflow = "";
        document.body.classList.remove("modal-open");
      }
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const finalMaxWidth = maxWidth || (size ? sizeMaxWidthMap[size] : "640px");
  const hasCustomHeader = !title && !headerLeft && !subtitle;

  const modalNode = (
    <div
      className="modal-overlay"
      onClick={(e) => {
        // Chỉ đóng nếu chủ động cho phép closeOnOutsideClick
        if (closeOnOutsideClick && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`modal ${className}`}
        style={{ maxWidth: finalMaxWidth, width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header mặc định nếu có title hoặc headerLeft */}
        {!hasCustomHeader ? (
          <div className={`modal-header ${headerClassName}`}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: 0 }}>
              {headerLeft}
              <div style={{ minWidth: 0 }}>
                {typeof title === "string" ? <h3 className="modal-title">{title}</h3> : title}
                {subtitle && <p className="modal-subtitle">{subtitle}</p>}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
              {headerRight}
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-icon btn-ghost"
                  title="Đóng"
                  style={{ width: "32px", height: "32px", borderRadius: "8px" }}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
        ) : null}

        {/* Nội dung Modal */}
        {hasCustomHeader && !footer ? (
          children
        ) : (
          <>
            <div className={`modal-body ${bodyClassName}`}>{children}</div>
            {footer && <div className={`modal-footer ${footerClassName}`}>{footer}</div>}
          </>
        )}
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
}

export default Modal;
