import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { repositoryRoot } from '../apps/api/src/config/database.js';
import { testDatabase } from '../apps/api/src/testing/database.js';

// Porty przydziela OS. Playwright nadal odmawia użycia zajętego portu,
// również przy wyścigu między zwolnieniem portu a uruchomieniem serwera.
async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Brak portu.');
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}
const args = process.argv.slice(2);
const engineArg = args.find((arg) => arg.startsWith('--engine='));
const engine =
  engineArg?.slice('--engine='.length) ??
  process.env.PLAYWRIGHT_BROWSER ??
  'chromium';
if (!['chromium', 'firefox'].includes(engine))
  throw new Error('Nieznana przeglądarka E2E.');
const apiPort = await freePort();
let webPort = await freePort();
while (webPort === apiPort) webPort = await freePort();

// Odrębna, migrowana baza i sekret w pamięci także dla serwera Playwright.
const fixture = await testDatabase(true);
try {
  await fixture.db.$disconnect();
  const result = spawnSync(
    process.execPath,
    [
      join(repositoryRoot, 'node_modules/@playwright/test/cli.js'),
      'test',
      ...args.filter((arg) => arg !== engineArg),
    ],
    {
      cwd: repositoryRoot,
      stdio: 'inherit',
      windowsHide: true,
      env: {
        ...process.env,
        SESSION_SECRET: fixture.secret.toString('hex'),
        DATABASE_URL: fixture.databaseUrl,
        ROOMBOOK_E2E_PASSWORD: fixture.password,
        NODE_ENV: 'development',
        API_PORT: String(apiPort),
        WEB_PORT: String(webPort),
        PLAYWRIGHT_BROWSER: engine,
      },
    },
  );
  process.exitCode = result.status ?? 1;
} finally {
  // Playwright zakończył serwery; można bezpiecznie zamknąć i usunąć pliki.
  await fixture.close();
}
