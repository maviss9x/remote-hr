import ExcelJS from "exceljs";

/**
 * Design System & Style Tokens cho File Excel của hệ thống Freetrip
 */
export const EXCEL_FONTS = {
  TITLE: {
    name: "Times New Roman",
    size: 14,
    bold: true,
    color: { argb: "FF000000" },
  } as Partial<ExcelJS.Font>,
  SUBTITLE: {
    name: "Times New Roman",
    size: 11,
    italic: true,
    color: { argb: "FF4B5563" },
  } as Partial<ExcelJS.Font>,
  HEADER: {
    name: "Times New Roman",
    size: 11,
    bold: true,
    color: { argb: "FFFFFFFF" }, // Chữ trắng
  } as Partial<ExcelJS.Font>,
  DATA: {
    name: "Times New Roman",
    size: 11,
    color: { argb: "FF000000" },
  } as Partial<ExcelJS.Font>,
  TOTAL: {
    name: "Times New Roman",
    size: 11,
    bold: true,
    color: { argb: "FF000000" },
  } as Partial<ExcelJS.Font>,
};

export const EXCEL_COLORS = {
  // Dark Slate / Charcoal thanh lịch, tương phản cao với chữ trắng
  HEADER_BG: {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF374151" }, // Tailwind slate-700
  } as ExcelJS.FillPattern,
  HEADER_BG_SECONDARY: {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4B5563" }, // Tailwind slate-600
  } as ExcelJS.FillPattern,
  ZEBRA_BG: {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF9FAFB" },
  } as ExcelJS.FillPattern,
};

export const EXCEL_BORDERS = {
  THIN: {
    top: { style: "thin", color: { argb: "FF9CA3AF" } },
    left: { style: "thin", color: { argb: "FF9CA3AF" } },
    bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
    right: { style: "thin", color: { argb: "FF9CA3AF" } },
  } as Partial<ExcelJS.Borders>,
  THIN_BLACK: {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
  } as Partial<ExcelJS.Borders>,
};

/**
 * Tải file Excel trên trình duyệt
 */
export async function downloadWorkbook(
  workbook: ExcelJS.Workbook,
  fileName: string
): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
