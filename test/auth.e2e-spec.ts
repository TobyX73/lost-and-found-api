// Needs the database from docker-compose (docker compose up -d). Migrations run on boot.
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

describe('Auth flow (e2e)', () => {
  let app: INestApplication<App>;
  const email = `e2e-${randomUUID()}@example.com`;
  const password = 'super-secret-1';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('reports the database as healthy', async () => {
    const res = await http().get('/api/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('validates the register body', async () => {
    const res = await http()
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'short', displayName: 'A' })
      .expect(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining([expect.stringMatching(/^email:/)]),
    );
  });

  it('registers, logs in, reads the profile, rotates and logs out', async () => {
    const registered = await http()
      .post('/api/auth/register')
      .send({ email: email.toUpperCase(), password, displayName: 'Ana' })
      .expect(201);
    expect(registered.body.user).toMatchObject({ email, displayName: 'Ana' });
    expect(registered.body.user).not.toHaveProperty('passwordHash');

    await http()
      .post('/api/auth/register')
      .send({ email, password, displayName: 'Ana' })
      .expect(409);

    await http()
      .post('/api/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);

    const login = await http()
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    const { accessToken, refreshToken } = login.body;

    await http().get('/api/users/me').expect(401);
    const me = await http()
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body.email).toBe(email);

    const patched = await http()
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ displayName: 'Ana María' })
      .expect(200);
    expect(patched.body.displayName).toBe('Ana María');

    const rotated = await http()
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    expect(rotated.body.refreshToken).not.toBe(refreshToken);

    // Reusing the spent token revokes the family, so the new token dies too.
    await http().post('/api/auth/refresh').send({ refreshToken }).expect(401);
    await http()
      .post('/api/auth/refresh')
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(401);
  });

  it('logout revokes the refresh token', async () => {
    const login = await http()
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    await http()
      .post('/api/auth/logout')
      .send({ refreshToken: login.body.refreshToken })
      .expect(204);
    await http()
      .post('/api/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
  });
});
