import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { repositoryRoot } from '../config/database.js';
import { createDatabase } from '../db/client.js';
import { seedDemo } from '../db/seed.js';

export async function testDatabase(seed = true) {
  const directory = await mkdtemp(join(tmpdir(), 'roombook-test-'));
  const databaseUrl = `file:${join(directory, 'test.db')}`;
  const password = randomBytes(24).toString('hex');
  const secret = randomBytes(32);
  // Usuń wyłącznie własny katalog tymczasowy, także po błędzie migracji.
  const cleanup = async () => {
    const child = relative(tmpdir(), directory);
    if (
      isAbsolute(child) ||
      child.startsWith('..') ||
      !child.startsWith('roombook-test-')
    ) {
      throw new Error('Niebezpieczna ścieżka testowej bazy.');
    }
    await rm(directory, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  };
  try {
    await promisify(execFile)(
      process.execPath,
      [
        join(repositoryRoot, 'node_modules/prisma/build/index.js'),
        'migrate',
        'deploy',
      ],
      {
        cwd: repositoryRoot,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        windowsHide: true,
        timeout: 30_000,
      },
    );
    const db = await createDatabase(databaseUrl);
    try {
      if (seed) await seedDemo(db, password);
    } catch (error) {
      await db.$disconnect();
      throw error;
    }
    return {
      db,
      databaseUrl,
      password,
      secret,
      async close() {
        await db.$disconnect();
        await cleanup();
      },
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
