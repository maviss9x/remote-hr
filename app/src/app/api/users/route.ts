import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasAnyRole } from "@/lib/auth";
import bcrypt from "bcryptjs";
import type { Role, UserStatus } from "@/generated/prisma";

const ALLOWED_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "HR"];

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || !hasAnyRole(session.role, ALLOWED_ROLES)) {
      return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const role = searchParams.get("role") || "";
    const status = searchParams.get("status") || "";
    const contractFilter = searchParams.get("contractStatus") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const skip = (page - 1) * limit;

    // Build filter conditions
    const where: any = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { phone: { contains: search } },
        { cccd: { contains: search } },
        { email: { contains: search } },
      ];
    }

    // Trang nhân sự chỉ hiển thị tài khoản nhân sự Hybrid (loại trừ cấp quản lý)
    where.role = "NHAN_SU_HYBRID";

    if (status && status !== "ALL") {
      where.status = status as UserStatus;
    }

    const now = new Date();
    const fourteenDaysLater = new Date();
    fourteenDaysLater.setDate(now.getDate() + 14);

    // Fetch users with their latest contracts
    const [users, total] = await Promise.all([
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
          dateOfBirth: true,
          cccdDate: true,
          cccdPlace: true,
          currentAddress: true,
          permanentAddress: true,
          avatarUrl: true,
          driveFolderUrl: true,
          createdAt: true,
          contracts: {
            orderBy: { endDate: "desc" },
            take: 1,
            select: {
              id: true,
              startDate: true,
              endDate: true,
              status: true,
              contractType: true,
              note: true,
            },
          },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    // Thống kê dành riêng cho nhân sự Hybrid
    const [totalUsers, probationUsers, activeUsers, expiringContracts] = await Promise.all([
      prisma.user.count({ where: { role: "NHAN_SU_HYBRID" } }),
      prisma.user.count({ where: { role: "NHAN_SU_HYBRID", status: "PROBATION" } }),
      prisma.user.count({ where: { role: "NHAN_SU_HYBRID", status: "ACTIVE" } }),
      prisma.contract.count({
        where: {
          status: "ACTIVE",
          user: { role: "NHAN_SU_HYBRID" },
          endDate: {
            gte: now,
            lte: fourteenDaysLater,
          },
        },
      }),
    ]);

    // Format response
    const formattedUsers = users.map((u) => {
      const latestContract = u.contracts[0] || null;
      let contractAlert = "NONE"; // NONE, EXPIRING_7, EXPIRING_14, EXPIRED, NO_CONTRACT

      if (!latestContract) {
        contractAlert = "NO_CONTRACT";
      } else if (new Date(latestContract.endDate) < now) {
        contractAlert = "EXPIRED";
      } else {
        const daysRemaining = Math.ceil(
          (new Date(latestContract.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysRemaining <= 7) {
          contractAlert = "EXPIRING_7";
        } else if (daysRemaining <= 14) {
          contractAlert = "EXPIRING_14";
        }
      }

      return {
        ...u,
        latestContract,
        contractAlert,
      };
    });

    // Filter by contract status if requested
    let filteredUsers = formattedUsers;
    if (contractFilter === "expiring_soon") {
      filteredUsers = formattedUsers.filter(
        (u) => u.contractAlert === "EXPIRING_7" || u.contractAlert === "EXPIRING_14"
      );
    } else if (contractFilter === "expired") {
      filteredUsers = formattedUsers.filter((u) => u.contractAlert === "EXPIRED");
    } else if (contractFilter === "no_contract") {
      filteredUsers = formattedUsers.filter((u) => u.contractAlert === "NO_CONTRACT");
    }

    return NextResponse.json({
      users: filteredUsers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalUsers,
        probationUsers,
        activeUsers,
        expiringContracts,
      },
    });
  } catch (error: any) {
    console.error("Lỗi khi tải danh sách nhân sự:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi máy chủ khi tải danh sách nhân sự" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !hasAnyRole(session.role, ALLOWED_ROLES)) {
      return NextResponse.json({ error: "Không có quyền thực hiện thao tác này" }, { status: 403 });
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
      status = "PROBATION",
      startDate,
      createContract = false,
      contractType = "khoan_viec",
      customPassword,
      dateOfBirth,
      cccdDate,
      cccdPlace,
      currentAddress,
      permanentAddress,
      driveFolderUrl,
      contractStartDate,
      contractEndDate,
    } = body;

    // Validation
    if (!fullName || !fullName.trim()) {
      return NextResponse.json({ error: "Họ và tên không được để trống" }, { status: 400 });
    }

    if (!phone || !phone.trim()) {
      return NextResponse.json({ error: "Số điện thoại không được để trống" }, { status: 400 });
    }

    // Check existing phone
    const existingPhone = await prisma.user.findUnique({
      where: { phone: phone.trim() },
    });
    if (existingPhone) {
      return NextResponse.json(
        { error: `Số điện thoại ${phone} đã được sử dụng bởi nhân sự khác` },
        { status: 400 }
      );
    }

    // Check existing cccd if provided
    if (cccd && cccd.trim()) {
      const existingCccd = await prisma.user.findUnique({
        where: { cccd: cccd.trim() },
      });
      if (existingCccd) {
        return NextResponse.json(
          { error: `CCCD ${cccd} đã tồn tại trên hệ thống` },
          { status: 400 }
        );
      }
    }

    // Check existing email if provided
    if (email && email.trim()) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
      });
      if (existingEmail) {
        return NextResponse.json(
          { error: `Email ${email} đã tồn tại trên hệ thống` },
          { status: 400 }
        );
      }
    }

    // Hash password (default: 123456)
    const rawPassword = customPassword && customPassword.trim() ? customPassword.trim() : "123456";
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const userStartDate = startDate ? new Date(startDate) : new Date();
    const userDob = dateOfBirth ? new Date(dateOfBirth) : null;
    const userCccdDate = cccdDate ? new Date(cccdDate) : null;

    // Transaction to create User and optional Contract
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email?.trim()?.toLowerCase() || null,
          cccd: cccd?.trim() || null,
          cccdDate: userCccdDate,
          cccdPlace: cccdPlace?.trim() || null,
          currentAddress: currentAddress?.trim() || null,
          permanentAddress: permanentAddress?.trim() || null,
          bankAccount: bankAccount?.trim() || null,
          bankName: bankName?.trim() || null,
          passwordHash,
          role: (role as Role) || "NHAN_SU_HYBRID",
          status: status as UserStatus,
          startDate: userStartDate,
          dateOfBirth: userDob,
          driveFolderUrl: driveFolderUrl?.trim() || null,
        },
      });

      // If contract requested or contract dates provided
      if (createContract || contractStartDate) {
        const parsedContractStart = contractStartDate ? new Date(contractStartDate) : userStartDate;
        let parsedContractEnd: Date;
        const isProbation = status === "PROBATION";

        if (contractEndDate) {
          parsedContractEnd = new Date(contractEndDate);
        } else if (isProbation) {
          // Thử việc 1 tuần: 7 ngày tính từ ngày bắt đầu (+ 6 ngày)
          parsedContractEnd = new Date(parsedContractStart);
          parsedContractEnd.setDate(parsedContractEnd.getDate() + 6);
        } else {
          parsedContractEnd = new Date(parsedContractStart);
          parsedContractEnd.setMonth(parsedContractEnd.getMonth() + 3);
        }

        const finalContractType = isProbation && contractType === "khoan_viec" ? "thu_viec" : contractType;
        const finalNote = isProbation
          ? "Hợp đồng thử việc 1 tuần khởi tạo ban đầu"
          : "Hợp đồng khoán việc khởi tạo ban đầu";

        await tx.contract.create({
          data: {
            userId: user.id,
            startDate: parsedContractStart,
            endDate: parsedContractEnd,
            status: "ACTIVE",
            contractType: finalContractType,
            note: finalNote,
          },
        });
      }

      return user;
    });

    return NextResponse.json(
      {
        message: "Tạo hồ sơ nhân sự thành công",
        user: {
          id: newUser.id,
          fullName: newUser.fullName,
          phone: newUser.phone,
          role: newUser.role,
          status: newUser.status,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Lỗi khi tạo nhân sự mới:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi máy chủ khi tạo hồ sơ nhân sự" },
      { status: 500 }
    );
  }
}
