import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../app.js';

describe('GET /api/health', () => {
  it('zwraca 200 i diagnostyczny JSON', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual({ status: 'ok' });
  });
});
