import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasAnyRole } from "@/lib/auth";
import { generateContractDocx, type ContractDocData } from "@/lib/docx-contract";
import type { Role } from "@/generated/prisma";

const ALLOWED_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER"];

function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9_\- ]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !hasAnyRole(session.role, ALLOWED_ROLES)) {
      return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "ID nhân sự không hợp lệ" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        contracts: {
          orderBy: { endDate: "desc" },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Không tìm thấy nhân sự" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const latestContract = user.contracts[0];

    // Xác định ngày hợp đồng mặc định nếu không truyền
    let defaultStartDate = body.startDate;
    let defaultEndDate = body.endDate;

    if (!defaultStartDate) {
      defaultStartDate = latestContract
        ? new Date(latestContract.startDate).toISOString().slice(0, 10)
        : new Date(user.startDate).toISOString().slice(0, 10);
    }

    if (!defaultEndDate) {
      if (latestContract) {
        defaultEndDate = new Date(latestContract.endDate).toISOString().slice(0, 10);
      } else {
        const d = new Date(defaultStartDate);
        d.setMonth(d.getMonth() + 3);
        defaultEndDate = d.toISOString().slice(0, 10);
      }
    }

    const docData: ContractDocData = {
      agreementDate: body.agreementDate || new Date().toISOString().slice(0, 10),
      fullName: body.fullName || user.fullName,
      dob: body.dob || "",
      currentAddress: body.currentAddress || "",
      permanentAddress: body.permanentAddress || "",
      cccd: body.cccd || user.cccd || "",
      cccdDate: body.cccdDate || "",
      cccdPlace: body.cccdPlace || "",
      bankAccount: body.bankAccount || user.bankAccount || "",
      bankName: body.bankName || user.bankName || "",
      startDate: defaultStartDate,
      endDate: defaultEndDate,
    };

    const docxBuffer = generateContractDocx(docData);
    const safeName = sanitizeFileName(docData.fullName) || `User_${user.id}`;
    const filename = `BB_Thoa_thuan_lam_viec_${safeName}.docx`;

    return new NextResponse(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("Lỗi khi xuất file docx biên bản làm việc:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi máy chủ khi xuất biên bản thỏa thuận làm việc" },
      { status: 500 }
    );
  }
}
