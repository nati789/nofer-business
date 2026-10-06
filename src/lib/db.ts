import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54329/nofer?sslmode=disable';
// PGlite's socket adapter needs serialized queries even when its URL is explicit.
const localDatabase = ['localhost', '127.0.0.1'].includes(new URL(connectionString).hostname);
export const db =
  globalDb.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      max: localDatabase ? 1 : 10,
      connectionTimeoutMillis: 10000,
      connectionString,
    }),
  });
if (process.env.NODE_ENV !== 'production') globalDb.prisma = db;
