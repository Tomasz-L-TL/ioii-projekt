import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const envDir = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  const webPort = Number(process.env.WEB_PORT ?? env.WEB_PORT ?? 5173);
  const apiPort = Number(process.env.API_PORT ?? env.API_PORT ?? 3001);

  for (const port of [webPort, apiPort]) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(
        'Porty WEB_PORT i API_PORT muszą być liczbami od 1 do 65535.',
      );
    }
  }

  return {
    plugins: [react()],
    envDir,
    server: {
      host: '127.0.0.1',
      port: webPort,
      strictPort: true,
      proxy: { '/api': { target: `http://127.0.0.1:${apiPort}` } },
    },
  };
});
