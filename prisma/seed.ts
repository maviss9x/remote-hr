import { PrismaClient } from "../src/generated/prisma";
import { PrismaMssql } from "@prisma/adapter-mssql";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL || "";
const adapter = new PrismaMssql(connectionString);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Create KPI Config
  await prisma.kpiConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      fbPerShift: 10,
      threadPerShift: 4,
      commentPerShift: 50,
      minShiftsPerWeek: 5,
      maxAbsentsPerMonth: 3,
      minDaysForSalary: 3,
      lateThresholdMinutes: 60,
      effectiveFrom: new Date("2026-08-01"),
    },
  });
  console.log("✅ KPI Config created");

  // 2. Create Viral Bonus Tiers
  const viralTiers = [
    // Posts - Facebook
    { contentType: "POST" as const, platform: "FACEBOOK" as const, minLikes: 500, bonusAmount: 50000 },
    { contentType: "POST" as const, platform: "FACEBOOK" as const, minLikes: 1000, bonusAmount: 80000 },
    { contentType: "POST" as const, platform: "FACEBOOK" as const, minLikes: 3000, bonusAmount: 100000 },
    { contentType: "POST" as const, platform: "FACEBOOK" as const, minLikes: 5000, bonusAmount: 200000 },
    // Posts - Threads
    { contentType: "POST" as const, platform: "THREADS" as const, minLikes: 1000, bonusAmount: 50000 },
    { contentType: "POST" as const, platform: "THREADS" as const, minLikes: 3000, bonusAmount: 80000 },
    { contentType: "POST" as const, platform: "THREADS" as const, minLikes: 5000, bonusAmount: 100000 },
    { contentType: "POST" as const, platform: "THREADS" as const, minLikes: 10000, bonusAmount: 200000 },
    // Comments - Facebook
    { contentType: "COMMENT" as const, platform: "FACEBOOK" as const, minLikes: 500, bonusAmount: 25000 },
    { contentType: "COMMENT" as const, platform: "FACEBOOK" as const, minLikes: 1000, bonusAmount: 50000 },
    { contentType: "COMMENT" as const, platform: "FACEBOOK" as const, minLikes: 5000, bonusAmount: 80000 },
    { contentType: "COMMENT" as const, platform: "FACEBOOK" as const, minLikes: 10000, bonusAmount: 100000 },
    // Comments - Threads
    { contentType: "COMMENT" as const, platform: "THREADS" as const, minLikes: 1000, bonusAmount: 25000 },
    { contentType: "COMMENT" as const, platform: "THREADS" as const, minLikes: 5000, bonusAmount: 50000 },
    { contentType: "COMMENT" as const, platform: "THREADS" as const, minLikes: 10000, bonusAmount: 80000 },
    { contentType: "COMMENT" as const, platform: "THREADS" as const, minLikes: 50000, bonusAmount: 100000 },
  ];

  for (const tier of viralTiers) {
    await prisma.viralBonusTier.upsert({
      where: {
        contentType_platform_minLikes: {
          contentType: tier.contentType,
          platform: tier.platform,
          minLikes: tier.minLikes,
        },
      },
      update: {},
      create: tier,
    });
  }
  console.log("✅ Viral Bonus Tiers created");

  // 3. Create Users
  const passwordHash = await bcrypt.hash("123456", 10);

  const users = [
    // Admin & Management
    { fullName: "Admin System", phone: "0900000001", role: "SUPER_ADMIN" as const, status: "ACTIVE" as const },
    { fullName: "Nguyễn Văn Admin", phone: "0900000002", role: "ADMIN" as const, status: "ACTIVE" as const },
    { fullName: "Nguyễn Thị Linh", phone: "0912509317", role: "HR" as const, status: "ACTIVE" as const },
    { fullName: "Nguyễn Thị Thủy", phone: "0964774572", role: "MANAGER" as const, status: "ACTIVE" as const },
    { fullName: "Nguyễn Thị Dung", phone: "0854201465", role: "QC" as const, status: "ACTIVE" as const },

    // Nhân sự Hybrid (from actual data)
    { fullName: "Nguyễn Tuyển Hải Anh", phone: "0901000001", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Đào Thùy Dung", phone: "0901000002", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Đỗ Lâm Huy", phone: "0901000003", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Bùi Khánh Linh", phone: "0901000004", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Lê Hoàng Ngân", phone: "0901000005", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Nguyễn Yến Trang", phone: "0901000006", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Lưu Thị Mùi", phone: "0901000007", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Võ Bùi Quỳnh Trang", phone: "0901000008", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Nguyễn Trọng Hiếu", phone: "0901000009", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Trịnh Thu Uyên", phone: "0901000010", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Nguyễn Thị Hoài", phone: "0901000011", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Đào Duy Mạnh", phone: "0901000012", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Lê Hải Lưu", phone: "0901000013", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Dương Tuệ Nhi", phone: "0901000014", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Thái Hoàng Hải", phone: "0901000015", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Nguyễn Thị Phương Hồng", phone: "0901000016", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Chu Minh Quân", phone: "0901000017", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Ngô Thị Lan Phượng", phone: "0901000018", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Lê Minh Thủy", phone: "0901000019", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Hoàng Thu Giang", phone: "0901000020", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Đỗ Thành Đạt", phone: "0901000021", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Hoa Gia Bảo", phone: "0901000022", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Đàm Hằng Phương", phone: "0901000023", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Nguyễn Thị Quỳnh", phone: "0901000024", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
    { fullName: "Phạm Phương Anh", phone: "0901000025", role: "NHAN_SU_HYBRID" as const, status: "ACTIVE" as const },
  ];

  for (const userData of users) {
    await prisma.user.upsert({
      where: { phone: userData.phone },
      update: {},
      create: {
        ...userData,
        passwordHash,
        startDate: new Date("2026-08-01"),
      },
    });
  }
  console.log(`✅ ${users.length} users created (password: 123456)`);

  // 4. Create contracts for hybrid staff
  const hybridUsers = await prisma.user.findMany({
    where: { role: "NHAN_SU_HYBRID" },
  });

  for (const user of hybridUsers) {
    await prisma.contract.upsert({
      where: { id: user.id },
      update: {},
      create: {
        userId: user.id,
        startDate: new Date("2026-08-01"),
        endDate: new Date("2026-11-01"), // 3 months
        status: "ACTIVE",
        contractType: "khoan_viec",
      },
    });
  }
  console.log(`✅ ${hybridUsers.length} contracts created`);

  console.log("\n🎉 Seed completed!");
  console.log("\n📝 Login credentials:");
  console.log("  Admin:    0900000001 / 123456");
  console.log("  HR:       0912509317 / 123456");
  console.log("  Manager:  0964774572 / 123456");
  console.log("  QC:       0854201465 / 123456");
  console.log("  Staff:    0901000001 / 123456");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
