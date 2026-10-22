import { loadEnv } from '../apps/api/src/config/env.js';
import { createDatabase } from '../apps/api/src/db/client.js';
import { seedDemo } from '../apps/api/src/db/seed.js';

loadEnv();
const password = process.env.SEED_DEMO_PASSWORD;
if (!password) {
  throw new Error(
    'Ustaw lokalne SEED_DEMO_PASSWORD w .env przed uruchomieniem seeda.',
  );
}
const db = await createDatabase(
  process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
);
try {
  await seedDemo(db, password);
  console.info(
    'Seed zakończony: brakujące konta i sale dodane, istniejące dane zachowane.',
  );
} catch {
  console.error(
    'Seed nie powiódł się; transakcja została wycofana. Sprawdź lokalną konfigurację i migracje.',
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
