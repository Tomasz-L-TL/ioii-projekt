import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

const browserName =
  process.env.PLAYWRIGHT_BROWSER === 'firefox' ? 'firefox' : 'chromium';

const webPort = Number(process.env.WEB_PORT ?? 5173);
const apiPort = Number(process.env.API_PORT ?? 3001);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  // Scenariusze mutujące tę samą tymczasową bazę wykonują się kolejno.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  // Ślady sieci mogłyby zapisać hasło logowania. Hasło istnieje tylko w pamięci.
  use: { baseURL: `http://127.0.0.1:${webPort}`, trace: 'off' },
  projects: [
    {
      name:
        browserName === 'firefox'
          ? 'firefox'
          : (process.env.PLAYWRIGHT_CHANNEL ?? 'chromium'),
      use: {
        ...devices[
          browserName === 'firefox' ? 'Desktop Firefox' : 'Desktop Chrome'
        ],
        browserName,
        ...(browserName === 'chromium' && process.env.PLAYWRIGHT_CHANNEL
          ? { channel: process.env.PLAYWRIGHT_CHANNEL }
          : {}),
      },
    },
  ],
  webServer: [
    {
      // Testy nie potrzebują watchera. Uruchamiamy ten sam entrypoint API.
      command: 'node --import tsx apps/api/src/server.ts',
      url: `http://127.0.0.1:${apiPort}/api/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { WEB_PORT: String(webPort), API_PORT: String(apiPort) },
    },
    {
      command: 'npm run dev --workspace @roombook/web',
      url: `http://127.0.0.1:${webPort}/api/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { WEB_PORT: String(webPort), API_PORT: String(apiPort) },
    },
  ],
});
