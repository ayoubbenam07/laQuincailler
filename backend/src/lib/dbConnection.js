import prisma from '../config/prisma.js';

export async function dbConnection() {
  try {
    await prisma.$connect();
    console.log('💎 Prisma connected to the database successfully!');
  } catch (error) {
    console.error('❌ Prisma database connection failed:', error);
    process.exit(1);
  }
}