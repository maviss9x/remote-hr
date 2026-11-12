"use client";

import React, { useState, useEffect } from "react";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

interface CustomDatePickerProps {
  value: string; // Định dạng "YYYY-MM-DD"
  onChange: (dateStr: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export function CustomDatePicker({
  value = "",
  onChange,
  className = "",
  placeholder = "YYYY-MM-DD",
  disabled = false,
  required = false,
}: CustomDatePickerProps) {
  const [viewDate, setViewDate] = useState<Date>(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });

  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setViewDate(d);
      }
    }
  }, [value]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0 - 11

  // Tính ngày đầu tiên của tháng và số ngày trong tháng
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = CN, 1 = T2
  // Chuẩn hóa T2 là ngày đầu tuần (0: T2, ..., 6: CN)
  const startOffset = (firstDayOfMonth + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    const mStr = (month + 1).toString().padStart(2, "0");
    const dStr = day.toString().padStart(2, "0");
    onChange(`${year}-${mStr}-${dStr}`);
  };

  // Format value hiển thị ngày đã chọn
  const isSelected = (day: number) => {
    if (!value) return false;
    const mStr = (month + 1).toString().padStart(2, "0");
    const dStr = day.toString().padStart(2, "0");
    return value === `${year}-${mStr}-${dStr}`;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day
    );
  };

  const monthNames = [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
    "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
  ];

  // Format hiển thị ngày chuẩn dd/mm/yyyy
  const formatDisplayDate = (val: string) => {
    if (!val) return "";
    const parts = val.split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return val;
  };

  return (
    <Popover className="relative w-full">
      {({ open }) => (
        <>
          <PopoverButton
            disabled={disabled}
            className={`w-full text-left focus:outline-none transition-all cursor-pointer ${
              disabled ? "opacity-60 cursor-not-allowed" : ""
            }`}
            title="Mở lịch chọn ngày"
          >
            <div
              className={`input w-full flex items-center justify-between font-mono h-[42px] px-3.5 box-border transition-all ${
                open
                  ? "border-[var(--border-focus)] shadow-[0_0_0_3px_rgba(249,115,22,0.15)] bg-[var(--bg-card)]"
                  : ""
              } ${className}`}
              style={{ minWidth: "140px" }}
            >
              <span
                style={{
                  color: value ? "var(--text-primary)" : "var(--text-muted)",
                  fontSize: "0.875rem",
                  letterSpacing: value ? "0.05em" : "normal",
                  fontWeight: value ? 500 : 400,
                }}
              >
                {formatDisplayDate(value) || placeholder}
              </span>
              <CalendarIcon
                size={16}
                className={value ? "text-[var(--primary)]" : "text-[var(--text-secondary)]"}
                style={{ flexShrink: 0, marginLeft: "0.5rem" }}
              />
            </div>
          </PopoverButton>
          {required && <input type="hidden" value={value} required />}

          <PopoverPanel
            anchor={{ to: "bottom start", gap: 8 }}
            className="z-50 rounded-2xl bg-[#121624] border border-[var(--border-color)] shadow-2xl backdrop-blur-xl focus:outline-none transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 select-none"
            style={{
              width: "320px",
              minWidth: "320px",
              padding: "18px 18px 16px",
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.85), 0 0 24px rgba(249, 115, 22, 0.12)",
              color: "#e2e8f0",
            }}
          >
            {({ close }) => (
              <div className="flex flex-col">
                {/* Header Month / Year & Prev / Next */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingBottom: "12px",
                    marginBottom: "12px",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {monthNames[month]} {year}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={prevMonth}
                      className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer"
                      title="Tháng trước"
                      style={{
                        width: "30px",
                        height: "30px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={nextMonth}
                      className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer"
                      title="Tháng sau"
                      style={{
                        width: "30px",
                        height: "30px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                {/* Day header (T2 - CN) */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: "6px",
                    textAlign: "center",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    marginBottom: "10px",
                  }}
                >
                  <span>T2</span>
                  <span>T3</span>
                  <span>T4</span>
                  <span>T5</span>
                  <span>T6</span>
                  <span>T7</span>
                  <span style={{ color: "#f87171" }}>CN</span>
                </div>

                {/* Day grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: "6px",
                  }}
                >
                  {Array.from({ length: startOffset }).map((_, i) => (
                    <div key={`empty-${i}`} style={{ height: "34px", width: "34px" }} />
                  ))}

                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const selected = isSelected(day);
                    const today = isToday(day);

                    return (
                      <button
                        key={`day-${day}`}
                        type="button"
                        onClick={() => {
                          handleSelectDay(day);
                          close();
                        }}
                        style={{
                          height: "34px",
                          width: "34px",
                          margin: "0 auto",
                          fontSize: "0.8125rem",
                          fontWeight: selected ? 700 : today ? 600 : 500,
                          borderRadius: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          backgroundColor: selected
                            ? "var(--primary)"
                            : "transparent",
                          color: selected
                            ? "#ffffff"
                            : today
                            ? "var(--primary)"
                            : "var(--text-secondary)",
                          border: selected
                            ? "none"
                            : today
                            ? "1px solid var(--primary)"
                            : "1px solid transparent",
                          boxShadow: selected
                            ? "0 4px 12px rgba(249, 115, 22, 0.35)"
                            : "none",
                        }}
                        onMouseEnter={(e) => {
                          if (!selected) {
                            e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                            e.currentTarget.style.color = "#ffffff";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!selected) {
                            e.currentTarget.style.backgroundColor = "transparent";
                            e.currentTarget.style.color = today ? "var(--primary)" : "var(--text-secondary)";
                          }
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                {/* Footer: Xóa chọn nếu đã chọn ngày */}
                {value && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      paddingTop: "12px",
                      marginTop: "12px",
                      borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onChange("");
                        close();
                      }}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors cursor-pointer"
                      style={{
                        background: "transparent",
                        border: "none",
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        padding: "2px 6px",
                      }}
                    >
                      Xóa chọn ngày
                    </button>
                  </div>
                )}
              </div>
            )}
          </PopoverPanel>
        </>
      )}
    </Popover>
  );
}
