import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

config({
  path: fileURLToPath(new URL('../../../../.env', import.meta.url)),
  quiet: true,
});

const port = Number(process.env.API_PORT ?? 3001);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('API_PORT musi być liczbą całkowitą od 1 do 65535.');
}

export const env = { port, host: '127.0.0.1' };
