import { createApp } from './app.js';
import { loadEnv, readEnv } from './config/env.js';
import { createDatabase } from './db/client.js';

loadEnv();
const env = readEnv();
const db = await createDatabase(env.databaseUrl);
const { app } = await createApp({
  db,
  session: env.session,
  allowedOrigins: env.allowedOrigins,
});

const server = app.listen(env.port, env.host, () => {
  console.info(`API RoomBook: http://${env.host}:${env.port}/api/health`);
});

server.on('error', async () => {
  console.error(
    'Nie udało się uruchomić API RoomBook. Sprawdź port i lokalną konfigurację.',
  );
  await db.$disconnect();
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      void db.$disconnect();
    });
  });
}
