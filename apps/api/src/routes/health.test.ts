import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { testDatabase } from '../testing/database.js';

describe('GET /api/health', () => {
  let fixture: Awaited<ReturnType<typeof testDatabase>>;
  let app: Awaited<ReturnType<typeof createApp>>['app'];
  beforeAll(async () => {
    fixture = await testDatabase(false);
    ({ app } = await createApp({
      db: fixture.db,
      session: { secret: fixture.secret, secure: false },
      allowedOrigins: [],
    }));
  }, 30_000);
  afterAll(async () => {
    await fixture?.close();
  });
  it('zwraca 200 i diagnostyczny JSON', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual({ status: 'ok' });
  });
});
