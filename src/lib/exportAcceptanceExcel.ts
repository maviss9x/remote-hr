import ExcelJS from "exceljs";

export interface AcceptanceExcelItem {
  stt?: number;
  user: {
    fullName: string;
    phone?: string;
  };
  totalPosts: number;
  totalComments: number;
  totalShiftsPassed?: number;
  morningHours?: number;
  afternoonHours?: number;
  eveningHours?: number;
  totalBaseSalary?: number;
  viralBonus?: number;
  totalSalaryAndBonus?: number;
}

export interface AcceptanceExcelSummary {
  totalPosts?: number;
  totalComments?: number;
  totalShiftsPassed?: number;
  totalMorningHours?: number;
  totalAfternoonHours?: number;
  totalEveningHours?: number;
  totalBaseSalary?: number;
  totalViralBonus?: number;
  totalSalaryAndBonus?: number;
}

interface ExportAcceptanceExcelOptions {
  month: number;
  year: number;
  items: AcceptanceExcelItem[];
  summary?: AcceptanceExcelSummary | null;
}

export async function exportAcceptanceExcel({
  month,
  year,
  items,
  summary,
}: ExportAcceptanceExcelOptions): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hệ Thống Quản Lý Remote - Freetrip";
  workbook.created = new Date();

  const sheetName = `NghiemThu_T${String(month).padStart(2, "0")}_${year}`;
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.5,
        right: 0.5,
        top: 0.7,
        bottom: 0.7,
        header: 0.3,
        footer: 0.3,
      },
    },
  });

  // Độ rộng các cột chuẩn theo mẫu Excel
  worksheet.columns = [
    { key: "stt", width: 8 }, // STT (Col 1)
    { key: "fullName", width: 28 }, // Họ và tên (Col 2)
    { key: "posts", width: 16 }, // Số lượng bài viết (Col 3)
    { key: "comments", width: 16 }, // Số lượng bình luận (Col 4)
    { key: "shifts", width: 16 }, // Tổng số ca làm (Col 5)
    { key: "morningHours", width: 19.7 }, // Ca sáng (Col 6)
    { key: "afternoonHours", width: 19.7 }, // Ca chiều (Col 7)
    { key: "eveningHours", width: 19.7 }, // Ca tối (Col 8)
    { key: "baseSalary", width: 20.7 }, // Thù lao (Col 9)
    { key: "bonus", width: 20.7 }, // Thưởng (Col 10)
    { key: "actualSalary", width: 20.7 }, // Thực nhận (Col 11)
  ];

  // Định dạng viền ô mỏng đen chuẩn
  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
  };

  // Font chuẩn Times New Roman
  const fontTitle: Partial<ExcelJS.Font> = {
    name: "Times New Roman",
    size: 14,
    bold: true,
    color: { argb: "FF000000" },
  };

  const fontSubtitle: Partial<ExcelJS.Font> = {
    name: "Times New Roman",
    size: 12,
    italic: true,
    color: { argb: "FF000000" },
  };

  const fontHeader: Partial<ExcelJS.Font> = {
    name: "Times New Roman",
    size: 12,
    bold: true,
    color: { argb: "FFFFFFFF" }, // Chữ trắng
  };

  const fontData: Partial<ExcelJS.Font> = {
    name: "Times New Roman",
    size: 12,
    color: { argb: "FF000000" },
  };

  const fontTotal: Partial<ExcelJS.Font> = {
    name: "Times New Roman",
    size: 12,
    bold: true,
    color: { argb: "FF000000" },
  };

  // Màu nền Dark Charcoal (#404040) cho Header chuẩn file mẫu
  const headerFill: ExcelJS.FillPattern = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF404040" },
  };

  // Dòng 1: Tiêu đề chính (Merge A1:K1)
  worksheet.mergeCells("A1:K1");
  const titleRow = worksheet.getCell("A1");
  titleRow.value = "BIÊN BẢN NGHIỆM THU CÔNG VIỆC - REMOTE";
  titleRow.font = fontTitle;
  titleRow.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(1).height = 28;

  // Dòng 2: Thời gian Tháng/Năm (Merge A2:K2)
  worksheet.mergeCells("A2:K2");
  const subtitleRow = worksheet.getCell("A2");
  subtitleRow.value = `Tháng: ${String(month).padStart(2, "0")} / Năm: ${year}`;
  subtitleRow.font = fontSubtitle;
  subtitleRow.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(2).height = 20;

  // Thiết lập chiều cao cho Header 2 tầng (Row 3 & Row 4)
  worksheet.getRow(3).height = 36;
  worksheet.getRow(4).height = 36;

  // Khởi tạo các ô header để áp dụng viền và màu nền trước khi merge
  for (let r = 3; r <= 4; r++) {
    for (let c = 1; c <= 11; c++) {
      const cell = worksheet.getRow(r).getCell(c);
      cell.fill = headerFill;
      cell.font = fontHeader;
      cell.border = borderThin;
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    }
  }

  // Row 3 text
  worksheet.getCell("A3").value = "STT";
  worksheet.getCell("B3").value = "Họ và tên";
  worksheet.getCell("C3").value = "Số lượng\nbài viết";
  worksheet.getCell("D3").value = "Số lượng\nbình luận";
  worksheet.getCell("E3").value = "Tổng số ca làm";
  worksheet.getCell("F3").value = "Tổng giờ làm việc";
  worksheet.getCell("I3").value = "Thù lao";
  worksheet.getCell("J3").value = "Thưởng";
  worksheet.getCell("K3").value = "Thực nhận";

  // Row 4 sub-headers cho cột F, G, H
  worksheet.getCell("F4").value = "Ca sáng";
  worksheet.getCell("G4").value = "Ca chiều";
  worksheet.getCell("H4").value = "Ca tối";

  // Merges chuẩn cho header 2 tầng
  worksheet.mergeCells("A3:A4"); // STT
  worksheet.mergeCells("B3:B4"); // Họ và tên
  worksheet.mergeCells("C3:C4"); // Số lượng bài viết
  worksheet.mergeCells("D3:D4"); // Số lượng bình luận
  worksheet.mergeCells("E3:E4"); // Tổng số ca làm
  worksheet.mergeCells("F3:H3"); // Tổng giờ làm việc (gom Ca sáng, Ca chiều, Ca tối)
  worksheet.mergeCells("I3:I4"); // Thù lao
  worksheet.mergeCells("J3:J4"); // Thưởng
  worksheet.mergeCells("K3:K4"); // Thực nhận

  // Đảm bảo border đầy đủ cho tất cả các ô trong vùng header sau merge
  for (let r = 3; r <= 4; r++) {
    for (let c = 1; c <= 11; c++) {
      worksheet.getRow(r).getCell(c).border = borderThin;
    }
  }

  // Thêm các dòng dữ liệu nhân sự bắt đầu từ Row 5
  items.forEach((item, index) => {
    const rowNumber = 5 + index;
    const row = worksheet.getRow(rowNumber);
    row.height = 25;

    // 1. STT
    const cellSTT = row.getCell(1);
    cellSTT.value = index + 1;
    cellSTT.font = fontData;
    cellSTT.alignment = { vertical: "middle", horizontal: "center" };
    cellSTT.border = borderThin;

    // 2. Họ và tên
    const cellName = row.getCell(2);
    cellName.value = item.user.fullName;
    cellName.font = fontData;
    cellName.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    cellName.border = borderThin;

    // 3. Số lượng bài viết
    const cellPosts = row.getCell(3);
    cellPosts.value = item.totalPosts || 0;
    cellPosts.font = fontData;
    cellPosts.alignment = { vertical: "middle", horizontal: "center" };
    cellPosts.numFmt = "#,##0";
    cellPosts.border = borderThin;

    // 4. Số lượng bình luận
    const cellComments = row.getCell(4);
    cellComments.value = item.totalComments || 0;
    cellComments.font = fontData;
    cellComments.alignment = { vertical: "middle", horizontal: "center" };
    cellComments.numFmt = "#,##0";
    cellComments.border = borderThin;

    // 5. Tổng số ca làm
    const cellShifts = row.getCell(5);
    cellShifts.value = item.totalShiftsPassed ?? 0;
    cellShifts.font = fontData;
    cellShifts.alignment = { vertical: "middle", horizontal: "center" };
    cellShifts.numFmt = "#,##0";
    cellShifts.border = borderThin;

    // 6. Ca sáng (Giờ làm)
    const cellMorning = row.getCell(6);
    const morningHours = item.morningHours ?? 0;
    cellMorning.value = morningHours > 0 ? morningHours : "";
    cellMorning.font = fontData;
    cellMorning.alignment = { vertical: "middle", horizontal: "center" };
    if (morningHours > 0) cellMorning.numFmt = "#,##0";
    cellMorning.border = borderThin;

    // 7. Ca chiều (Giờ làm)
    const cellAfternoon = row.getCell(7);
    const afternoonHours = item.afternoonHours ?? 0;
    cellAfternoon.value = afternoonHours > 0 ? afternoonHours : "";
    cellAfternoon.font = fontData;
    cellAfternoon.alignment = { vertical: "middle", horizontal: "center" };
    if (afternoonHours > 0) cellAfternoon.numFmt = "#,##0";
    cellAfternoon.border = borderThin;

    // 8. Ca tối (Giờ làm)
    const cellEvening = row.getCell(8);
    const eveningHours = item.eveningHours ?? 0;
    cellEvening.value = eveningHours > 0 ? eveningHours : "";
    cellEvening.font = fontData;
    cellEvening.alignment = { vertical: "middle", horizontal: "center" };
    if (eveningHours > 0) cellEvening.numFmt = "#,##0";
    cellEvening.border = borderThin;

    // 9. Thù lao (Base salary)
    const cellSalary = row.getCell(9);
    const baseSalary = item.totalBaseSalary ?? 0;
    cellSalary.value = baseSalary > 0 ? baseSalary : "";
    cellSalary.font = fontData;
    cellSalary.alignment = { vertical: "middle", horizontal: "right" };
    if (baseSalary > 0) cellSalary.numFmt = "#,##0";
    cellSalary.border = borderThin;

    // 10. Thưởng (Viral bonus)
    const cellBonus = row.getCell(10);
    const bonus = item.viralBonus ?? 0;
    cellBonus.value = bonus > 0 ? bonus : "";
    cellBonus.font = fontData;
    cellBonus.alignment = { vertical: "middle", horizontal: "right" };
    if (bonus > 0) cellBonus.numFmt = "#,##0";
    cellBonus.border = borderThin;

    // 11. Thực nhận (Tổng thù lao + thưởng)
    const cellActual = row.getCell(11);
    const actualSalary = item.totalSalaryAndBonus ?? 0;
    cellActual.value = actualSalary > 0 ? actualSalary : "";
    cellActual.font = fontData;
    cellActual.alignment = { vertical: "middle", horizontal: "right" };
    if (actualSalary > 0) cellActual.numFmt = "#,##0";
    cellActual.border = borderThin;
  });

  // Hàng Tổng cộng
  const summaryRowIndex = 5 + items.length;
  const summaryRow = worksheet.getRow(summaryRowIndex);
  summaryRow.height = 26;

  // Merge cột STT và Họ và tên thành ô "Tổng cộng"
  worksheet.mergeCells(`A${summaryRowIndex}:B${summaryRowIndex}`);
  const totalLabelCell = worksheet.getCell(`A${summaryRowIndex}`);
  totalLabelCell.value = "Tổng cộng";
  totalLabelCell.font = fontTotal;
  totalLabelCell.alignment = { vertical: "middle", horizontal: "center" };
  totalLabelCell.border = borderThin;
  worksheet.getCell(`B${summaryRowIndex}`).border = borderThin;

  // Tổng số lượng bài viết (Col 3)
  const totalPostsCell = summaryRow.getCell(3);
  totalPostsCell.value = summary?.totalPosts ?? 0;
  totalPostsCell.font = fontTotal;
  totalPostsCell.alignment = { vertical: "middle", horizontal: "center" };
  totalPostsCell.numFmt = "#,##0";
  totalPostsCell.border = borderThin;

  // Tổng số lượng bình luận (Col 4)
  const totalCommentsCell = summaryRow.getCell(4);
  totalCommentsCell.value = summary?.totalComments ?? 0;
  totalCommentsCell.font = fontTotal;
  totalCommentsCell.alignment = { vertical: "middle", horizontal: "center" };
  totalCommentsCell.numFmt = "#,##0";
  totalCommentsCell.border = borderThin;

  // Tổng số ca làm (Col 5)
  const totalShiftsCell = summaryRow.getCell(5);
  totalShiftsCell.value = summary?.totalShiftsPassed ?? 0;
  totalShiftsCell.font = fontTotal;
  totalShiftsCell.alignment = { vertical: "middle", horizontal: "center" };
  totalShiftsCell.numFmt = "#,##0";
  totalShiftsCell.border = borderThin;

  // Tổng Ca sáng (Col 6)
  const totalMorningCell = summaryRow.getCell(6);
  const sumMorning = summary?.totalMorningHours ?? 0;
  totalMorningCell.value = sumMorning > 0 ? sumMorning : "";
  totalMorningCell.font = fontTotal;
  totalMorningCell.alignment = { vertical: "middle", horizontal: "center" };
  if (sumMorning > 0) totalMorningCell.numFmt = "#,##0";
  totalMorningCell.border = borderThin;

  // Tổng Ca chiều (Col 7)
  const totalAfternoonCell = summaryRow.getCell(7);
  const sumAfternoon = summary?.totalAfternoonHours ?? 0;
  totalAfternoonCell.value = sumAfternoon > 0 ? sumAfternoon : "";
  totalAfternoonCell.font = fontTotal;
  totalAfternoonCell.alignment = { vertical: "middle", horizontal: "center" };
  if (sumAfternoon > 0) totalAfternoonCell.numFmt = "#,##0";
  totalAfternoonCell.border = borderThin;

  // Tổng Ca tối (Col 8)
  const totalEveningCell = summaryRow.getCell(8);
  const sumEvening = summary?.totalEveningHours ?? 0;
  totalEveningCell.value = sumEvening > 0 ? sumEvening : "";
  totalEveningCell.font = fontTotal;
  totalEveningCell.alignment = { vertical: "middle", horizontal: "center" };
  if (sumEvening > 0) totalEveningCell.numFmt = "#,##0";
  totalEveningCell.border = borderThin;

  // Tổng Thù lao (Col 9)
  const totalSalaryCell = summaryRow.getCell(9);
  const sumBaseSalary = summary?.totalBaseSalary ?? 0;
  totalSalaryCell.value = sumBaseSalary > 0 ? sumBaseSalary : "";
  totalSalaryCell.font = fontTotal;
  totalSalaryCell.alignment = { vertical: "middle", horizontal: "right" };
  if (sumBaseSalary > 0) totalSalaryCell.numFmt = "#,##0";
  totalSalaryCell.border = borderThin;

  // Tổng Thưởng (Col 10)
  const totalBonusCell = summaryRow.getCell(10);
  const sumBonus = summary?.totalViralBonus ?? 0;
  totalBonusCell.value = sumBonus > 0 ? sumBonus : "";
  totalBonusCell.font = fontTotal;
  totalBonusCell.alignment = { vertical: "middle", horizontal: "right" };
  if (sumBonus > 0) totalBonusCell.numFmt = "#,##0";
  totalBonusCell.border = borderThin;

  // Tổng Thực nhận (Col 11)
  const totalActualCell = summaryRow.getCell(11);
  const sumActual = summary?.totalSalaryAndBonus ?? 0;
  totalActualCell.value = sumActual > 0 ? sumActual : "";
  totalActualCell.font = fontTotal;
  totalActualCell.alignment = { vertical: "middle", horizontal: "right" };
  if (sumActual > 0) totalActualCell.numFmt = "#,##0";
  totalActualCell.border = borderThin;

  // Xuất file và tải về trên trình duyệt
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `Bien_Ban_Nghiem_Thu_Freetrip_T${String(month).padStart(2, "0")}_${year}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
