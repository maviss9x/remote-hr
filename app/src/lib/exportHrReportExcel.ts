import ExcelJS from "exceljs";
import {
  EXCEL_FONTS,
  EXCEL_COLORS,
  EXCEL_BORDERS,
  downloadWorkbook,
} from "./excelStyles";

export interface FluctuationItem {
  fullName: string;
  phone: string;
  role: string;
  status: string;
  probationStartDate?: string | null;
  contractStartDate?: string | null;
  leaveDate?: string | null;
  contractEndDate?: string | null;
  isInput?: boolean;
  isOutput?: boolean;
}

export interface AttendanceItem {
  fullName: string;
  phone: string;
  role: string;
  totalRegistered: number;
  attended: number;
  absent: number;
  lateCount: number;
  passQcCount: number;
  attendanceRate: number;
}

export interface AbsentItem {
  fullName: string;
  phone: string;
  role: string;
  absent: number;
  totalRegistered: number;
}

interface ExportHrReportOptions {
  month: number;
  year: number;
  formatDate: (d?: string | null) => string;
  fluctuations: FluctuationItem[];
  attendances: AttendanceItem[];
  absents: AbsentItem[];
}

export async function exportHrReportExcel({
  month,
  year,
  formatDate,
  fluctuations,
  attendances,
  absents,
}: ExportHrReportOptions): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hệ Thống Quản Lý Remote - Freetrip";
  workbook.created = new Date();

  const formattedMonth = String(month).padStart(2, "0");

  // ==========================================
  // SHEET 1: BIẾN ĐỘNG NHÂN SỰ
  // ==========================================
  const ws1 = workbook.addWorksheet("Biến Động Nhân Sự", {
    views: [{ showGridLines: true }],
  });

  ws1.columns = [
    { key: "stt", width: 7 },
    { key: "fullName", width: 28 },
    { key: "phone", width: 15 },
    { key: "role", width: 18 },
    { key: "status", width: 18 },
    { key: "probationStart", width: 18 },
    { key: "contractStart", width: 18 },
    { key: "endDate", width: 22 },
    { key: "changeType", width: 22 },
  ];

  // Header Tiêu đề
  ws1.mergeCells("A1:I1");
  const title1 = ws1.getCell("A1");
  title1.value = "BÁO CÁO BIẾN ĐỘNG NHÂN SỰ";
  title1.font = EXCEL_FONTS.TITLE;
  title1.alignment = { vertical: "middle", horizontal: "center" };
  ws1.getRow(1).height = 28;

  ws1.mergeCells("A2:I2");
  const sub1 = ws1.getCell("A2");
  sub1.value = `Tháng: ${formattedMonth} / Năm: ${year}`;
  sub1.font = EXCEL_FONTS.SUBTITLE;
  sub1.alignment = { vertical: "middle", horizontal: "center" };
  ws1.getRow(2).height = 20;

  // Dòng Header
  const headers1 = [
    "STT",
    "Họ và tên",
    "Số điện thoại",
    "Chức vụ",
    "Trạng thái",
    "Bắt đầu thử việc",
    "Ký hợp đồng",
    "Hết hạn HĐ / Ngày nghỉ",
    "Loại biến động",
  ];

  const headerRow1 = ws1.getRow(3);
  headerRow1.height = 30;
  headers1.forEach((text, i) => {
    const cell = headerRow1.getCell(i + 1);
    cell.value = text;
    cell.font = EXCEL_FONTS.HEADER;
    cell.fill = EXCEL_COLORS.HEADER_BG;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = EXCEL_BORDERS.THIN_BLACK;
  });

  fluctuations.forEach((item, idx) => {
    const row = ws1.getRow(4 + idx);
    row.height = 24;

    const changeTypeText = item.isInput
      ? "Đầu vào (Mới)"
      : item.isOutput
      ? "Đầu ra (Đã nghỉ)"
      : "Đang làm việc";

    const values = [
      idx + 1,
      item.fullName,
      item.phone,
      item.role,
      item.status,
      formatDate(item.probationStartDate),
      formatDate(item.contractStartDate),
      formatDate(item.leaveDate || item.contractEndDate),
      changeTypeText,
    ];

    values.forEach((val, i) => {
      const cell = row.getCell(i + 1);
      cell.value = val;
      cell.font = EXCEL_FONTS.DATA;
      cell.border = EXCEL_BORDERS.THIN;
      if (i === 0 || i === 2 || i === 5 || i === 6 || i === 7 || i === 8) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
    });
  });

  // ==========================================
  // SHEET 2: BÁO CÁO CHUYÊN CẦN & ĐI LÀM
  // ==========================================
  const ws2 = workbook.addWorksheet("Chuyên Cần Đi Làm", {
    views: [{ showGridLines: true }],
  });

  ws2.columns = [
    { key: "stt", width: 7 },
    { key: "fullName", width: 28 },
    { key: "phone", width: 15 },
    { key: "role", width: 18 },
    { key: "totalRegistered", width: 16 },
    { key: "attended", width: 18 },
    { key: "absent", width: 16 },
    { key: "lateCount", width: 16 },
    { key: "passQcCount", width: 16 },
    { key: "attendanceRate", width: 18 },
    { key: "status", width: 16 },
  ];

  ws2.mergeCells("A1:K1");
  const title2 = ws2.getCell("A1");
  title2.value = "BÁO CÁO CHUYÊN CẦN & ĐI LÀM";
  title2.font = EXCEL_FONTS.TITLE;
  title2.alignment = { vertical: "middle", horizontal: "center" };
  ws2.getRow(1).height = 28;

  ws2.mergeCells("A2:K2");
  const sub2 = ws2.getCell("A2");
  sub2.value = `Tháng: ${formattedMonth} / Năm: ${year}`;
  sub2.font = EXCEL_FONTS.SUBTITLE;
  sub2.alignment = { vertical: "middle", horizontal: "center" };
  ws2.getRow(2).height = 20;

  const headers2 = [
    "STT",
    "Họ và tên",
    "Số điện thoại",
    "Chức vụ",
    "Tổng ca đăng ký",
    "Ca đi làm thực tế",
    "Ca nghỉ / Vắng",
    "Số lần đi muộn",
    "Ca đạt QC",
    "Tỉ lệ đi làm",
    "Tình trạng",
  ];

  const headerRow2 = ws2.getRow(3);
  headerRow2.height = 30;
  headers2.forEach((text, i) => {
    const cell = headerRow2.getCell(i + 1);
    cell.value = text;
    cell.font = EXCEL_FONTS.HEADER;
    cell.fill = EXCEL_COLORS.HEADER_BG;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = EXCEL_BORDERS.THIN_BLACK;
  });

  attendances.forEach((item, idx) => {
    const row = ws2.getRow(4 + idx);
    row.height = 24;

    const values = [
      idx + 1,
      item.fullName,
      item.phone,
      item.role,
      item.totalRegistered,
      item.attended,
      item.absent,
      item.lateCount,
      item.passQcCount,
      `${item.attendanceRate}%`,
      item.attended > 0 ? "Có đi làm" : "Không đi làm",
    ];

    values.forEach((val, i) => {
      const cell = row.getCell(i + 1);
      cell.value = val;
      cell.font = EXCEL_FONTS.DATA;
      cell.border = EXCEL_BORDERS.THIN;
      if (i === 1) {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
    });
  });

  // ==========================================
  // SHEET 3: DANH SÁCH NHÂN SỰ NGHỈ VẮNG
  // ==========================================
  const ws3 = workbook.addWorksheet("Nhân Sự Nghỉ Vắng", {
    views: [{ showGridLines: true }],
  });

  ws3.columns = [
    { key: "stt", width: 7 },
    { key: "fullName", width: 28 },
    { key: "phone", width: 15 },
    { key: "role", width: 18 },
    { key: "absent", width: 16 },
    { key: "totalRegistered", width: 18 },
    { key: "reason", width: 32 },
  ];

  ws3.mergeCells("A1:G1");
  const title3 = ws3.getCell("A1");
  title3.value = "DANH SÁCH NHÂN SỰ NGHỈ / VẮNG CA";
  title3.font = EXCEL_FONTS.TITLE;
  title3.alignment = { vertical: "middle", horizontal: "center" };
  ws3.getRow(1).height = 28;

  ws3.mergeCells("A2:G2");
  const sub3 = ws3.getCell("A2");
  sub3.value = `Tháng: ${formattedMonth} / Năm: ${year}`;
  sub3.font = EXCEL_FONTS.SUBTITLE;
  sub3.alignment = { vertical: "middle", horizontal: "center" };
  ws3.getRow(2).height = 20;

  const headers3 = [
    "STT",
    "Họ và tên",
    "Số điện thoại",
    "Chức vụ",
    "Số ca vắng",
    "Tổng ca đăng ký",
    "Lý do ghi nhận",
  ];

  const headerRow3 = ws3.getRow(3);
  headerRow3.height = 30;
  headers3.forEach((text, i) => {
    const cell = headerRow3.getCell(i + 1);
    cell.value = text;
    cell.font = EXCEL_FONTS.HEADER;
    cell.fill = EXCEL_COLORS.HEADER_BG;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = EXCEL_BORDERS.THIN_BLACK;
  });

  absents.forEach((item, idx) => {
    const row = ws3.getRow(4 + idx);
    row.height = 24;

    const values = [
      idx + 1,
      item.fullName,
      item.phone,
      item.role,
      item.absent,
      item.totalRegistered,
      item.absent > 0 ? "Vắng ca đăng ký" : "Không đăng ký ca trong tháng",
    ];

    values.forEach((val, i) => {
      const cell = row.getCell(i + 1);
      cell.value = val;
      cell.font = EXCEL_FONTS.DATA;
      cell.border = EXCEL_BORDERS.THIN;
      if (i === 1 || i === 6) {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
    });
  });

  // Tải file về máy
  await downloadWorkbook(
    workbook,
    `Bao_Cao_Nhan_Su_Thang_${formattedMonth}_${year}.xlsx`
  );
}
