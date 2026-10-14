import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

const webPort = Number(process.env.WEB_PORT ?? 5173);
const apiPort = Number(process.env.API_PORT ?? 3001);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${webPort}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: `http://127.0.0.1:${webPort}`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: { WEB_PORT: String(webPort), API_PORT: String(apiPort) },
  },
});
