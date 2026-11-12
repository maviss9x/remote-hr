import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasAnyRole } from "@/lib/auth";
import ExcelJS from "exceljs";
import type { Role } from "@/generated/prisma";

const ALLOWED_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "HR"];

const ROLE_MAP: Record<string, string> = {
  SUPER_ADMIN: "Quản trị cấp cao",
  ADMIN: "Quản trị viên",
  HR: "Nhân sự",
  MANAGER: "Quản lý ca",
  QC: "Kiểm duyệt viên",
  NHAN_SU_HYBRID: "Nhân sự Remote",
};

const STATUS_MAP: Record<string, string> = {
  PROBATION: "Thử việc",
  ACTIVE: "Chính thức",
  INACTIVE: "Đã nghỉ",
  SUSPENDED: "Tạm đình chỉ",
};

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || !hasAnyRole(session.role, ALLOWED_ROLES)) {
      return NextResponse.json({ error: "Không có quyền xuất dữ liệu" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: any = {
      role: "NHAN_SU_HYBRID",
    };
    if (status && status !== "ALL") where.status = status;

    const users = await prisma.user.findMany({
      where,
      include: {
        contracts: {
          orderBy: { endDate: "desc" },
          take: 1,
        },
      },
      orderBy: { id: "asc" },
    });

    const now = new Date();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Hệ Thống Quản Lý Remote - Freetrip";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("DanhSachNhanSu", {
      views: [{ showGridLines: true }],
    });

    // Cấu hình chiều rộng các cột
    worksheet.columns = [
      { key: "stt", width: 7 },
      { key: "fullName", width: 28 },
      { key: "phone", width: 16 },
      { key: "cccd", width: 18 },
      { key: "email", width: 26 },
      { key: "bankName", width: 20 },
      { key: "bankAccount", width: 20 },
      { key: "role", width: 18 },
      { key: "status", width: 16 },
      { key: "startDate", width: 18 },
      { key: "contractStatus", width: 22 },
      { key: "contractEndDate", width: 18 },
      { key: "driveFolderUrl", width: 38 },
    ];

    const borderThin: Partial<ExcelJS.Borders> = {
      top: { style: "thin", color: { argb: "FF9CA3AF" } },
      left: { style: "thin", color: { argb: "FF9CA3AF" } },
      bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
      right: { style: "thin", color: { argb: "FF9CA3AF" } },
    };

    const borderThinBlack: Partial<ExcelJS.Borders> = {
      top: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } },
    };

    // Dòng 1: Tiêu đề danh sách
    worksheet.mergeCells("A1:M1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "CÔNG TY CỔ PHẦN FREETRIP - DANH SÁCH NHÂN SỰ REMOTE";
    titleCell.font = {
      name: "Times New Roman",
      size: 14,
      bold: true,
      color: { argb: "FF000000" },
    };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(1).height = 28;

    // Dòng 2: Ngày xuất
    const todayStr = now.toLocaleDateString("vi-VN");
    worksheet.mergeCells("A2:M2");
    const subCell = worksheet.getCell("A2");
    subCell.value = `Thời gian kết xuất: ${todayStr} | Hệ Thống Quản Lý Nhân Sự Remote`;
    subCell.font = {
      name: "Times New Roman",
      size: 11,
      italic: true,
      color: { argb: "FF4B5563" },
    };
    subCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(2).height = 20;

    // Dòng 3: Header
    const headers = [
      "STT",
      "Họ và tên",
      "Số điện thoại",
      "Số CCCD",
      "Email",
      "Ngân hàng",
      "Số tài khoản",
      "Vai trò",
      "Trạng thái",
      "Ngày nhận việc",
      "Tình trạng HĐ",
      "Ngày hết hạn HĐ",
      "Link Drive tổng hợp",
    ];

    const headerRow = worksheet.getRow(3);
    headerRow.height = 32;
    headers.forEach((h, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = h;
      cell.font = {
        name: "Times New Roman",
        size: 11,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF374151" },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
      cell.border = borderThinBlack;
    });

    // Dòng dữ liệu
    users.forEach((u, index) => {
      const contract = u.contracts[0] || null;
      let contractStatusText = "Chưa có HĐ";
      let contractEndStr = "";

      if (contract) {
        contractEndStr = new Date(contract.endDate).toLocaleDateString("vi-VN");
        if (new Date(contract.endDate) < now) {
          contractStatusText = "Đã hết hạn";
        } else {
          const daysLeft = Math.ceil(
            (new Date(contract.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysLeft <= 7) {
            contractStatusText = `Sắp hết hạn (${daysLeft} ngày)`;
          } else if (daysLeft <= 14) {
            contractStatusText = `Cần gia hạn (${daysLeft} ngày)`;
          } else {
            contractStatusText = "Còn hiệu lực";
          }
        }
      }

      const rowValues = [
        index + 1,
        u.fullName,
        u.phone,
        u.cccd || "",
        u.email || "",
        u.bankName || "",
        u.bankAccount || "",
        ROLE_MAP[u.role] || u.role,
        STATUS_MAP[u.status] || u.status,
        new Date(u.startDate).toLocaleDateString("vi-VN"),
        contractStatusText,
        contractEndStr,
        u.driveFolderUrl || "",
      ];

      const row = worksheet.getRow(4 + index);
      row.height = 24;

      rowValues.forEach((val, i) => {
        const cell = row.getCell(i + 1);
        if (i === 12 && val) {
          cell.value = { text: String(val), hyperlink: String(val) };
          cell.font = {
            name: "Times New Roman",
            size: 11,
            color: { argb: "FF1D4ED8" },
            underline: true,
          };
        } else {
          cell.value = val;
          cell.font = {
            name: "Times New Roman",
            size: 11,
            color: { argb: "FF000000" },
          };
        }
        cell.border = borderThin;

        // Căn lề: Cột STT, SĐT, CCCD, Vai trò, Trạng thái, Ngày tháng, Tình trạng HĐ -> Căn giữa
        // Cột Họ tên, Email, Ngân hàng, STK, Link Drive -> Căn trái
        if (i === 1 || i === 4 || i === 5 || i === 6 || i === 12) {
          cell.alignment = { vertical: "middle", horizontal: "left" };
        } else {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Danh_Sach_Nhan_Su_${now.toISOString().slice(0, 10)}.xlsx`;

    return new Response(buffer as any, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Lỗi khi export Excel:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi xuất file Excel" }, { status: 500 });
  }
}
