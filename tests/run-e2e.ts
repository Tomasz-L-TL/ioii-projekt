import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { repositoryRoot } from '../apps/api/src/config/database.js';
import { testDatabase } from '../apps/api/src/testing/database.js';

// Odrębna, migrowana baza i sekret w pamięci także dla serwera Playwright.
const fixture = await testDatabase(false);
await fixture.db.$disconnect();
try {
  const result = spawnSync(
    process.execPath,
    [
      join(repositoryRoot, 'node_modules/@playwright/test/cli.js'),
      'test',
      ...process.argv.slice(2),
    ],
    {
      cwd: repositoryRoot,
      stdio: 'inherit',
      windowsHide: true,
      env: {
        ...process.env,
        SESSION_SECRET: fixture.secret.toString('hex'),
        DATABASE_URL: fixture.databaseUrl,
        NODE_ENV: 'development',
      },
    },
  );
  process.exitCode = result.status ?? 1;
} finally {
  // Playwright zakończył serwery; można bezpiecznie zamknąć i usunąć pliki.
  await fixture.close();
}
