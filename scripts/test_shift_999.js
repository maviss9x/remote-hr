const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "sqlserver://localhost:14333;database=remote_hr;user=sa;password=HybridHr@2026;trustServerCertificate=true;encrypt=false;"
    }
  }
});

async function main() {
  const shift = await prisma.shiftRegistration.findUnique({
    where: { id: 999 },
    include: { dailyReport: true, loginSession: true }
  });
  console.log('Shift 999:', JSON.stringify(shift, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

