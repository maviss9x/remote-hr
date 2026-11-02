import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseExcelDate,
  normalizeShiftType,
  normalizeWorkMode,
  findUserByIdentifier,
  UserLookupItem,
} from "@/lib/importParsers";
import { getISOWeekAndYear } from "@/lib/dateUtils";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Chỉ Super Admin mới có quyền thực hiện thao tác này." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = (formData.get("type") as string) || "nhan-su";
    const requestedSheet = (formData.get("sheetName") as string) || "";

    if (!file) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Vui lòng chọn tệp để tải lên." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Lấy danh sách users hiện có trong DB để đối chiếu
    const dbUsers: UserLookupItem[] = await prisma.user.findMany({
      select: { id: true, fullName: true, phone: true, email: true, role: true },
    });

    const errors: Array<{ row: number; message: string; details?: string }> = [];
    const parsedData: any[] = [];

    // ==============================================================
    // 0. XỬ LÝ ĐỊNH DẠNG JSON ALL-IN-ONE
    // ==============================================================
    if (type === "json-all-in-one") {
      let parsedJson: any;
      try {
        const text = buffer.toString("utf-8");
        parsedJson = JSON.parse(text);
      } catch (err: any) {
        return NextResponse.json(
          { error: "INVALID_JSON", message: `Tệp JSON không hợp lệ hoặc bị lỗi cú pháp: ${err.message}` },
          { status: 400 }
        );
      }

      let rawList: any[] = [];
      if (Array.isArray(parsedJson)) {
        rawList = parsedJson;
      } else if (Array.isArray(parsedJson.data)) {
        rawList = parsedJson.data;
      } else if (Array.isArray(parsedJson.personnel)) {
        rawList = parsedJson.personnel;
      } else {
        return NextResponse.json(
          {
            error: "INVALID_STRUCTURE",
            message: "Cấu trúc JSON không hợp lệ. Mong đợi một mảng danh sách nhân sự [ { info, shifts, reports, ... } ].",
          },
          { status: 400 }
        );
      }

      let totalShifts = 0;
      let totalReports = 0;
      let totalViralPosts = 0;
      let totalAcceptances = 0;

      const seenPhones = new Set<string>();

      for (let i = 0; i < rawList.length; i++) {
        const item = rawList[i];
        const rowNum = i + 1;
        const info = item.info || item;

        const rawName = info.name || info.fullName || "";
        const rawPhone = String(info.phone || "").trim();
        const cleanPhone = rawPhone.replace(/\D/g, "");

        if (!rawName) {
          errors.push({ row: rowNum, message: `Nhân sự thứ #${rowNum}: Thiếu thông tin họ tên ('name' hoặc 'fullName').` });
          continue;
        }

        if (!cleanPhone || cleanPhone.length < 9) {
          errors.push({ row: rowNum, message: `Nhân sự "${rawName}": Số điện thoại không hợp lệ ("${rawPhone}").` });
          continue;
        }

        if (seenPhones.has(cleanPhone)) {
          errors.push({ row: rowNum, message: `Nhân sự "${rawName}": Số điện thoại "${cleanPhone}" bị trùng lặp trong tệp JSON.` });
          continue;
        }
        seenPhones.add(cleanPhone);

        const existingDbUser = dbUsers.find((u) => u.phone.replace(/\D/g, "") === cleanPhone);

        // Normalize contracts
        const contracts = Array.isArray(item.contracts) ? item.contracts : [];

        // Normalize shifts
        const rawShifts = Array.isArray(item.shifts) ? item.shifts : [];
        const shifts = rawShifts
          .map((s: any) => {
            const sDate = parseExcelDate(s.shiftDate) || s.shiftDate;
            const sType = normalizeShiftType(s.shiftType) || "MORNING";
            const wMode = normalizeWorkMode(s.workMode);
            const weekInfo = sDate ? getISOWeekAndYear(new Date(`${sDate}T00:00:00Z`)) : { weekNumber: 1, year: 2026 };
            return {
              shiftDate: sDate,
              shiftType: sType,
              workMode: wMode,
              status: ["REGISTERED", "COMPLETED", "ABSENT", "CANCELLED"].includes(s.status) ? s.status : "COMPLETED",
              weekNumber: s.weekNumber || weekInfo.weekNumber,
              year: s.year || weekInfo.year,
              note: s.note || "Nạp từ JSON All-In-One",
            };
          })
          .filter((s: any) => !!s.shiftDate);

        // Normalize reports
        const rawReports = Array.isArray(item.reports) ? item.reports : [];
        const reports = rawReports
          .map((r: any) => {
            const rDate = parseExcelDate(r.reportDate) || r.reportDate;
            const sType = normalizeShiftType(r.shiftType) || "MORNING";
            const weekInfo = rDate ? getISOWeekAndYear(new Date(`${rDate}T00:00:00Z`)) : { weekNumber: 1, year: 2026 };
            const qc = r.qcReview || {};
            return {
              reportDate: rDate,
              shiftType: sType,
              fbLinks: Array.isArray(r.fbLinks) ? r.fbLinks : [],
              threadLinks: Array.isArray(r.threadLinks) ? r.threadLinks : [],
              commentDriveLink: r.commentDriveLink || null,
              femaleContentLinks: Array.isArray(r.femaleContentLinks) ? r.femaleContentLinks : [],
              viralPostLinks: Array.isArray(r.viralPostLinks) ? r.viralPostLinks : [],
              fbApproved: qc.fbApproved ?? (Array.isArray(r.fbLinks) ? r.fbLinks.length : 10),
              threadApproved: qc.threadApproved ?? (Array.isArray(r.threadLinks) ? r.threadLinks.length : 4),
              commentApproved: qc.commentApproved ?? 50,
              qcResult: qc.result || "PASS",
              qcFeedback: qc.feedback || null,
              weekNumber: weekInfo.weekNumber,
              year: weekInfo.year,
            };
          })
          .filter((r: any) => !!r.reportDate);

        // Normalize viral posts
        const rawViral = Array.isArray(item.viralPosts) ? item.viralPosts : [];
        const viralPosts = rawViral
          .map((v: any) => {
            return {
              postUrl: v.postUrl,
              platform: String(v.platform || "").toUpperCase().includes("THREAD") ? "THREADS" : "FACEBOOK",
              contentType: String(v.contentType || "").toUpperCase().includes("COMMENT") ? "COMMENT" : "POST",
              likes: Number(v.likes || 0),
              bonusAmount: Number(v.bonusAmount || 0),
              submittedAt: parseExcelDate(v.submittedAt) || v.submittedAt || new Date().toISOString().slice(0, 10),
              shiftType: normalizeShiftType(v.shiftType) || "MORNING",
            };
          })
          .filter((v: any) => !!v.postUrl);

        // Normalize monthly acceptances
        const monthlyAcceptances = Array.isArray(item.monthlyAcceptances) ? item.monthlyAcceptances : [];

        totalShifts += shifts.length;
        totalReports += reports.length;
        totalViralPosts += viralPosts.length;
        totalAcceptances += monthlyAcceptances.length;

        parsedData.push({
          row: rowNum,
          info: {
            fullName: rawName,
            phone: cleanPhone,
            email: info.email || null,
            cccd: info.cccd || null,
            dateOfBirth: parseExcelDate(info.dob || info.dateOfBirth) || null,
            startDate: parseExcelDate(info.startDate) || new Date().toISOString().slice(0, 10),
            bankAccount: info.bankAccount || null,
            bankName: info.bankName || null,
            role: info.role || "NHAN_SU_HYBRID",
            status: info.status || "ACTIVE",
            contractType: info.contractType || "khoan_viec",
            customPassword: info.password || null,
          },
          contracts,
          shifts,
          reports,
          viralPosts,
          monthlyAcceptances,
          isExisting: !!existingDbUser,
          existingId: existingDbUser ? existingDbUser.id : null,
        });
      }

      return NextResponse.json({
        success: true,
        type,
        sheetNames: ["JSON_DATA"],
        selectedSheet: "JSON_DATA",
        totalRows: rawList.length,
        validCount: parsedData.length,
        errorCount: errors.length,
        stats: {
          totalPersonnel: parsedData.length,
          totalShifts,
          totalReports,
          totalViralPosts,
          totalAcceptances,
        },
        previewRows: parsedData.slice(0, 15).map((p: any) => ({
          row: p.row,
          fullName: p.info.fullName,
          phone: p.info.phone,
          email: p.info.email,
          shiftCount: p.shifts.length,
          reportCount: p.reports.length,
          viralCount: p.viralPosts.length,
          isExisting: p.isExisting,
          existingId: p.existingId,
        })),
        errors,
        parsedData,
      });
    }

    // ==============================================================
    // XỬ LÝ FILE EXCEL / CSV
    // ==============================================================
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetNames = workbook.SheetNames;
    if (sheetNames.length === 0) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Tệp Excel không chứa trang tính (sheet) nào." },
        { status: 400 }
      );
    }

    const selectedSheet = requestedSheet && sheetNames.includes(requestedSheet)
      ? requestedSheet
      : sheetNames[0];

    const worksheet = workbook.Sheets[selectedSheet];
    const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

    if (rawRows.length < 2) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Trang tính rỗng hoặc chỉ có dòng tiêu đề." },
        { status: 400 }
      );
    }

    // Helper map headers
    const headerRow = rawRows[0].map((h: any) => String(h || "").trim());

    const findColIndex = (keywords: string[]): number => {
      return headerRow.findIndex((col) => {
        const lower = col.toLowerCase();
        return keywords.some((k) => lower.includes(k.toLowerCase()));
      });
    };

    // ==============================================================
    // 1. NHÂN SỰ & HỢP ĐỒNG (nhan-su)
    // ==============================================================
    if (type === "nhan-su") {
      const colName = findColIndex(["họ và tên", "họ tên", "fullname", "tên"]);
      const colPhone = findColIndex(["số điện thoại", "sđt", "phone", "điện thoại"]);
      const colEmail = findColIndex(["email"]);
      const colCccd = findColIndex(["cccd", "cmnd"]);
      const colDob = findColIndex(["ngày sinh", "dob", "năm sinh"]);
      const colStartDate = findColIndex(["ngày bắt đầu", "start date", "ngày vào"]);
      const colBankAcc = findColIndex(["số tài khoản", "stk", "tài khoản"]);
      const colBankName = findColIndex(["tên ngân hàng", "ngân hàng", "bank"]);
      const colRole = findColIndex(["vai trò", "role", "chức vụ"]);
      const colStatus = findColIndex(["trạng thái", "status"]);
      const colContract = findColIndex(["hợp đồng", "loại hợp đồng", "contract"]);
      const colPassword = findColIndex(["mật khẩu", "password"]);

      const seenPhonesInFile = new Set<string>();

      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.every((c: any) => String(c).trim() === "")) continue;

        const rowNum = i + 1;
        const fullName = colName !== -1 ? String(row[colName] || "").trim() : "";
        const rawPhone = colPhone !== -1 ? String(row[colPhone] || "").trim() : "";
        const cleanPhone = rawPhone.replace(/\D/g, "");
        const email = colEmail !== -1 ? String(row[colEmail] || "").trim() : "";
        const cccd = colCccd !== -1 ? String(row[colCccd] || "").trim() : "";
        const dobStr = colDob !== -1 ? parseExcelDate(row[colDob]) : null;
        const startDateStr = colStartDate !== -1 ? parseExcelDate(row[colStartDate]) : null;
        const bankAccount = colBankAcc !== -1 ? String(row[colBankAcc] || "").trim() : "";
        const bankName = colBankName !== -1 ? String(row[colBankName] || "").trim() : "";
        const roleStr = colRole !== -1 ? String(row[colRole] || "").trim() : "";
        const statusStr = colStatus !== -1 ? String(row[colStatus] || "").trim().toUpperCase() : "ACTIVE";
        const contractType = colContract !== -1 ? String(row[colContract] || "").trim() : "khoan_viec";
        const password = colPassword !== -1 ? String(row[colPassword] || "").trim() : "";

        if (!fullName) {
          errors.push({ row: rowNum, message: "Thiếu cột 'Họ và tên'." });
          continue;
        }

        if (!cleanPhone || cleanPhone.length < 9) {
          errors.push({ row: rowNum, message: `Số điện thoại không hợp lệ: "${rawPhone}".` });
          continue;
        }

        if (seenPhonesInFile.has(cleanPhone)) {
          errors.push({ row: rowNum, message: `Số điện thoại "${cleanPhone}" bị trùng lặp trong chính tệp tải lên.` });
          continue;
        }
        seenPhonesInFile.add(cleanPhone);

        const existingDbUser = dbUsers.find((u) => u.phone.replace(/\D/g, "") === cleanPhone);

        let finalRole = "NHAN_SU_HYBRID";
        if (["SUPER_ADMIN", "ADMIN", "HR", "MANAGER", "QC", "NHAN_SU_HYBRID"].includes(roleStr)) {
          finalRole = roleStr;
        }

        parsedData.push({
          row: rowNum,
          fullName,
          phone: cleanPhone,
          email: email || null,
          cccd: cccd || null,
          dateOfBirth: dobStr,
          startDate: startDateStr || new Date().toISOString().slice(0, 10),
          bankAccount: bankAccount || null,
          bankName: bankName || null,
          role: finalRole,
          status: ["ACTIVE", "PROBATION", "INACTIVE", "SUSPENDED"].includes(statusStr) ? statusStr : "ACTIVE",
          contractType: contractType || "khoan_viec",
          customPassword: password || null,
          isExisting: !!existingDbUser,
          existingId: existingDbUser ? existingDbUser.id : null,
        });
      }
    }

    // ==============================================================
    // 2. CA LÀM VIỆC & CHẤM CÔNG (ca-lam-viec)
    // ==============================================================
    else if (type === "ca-lam-viec") {
      const colUser = findColIndex(["nhân sự", "họ và tên", "tên", "email", "sđt", "số điện thoại", "phone"]);
      const colDate = findColIndex(["ngày", "shift date", "ngày làm việc"]);
      const colShift = findColIndex(["ca làm việc", "ca", "shift type"]);
      const colMode = findColIndex(["hình thức", "chế độ", "work mode", "online/offline"]);
      const colStatus = findColIndex(["trạng thái", "status"]);
      const colNote = findColIndex(["ghi chú", "note"]);

      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.every((c: any) => String(c).trim() === "")) continue;

        const rowNum = i + 1;
        const userIdentifier = colUser !== -1 ? String(row[colUser] || "").trim() : "";
        const dateStr = colDate !== -1 ? parseExcelDate(row[colDate]) : null;
        const shiftType = colShift !== -1 ? normalizeShiftType(row[colShift]) : null;
        const workMode = colMode !== -1 ? normalizeWorkMode(row[colMode]) : "ONLINE";
        const statusRaw = colStatus !== -1 ? String(row[colStatus] || "").trim().toUpperCase() : "COMPLETED";
        const note = colNote !== -1 ? String(row[colNote] || "").trim() : "";

        if (!userIdentifier) {
          errors.push({ row: rowNum, message: "Thiếu thông tin định danh nhân sự (SĐT / Email / Tên)." });
          continue;
        }

        const matchedUser = findUserByIdentifier(userIdentifier, dbUsers);
        if (!matchedUser) {
          errors.push({
            row: rowNum,
            message: `Không tìm thấy nhân sự ứng với "${userIdentifier}" trong hệ thống. Hãy nạp danh sách nhân sự trước!`,
          });
          continue;
        }

        if (!dateStr) {
          errors.push({ row: rowNum, message: `Ngày làm việc không hợp lệ: "${row[colDate]}". Định dạng chuẩn: YYYY-MM-DD.` });
          continue;
        }

        if (!shiftType) {
          errors.push({ row: rowNum, message: `Ca làm việc không hợp lệ: "${row[colShift]}". Chọn: Sáng, Chiều hoặc Tối.` });
          continue;
        }

        const weekInfo = getISOWeekAndYear(new Date(`${dateStr}T00:00:00Z`));
        const finalStatus = ["REGISTERED", "COMPLETED", "ABSENT", "CANCELLED"].includes(statusRaw)
          ? statusRaw
          : "COMPLETED";

        parsedData.push({
          row: rowNum,
          userId: matchedUser.id,
          userName: matchedUser.fullName,
          shiftDate: dateStr,
          shiftType,
          workMode,
          status: finalStatus,
          weekNumber: weekInfo.weekNumber,
          year: weekInfo.year,
          note: note || "Nạp từ file Excel",
        });
      }
    }

    // ==============================================================
    // 3. BÁO CÁO SEEDING & QC (bao-cao-seeding)
    // ==============================================================
    else if (type === "bao-cao-seeding") {
      const colUser = findColIndex(["nhân sự", "họ và tên", "tên", "email", "sđt", "phone"]);
      const colDate = findColIndex(["ngày", "ngày báo cáo", "date"]);
      const colShift = findColIndex(["ca làm việc", "ca", "shift"]);
      const colFb = findColIndex(["facebook", "fb", "link facebook"]);
      const colThreads = findColIndex(["threads", "thread", "link threads"]);
      const colDrive = findColIndex(["drive", "cmt", "comment"]);
      const colFemale = findColIndex(["bài nữ", "female"]);
      const colViral = findColIndex(["bài viral", "viral"]);
      const colDuyetFb = findColIndex(["duyệt fb", "fb approved"]);
      const colDuyetThreads = findColIndex(["duyệt threads", "threads approved"]);
      const colDuyetCmt = findColIndex(["duyệt cmt", "duyệt comment", "cmt approved"]);
      const colQcResult = findColIndex(["kết quả qc", "qc result", "kết quả"]);
      const colQcNote = findColIndex(["nhận xét", "feedback", "ghi chú qc"]);

      const splitLinks = (val: any): string[] => {
        if (!val) return [];
        return String(val)
          .split(/[\r\n,;]+/)
          .map((s) => s.trim())
          .filter((s) => s.startsWith("http"));
      };

      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.every((c: any) => String(c).trim() === "")) continue;

        const rowNum = i + 1;
        const userIdentifier = colUser !== -1 ? String(row[colUser] || "").trim() : "";
        const dateStr = colDate !== -1 ? parseExcelDate(row[colDate]) : null;
        const shiftType = colShift !== -1 ? normalizeShiftType(row[colShift]) : "MORNING";

        if (!userIdentifier) {
          errors.push({ row: rowNum, message: "Thiếu thông tin định danh nhân sự." });
          continue;
        }

        const matchedUser = findUserByIdentifier(userIdentifier, dbUsers);
        if (!matchedUser) {
          errors.push({
            row: rowNum,
            message: `Không tìm thấy nhân sự "${userIdentifier}" trong hệ thống.`,
          });
          continue;
        }

        if (!dateStr) {
          errors.push({ row: rowNum, message: `Ngày báo cáo không hợp lệ: "${row[colDate]}".` });
          continue;
        }

        const fbLinks = colFb !== -1 ? splitLinks(row[colFb]) : [];
        const threadLinks = colThreads !== -1 ? splitLinks(row[colThreads]) : [];
        const commentDriveLink = colDrive !== -1 ? String(row[colDrive] || "").trim() : "";
        const femaleLinks = colFemale !== -1 ? splitLinks(row[colFemale]) : [];
        const viralLinks = colViral !== -1 ? splitLinks(row[colViral]) : [];

        const fbApproved = colDuyetFb !== -1 && row[colDuyetFb] !== "" ? Number(row[colDuyetFb]) : fbLinks.length;
        const threadApproved = colDuyetThreads !== -1 && row[colDuyetThreads] !== "" ? Number(row[colDuyetThreads]) : threadLinks.length;
        const commentApproved = colDuyetCmt !== -1 && row[colDuyetCmt] !== "" ? Number(row[colDuyetCmt]) : 50;

        let qcResult = "PASS";
        if (colQcResult !== -1 && row[colQcResult]) {
          const res = String(row[colQcResult]).trim().toUpperCase();
          if (["PASS", "PARTIAL", "FAIL"].includes(res)) qcResult = res;
        } else {
          qcResult = fbApproved >= 10 && threadApproved >= 4 && commentApproved >= 50 ? "PASS" : "PARTIAL";
        }

        const qcNote = colQcNote !== -1 ? String(row[colQcNote] || "").trim() : null;
        const weekInfo = getISOWeekAndYear(new Date(`${dateStr}T00:00:00Z`));

        parsedData.push({
          row: rowNum,
          userId: matchedUser.id,
          userName: matchedUser.fullName,
          reportDate: dateStr,
          shiftType,
          fbLinks,
          threadLinks,
          commentDriveLink: commentDriveLink || null,
          femaleContentLinks: femaleLinks,
          viralPostLinks: viralLinks,
          fbApproved,
          threadApproved,
          commentApproved,
          qcResult,
          qcNote,
          weekNumber: weekInfo.weekNumber,
          year: weekInfo.year,
        });
      }
    }

    // ==============================================================
    // 4. THƯỞNG VIRAL (thuong-viral)
    // ==============================================================
    else if (type === "thuong-viral") {
      const colUser = findColIndex(["nhân sự", "họ và tên", "tên", "email", "sđt"]);
      const colUrl = findColIndex(["link", "url", "link bài viết"]);
      const colPlatform = findColIndex(["nền tảng", "platform"]);
      const colType = findColIndex(["loại", "content type"]);
      const colLikes = findColIndex(["likes", "lượt thích", "tương tác"]);
      const colBonus = findColIndex(["tiền thưởng", "thưởng", "bonus"]);
      const colDate = findColIndex(["ngày", "ngày đăng", "date"]);
      const colShift = findColIndex(["ca", "ca làm việc", "shift"]);

      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.every((c: any) => String(c).trim() === "")) continue;

        const rowNum = i + 1;
        const userIdentifier = colUser !== -1 ? String(row[colUser] || "").trim() : "";
        const postUrl = colUrl !== -1 ? String(row[colUrl] || "").trim() : "";
        const platform = colPlatform !== -1 && String(row[colPlatform]).toUpperCase().includes("THREAD") ? "THREADS" : "FACEBOOK";
        const contentType = colType !== -1 && String(row[colType]).toUpperCase().includes("COMMENT") ? "COMMENT" : "POST";
        const likes = colLikes !== -1 ? parseInt(String(row[colLikes]).replace(/\D/g, "") || "0", 10) : 0;
        const bonusAmount = colBonus !== -1 ? parseInt(String(row[colBonus]).replace(/\D/g, "") || "0", 10) : 0;
        const dateStr = colDate !== -1 ? parseExcelDate(row[colDate]) : new Date().toISOString().slice(0, 10);
        const shiftType = colShift !== -1 ? normalizeShiftType(row[colShift]) || "MORNING" : "MORNING";

        if (!userIdentifier) {
          errors.push({ row: rowNum, message: "Thiếu thông tin định danh nhân sự." });
          continue;
        }

        const matchedUser = findUserByIdentifier(userIdentifier, dbUsers);
        if (!matchedUser) {
          errors.push({
            row: rowNum,
            message: `Không tìm thấy nhân sự "${userIdentifier}" trong hệ thống.`,
          });
          continue;
        }

        if (!postUrl || !postUrl.startsWith("http")) {
          errors.push({ row: rowNum, message: `Link bài viết không hợp lệ: "${postUrl}".` });
          continue;
        }

        parsedData.push({
          row: rowNum,
          userId: matchedUser.id,
          userName: matchedUser.fullName,
          postUrl,
          platform,
          contentType,
          likes,
          bonusAmount,
          submittedAt: dateStr,
          shiftType,
        });
      }
    }

    return NextResponse.json({
      success: true,
      type,
      sheetNames,
      selectedSheet,
      totalRows: rawRows.length - 1,
      validCount: parsedData.length,
      errorCount: errors.length,
      previewRows: parsedData.slice(0, 10),
      errors,
      parsedData,
    });
  } catch (err: any) {
    console.error("Lỗi khi phân tích tệp:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: `Không thể đọc tệp: ${err.message || String(err)}` },
      { status: 500 }
    );
  }
}
