import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import type { Role, UserStatus } from "@/generated/prisma";

const SUBORDINATE_ROLES: Role[] = [
  "ADMIN",
  "HR",
  "MANAGER",
  "QC",
  "NHAN_SU_HYBRID",
];

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Chỉ Quản trị viên cấp cao nhất (SUPER_ADMIN) mới có quyền truy cập" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const scope = searchParams.get("scope") || "ALL"; // ALL, MANAGEMENT, STAFF
    const role = searchParams.get("role") || "";
    const status = searchParams.get("status") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "30")));
    const skip = (page - 1) * limit;

    const MANAGEMENT_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER", "QC"];

    const where: any = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
        { cccd: { contains: search } },
      ];
    }

    if (scope === "MANAGEMENT") {
      if (role && role !== "ALL" && MANAGEMENT_ROLES.includes(role as Role)) {
        where.role = role as Role;
      } else {
        where.role = { in: MANAGEMENT_ROLES };
      }
    } else if (scope === "STAFF") {
      where.role = "NHAN_SU_HYBRID";
    } else if (role && role !== "ALL") {
      where.role = role as Role;
    }

    if (status && status !== "ALL") {
      where.status = status as UserStatus;
    }

    const [users, total, roleStats, managementTotal, staffTotal] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          cccd: true,
          bankAccount: true,
          bankName: true,
          role: true,
          status: true,
          startDate: true,
          avatarUrl: true,
          driveFolderUrl: true,
          createdAt: true,
          updatedAt: true,
          contracts: {
            orderBy: { endDate: "desc" },
            take: 1,
            select: {
              id: true,
              startDate: true,
              endDate: true,
              status: true,
              contractType: true,
            },
          },
        },
        orderBy: [{ role: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
      prisma.user.groupBy({
        by: ["role"],
        _count: { id: true },
      }),
      prisma.user.count({
        where: { role: { in: MANAGEMENT_ROLES } },
      }),
      prisma.user.count({
        where: { role: "NHAN_SU_HYBRID" },
      }),
    ]);

    const statsMap: Record<string, number> = {};
    roleStats.forEach((r) => {
      statsMap[r.role] = r._count.id;
    });

    return NextResponse.json({
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total,
        managementTotal,
        staffTotal,
        byRole: statsMap,
      },
    });
  } catch (error: any) {
    console.error("Lỗi API GET /api/admin/users:", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi tải danh sách người dùng" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Chỉ Quản trị viên cấp cao nhất (SUPER_ADMIN) mới có quyền tạo tài khoản" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      fullName,
      phone,
      email,
      cccd,
      bankAccount,
      bankName,
      role = "NHAN_SU_HYBRID",
      status = "ACTIVE",
      startDate,
      customPassword,
      contractType,
    } = body;

    // Validation
    if (!fullName || !fullName.trim()) {
      return NextResponse.json({ error: "Họ và tên không được để trống" }, { status: 400 });
    }

    if (!phone || !phone.trim()) {
      return NextResponse.json({ error: "Số điện thoại đăng nhập không được để trống" }, { status: 400 });
    }

    // Role validation
    const validRoles: Role[] = ["SUPER_ADMIN", ...SUBORDINATE_ROLES];
    if (!validRoles.includes(role as Role)) {
      return NextResponse.json({ error: "Vai trò người dùng không hợp lệ" }, { status: 400 });
    }

    // Check unique phone
    const existingPhone = await prisma.user.findUnique({
      where: { phone: phone.trim() },
    });
    if (existingPhone) {
      return NextResponse.json(
        { error: `Số điện thoại ${phone} đã được sử dụng` },
        { status: 400 }
      );
    }

    // Check unique email
    if (email && email.trim()) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
      });
      if (existingEmail) {
        return NextResponse.json(
          { error: `Email ${email} đã được đăng ký trên hệ thống` },
          { status: 400 }
        );
      }
    }

    // Check unique cccd
    if (cccd && cccd.trim()) {
      const existingCccd = await prisma.user.findUnique({
        where: { cccd: cccd.trim() },
      });
      if (existingCccd) {
        return NextResponse.json(
          { error: `CCCD/CMND ${cccd} đã tồn tại trên hệ thống` },
          { status: 400 }
        );
      }
    }

    const rawPassword = customPassword && customPassword.trim() ? customPassword.trim() : "123456";
    if (rawPassword.length < 6) {
      return NextResponse.json({ error: "Mật khẩu phải có ít nhất 6 ký tự" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const parsedStartDate = startDate ? new Date(startDate) : new Date();

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email?.trim()?.toLowerCase() || null,
          cccd: cccd?.trim() || null,
          bankAccount: bankAccount?.trim() || null,
          bankName: bankName?.trim() || null,
          passwordHash,
          role: role as Role,
          status: (status as UserStatus) || "ACTIVE",
          startDate: parsedStartDate,
        },
      });

      // Tạo hợp đồng mặc định nếu là Nhân sự
      if (contractType || role === "NHAN_SU_HYBRID") {
        const endDate = new Date(parsedStartDate);
        endDate.setMonth(endDate.getMonth() + 3);

        await tx.contract.create({
          data: {
            userId: user.id,
            startDate: parsedStartDate,
            endDate,
            contractType: contractType || "khoan_viec",
            status: "ACTIVE",
            note: "Hợp đồng khởi tạo bởi Quản trị viên cấp cao",
          },
        });
      }

      return user;
    });

    return NextResponse.json({
      message: `Đã khởi tạo tài khoản ${newUser.fullName} thành công`,
      user: {
        id: newUser.id,
        fullName: newUser.fullName,
        phone: newUser.phone,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
      },
    });
  } catch (error: any) {
    console.error("Lỗi API POST /api/admin/users:", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi tạo tài khoản mới" },
      { status: 500 }
    );
  }
}
