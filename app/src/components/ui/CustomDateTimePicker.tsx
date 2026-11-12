"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Check,
} from "lucide-react";

interface CustomDateTimePickerProps {
  value: string; // Định dạng "YYYY-MM-DD HH:mm:ss"
  onChange: (datetimeStr: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  isError?: boolean;
}

// Helper: Phân tích chuỗi datetime an toàn
function parseDateTimeString(str: string): {
  year: number;
  month: number; // 0 - 11
  date: number; // 1 - 31
  hours: number;
  minutes: number;
  seconds: number;
  isValid: boolean;
} {
  if (!str) {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth(),
      date: now.getDate(),
      hours: 0,
      minutes: 0,
      seconds: 0,
      isValid: false,
    };
  }

  const cleanStr = str.replace("T", " ").trim();
  const [datePart, timePart = "00:00:00"] = cleanStr.split(" ");
  const dateTokens = datePart.split("-").map(Number);
  const timeTokens = timePart.split(":").map(Number);

  const year = dateTokens[0] || new Date().getFullYear();
  const month = (dateTokens[1] || 1) - 1;
  const date = dateTokens[2] || 1;
  const hours = timeTokens[0] || 0;
  const minutes = timeTokens[1] || 0;
  const seconds = timeTokens[2] || 0;

  return {
    year,
    month,
    date,
    hours: Math.min(23, Math.max(0, hours)),
    minutes: Math.min(59, Math.max(0, minutes)),
    seconds: Math.min(59, Math.max(0, seconds)),
    isValid: true,
  };
}

// Helper: Định dạng hiển thị DD/MM/YYYY HH:mm:ss
function formatDisplayString(value: string): string {
  if (!value) return "";
  const parsed = parseDateTimeString(value);
  if (!parsed.isValid) return "";

  const d = String(parsed.date).padStart(2, "0");
  const m = String(parsed.month + 1).padStart(2, "0");
  const y = parsed.year;
  const hh = String(parsed.hours).padStart(2, "0");
  const mm = String(parsed.minutes).padStart(2, "0");
  const ss = String(parsed.seconds).padStart(2, "0");

  return `${d}/${m}/${y} ${hh}:${mm}:${ss}`;
}

export function CustomDateTimePicker({
  value = "",
  onChange,
  className = "",
  placeholder = "DD/MM/YYYY HH:mm:ss",
  disabled = false,
  isError = false,
}: CustomDateTimePickerProps) {
  const parsed = useMemo(() => parseDateTimeString(value), [value]);

  // State cho tháng / năm đang duyệt xem trên lịch
  const [viewYear, setViewYear] = useState<number>(() => parsed.year);
  const [viewMonth, setViewMonth] = useState<number>(() => parsed.month);

  // State cục bộ cho giờ, phút, giây
  const [hours, setHours] = useState<number>(() => parsed.hours);
  const [minutes, setMinutes] = useState<number>(() => parsed.minutes);
  const [seconds, setSeconds] = useState<number>(() => parsed.seconds);

  // Đồng bộ khi value bên ngoài thay đổi
  useEffect(() => {
    if (value) {
      const p = parseDateTimeString(value);
      setViewYear(p.year);
      setViewMonth(p.month);
      setHours(p.hours);
      setMinutes(p.minutes);
      setSeconds(p.seconds);
    }
  }, [value]);

  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Tính ngày đầu tiên của tháng và số ngày trong tháng
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0 = CN, 1 = T2
  const startOffset = (firstDayOfMonth + 6) % 7; // Chuẩn hóa T2 là 0 ... CN là 6
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  // Tạo chuỗi lưu chuẩn: "YYYY-MM-DD HH:mm:ss"
  const emitChange = (y: number, m: number, d: number, hh: number, mm: number, ss: number) => {
    const yStr = y;
    const mStr = String(m + 1).padStart(2, "0");
    const dStr = String(d).padStart(2, "0");
    const hStr = String(hh).padStart(2, "0");
    const minStr = String(mm).padStart(2, "0");
    const sStr = String(ss).padStart(2, "0");
    onChange(`${yStr}-${mStr}-${dStr} ${hStr}:${minStr}:${sStr}`);
  };

  const handleSelectDay = (day: number) => {
    emitChange(viewYear, viewMonth, day, hours, minutes, seconds);
  };

  const handleTimeChange = (type: "h" | "m" | "s", rawVal: string) => {
    const num = parseInt(rawVal, 10);
    const val = isNaN(num) ? 0 : num;

    let nextH = hours;
    let nextM = minutes;
    let nextS = seconds;

    if (type === "h") {
      nextH = Math.min(23, Math.max(0, val));
      setHours(nextH);
    } else if (type === "m") {
      nextM = Math.min(59, Math.max(0, val));
      setMinutes(nextM);
    } else {
      nextS = Math.min(59, Math.max(0, val));
      setSeconds(nextS);
    }

    const targetDate = parsed.isValid ? parsed.date : new Date().getDate();
    emitChange(viewYear, viewMonth, targetDate, nextH, nextM, nextS);
  };

  const handleSetNow = () => {
    const now = new Date();
    const curH = now.getHours();
    const curM = now.getMinutes();
    const curS = now.getSeconds();
    setHours(curH);
    setMinutes(curM);
    setSeconds(curS);
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    emitChange(now.getFullYear(), now.getMonth(), now.getDate(), curH, curM, curS);
  };

  const handleSetStartOfDay = () => {
    setHours(0);
    setMinutes(0);
    setSeconds(0);
    const targetDate = parsed.isValid ? parsed.date : new Date().getDate();
    emitChange(viewYear, viewMonth, targetDate, 0, 0, 0);
  };

  const handleSetEndOfDay = () => {
    setHours(23);
    setMinutes(59);
    setSeconds(59);
    const targetDate = parsed.isValid ? parsed.date : new Date().getDate();
    emitChange(viewYear, viewMonth, targetDate, 23, 59, 59);
  };

  const isDaySelected = (day: number) => {
    if (!value || !parsed.isValid) return false;
    return parsed.year === viewYear && parsed.month === viewMonth && parsed.date === day;
  };

  const displayValue = formatDisplayString(value);

  return (
    <Popover className="relative w-full">
      {({ open, close }) => (
        <>
          <PopoverButton
            disabled={disabled}
            className={`w-full text-left focus:outline-none transition-all cursor-pointer ${
              disabled ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            <div
              className={`input w-full flex items-center justify-between font-mono ${
                open
                  ? "border-[var(--primary)] shadow-[0_0_0_2px_rgba(249,115,22,0.2)] bg-[var(--bg-card)]"
                  : ""
              } ${isError ? "!border-[var(--danger)] !shadow-[0_0_0_1px_rgba(239,68,68,0.4)]" : ""} ${className}`}
              style={{
                padding: "0.35rem 0.5rem",
                fontSize: "0.75rem",
                cursor: "pointer",
                height: "34px",
              }}
            >
              <span
                style={{
                  color: displayValue ? "var(--text-primary)" : "var(--text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {displayValue || placeholder}
              </span>
              <CalendarIcon
                size={14}
                className={displayValue ? "text-[var(--primary)]" : "text-[var(--text-muted)]"}
                style={{ flexShrink: 0, marginLeft: "4px" }}
              />
            </div>
          </PopoverButton>

          <PopoverPanel
            anchor={{ to: "bottom start", gap: 6 }}
            className="z-50 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-[var(--shadow-lg)] backdrop-blur-xl focus:outline-none transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
            style={{
              width: "340px",
              minWidth: "340px",
              maxHeight: "none",
              padding: "16px 16px 14px",
              boxShadow: "var(--shadow-lg), 0 0 20px rgba(249, 115, 22, 0.08)",
              color: "var(--text-primary)",
            }}
          >
            <div className="flex flex-col select-none">
              {/* Header: < Tháng X YYYY  < > */}
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  title="Tháng trước"
                >
                  <ChevronLeft size={16} />
                </button>

                <span className="font-bold text-[0.8125rem] text-[var(--text-primary)] tracking-wide uppercase">
                  Tháng {viewMonth + 1} {viewYear}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={prevMonth}
                    className="p-1 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--primary)] transition-colors cursor-pointer"
                    title="Tháng trước"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={nextMonth}
                    className="p-1 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    title="Tháng sau"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Bảng Lịch có viền ô (Calendar Grid Table) */}
              <div
                className="w-full border border-[var(--border-color)] rounded-xl overflow-hidden mb-3 bg-[var(--bg-card)]"
              >
                {/* Hàng Tiêu Đề Thứ (T2 - CN) */}
                <div className="grid grid-cols-7 border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
                  {["T2", "T3", "T4", "T5", "T6", "T7"].map((d) => (
                    <span
                      key={d}
                      className="text-center text-[0.6875rem] font-bold text-[var(--text-muted)] py-2"
                    >
                      {d}
                    </span>
                  ))}
                  <span className="text-center text-[0.6875rem] font-bold text-[var(--danger)] py-2">
                    CN
                  </span>
                </div>

                {/* Lưới Ngày trong Tháng — từng ô có border */}
                <div className="grid grid-cols-7">
                  {/* Ngày của tháng trước */}
                  {Array.from({ length: startOffset }).map((_, i) => {
                    const day = daysInPrevMonth - startOffset + i + 1;
                    return (
                      <div
                        key={`prev-${i}`}
                        className="h-10 flex items-center justify-center font-mono text-xs text-[var(--text-dim)] border-b border-r border-[var(--border-color)]"
                      >
                        {day}
                      </div>
                    );
                  })}

                  {/* Các ngày trong tháng hiện tại */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const selected = isDaySelected(day);

                    return (
                      <div
                        key={`day-${day}`}
                        onClick={() => handleSelectDay(day)}
                        className="h-10 flex items-center justify-center font-mono text-xs border-b border-r border-[var(--border-color)] cursor-pointer p-0.5"
                      >
                        <div
                          className={`w-full h-full flex items-center justify-center rounded-lg transition-colors ${
                            selected
                              ? "bg-[var(--primary)] text-white font-bold shadow-md shadow-orange-500/30"
                              : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                          }`}
                        >
                          {day}
                        </div>
                      </div>
                    );
                  })}

                  {/* Ngày của tháng sau để lấp đầy hàng cuối */}
                  {Array.from({
                    length: (7 - ((startOffset + daysInMonth) % 7)) % 7,
                  }).map((_, i) => (
                    <div
                      key={`next-${i}`}
                      className="h-10 flex items-center justify-center font-mono text-xs text-[var(--text-dim)] border-b border-r border-[var(--border-color)]"
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>

              {/* Thanh Time Picker Giờ / Phút / Giây */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Clock size={14} className="text-[var(--primary)]" />
                    <span className="font-bold text-[var(--text-primary)]">Time Picker</span>
                    <span className="text-[var(--text-muted)] text-[0.6875rem]">
                      Giờ / Phút / Giây (HH:mm:ss):
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[0.6875rem] text-[var(--text-muted)] font-mono">
                    <button
                      type="button"
                      onClick={handleSetStartOfDay}
                      className="hover:text-[var(--primary)] transition-colors cursor-pointer"
                      title="Chọn 00:00:00"
                    >
                      00:00:00
                    </button>
                    <span>-</span>
                    <button
                      type="button"
                      onClick={handleSetEndOfDay}
                      className="hover:text-[var(--primary)] transition-colors cursor-pointer"
                      title="Chọn 23:59:59"
                    >
                      23:59:59
                    </button>
                  </div>
                </div>

                {/* Khung Nhập Thời Gian HH : mm : ss */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl py-2.5 px-4 flex items-center justify-around">
                  {/* Giờ */}
                  <div className="flex flex-col items-center flex-1">
                    <input
                      type="text"
                      maxLength={2}
                      value={String(hours).padStart(2, "0")}
                      onChange={(e) => handleTimeChange("h", e.target.value)}
                      className="w-full text-center font-mono font-bold text-base bg-transparent border-0 text-[var(--text-primary)] focus:outline-none"
                    />
                    <span className="text-[0.625rem] text-[var(--text-muted)] mt-0.5">Giờ</span>
                  </div>

                  <span className="font-bold text-base text-[var(--text-dim)] -mt-3.5">:</span>

                  {/* Phút */}
                  <div className="flex flex-col items-center flex-1">
                    <input
                      type="text"
                      maxLength={2}
                      value={String(minutes).padStart(2, "0")}
                      onChange={(e) => handleTimeChange("m", e.target.value)}
                      className="w-full text-center font-mono font-bold text-base bg-transparent border-0 text-[var(--text-primary)] focus:outline-none"
                    />
                    <span className="text-[0.625rem] text-[var(--text-muted)] mt-0.5">Phút</span>
                  </div>

                  <span className="font-bold text-base text-[var(--text-dim)] -mt-3.5">:</span>

                  {/* Giây */}
                  <div className="flex flex-col items-center flex-1">
                    <input
                      type="text"
                      maxLength={2}
                      value={String(seconds).padStart(2, "0")}
                      onChange={(e) => handleTimeChange("s", e.target.value)}
                      className="w-full text-center font-mono font-bold text-base bg-transparent border-0 text-[var(--text-primary)] focus:outline-none"
                    />
                    <span className="text-[0.625rem] text-[var(--text-muted)] mt-0.5">Giây</span>
                  </div>
                </div>
              </div>

              {/* Hàng Đáy: Bây giờ & Nút Xong */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={handleSetNow}
                  className="text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] transition-colors cursor-pointer"
                >
                  Bây giờ
                </button>

                <button
                  type="button"
                  onClick={() => close()}
                  className="bg-gradient-to-r from-[#ff6a00] to-[#f97316] hover:brightness-105 active:scale-95 text-white font-bold text-sm px-6 py-2 rounded-full flex items-center gap-1.5 shadow-md shadow-orange-500/25 transition-all cursor-pointer"
                >
                  <Check size={14} strokeWidth={3} /> Xong
                </button>
              </div>
            </div>
          </PopoverPanel>
        </>
      )}
    </Popover>
  );
}
