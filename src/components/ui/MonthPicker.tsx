"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, Check, Clock } from "lucide-react";

interface MonthPickerProps {
  selectedMonth: number; // 1 - 12
  selectedYear: number;
  onChange: (month: number, year: number) => void;
  className?: string;
  disabled?: boolean;
}

export function MonthPicker({
  selectedMonth,
  selectedYear,
  onChange,
  className = "",
  disabled = false,
}: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selectedYear);
  const containerRef = useRef<HTMLDivElement>(null);

  const now = useMemo(() => new Date(), []);
  const currentRealMonth = now.getMonth() + 1;
  const currentRealYear = now.getFullYear();

  // Đóng khi click ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Đồng bộ viewYear khi mở hoặc khi prop selectedYear thay đổi
  useEffect(() => {
    if (isOpen) {
      setViewYear(selectedYear);
    }
  }, [isOpen, selectedYear]);

  const monthNames = [
    "Tháng 01", "Tháng 02", "Tháng 03", "Tháng 04",
    "Tháng 05", "Tháng 06", "Tháng 07", "Tháng 08",
    "Tháng 09", "Tháng 10", "Tháng 11", "Tháng 12"
  ];

  const handleSelectMonth = (m: number) => {
    onChange(m, viewYear);
    setIsOpen(false);
  };

  const handleSelectCurrentMonth = () => {
    setViewYear(currentRealYear);
    onChange(currentRealMonth, currentRealYear);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: "0.5rem 0.875rem",
          borderRadius: "var(--radius-md)",
          background: "var(--bg-card)",
          border: isOpen ? "1px solid var(--primary)" : "1px solid var(--border-color)",
          fontSize: "0.8125rem",
          color: "var(--text-primary)",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          boxShadow: isOpen ? "0 0 0 2px rgba(56, 189, 248, 0.15)" : "none",
        }}
        title="Nhấp để lọc số liệu theo tháng"
      >
        <Calendar size={15} style={{ color: "var(--primary)" }} />
        <span style={{ fontWeight: 600 }}>
          Tháng {String(selectedMonth).padStart(2, "0")}/{selectedYear}
        </span>
        <ChevronDown
          size={14}
          style={{
            color: "var(--text-muted)",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 100,
            width: "280px",
            background: "#121727",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-lg, 12px)",
            boxShadow: "0 12px 30px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.05)",
            padding: "0.875rem",
            backdropFilter: "blur(12px)",
          }}
          className="animate-fadeIn"
        >
          {/* Header chọn năm */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "0.75rem",
              paddingBottom: "0.5rem",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <button
              type="button"
              onClick={() => setViewYear((prev) => prev - 1)}
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                border: "none",
                borderRadius: "6px",
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
              title="Năm trước"
            >
              <ChevronLeft size={16} />
            </button>

            <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)" }}>
              Năm {viewYear}
            </span>

            <button
              type="button"
              onClick={() => setViewYear((prev) => prev + 1)}
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                border: "none",
                borderRadius: "6px",
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
              title="Năm kế tiếp"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Lưới 12 tháng */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "0.375rem",
            }}
          >
            {monthNames.map((name, idx) => {
              const mNum = idx + 1;
              const isSelected = selectedMonth === mNum && selectedYear === viewYear;
              const isCurrent = currentRealMonth === mNum && currentRealYear === viewYear;

              return (
                <button
                  key={mNum}
                  type="button"
                  onClick={() => handleSelectMonth(mNum)}
                  style={{
                    padding: "0.5rem 0.25rem",
                    borderRadius: "8px",
                    border: isSelected
                      ? "1px solid var(--primary)"
                      : isCurrent
                      ? "1px dashed rgba(56, 189, 248, 0.4)"
                      : "1px solid transparent",
                    background: isSelected
                      ? "linear-gradient(135deg, rgba(56, 189, 248, 0.22) 0%, rgba(37, 99, 235, 0.22) 100%)"
                      : "rgba(255, 255, 255, 0.03)",
                    color: isSelected
                      ? "#38bdf8"
                      : isCurrent
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                    fontSize: "0.8125rem",
                    fontWeight: isSelected || isCurrent ? 600 : 500,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "2px",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                      e.currentTarget.style.color = "var(--text-primary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                      e.currentTarget.style.color = isCurrent
                        ? "var(--text-primary)"
                        : "var(--text-secondary)";
                    }
                  }}
                >
                  <span>{name}</span>
                  {isCurrent && (
                    <span
                      style={{
                        fontSize: "0.625rem",
                        color: "#10b981",
                        lineHeight: 1,
                      }}
                    >
                      Hiện tại
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer nút Tháng hiện tại */}
          <div
            style={{
              marginTop: "0.75rem",
              paddingTop: "0.5rem",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={handleSelectCurrentMonth}
              style={{
                background: "transparent",
                border: "none",
                color: "#38bdf8",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                padding: "0.25rem 0.5rem",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
            >
              <Clock size={12} />
              Về tháng hiện tại
            </button>

            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              {selectedYear === currentRealYear && selectedMonth === currentRealMonth
                ? "Đang xem tháng này"
                : `T${selectedMonth}/${selectedYear}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
