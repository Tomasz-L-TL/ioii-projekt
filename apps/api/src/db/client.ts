import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client.js';
import { resolveDatabaseUrl } from '../config/database.js';

export async function createDatabase(
  databaseUrl: string,
): Promise<PrismaClient> {
  const db = new PrismaClient({
    // Krótki limit synchronicznego oczekiwania adaptera; konflikt zapisu → 409.
    adapter: new PrismaBetterSqlite3({
      url: resolveDatabaseUrl(databaseUrl),
      timeout: 100,
    }),
  });
  try {
    await db.$connect();
    await db.$executeRawUnsafe('PRAGMA foreign_keys = ON');
    const rows = await db.$queryRawUnsafe<{ foreign_keys: bigint }[]>(
      'PRAGMA foreign_keys',
    );
    if (Number(rows[0]?.foreign_keys) !== 1) {
      throw new Error('SQLite nie egzekwuje kluczy obcych.');
    }
    return db;
  } catch (error) {
    await db.$disconnect();
    throw error;
  }
}
