// Osobny proces API: generator obciążenia nie współdzieli jego event loop.
import { createApp } from '../../apps/api/src/app.js';
import { createDatabase } from '../../apps/api/src/db/client.js';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, relative, resolve } from 'node:path';

if (!process.send) throw new Error('Serwer perf wymaga runnera IPC.');
process.once(
  'message',
  async (config: { databaseUrl: string; secret: string }) => {
    let db: Awaited<ReturnType<typeof createDatabase>> | undefined;
    try {
      const path = resolve(config.databaseUrl.slice(5));
      const child = relative(tmpdir(), path);
      if (
        !config.databaseUrl.startsWith('file:') ||
        isAbsolute(child) ||
        child.startsWith('..') ||
        !child.startsWith('roombook-test-') ||
        basename(path) !== 'test.db' ||
        !/^[a-f\d]{64}$/u.test(config.secret)
      )
        throw new Error('Niebezpieczna konfiguracja perf.');
      db = await createDatabase(config.databaseUrl);
      const { app } = await createApp({
        db,
        session: { secret: Buffer.from(config.secret, 'hex'), secure: false },
        // Klienci Node nie wysyłają Origin; middleware nadal weryfikuje JSON i źródło.
        allowedOrigins: [],
      });
      const server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address && typeof address !== 'string')
          process.send?.({ port: address.port });
      });
      server.once('error', () => process.exit(1));
      process.once('disconnect', () => {
        server.close(() => {
          void db?.$disconnect().then(() => process.exit(0));
        });
        server.closeAllConnections();
      });
    } catch {
      await db?.$disconnect();
      // Nie wypisujemy konfiguracji, DB ani sekretu w razie awarii.
      process.exit(1);
    }
  },
);
