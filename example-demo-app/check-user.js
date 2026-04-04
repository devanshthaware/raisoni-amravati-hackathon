const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'hackytricky8.30@gmail.com';
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    console.log('User found:', user);
  } catch (error) {
    console.error('Error finding user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
