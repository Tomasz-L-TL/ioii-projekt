import { app } from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.port, env.host, () => {
  console.info(`API RoomBook: http://${env.host}:${env.port}/api/health`);
});

server.on('error', (error) => {
  console.error('Nie udało się uruchomić API RoomBook:', error);
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close();
  });
}
