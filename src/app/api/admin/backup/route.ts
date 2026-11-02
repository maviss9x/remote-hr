import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handleBackup(request);
}

export async function GET(request: NextRequest) {
  return handleBackup(request);
}

async function handleBackup(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Chỉ Super Admin mới có quyền sao lưu dữ liệu hệ thống." },
        { status: 403 }
      );
    }

    let types: string[] = [];
    let format = "json";

    if (request.method === "POST") {
      try {
        const body = await request.json();
        types = Array.isArray(body.types) ? body.types : [];
        if (body.format) format = String(body.format).toLowerCase();
      } catch {
        types = [];
      }
    } else {
      const searchParams = request.nextUrl.searchParams;
      const typesParam = searchParams.get("types");
      types = typesParam ? typesParam.split(",").map((s) => s.trim()).filter(Boolean) : [];
      const formatParam = searchParams.get("format");
      if (formatParam) format = formatParam.toLowerCase();
    }

    const isAll = types.includes("all") || types.length === 0;
    const shouldInclude = (key: string) => isAll || types.includes(key);

    const now = new Date();
    const dateStr = now.toISOString().replace(/[-:T]/g, "").slice(0, 14); // YYYYMMDDHHmmss

    // Query các bảng được chọn
    const [
      users,
      contracts,
      shifts,
      dailyReports,
      qcReviews,
      weeklyEvaluations,
      monthlyAcceptances,
      viralPosts,
      kpiConfigs,
      viralBonusTiers,
      shiftScheduleConfigs,
      systemSettings,
    ] = await Promise.all([
      shouldInclude("users")
        ? prisma.user.findMany({
            select: {
              id: true,
              fullName: true,
              phone: true,
              email: true,
              cccd: true,
              bankAccount: true,
              bankName: true,
              role: true,
              status: true,
              startDate: true,
              dateOfBirth: true,
              cccdDate: true,
              cccdPlace: true,
              currentAddress: true,
              permanentAddress: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { id: "asc" },
          })
        : Promise.resolve([]),

      shouldInclude("contracts")
        ? prisma.contract.findMany({
            include: {
              user: {
                select: { id: true, fullName: true, phone: true },
              },
            },
            orderBy: { id: "asc" },
          })
        : Promise.resolve([]),

      shouldInclude("shifts")
        ? prisma.shiftRegistration.findMany({
            include: {
              user: {
                select: { id: true, fullName: true, phone: true },
              },
              loginSession: true,
            },
            orderBy: [{ shiftDate: "desc" }, { id: "asc" }],
          })
        : Promise.resolve([]),

      shouldInclude("reports")
        ? prisma.dailyReport.findMany({
            include: {
              user: {
                select: { id: true, fullName: true, phone: true },
              },
              qcReview: true,
            },
            orderBy: [{ reportDate: "desc" }, { id: "asc" }],
          })
        : Promise.resolve([]),

      shouldInclude("qcs")
        ? prisma.qcReview.findMany({
            include: {
              dailyReport: {
                select: {
                  id: true,
                  reportDate: true,
                  shiftType: true,
                  user: { select: { id: true, fullName: true, phone: true } },
                },
              },
              reviewer: {
                select: { id: true, fullName: true, phone: true },
              },
            },
            orderBy: { id: "desc" },
          })
        : Promise.resolve([]),

      shouldInclude("evaluations")
        ? prisma.weeklyEvaluation.findMany({
            include: {
              user: {
                select: { id: true, fullName: true, phone: true },
              },
            },
            orderBy: [{ year: "desc" }, { weekNumber: "desc" }, { id: "asc" }],
          })
        : Promise.resolve([]),

      shouldInclude("acceptances")
        ? prisma.monthlyAcceptance.findMany({
            include: {
              user: {
                select: { id: true, fullName: true, phone: true },
              },
            },
            orderBy: [{ year: "desc" }, { month: "desc" }, { id: "asc" }],
          })
        : Promise.resolve([]),

      shouldInclude("virals")
        ? prisma.viralPost.findMany({
            include: {
              user: {
                select: { id: true, fullName: true, phone: true },
              },
            },
            orderBy: { id: "desc" },
          })
        : Promise.resolve([]),

      shouldInclude("configs") ? prisma.kpiConfig.findMany({ orderBy: { id: "asc" } }) : Promise.resolve([]),
      shouldInclude("configs") ? prisma.viralBonusTier.findMany({ orderBy: [{ minLikes: "asc" }] }) : Promise.resolve([]),
      shouldInclude("configs") ? prisma.shiftScheduleConfig.findMany({ orderBy: [{ year: "desc" }, { weekNumber: "desc" }] }) : Promise.resolve([]),
      shouldInclude("configs") ? prisma.systemSetting.findMany({ orderBy: { key: "asc" } }) : Promise.resolve([]),
    ]);

    // ==============================================================
    // 1. XUẤT ĐỊNH DẠNG JSON
    // ==============================================================
    if (format === "json") {
      const backupPayload: any = {
        metadata: {
          app: "Remote HR Management System",
          version: "2.0.0",
          exportedAt: now.toISOString(),
          exportedBy: {
            id: currentUser.userId,
            fullName: currentUser.fullName,
            role: currentUser.role,
          },
          selectedTypes: isAll ? ["all"] : types,
          recordCounts: {
            users: users.length,
            contracts: contracts.length,
            shifts: shifts.length,
            dailyReports: dailyReports.length,
            qcReviews: qcReviews.length,
            weeklyEvaluations: weeklyEvaluations.length,
            monthlyAcceptances: monthlyAcceptances.length,
            viralPosts: viralPosts.length,
            kpiConfigs: kpiConfigs.length,
            viralBonusTiers: viralBonusTiers.length,
            shiftScheduleConfigs: shiftScheduleConfigs.length,
            systemSettings: systemSettings.length,
          },
        },
        data: {},
      };

      if (shouldInclude("users")) backupPayload.data.users = users;
      if (shouldInclude("contracts")) backupPayload.data.contracts = contracts;
      if (shouldInclude("shifts")) backupPayload.data.shifts = shifts;
      if (shouldInclude("reports")) backupPayload.data.dailyReports = dailyReports;
      if (shouldInclude("qcs")) backupPayload.data.qcReviews = qcReviews;
      if (shouldInclude("evaluations")) backupPayload.data.weeklyEvaluations = weeklyEvaluations;
      if (shouldInclude("acceptances")) backupPayload.data.monthlyAcceptances = monthlyAcceptances;
      if (shouldInclude("virals")) backupPayload.data.viralPosts = viralPosts;
      if (shouldInclude("configs")) {
        backupPayload.data.configs = {
          kpiConfigs,
          viralBonusTiers,
          shiftScheduleConfigs,
          systemSettings,
        };
      }

      const jsonString = JSON.stringify(backupPayload, null, 2);
      const filename = `backup_freetrip_hr_${dateStr}.json`;

      return new NextResponse(jsonString, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // ==============================================================
    // 2. XUẤT ĐỊNH DẠNG EXCEL MULTI-SHEET (.XLSX)
    // ==============================================================
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Freetrip Remote HR System";
    workbook.created = now;

    const styleHeader = (worksheet: ExcelJS.Worksheet) => {
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F46E5" }, // Indigo 600
      };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.height = 26;

      worksheet.columns.forEach((column) => {
        let maxLength = 10;
        if (column.header) maxLength = Math.max(maxLength, String(column.header).length + 4);
        column.width = Math.min(Math.max(maxLength, 12), 40);
      });
    };

    // Sheet 1: Users
    if (shouldInclude("users") && users.length > 0) {
      const ws = workbook.addWorksheet("1. Nhân sự");
      ws.columns = [
        { header: "Mã NV (ID)", key: "id", width: 12 },
        { header: "Họ và tên", key: "fullName", width: 25 },
        { header: "Số điện thoại", key: "phone", width: 16 },
        { header: "Email", key: "email", width: 25 },
        { header: "CCCD/CMND", key: "cccd", width: 18 },
        { header: "Vai trò", key: "role", width: 18 },
        { header: "Trạng thái", key: "status", width: 16 },
        { header: "Ngày bắt đầu", key: "startDate", width: 16 },
        { header: "Ngày sinh", key: "dateOfBirth", width: 16 },
        { header: "Số tài khoản", key: "bankAccount", width: 20 },
        { header: "Ngân hàng", key: "bankName", width: 20 },
        { header: "Địa chỉ hiện tại", key: "currentAddress", width: 30 },
      ];

      users.forEach((u) => {
        ws.addRow({
          id: u.id,
          fullName: u.fullName,
          phone: u.phone,
          email: u.email || "",
          cccd: u.cccd || "",
          role: u.role,
          status: u.status,
          startDate: u.startDate ? new Date(u.startDate).toISOString().slice(0, 10) : "",
          dateOfBirth: u.dateOfBirth ? new Date(u.dateOfBirth).toISOString().slice(0, 10) : "",
          bankAccount: u.bankAccount || "",
          bankName: u.bankName || "",
          currentAddress: u.currentAddress || "",
        });
      });
      styleHeader(ws);
    }

    // Sheet 2: Contracts
    if (shouldInclude("contracts") && contracts.length > 0) {
      const ws = workbook.addWorksheet("2. Hợp đồng");
      ws.columns = [
        { header: "Mã HĐ", key: "id", width: 10 },
        { header: "Tên nhân sự", key: "userName", width: 25 },
        { header: "Số điện thoại", key: "userPhone", width: 16 },
        { header: "Loại hợp đồng", key: "contractType", width: 18 },
        { header: "Ngày bắt đầu", key: "startDate", width: 16 },
        { header: "Ngày kết thúc", key: "endDate", width: 16 },
        { header: "Trạng thái", key: "status", width: 16 },
        { header: "Ghi chú", key: "note", width: 30 },
      ];

      contracts.forEach((c) => {
        ws.addRow({
          id: c.id,
          userName: c.user?.fullName || "",
          userPhone: c.user?.phone || "",
          contractType: c.contractType,
          startDate: c.startDate ? new Date(c.startDate).toISOString().slice(0, 10) : "",
          endDate: c.endDate ? new Date(c.endDate).toISOString().slice(0, 10) : "",
          status: c.status,
          note: c.note || "",
        });
      });
      styleHeader(ws);
    }

    // Sheet 3: Shifts & Chấm công
    if (shouldInclude("shifts") && shifts.length > 0) {
      const ws = workbook.addWorksheet("3. Ca làm việc & Chấm công");
      ws.columns = [
        { header: "Mã ca", key: "id", width: 10 },
        { header: "Tên nhân sự", key: "userName", width: 25 },
        { header: "Số điện thoại", key: "userPhone", width: 16 },
        { header: "Ngày ca", key: "shiftDate", width: 14 },
        { header: "Loại ca", key: "shiftType", width: 14 },
        { header: "Hình thức", key: "workMode", width: 14 },
        { header: "Trạng thái", key: "status", width: 16 },
        { header: "Tuần / Năm", key: "weekYear", width: 14 },
        { header: "Giờ vào", key: "loginTime", width: 20 },
        { header: "Giờ ra", key: "logoutTime", width: 20 },
        { header: "Trễ (phút)", key: "lateMinutes", width: 12 },
      ];

      shifts.forEach((s) => {
        ws.addRow({
          id: s.id,
          userName: s.user?.fullName || "",
          userPhone: s.user?.phone || "",
          shiftDate: s.shiftDate ? new Date(s.shiftDate).toISOString().slice(0, 10) : "",
          shiftType: s.shiftType,
          workMode: s.workMode,
          status: s.status,
          weekYear: `W${s.weekNumber}-${s.year}`,
          loginTime: s.loginSession?.loginTime ? new Date(s.loginSession.loginTime).toLocaleString("vi-VN") : "",
          logoutTime: s.loginSession?.logoutTime ? new Date(s.loginSession.logoutTime).toLocaleString("vi-VN") : "",
          lateMinutes: s.loginSession?.lateMinutes || 0,
        });
      });
      styleHeader(ws);
    }

    // Sheet 4: Daily Reports
    if (shouldInclude("reports") && dailyReports.length > 0) {
      const ws = workbook.addWorksheet("4. Báo cáo Seeding");
      ws.columns = [
        { header: "Mã BC", key: "id", width: 10 },
        { header: "Tên nhân sự", key: "userName", width: 25 },
        { header: "Số điện thoại", key: "userPhone", width: 16 },
        { header: "Ngày báo cáo", key: "reportDate", width: 14 },
        { header: "Ca", key: "shiftType", width: 12 },
        { header: "Số link FB", key: "fbCount", width: 12 },
        { header: "Số link Threads", key: "threadCount", width: 14 },
        { header: "Drive Comment", key: "driveLink", width: 30 },
        { header: "Kết quả QC", key: "qcResult", width: 14 },
        { header: "Thời gian nộp", key: "submittedAt", width: 20 },
      ];

      dailyReports.forEach((r) => {
        let fbCount = 0;
        let threadCount = 0;
        try {
          fbCount = JSON.parse(r.fbLinks || "[]").length;
          threadCount = JSON.parse(r.threadLinks || "[]").length;
        } catch {}

        ws.addRow({
          id: r.id,
          userName: r.user?.fullName || "",
          userPhone: r.user?.phone || "",
          reportDate: r.reportDate ? new Date(r.reportDate).toISOString().slice(0, 10) : "",
          shiftType: r.shiftType,
          fbCount,
          threadCount,
          driveLink: r.commentDriveLink || "",
          qcResult: r.qcReview?.result || "CHƯA_QC",
          submittedAt: r.submittedAt ? new Date(r.submittedAt).toLocaleString("vi-VN") : "",
        });
      });
      styleHeader(ws);
    }

    // Sheet 5: QC Reviews
    if (shouldInclude("qcs") && qcReviews.length > 0) {
      const ws = workbook.addWorksheet("5. Đánh giá QC");
      ws.columns = [
        { header: "Mã QC", key: "id", width: 10 },
        { header: "Mã BC", key: "dailyReportId", width: 10 },
        { header: "Nhân sự báo cáo", key: "staffName", width: 25 },
        { header: "Người kiểm định", key: "reviewerName", width: 25 },
        { header: "Kết quả", key: "result", width: 16 },
        { header: "FB duyệt", key: "fbApproved", width: 12 },
        { header: "Threads duyệt", key: "threadApproved", width: 14 },
        { header: "Comment duyệt", key: "commentApproved", width: 14 },
        { header: "Phản hồi / Ghi chú", key: "feedback", width: 35 },
        { header: "Thời gian duyệt", key: "reviewedAt", width: 20 },
      ];

      qcReviews.forEach((q) => {
        ws.addRow({
          id: q.id,
          dailyReportId: q.dailyReportId,
          staffName: q.dailyReport?.user?.fullName || "",
          reviewerName: q.reviewer?.fullName || "",
          result: q.result,
          fbApproved: q.fbApproved,
          threadApproved: q.threadApproved,
          commentApproved: q.commentApproved,
          feedback: q.feedback || "",
          reviewedAt: q.reviewedAt ? new Date(q.reviewedAt).toLocaleString("vi-VN") : "",
        });
      });
      styleHeader(ws);
    }

    // Sheet 6: Weekly Evaluations
    if (shouldInclude("evaluations") && weeklyEvaluations.length > 0) {
      const ws = workbook.addWorksheet("6. Đánh giá tuần");
      ws.columns = [
        { header: "Mã ĐG", key: "id", width: 10 },
        { header: "Tên nhân sự", key: "userName", width: 25 },
        { header: "Tuần", key: "weekNumber", width: 10 },
        { header: "Năm", key: "year", width: 10 },
        { header: "Tổng ca", key: "totalShifts", width: 12 },
        { header: "Ca đạt", key: "totalShiftsPassed", width: 12 },
        { header: "Tỷ lệ FB (%)", key: "fbCompletionRate", width: 14 },
        { header: "Tỷ lệ Thread (%)", key: "threadCompletionRate", width: 16 },
        { header: "Thưởng viral (VNĐ)", key: "viralBonus", width: 18 },
        { header: "Xếp loại", key: "overallRating", width: 16 },
      ];

      weeklyEvaluations.forEach((e) => {
        ws.addRow({
          id: e.id,
          userName: e.user?.fullName || "",
          weekNumber: e.weekNumber,
          year: e.year,
          totalShifts: e.totalShifts,
          totalShiftsPassed: e.totalShiftsPassed,
          fbCompletionRate: Math.round(e.fbCompletionRate * 100),
          threadCompletionRate: Math.round(e.threadCompletionRate * 100),
          viralBonus: e.viralBonus,
          overallRating: e.overallRating,
        });
      });
      styleHeader(ws);
    }

    // Sheet 7: Monthly Acceptances
    if (shouldInclude("acceptances") && monthlyAcceptances.length > 0) {
      const ws = workbook.addWorksheet("7. Nghiệm thu tháng");
      ws.columns = [
        { header: "Mã NT", key: "id", width: 10 },
        { header: "Tên nhân sự", key: "userName", width: 25 },
        { header: "Tháng/Năm", key: "monthYear", width: 14 },
        { header: "Tổng bài", key: "totalPosts", width: 12 },
        { header: "Tổng ca", key: "totalShifts", width: 12 },
        { header: "Ca đạt", key: "totalShiftsPassed", width: 12 },
        { header: "Gói nghiệm thu", key: "totalPackages", width: 14 },
        { header: "Thưởng viral (VNĐ)", key: "viralBonus", width: 18 },
        { header: "Trạng thái", key: "status", width: 16 },
      ];

      monthlyAcceptances.forEach((m) => {
        ws.addRow({
          id: m.id,
          userName: m.user?.fullName || "",
          monthYear: `T${m.month}/${m.year}`,
          totalPosts: m.totalPosts,
          totalShifts: m.totalShifts,
          totalShiftsPassed: m.totalShiftsPassed,
          totalPackages: m.totalPackages,
          viralBonus: m.viralBonus,
          status: m.status,
        });
      });
      styleHeader(ws);
    }

    // Sheet 8: Viral Posts
    if (shouldInclude("virals") && viralPosts.length > 0) {
      const ws = workbook.addWorksheet("8. Thưởng Viral");
      ws.columns = [
        { header: "Mã Viral", key: "id", width: 10 },
        { header: "Tên nhân sự", key: "userName", width: 25 },
        { header: "Nền tảng", key: "platform", width: 14 },
        { header: "Link bài viết", key: "postUrl", width: 35 },
        { header: "Số like / tương tác", key: "likes", width: 18 },
        { header: "Tiền thưởng (VNĐ)", key: "bonusAmount", width: 18 },
        { header: "Ca làm việc", key: "shiftType", width: 12 },
        { header: "Thời gian nộp", key: "submittedAt", width: 20 },
      ];

      viralPosts.forEach((v) => {
        ws.addRow({
          id: v.id,
          userName: v.user?.fullName || "",
          platform: v.platform,
          postUrl: v.postUrl,
          likes: v.likes,
          bonusAmount: v.bonusAmount,
          shiftType: v.shiftType,
          submittedAt: v.submittedAt ? new Date(v.submittedAt).toLocaleString("vi-VN") : "",
        });
      });
      styleHeader(ws);
    }

    // Sheet 9: Configs
    if (shouldInclude("configs")) {
      const ws = workbook.addWorksheet("9. Cấu hình hệ thống");
      ws.columns = [
        { header: "Nhóm cấu hình", key: "group", width: 22 },
        { header: "Khóa / Mô tả", key: "key", width: 25 },
        { header: "Giá trị", key: "value", width: 45 },
      ];

      kpiConfigs.forEach((k) => {
        ws.addRow({
          group: "KPI Chỉ tiêu",
          key: `ID #${k.id}`,
          value: `FB: ${k.fbPerShift}, Threads: ${k.threadPerShift}, Comments: ${k.commentPerShift}, Min shifts: ${k.minShiftsPerWeek}`,
        });
      });

      viralBonusTiers.forEach((t) => {
        ws.addRow({
          group: "Khung thưởng viral",
          key: `${t.platform} (${t.contentType}) >= ${t.minLikes} likes`,
          value: `${t.bonusAmount.toLocaleString("vi-VN")} VNĐ`,
        });
      });

      systemSettings.forEach((s) => {
        ws.addRow({
          group: "Cài đặt chung",
          key: s.key,
          value: s.value,
        });
      });
      styleHeader(ws);
    }

    // Nếu workbook không có sheet nào (ví dụ không có dữ liệu nào khớp)
    if (workbook.worksheets.length === 0) {
      const ws = workbook.addWorksheet("Thông báo");
      ws.addRow(["Không có dữ liệu tương ứng với bộ lọc đã chọn"]);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `backup_freetrip_hr_${dateStr}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("Lỗi khi tạo sao lưu dữ liệu:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: `Không thể tạo bản sao lưu: ${err.message || String(err)}` },
      { status: 500 }
    );
  }
}
