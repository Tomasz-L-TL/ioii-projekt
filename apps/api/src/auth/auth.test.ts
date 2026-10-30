import { createHmac, randomBytes } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { testDatabase } from '../testing/database.js';
import { readEnv } from '../config/env.js';
import { errorHandler } from '../http/errors.js';
import { requireAuth, requireRole } from './middleware.js';
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from './session.js';

describe('API auth na rzeczywistym adapterze SQLite', () => {
  let fixture: Awaited<ReturnType<typeof testDatabase>>;
  let app: Awaited<ReturnType<typeof createApp>>['app'];
  let roleApp: express.Express;
  beforeAll(async () => {
    fixture = await testDatabase();
    const created = await createApp({
      db: fixture.db,
      session: { secret: fixture.secret, secure: false },
      allowedOrigins: ['http://127.0.0.1:5173', 'http://127.0.0.1:3001'],
    });
    app = created.app;
    roleApp = express();
    // Kontrolny router istnieje wyłącznie w tym pliku testowym.
    roleApp.get(
      '/admin',
      requireAuth(created.auth),
      requireRole('ADMIN'),
      (_req, res) => res.json({ ok: true }),
    );
    roleApp.get(
      '/student',
      requireAuth(created.auth),
      requireRole('STUDENT'),
      (_req, res) => res.json({ ok: true }),
    );
    roleApp.get('/role-alone', requireRole('ADMIN'), (_req, res) =>
      res.json({ ok: true }),
    );
    roleApp.use(errorHandler);
  });
  afterAll(async () => {
    await fixture?.close();
  });

  const login = (email: string) =>
    request(app)
      .post('/api/auth/login')
      .send({ email, password: fixture.password });
  const cookie = (id: number) =>
    `${SESSION_COOKIE}=${createSessionToken(id, fixture.secret)}`;
  const signed = (payload: unknown) => {
    const value = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${SESSION_COOKIE}=${value}.${createHmac('sha256', fixture.secret).update(value).digest('base64url')}`;
  };

  it.each([
    ['  ANNA.NOWAK@ROOMBOOK.TEST  ', 'STUDENT'],
    ['admin@roombook.test', 'ADMIN'],
  ])(
    'loguje %s, odczytuje rolę i zwraca tylko bezpieczne DTO',
    async (email, role) => {
      const response = await login(email).expect(200);
      expect(Object.keys(response.body).sort()).toEqual([
        'displayName',
        'email',
        'id',
        'role',
      ]);
      expect(response.body.role).toBe(role);
      expect(response.body.email).toBe(email.trim().toLowerCase());
      const setCookie = response.headers['set-cookie']![0]!;
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
      expect(setCookie).toContain('Path=/api');
      expect(setCookie).toContain(`Max-Age=${SESSION_TTL_SECONDS}`);
      expect(setCookie).toContain('Expires=');
      expect(setCookie).not.toContain('Secure');
      expect(setCookie).not.toContain(response.body.email);
      const token = setCookie.split(';')[0]!.slice(SESSION_COOKIE.length + 1);
      const payload = JSON.parse(
        Buffer.from(token.split('.')[0]!, 'base64url').toString('utf8'),
      );
      expect(Object.keys(payload).sort()).toEqual(['exp', 'sub']);
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
      const me = await request(app)
        .get('/api/auth/me')
        .set('Cookie', setCookie.split(';')[0]!)
        .expect(200);
      expect(me.body).toEqual(response.body);
      expect(me.headers['cache-control']).toBe('no-store');
      expect(JSON.stringify(me.body)).not.toContain('password');
    },
  );

  it('nie odróżnia nieistniejącego loginu i błędnego hasła, bez cookie', async () => {
    const wrong = randomBytes(24).toString('hex');
    const first = await request(app)
      .post('/api/auth/login')
      .send({ email: 'anna.nowak@roombook.test', password: wrong })
      .expect(401);
    const second = await request(app)
      .post('/api/auth/login')
      .send({ email: 'missing@roombook.test', password: wrong })
      .expect(401);
    expect(first.body).toEqual(second.body);
    expect(first.body.error.code).toBe('LOGIN_FAILED');
    expect(first.headers['set-cookie']).toBeUndefined();
    expect(second.headers['set-cookie']).toBeUndefined();
  });

  it('brak cookie i sfałszowany podpis dają 401', async () => {
    await request(app).get('/api/auth/me').expect(401);
    await request(app)
      .get('/api/auth/me')
      .set(
        'Cookie',
        `${SESSION_COOKIE}=${createSessionToken(1, randomBytes(32))}`,
      )
      .expect(401);
    const original = cookie(2);
    await request(app)
      .get('/api/auth/me')
      .set('Cookie', original.replace('=', '=x'))
      .expect(401);
  });

  it('odrzuca wygasły token, błędny format, nieobecne exp i niepoprawne identyfikatory', async () => {
    const now = Math.floor(Date.now() / 1000);
    const tokens = [
      `${SESSION_COOKIE}=${createSessionToken(1, fixture.secret, Date.now() - (SESSION_TTL_SECONDS + 1) * 1000)}`,
      `${SESSION_COOKIE}=invalid`,
      `${SESSION_COOKIE}=%%%.bad`,
      signed({ sub: 1 }),
      signed({ sub: 1, exp: now }),
      signed({ sub: 1, exp: 'tomorrow' }),
      signed({ sub: '1', exp: now + 60 }),
      signed({ sub: -1, exp: now + 60 }),
      signed({ sub: 1.5, exp: now + 60 }),
      signed({ sub: 1, exp: now + SESSION_TTL_SECONDS + 1000 }),
      signed({ sub: 999999, exp: now + 60 }),
      `${cookie(1)}; ${cookie(2)}`,
    ];
    for (const value of tokens)
      await request(app).get('/api/auth/me').set('Cookie', value).expect(401);
  });

  it('logout usuwa cookie i sesja przeglądarki przestaje działać', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/login')
      .send({ email: 'admin@roombook.test', password: fixture.password })
      .expect(200);
    await agent.get('/api/auth/me').expect(200);
    const logout = await agent.post('/api/auth/logout').send({}).expect(204);
    expect(logout.headers['set-cookie']![0]).toMatch(
      /roombook_session=; Path=\/api; Expires=Thu, 01 Jan 1970/u,
    );
    expect(logout.headers['set-cookie']![0]).toContain('HttpOnly');
    expect(logout.headers['set-cookie']![0]).toContain('SameSite=Lax');
    await agent.get('/api/auth/me').expect(401);
    await request(app).post('/api/auth/logout').send({}).expect(204);
  });

  it('requireRole odrzuca niezalogowanego i studenta, akceptuje admina', async () => {
    await request(roleApp).get('/admin').expect(401);
    await request(roleApp).get('/role-alone').expect(401);
    await request(roleApp).get('/admin').set('Cookie', cookie(2)).expect(403);
    await request(roleApp).get('/admin').set('Cookie', cookie(1)).expect(200);
    await request(roleApp).get('/student').set('Cookie', cookie(2)).expect(200);
    await request(roleApp).get('/student').set('Cookie', cookie(1)).expect(403);
    await request(app).get('/admin').expect(404);
    // Moduł admin etapu 08 chroni cały prefiks, także nieznane ścieżki.
    await request(app).get('/api/admin').expect(401);
    await request(app).get('/api/admin').set('Cookie', cookie(1)).expect(404);
  });

  it('odczytuje aktualną rolę z DB przy każdym żądaniu, a usunięte konto daje 401', async () => {
    const value = cookie(2);
    await fixture.db.user.update({ where: { id: 2 }, data: { role: 'ADMIN' } });
    try {
      await request(roleApp).get('/admin').set('Cookie', value).expect(200);
      const me = await request(app)
        .get('/api/auth/me')
        .set('Cookie', value)
        .expect(200);
      expect(me.body.role).toBe('ADMIN');
    } finally {
      await fixture.db.user.update({
        where: { id: 2 },
        data: { role: 'STUDENT' },
      });
    }
    const user = await fixture.db.user.create({
      data: {
        email: 'deleted@roombook.test',
        displayName: 'Konto testowe',
        passwordHash: (
          await fixture.db.user.findUniqueOrThrow({ where: { id: 1 } })
        ).passwordHash,
        role: 'STUDENT',
      },
    });
    const deletedCookie = cookie(user.id);
    await fixture.db.user.delete({ where: { id: user.id } });
    await request(app)
      .get('/api/auth/me')
      .set('Cookie', deletedCookie)
      .expect(401);
  });

  it.each([
    {},
    { email: 'admin@roombook.test' },
    { email: 123, password: 'x' },
    { email: [], password: {} },
    { email: 'admin@roombook.test', password: false },
    { email: 'bad', password: 'x' },
    { email: 'a'.repeat(255) + '@x.test', password: 'x' },
    { email: 'admin@roombook.test', password: 'a'.repeat(73) },
    { email: 'admin@roombook.test', password: 'ą'.repeat(37) },
    { email: 'admin@roombook.test', password: '' },
    { email: 'admin@roombook.test', password: 'x', role: 'ADMIN' },
    [],
  ])('odrzuca błędne dane formularza (%#)', async (body) => {
    const response = await request(app)
      .post('/api/auth/login')
      .send(body)
      .expect(422);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS_INPUT');
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('bezpiecznie odrzuca uszkodzony JSON, nadmierną treść i niewłaściwy Content-Type', async () => {
    for (const [body, code] of [
      ['{"password":"sensitive",', 'INVALID_JSON'],
      [JSON.stringify({ email: 'x'.repeat(5000) }), 'INVALID_BODY'],
    ] as const) {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send(body)
        .expect(400);
      expect(response.body.error.code).toBe(code);
      expect(JSON.stringify(response.body)).not.toContain('sensitive');
      expect(response.headers['set-cookie']).toBeUndefined();
    }
    await request(app)
      .post('/api/auth/login')
      .type('form')
      .send({ email: 'admin@roombook.test', password: 'x' })
      .expect(400);
    await request(app).post('/api/auth/logout').expect(400);
  });

  it.each(['/login', '/logout'])(
    'kontroluje Origin/Fetch Metadata dla %s bez szerokiego CORS',
    async (path) => {
      for (const headers of [
        { Origin: 'https://evil.test' },
        { Origin: 'http://127.0.0.1:9999', 'Sec-Fetch-Site': 'same-site' },
        { Origin: 'null' },
        { 'Sec-Fetch-Site': 'cross-site' },
        { 'Sec-Fetch-Site': 'same-site' },
        { Origin: 'http://127.0.0.1:5173', 'Sec-Fetch-Site': 'cross-site' },
      ]) {
        const response = await request(app)
          .post(`/api/auth${path}`)
          .set(headers)
          .send({})
          .expect(403);
        expect(response.body.error.code).toBe('UNTRUSTED_ORIGIN');
        expect(response.headers['set-cookie']).toBeUndefined();
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
      }
      const response = await request(app)
        .post(`/api/auth${path}`)
        .set('Origin', 'http://127.0.0.1:5173')
        .set('Sec-Fetch-Site', 'same-origin')
        .send(
          path === '/login'
            ? { email: 'admin@roombook.test', password: fixture.password }
            : {},
        )
        .expect(path === '/login' ? 200 : 204);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      await request(app)
        .post('/api/auth/logout')
        .set('Origin', 'http://127.0.0.1:3001')
        .send({})
        .expect(204);
    },
  );

  it('produkcja ustawia Secure zarówno przy logowaniu, jak i czyszczeniu cookie', async () => {
    const secure = (
      await createApp({
        db: fixture.db,
        session: { secret: fixture.secret, secure: true },
        allowedOrigins: ['https://roombook.test'],
      })
    ).app;
    const response = await request(secure)
      .post('/api/auth/login')
      .send({ email: 'admin@roombook.test', password: fixture.password })
      .expect(200);
    expect(response.headers['set-cookie']![0]).toContain('Secure');
    const logout = await request(secure)
      .post('/api/auth/logout')
      .send({})
      .expect(204);
    expect(logout.headers['set-cookie']![0]).toContain('Secure');
  });

  it('błąd SQLite nie ujawnia zapytań, ścieżek i hashy', async () => {
    const broken = await testDatabase();
    try {
      const brokenApp = (
        await createApp({
          db: broken.db,
          session: { secret: broken.secret, secure: false },
          allowedOrigins: [],
        })
      ).app;
      await broken.db.$executeRawUnsafe('DROP TABLE users');
      const response = await request(brokenApp)
        .post('/api/auth/login')
        .send({ email: 'admin@roombook.test', password: broken.password })
        .expect(500);
      expect(response.body).toEqual({
        error: { code: 'INTERNAL_ERROR', message: 'Wewnętrzny błąd serwera.' },
      });
    } finally {
      await broken.close();
    }
  });
});

describe('Walidacja konfiguracji bez prawdziwych sekretów', () => {
  it('wymaga sekretu i odrzuca nieprawidłowe porty/URL', () => {
    expect(() => readEnv({})).toThrow('SESSION_SECRET');
    expect(() => readEnv({ SESSION_SECRET: 'short' })).toThrow(
      'SESSION_SECRET',
    );
    const source = { SESSION_SECRET: randomBytes(32).toString('hex') };
    expect(() => readEnv({ ...source, API_PORT: '0' })).toThrow('API_PORT');
    expect(() => readEnv({ ...source, WEB_PORT: '65536' })).toThrow('WEB_PORT');
    expect(() =>
      readEnv({ ...source, DATABASE_URL: 'https://example.test' }),
    ).toThrow('DATABASE_URL');
    expect(readEnv({ ...source, NODE_ENV: 'production' }).session.secure).toBe(
      true,
    );
    expect(readEnv({ ...source, NODE_ENV: 'development' }).session.secure).toBe(
      false,
    );
  });
});
