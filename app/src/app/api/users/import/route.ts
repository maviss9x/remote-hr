import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasAnyRole } from "@/lib/auth";
import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import type { Role, UserStatus } from "@/generated/prisma";

const ALLOWED_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "HR"];

const REVERSE_ROLE_MAP: Record<string, Role> = {
  "quản trị cấp cao": "SUPER_ADMIN",
  "super admin": "SUPER_ADMIN",
  "super_admin": "SUPER_ADMIN",
  "quản trị viên": "ADMIN",
  "admin": "ADMIN",
  "nhân sự": "HR",
  "hr": "HR",
  "quản lý ca": "MANAGER",
  "manager": "MANAGER",
  "kiểm duyệt viên": "QC",
  "qc": "QC",
  "nhân sự hybrid": "NHAN_SU_HYBRID",
  "nhan_su_hybrid": "NHAN_SU_HYBRID",
  "hybrid": "NHAN_SU_HYBRID",
  "nhân sự remote": "NHAN_SU_HYBRID",
  "nhan_su_remote": "NHAN_SU_HYBRID",
  "remote": "NHAN_SU_HYBRID",
};

const REVERSE_STATUS_MAP: Record<string, UserStatus> = {
  "thử việc": "PROBATION",
  "probation": "PROBATION",
  "chính thức": "ACTIVE",
  "active": "ACTIVE",
  "đã nghỉ": "INACTIVE",
  "inactive": "INACTIVE",
  "tạm đình chỉ": "SUSPENDED",
  "suspended": "SUSPENDED",
};

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !hasAnyRole(session.role, ALLOWED_ROLES)) {
      return NextResponse.json({ error: "Không có quyền thực hiện import" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Vui lòng chọn file Excel để tải lên" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return NextResponse.json({ error: "File Excel không có sheet dữ liệu nào" }, { status: 400 });
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ error: "File Excel không có dòng dữ liệu nào" }, { status: 400 });
    }

    // Default password hash
    const defaultPasswordHash = await bcrypt.hash("123456", 10);
    const now = new Date();

    const usersToCreate: any[] = [];
    const usersToUpdate: Array<{
      phone: string;
      fullName?: string;
      email?: string;
      cccd?: string;
      bankName?: string;
      bankAccount?: string;
      driveFolderUrl?: string;
      status?: UserStatus;
    }> = [];
    const errors: string[] = [];
    const seenPhones = new Set<string>();
    const seenCccds = new Set<string>();

    // Fetch existing phones & cccds from database
    const existingUsers = await prisma.user.findMany({
      select: { phone: true, cccd: true },
    });
    const dbPhones = new Set(existingUsers.map((u) => u.phone));
    const dbCccds = new Set(existingUsers.map((u) => u.cccd).filter(Boolean) as string[]);

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowIdx = i + 2; // Excel row numbering (1-indexed + header)

      // Map flexible column names
      const fullName = String(
        row["Họ và tên"] || row["Họ tên"] || row["fullName"] || row["Ho va ten"] || ""
      ).trim();
      const phone = String(
        row["Số điện thoại"] || row["SĐT"] || row["SDT"] || row["phone"] || ""
      ).replace(/[^0-9]/g, "").trim();
      const cccd = String(
        row["Số CCCD"] || row["CCCD"] || row["cccd"] || ""
      ).replace(/[^0-9]/g, "").trim();
      const email = String(row["Email"] || row["email"] || "").trim().toLowerCase();
      const bankName = String(row["Ngân hàng"] || row["Ngan hang"] || row["bankName"] || "").trim();
      const bankAccount = String(
        row["Số tài khoản"] || row["STK"] || row["bankAccount"] || ""
      ).trim();
      const rawRole = String(row["Vai trò"] || row["Role"] || row["role"] || "").trim().toLowerCase();
      const rawStatus = String(row["Trạng thái"] || row["Status"] || row["status"] || "").trim().toLowerCase();
      const driveFolderUrl = String(
        row["Link Drive tổng hợp"] ||
        row["Link Drive"] ||
        row["Link tổng"] ||
        row["Drive"] ||
        row["driveFolderUrl"] ||
        ""
      ).trim();

      if (!fullName) {
        errors.push(`Dòng ${rowIdx}: Thiếu Họ và tên`);
        continue;
      }

      if (!phone || phone.length < 9 || phone.length > 11) {
        errors.push(`Dòng ${rowIdx}: Số điện thoại '${phone}' không hợp lệ`);
        continue;
      }

      if (seenPhones.has(phone)) {
        errors.push(`Dòng ${rowIdx}: Số điện thoại '${phone}' bị trùng lặp trong file`);
        continue;
      }
      seenPhones.add(phone);

      const role: Role = REVERSE_ROLE_MAP[rawRole] || "NHAN_SU_HYBRID";
      const status: UserStatus = REVERSE_STATUS_MAP[rawStatus] || "PROBATION";

      if (dbPhones.has(phone)) {
        // Cập nhật an toàn các trường có dữ liệu từ file Excel, bảo toàn dữ liệu cũ nếu ô trống
        usersToUpdate.push({
          phone,
          fullName: fullName || undefined,
          email: email || undefined,
          cccd: cccd || undefined,
          bankName: bankName || undefined,
          bankAccount: bankAccount || undefined,
          driveFolderUrl: driveFolderUrl || undefined,
          status: rawStatus ? status : undefined,
        });
        continue;
      }

      usersToCreate.push({
        fullName,
        phone,
        email: email || null,
        cccd: cccd || null,
        bankName: bankName || null,
        bankAccount: bankAccount || null,
        role,
        status,
        driveFolderUrl: driveFolderUrl || null,
        passwordHash: defaultPasswordHash,
        startDate: now,
      });
    }

    if (usersToCreate.length === 0 && usersToUpdate.length === 0) {
      return NextResponse.json(
        {
          error: "Không có dòng dữ liệu hợp lệ nào để nhập hoặc cập nhật",
          details: errors,
        },
        { status: 400 }
      );
    }

    // Process creations and updates in a transaction
    const { createdCount, updatedCount } = await prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;

      for (const u of usersToCreate) {
        const newUser = await tx.user.create({ data: u });
        if (newUser.status === "ACTIVE") {
          const contractEnd = new Date(now);
          contractEnd.setMonth(contractEnd.getMonth() + 3);
          await tx.contract.create({
            data: {
              userId: newUser.id,
              startDate: now,
              endDate: contractEnd,
              status: "ACTIVE",
              contractType: "khoan_viec",
              note: "Hợp đồng khởi tạo tự động qua Import Excel",
            },
          });
        }
        created++;
      }

      for (const u of usersToUpdate) {
        const updateData: any = {};
        if (u.fullName) updateData.fullName = u.fullName;
        if (u.email) updateData.email = u.email;
        if (u.cccd) updateData.cccd = u.cccd;
        if (u.bankName) updateData.bankName = u.bankName;
        if (u.bankAccount) updateData.bankAccount = u.bankAccount;
        if (u.driveFolderUrl) updateData.driveFolderUrl = u.driveFolderUrl;
        if (u.status) updateData.status = u.status;

        if (Object.keys(updateData).length > 0) {
          await tx.user.update({
            where: { phone: u.phone },
            data: updateData,
          });
          updated++;
        }
      }

      return { createdCount: created, updatedCount: updated };
    });

    const successParts = [];
    if (createdCount > 0) successParts.push(`thêm mới ${createdCount} nhân sự`);
    if (updatedCount > 0) successParts.push(`cập nhật thông tin cho ${updatedCount} nhân sự`);

    return NextResponse.json({
      message: `Đã ${successParts.join(" và ")} thành công`,
      importedCount: createdCount,
      updatedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Lỗi khi import Excel:", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ trong quá trình xử lý file Excel", details: error.message },
      { status: 500 }
    );
  }
}
