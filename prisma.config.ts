import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { resolveDatabaseUrl } from './apps/api/src/config/database.js';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: {
    url: resolveDatabaseUrl(process.env.DATABASE_URL ?? 'file:./prisma/dev.db'),
  },
});
