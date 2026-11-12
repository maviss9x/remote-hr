const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: { contains: '0899328640' } },
        { fullName: { contains: 'Trang' } }
      ]
    }
  });
  console.log('User:', JSON.stringify(user, null, 2));
  if (user) {
    const shifts = await prisma.shiftRegistration.findMany({
      where: {
        userId: user.id,
        weekNumber: 45
      },
      include: {
        dailyReport: true,
        loginSession: true
      }
    });
    console.log('Shifts week 45 count:', shifts.length);
    console.log('Shifts week 45:', JSON.stringify(shifts, null, 2));

    const allUserShifts = await prisma.shiftRegistration.findMany({
      where: {
        userId: user.id
      },
      orderBy: { shiftDate: 'desc' },
      take: 20
    });
    console.log('Recent 20 shifts:', JSON.stringify(allUserShifts, null, 2));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
