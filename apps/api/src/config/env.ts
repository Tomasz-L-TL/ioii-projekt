import { resolve } from 'node:path';
import { config } from 'dotenv';
import { repositoryRoot, resolveDatabaseUrl } from './database.js';

export function loadEnv(): void {
  config({ path: resolve(repositoryRoot, '.env'), quiet: true });
}

export function readEnv(source: NodeJS.ProcessEnv = process.env) {
  const port = Number(source.API_PORT ?? 3001);
  const webPort = Number(source.WEB_PORT ?? 5173);
  if (
    ![port, webPort].every(
      (value) => Number.isInteger(value) && value >= 1 && value <= 65535,
    )
  ) {
    throw new Error(
      'API_PORT i WEB_PORT muszą być liczbami całkowitymi od 1 do 65535.',
    );
  }
  if (
    !source.SESSION_SECRET ||
    !/^[a-f\d]{64}$/iu.test(source.SESSION_SECRET)
  ) {
    throw new Error(
      'SESSION_SECRET jest wymagany: 32 losowe bajty zapisane jako 64 znaki hex w lokalnym .env.',
    );
  }
  const nodeEnv = source.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv))
    throw new Error('Niepoprawne NODE_ENV.');
  return {
    port,
    host: '127.0.0.1',
    databaseUrl: resolveDatabaseUrl(
      source.DATABASE_URL ?? 'file:./prisma/dev.db',
    ),
    session: {
      secret: Buffer.from(source.SESSION_SECRET, 'hex'),
      secure: nodeEnv === 'production',
    },
    allowedOrigins: [`http://127.0.0.1:${webPort}`, `http://127.0.0.1:${port}`],
  };
}
