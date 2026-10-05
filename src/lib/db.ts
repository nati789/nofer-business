import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export const db =
  globalDb.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      max: process.env.DATABASE_URL ? 10 : 1,
      connectionTimeoutMillis: 10000,
      connectionString:
        process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@127.0.0.1:54329/nofer?sslmode=disable',
    }),
  });
if (process.env.NODE_ENV !== 'production') globalDb.prisma = db;
