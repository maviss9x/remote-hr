import ExcelJS from "exceljs";
import { downloadWorkbook } from "./excelStyles";
import type { KpiExportPayload, KpiExportPersonnel } from "@/app/api/kpi/export-data/route";

const FONT_NAME = "Times New Roman";

const STYLES = {
  BORDER_THIN: {
    top: { style: "thin", color: { argb: "FF9CA3AF" } },
    left: { style: "thin", color: { argb: "FF9CA3AF" } },
    bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
    right: { style: "thin", color: { argb: "FF9CA3AF" } },
  } as Partial<ExcelJS.Borders>,
  HEADER_BG: {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF3F4F6" }, // Gray 100
  } as ExcelJS.FillPattern,
  HIGHLIGHT_BG: {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FEFEF3C7" }, // Amber 100
  } as ExcelJS.FillPattern,
};

function applyCellBorder(cell: ExcelJS.Cell) {
  cell.border = STYLES.BORDER_THIN;
}

function setMatrixHeader(cell: ExcelJS.Cell, text: string, isBold: boolean = true) {
  cell.value = text;
  cell.font = { name: FONT_NAME, size: 11, bold: isBold };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  applyCellBorder(cell);
}

function setMatrixDataCell(
  cell: ExcelJS.Cell,
  value: any,
  options?: {
    align?: "center" | "left" | "right";
    bold?: boolean;
    numFmt?: string;
    hyperlink?: string;
    color?: string;
  }
) {
  if (options?.hyperlink) {
    cell.value = {
      text: String(value),
      hyperlink: options.hyperlink,
    };
    cell.font = {
      name: FONT_NAME,
      size: 11,
      color: { argb: "FF1D4ED8" }, // Blue
      underline: true,
      bold: options?.bold || false,
    };
  } else {
    cell.value = value;
    cell.font = {
      name: FONT_NAME,
      size: 11,
      bold: options?.bold || false,
      color: options?.color ? { argb: options.color } : undefined,
    };
  }

  cell.alignment = {
    horizontal: options?.align || "center",
    vertical: "middle",
    wrapText: true,
  };

  if (options?.numFmt) {
    cell.numFmt = options.numFmt;
  }

  applyCellBorder(cell);
}

/**
 * Sinh file Báo Cáo Tổng Hợp KPI & Đánh Giá (Tuần hoặc Tháng)
 * Tuyệt đối không can thiệp hay thay đổi file mẫu gốc.
 */
export async function exportKpiExcel(data: KpiExportPayload): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hệ Thống Quản Lý Remote - Freetrip";
  workbook.created = new Date();

  const isWeek = data.reportType === "WEEK";
  const sheetTitle = isWeek
    ? `KPI_Tuan_${data.weekNumber || ""}_T${data.month}_${data.year}`
    : `KPI_Thang_${data.month}_${data.year}`;

  const ws = workbook.addWorksheet(sheetTitle, {
    views: [{ showGridLines: true }],
  });

  // Thiết lập Column Widths
  ws.getColumn(1).width = 44; // Cột A: Tên nhóm tiêu chí
  ws.getColumn(2).width = 13; // Cột B: Nền tảng / Phân loại
  ws.getColumn(3).width = 13; // Cột C: Phụ lục / Đơn vị
  const totalUsers = data.personnelList.length;
  for (let c = 0; c < totalUsers; c++) {
    ws.getColumn(4 + c).width = 24; // Mỗi nhân sự 1 cột
  }

  // ========================================================
  // PHẦN 1: HEADER & GHI CHÚ TỔNG HỢP CHUNG (Rows 1 - 10)
  // ========================================================

  // Row 1: Title
  ws.mergeCells("A1:C1");
  const cellA1 = ws.getCell("A1");
  cellA1.value = data.title;
  cellA1.font = { name: FONT_NAME, size: 16, bold: true };
  cellA1.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  ws.getRow(1).height = 45;

  // Row 2: 1. Nhân sự
  ws.mergeCells("A2:C2");
  const cellA2 = ws.getCell("A2");
  cellA2.value = "1.Nhân sự";
  cellA2.font = { name: FONT_NAME, size: 12, bold: true };
  cellA2.alignment = { vertical: "middle" };
  ws.getRow(2).height = 22;

  // Row 3: Nội dung nhân sự
  ws.mergeCells("A3:C3");
  const cellA3 = ws.getCell("A3");
  cellA3.value = ` - Số lượng nhân sự: ${data.summary.totalPersonnel}
 - Thời gian: ${data.summary.workingTimeNote}
 - Thái độ làm việc: ${data.summary.attitudeNote}
 - Nhân sự làm nhiều nhất: ${data.summary.highestStaffName || ""}
 - Nhân sự làm ít nhất: ${data.summary.lowestStaffName || ""}`;
  cellA3.font = { name: FONT_NAME, size: 11 };
  cellA3.alignment = { vertical: "middle", wrapText: true };
  ws.getRow(3).height = 80;

  // Row 4: 2. Số lượng user đăng ký
  const cellA4 = ws.getCell("A4");
  cellA4.value = `2. ${data.summary.registeredUserText || `Số lượng user đăng ký ${data.periodText}`}`;
  cellA4.font = { name: FONT_NAME, size: 11, bold: true };
  cellA4.alignment = { vertical: "middle" };

  ws.mergeCells("B4:C4");
  const cellB4 = ws.getCell("B4");
  cellB4.value = data.summary.registeredUserCount || 0;
  cellB4.font = { name: FONT_NAME, size: 11, bold: true };
  cellB4.alignment = { horizontal: "center", vertical: "middle" };
  cellB4.numFmt = "#,##0";
  ws.getRow(4).height = 28;

  // Row 5: 3. Đánh giá chạy content nữ
  ws.mergeCells("A5:C5");
  const cellA5 = ws.getCell("A5");
  cellA5.value = "3. Đánh giá chạy content nữ";
  cellA5.font = { name: FONT_NAME, size: 12, bold: true };
  cellA5.alignment = { vertical: "middle" };
  ws.getRow(5).height = 24;

  // Row 6: Nội dung content nữ
  ws.mergeCells("A6:C6");
  const cellA6 = ws.getCell("A6");
  cellA6.value = ` - Các bạn viết content các dạng bài về:
  + Nhóm 1: Tâm sự, chữa lành và tình cảm, hôn nhân, Single Mom
  + Nhóm 2: Địa điểm hẹn hò, ăn chơi, du lịch
  + Nhóm 3: Cộng đồng về giới tính, sinh viên, gen Z 
  + Nhóm 4: Drama, Hóng hớt`;
  cellA6.font = { name: FONT_NAME, size: 11 };
  cellA6.alignment = { vertical: "middle", wrapText: true };
  ws.getRow(6).height = 70;

  // Row 7: Kết quả số lượng Nam/Nữ
  ws.mergeCells("A7:C7");
  const cellA7 = ws.getCell("A7");
  cellA7.value = `Kết quả số lượng:
Nam: 1,848 đạt 70,7% | Nữ: 492 đạt 18,8%`;
  cellA7.font = { name: FONT_NAME, size: 11 };
  cellA7.alignment = { vertical: "middle", wrapText: true };
  ws.getRow(7).height = 36;

  // Row 8: Tiêu đề đánh giá nội dung
  ws.mergeCells("A8:C8");
  const cellA8 = ws.getCell("A8");
  cellA8.value = isWeek ? "4. Đánh giá nội dung làm việc" : "5. Đánh giá nội dung làm việc";
  cellA8.font = { name: FONT_NAME, size: 12, bold: true };
  cellA8.alignment = { vertical: "middle" };
  ws.getRow(8).height = 24;

  // Row 9: Nhận xét nội dung làm việc
  ws.mergeCells("A9:C9");
  const cellA9 = ws.getCell("A9");
  cellA9.value = data.summary.contentEvaluationNote || "Các bạn làm việc tương đối tốt, hầu hết các bài đều có tương tác.";
  cellA9.font = { name: FONT_NAME, size: 11 };
  cellA9.alignment = { vertical: "middle", wrapText: true };
  ws.getRow(9).height = 40;

  // ========================================================
  // PHẦN 2: BẢNG MA TRẬN NHÂN SỰ (Bắt đầu từ Row 11)
  // ========================================================

  let r = 11;

  // Row 11: Header ĐÁNH GIÁ & Tên nhân sự
  ws.mergeCells(`A${r}:C${r}`);
  const cellEval = ws.getCell(`A${r}`);
  setMatrixHeader(cellEval, "ĐÁNH GIÁ", true);
  cellEval.fill = STYLES.HEADER_BG;

  data.personnelList.forEach((p, idx) => {
    const colIdx = 4 + idx;
    const cell = ws.getRow(r).getCell(colIdx);
    if (p.user.driveFolderUrl) {
      setMatrixDataCell(cell, p.user.fullName, {
        bold: true,
        align: "center",
        hyperlink: p.user.driveFolderUrl,
      });
    } else {
      setMatrixDataCell(cell, p.user.fullName, { bold: true, align: "center" });
    }
    cell.fill = STYLES.HEADER_BG;
  });
  ws.getRow(r).height = 35;
  r++;

  // Row 12: Số ca đã làm / Số ca đăng ký
  const shiftRowLabel = "Số ca đã làm / Số ca đăng ký";
  ws.mergeCells(`A${r}:C${r}`);
  setMatrixHeader(ws.getCell(`A${r}`), shiftRowLabel, true);

  data.personnelList.forEach((p, idx) => {
    const colIdx = 4 + idx;
    const cell = ws.getRow(r).getCell(colIdx);
    const shiftDisplay = `${p.actualShifts ?? 0} / ${p.totalShifts ?? 0}`;
    setMatrixDataCell(cell, shiftDisplay, { bold: true, align: "center" });
  });
  ws.getRow(r).height = 24;
  r++;

  // Rows 13 - 15: KPI/ ca/ 1 nhân sự
  const kpiStartRow = r;
  ws.mergeCells(`A${kpiStartRow}:A${kpiStartRow + 2}`);
  const kpiHeaderCell = ws.getCell(`A${kpiStartRow}`);
  setMatrixHeader(kpiHeaderCell, "KPI/ ca/ 1 nhân sự", true);

  const kpiRows = [
    { name: "Facebook", key: "facebook" as const, defaultVal: 10 },
    { name: "Threads", key: "threads" as const, defaultVal: 4 },
    { name: "Comments", key: "comments" as const, defaultVal: 50 },
  ];

  kpiRows.forEach((item, kIdx) => {
    const curR = kpiStartRow + kIdx;
    ws.mergeCells(`B${curR}:C${curR}`);
    setMatrixHeader(ws.getCell(`B${curR}`), item.name, false);

    data.personnelList.forEach((p, pIdx) => {
      const colIdx = 4 + pIdx;
      const targetVal = p.targetsPerShift ? p.targetsPerShift[item.key] : item.defaultVal;
      setMatrixDataCell(ws.getRow(curR).getCell(colIdx), targetVal, {
        align: "center",
        bold: Boolean(p.isCustomKpi),
      });
    });
    ws.getRow(curR).height = 22;
  });
  r += 3;

  // Rows 16 - 18: Số lượng nội dung thực tế
  const actualStartRow = r;
  ws.mergeCells(`A${actualStartRow}:A${actualStartRow + 2}`);
  setMatrixHeader(ws.getCell(`A${actualStartRow}`), "Số lượng nội dung thực tế", true);

  const actualRows = [
    { name: "Facebook", key: "facebook" as const },
    { name: "Threads", key: "threads" as const },
    { name: "Comments", key: "comments" as const },
  ];

  actualRows.forEach((item, aIdx) => {
    const curR = actualStartRow + aIdx;
    ws.mergeCells(`B${curR}:C${curR}`);
    setMatrixHeader(ws.getCell(`B${curR}`), item.name, false);

    data.personnelList.forEach((p, pIdx) => {
      const colIdx = 4 + pIdx;
      setMatrixDataCell(ws.getRow(curR).getCell(colIdx), p.actual[item.key], {
        align: "center",
        bold: true,
      });
    });
    ws.getRow(curR).height = 22;
  });
  r += 3;

  // Rows 19 - 21: So sánh mức tăng trưởng
  const growthStartRow = r;
  const growthTitle = isWeek ? "So sánh mức tăng trưởng với tuần trước" : "So sánh mức tăng trưởng với tháng trước";
  ws.mergeCells(`A${growthStartRow}:A${growthStartRow + 2}`);
  setMatrixHeader(ws.getCell(`A${growthStartRow}`), growthTitle, true);

  actualRows.forEach((item, gIdx) => {
    const curR = growthStartRow + gIdx;
    ws.mergeCells(`B${curR}:C${curR}`);
    setMatrixHeader(ws.getCell(`B${curR}`), item.name, false);

    data.personnelList.forEach((p, pIdx) => {
      const colIdx = 4 + pIdx;
      const gVal = p.growth[item.key];
      const textVal = gVal != null ? `${gVal > 0 ? "+" : ""}${gVal}%` : "-";
      setMatrixDataCell(ws.getRow(curR).getCell(colIdx), textVal, {
        align: "center",
        color: gVal != null && gVal >= 0 ? "FF16A34A" : "FFDC2626",
      });
    });
    ws.getRow(curR).height = 22;
  });
  r += 3;

  // Rows 22 - 24: Chất lượng nội dung
  const qualityStartRow = r;
  ws.mergeCells(`A${qualityStartRow}:A${qualityStartRow + 2}`);
  setMatrixHeader(ws.getCell(`A${qualityStartRow}`), "Chất lượng nội dung ", true);

  actualRows.forEach((item, qIdx) => {
    const curR = qualityStartRow + qIdx;
    ws.mergeCells(`B${curR}:C${curR}`);
    setMatrixHeader(ws.getCell(`B${curR}`), item.name, false);

    data.personnelList.forEach((p, pIdx) => {
      const colIdx = 4 + pIdx;
      setMatrixDataCell(ws.getRow(curR).getCell(colIdx), p.qualityReview[item.key], {
        align: "left",
      });
    });
    ws.getRow(curR).height = 50;
  });
  r += 3;

  // Rows 25 - 27: Đánh giá mức độ hoàn thành KPI
  const compStartRow = r;
  ws.mergeCells(`A${compStartRow}:A${compStartRow + 2}`);
  setMatrixHeader(ws.getCell(`A${compStartRow}`), "Đánh giá mức độ hoàn thành KPI", true);

  actualRows.forEach((item, cIdx) => {
    const curR = compStartRow + cIdx;
    ws.mergeCells(`B${curR}:C${curR}`);
    setMatrixHeader(ws.getCell(`B${curR}`), item.name, false);

    data.personnelList.forEach((p, pIdx) => {
      const colIdx = 4 + pIdx;
      const rateVal = p.completionRates[item.key];
      const cell = ws.getRow(curR).getCell(colIdx);
      if (rateVal == null) {
        setMatrixDataCell(cell, "-", {
          align: "center",
          bold: false,
          color: "FF6B7280",
        });
      } else {
        setMatrixDataCell(cell, rateVal, {
          align: "center",
          bold: true,
          numFmt: "0.0%",
          color: rateVal >= 1 ? "FF16A34A" : "FFDC2626",
        });
      }
    });
    ws.getRow(curR).height = 24;
  });
  r += 3;

  // Rows 28 - 29: Chăm sóc bài viết
  const careStartRow = r;
  ws.mergeCells(`A${careStartRow}:A${careStartRow + 1}`);
  setMatrixHeader(ws.getCell(`A${careStartRow}`), "Chăm sóc bài viết", true);

  const carePlatforms = [
    { name: "Facebook", key: "facebook" as const },
    { name: "Threads", key: "threads" as const },
  ];

  carePlatforms.forEach((cp, cpIdx) => {
    const curR = careStartRow + cpIdx;
    ws.mergeCells(`B${curR}:C${curR}`);
    setMatrixHeader(ws.getCell(`B${curR}`), cp.name, false);

    data.personnelList.forEach((p, pIdx) => {
      const colIdx = 4 + pIdx;
      setMatrixDataCell(ws.getRow(curR).getCell(colIdx), p.postCareReview[cp.key], {
        align: "left",
      });
    });
    ws.getRow(curR).height = 35;
  });
  r += 2;

  // Link bài viết tốt
  let maxGoodCount = 2;
  data.personnelList.forEach((p) => {
    const len = p.goodLinks?.length || 0;
    if (len > maxGoodCount) maxGoodCount = len;
  });
  maxGoodCount = Math.min(Math.max(maxGoodCount, 2), 6);

  const goodStartRow = r;
  ws.mergeCells(`A${goodStartRow}:C${goodStartRow + maxGoodCount - 1}`);
  setMatrixHeader(ws.getCell(`A${goodStartRow}`), "Link bài viết tốt", true);

  for (let g = 0; g < maxGoodCount; g++) {
    const curR = goodStartRow + g;
    data.personnelList.forEach((p, pIdx) => {
      const colIdx = 4 + pIdx;
      const link = p.goodLinks ? p.goodLinks[g] : undefined;
      const cell = ws.getRow(curR).getCell(colIdx);
      if (link) {
        setMatrixDataCell(cell, `Link ${g + 1}`, {
          hyperlink: link,
          align: "center",
          bold: true,
        });
      } else {
        setMatrixDataCell(cell, "", { align: "center" });
      }
    });
    ws.getRow(curR).height = 22;
  }
  r += maxGoodCount;

  // Link bài viết viral
  let maxViralCount = 2;
  data.personnelList.forEach((p) => {
    const len = p.viralLinks?.length || 0;
    if (len > maxViralCount) maxViralCount = len;
  });
  maxViralCount = Math.min(Math.max(maxViralCount, 2), 6);

  const viralStartRow = r;
  ws.mergeCells(`A${viralStartRow}:C${viralStartRow + maxViralCount - 1}`);
  setMatrixHeader(ws.getCell(`A${viralStartRow}`), "Link bài viết viral", true);

  for (let v = 0; v < maxViralCount; v++) {
    const curR = viralStartRow + v;
    data.personnelList.forEach((p, pIdx) => {
      const colIdx = 4 + pIdx;
      const link = p.viralLinks ? p.viralLinks[v] : undefined;
      const cell = ws.getRow(curR).getCell(colIdx);
      if (link) {
        setMatrixDataCell(cell, `Link ${v + 1}`, {
          hyperlink: link,
          align: "center",
          bold: true,
        });
      } else {
        setMatrixDataCell(cell, "", { align: "center" });
      }
    });
    ws.getRow(curR).height = 22;
  }
  r += maxViralCount;

  // Row: Link bài chưa tốt
  ws.mergeCells(`A${r}:C${r}`);
  setMatrixHeader(ws.getCell(`A${r}`), "Link bài chưa tốt", true);
  data.personnelList.forEach((p, pIdx) => {
    const colIdx = 4 + pIdx;
    const badText = p.badLinks && p.badLinks.length > 0 ? p.badLinks.join("\n") : "";
    setMatrixDataCell(ws.getRow(r).getCell(colIdx), badText, { align: "left" });
  });
  ws.getRow(r).height = 26;
  r++;

  // Row: Mức thưởng viral dự kiến
  const bonusStartRow = r;
  ws.mergeCells(`A${bonusStartRow}:A${bonusStartRow + 1}`);
  setMatrixHeader(
    ws.getCell(`A${bonusStartRow}`),
    "Mức thưởng viral dự kiến (Ghi rõ mức thưởng và bài/cmt được thưởng)",
    true
  );

  // Dòng chi tiết
  ws.mergeCells(`B${bonusStartRow}:C${bonusStartRow}`);
  setMatrixHeader(ws.getCell(`B${bonusStartRow}`), "Link bài/cmt", false);
  data.personnelList.forEach((p, pIdx) => {
    const colIdx = 4 + pIdx;
    const note = p.viralBonusLinkNote || (p.viralLinks && p.viralLinks.length > 0 ? `${p.viralLinks.length} bài viral` : "");
    setMatrixDataCell(ws.getRow(bonusStartRow).getCell(colIdx), note, { align: "center" });
  });
  ws.getRow(bonusStartRow).height = 24;

  // Dòng tổng tiền thưởng
  const bonusValRow = bonusStartRow + 1;
  ws.mergeCells(`B${bonusValRow}:C${bonusValRow}`);
  setMatrixHeader(ws.getCell(`B${bonusValRow}`), "Mức thưởng dự kiến", true);
  data.personnelList.forEach((p, pIdx) => {
    const colIdx = 4 + pIdx;
    const cell = ws.getRow(bonusValRow).getCell(colIdx);
    setMatrixDataCell(cell, p.viralBonusAmount || 0, {
      align: "center",
      bold: true,
      numFmt: '#,##0" đ"',
      color: p.viralBonusAmount > 0 ? "FFB45309" : undefined,
    });
  });
  ws.getRow(bonusValRow).height = 26;
  r += 2;

  // Row cuối: Đánh giá nhân sự/ tuần (hoặc tháng)
  const finalRatingLabel = isWeek ? "Đánh giá nhân sự/ tuần" : "Đánh giá nhân sự/ tháng";
  ws.mergeCells(`A${r}:C${r}`);
  const finalHeaderCell = ws.getCell(`A${r}`);
  setMatrixHeader(finalHeaderCell, finalRatingLabel, true);
  finalHeaderCell.fill = STYLES.HIGHLIGHT_BG;

  data.personnelList.forEach((p, pIdx) => {
    const colIdx = 4 + pIdx;
    const cell = ws.getRow(r).getCell(colIdx);
    setMatrixDataCell(cell, p.overallRating, {
      align: "center",
      bold: true,
    });
    cell.fill = STYLES.HIGHLIGHT_BG;
  });
  ws.getRow(r).height = 32;

  // Tên file xuất ra máy tính
  const fileName = isWeek
    ? `BAO_CAO_KPI_TUAN_${data.weekNumber || ""}_T${data.month}_${data.year}.xlsx`
    : `BAO_CAO_KPI_THANG_${data.month}_${data.year}.xlsx`;

  await downloadWorkbook(workbook, fileName);
}
