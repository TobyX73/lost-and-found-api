// Needs the database from docker-compose (docker compose up -d). Migrations run on boot.
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

describe('Categories and posts (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let otherToken: string;
  let categoryId: number;
  let postId: string;

  const exact = { lat: -34.60837, lng: -58.37224 };

  const http = () => request(app.getHttpServer());

  async function registerUser(name: string): Promise<string> {
    const res = await http()
      .post('/api/auth/register')
      .send({
        email: `e2e-${randomUUID()}@example.com`,
        password: 'super-secret-1',
        displayName: name,
      })
      .expect(201);
    return res.body.accessToken;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    ownerToken = await registerUser('Dueña');
    otherToken = await registerUser('Otro');
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists the seeded categories publicly', async () => {
    const res = await http().get('/api/categories').expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(10);
    const wallets = res.body.find((c: { slug: string }) => c.slug === 'billeteras');
    expect(wallets).toBeDefined();
    categoryId = wallets.id;
  });

  it('requires a token to publish', async () => {
    await http().post('/api/posts').send({}).expect(401);
  });

  it('validates the post body', async () => {
    const res = await http()
      .post('/api/posts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'STOLEN',
        title: 'x',
        description: 'corta',
        categoryId,
        occurredAt: new Date(Date.now() + 86_400_000).toISOString(),
        location: { lat: 200, lng: 0 },
      })
      .expect(400);
    const fields = (res.body.message as string[]).map((m) => m.split(':')[0]);
    expect(fields).toEqual(
      expect.arrayContaining(['type', 'title', 'description', 'occurredAt', 'location.lat']),
    );
  });

  it('rejects an unknown category', async () => {
    await http()
      .post('/api/posts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'FOUND',
        title: 'Billetera',
        description: 'Billetera encontrada en la plaza',
        categoryId: 9999,
        occurredAt: new Date().toISOString(),
        location: exact,
      })
      .expect(400);
  });

  it('creates a post and keeps the exact location for the author only', async () => {
    const created = await http()
      .post('/api/posts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'FOUND',
        title: 'Billetera de cuero marrón',
        description: 'La encontré en un banco de Plaza de Mayo, cerca de la catedral.',
        categoryId,
        attributes: { color: 'Marrón ', brand: 'Prune' },
        occurredAt: new Date(Date.now() - 3_600_000).toISOString(),
        location: exact,
        radiusM: 50,
        locationLabel: 'Plaza de Mayo',
      })
      .expect(201);

    postId = created.body.id;
    expect(created.body).toMatchObject({
      type: 'FOUND',
      status: 'OPEN',
      isOwner: true,
      location: exact,
      radiusM: 50,
      approximateRadiusM: 300,
      attributes: { color: 'marrón', brand: 'prune' },
      category: { slug: 'billeteras' },
      author: { displayName: 'Dueña' },
    });
    expect(created.body.approximateLocation).not.toEqual(exact);

    const anonymous = await http().get(`/api/posts/${postId}`).expect(200);
    expect(anonymous.body.isOwner).toBe(false);
    expect(anonymous.body).not.toHaveProperty('location');
    expect(anonymous.body.approximateLocation).toEqual(created.body.approximateLocation);

    const asOwner = await http()
      .get(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(asOwner.body.location).toEqual(exact);
  });

  it('lists open posts with filters and pagination', async () => {
    const res = await http()
      .get('/api/posts')
      .query({ type: 'FOUND', categoryId, limit: 5 })
      .expect(200);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 5 });
    expect(res.body.data.some((p: { id: string }) => p.id === postId)).toBe(true);
    expect(res.body.data.every((p: { type: string }) => p.type === 'FOUND')).toBe(true);

    const lost = await http().get('/api/posts').query({ type: 'LOST', categoryId }).expect(200);
    expect(lost.body.data.some((p: { id: string }) => p.id === postId)).toBe(false);
  });

  it("lists the author's own posts", async () => {
    const res = await http()
      .get('/api/posts/mine')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.body.data.map((p: { id: string }) => p.id)).toContain(postId);

    const other = await http()
      .get('/api/posts/mine')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    expect(other.body.data).toHaveLength(0);
  });

  it('only lets the author update, and recomputes the public location', async () => {
    await http()
      .patch(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ title: 'Hackeado' })
      .expect(403);

    await http()
      .patch(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'MATCHED' })
      .expect(400);

    const moved = { lat: -34.6037, lng: -58.3816 };
    const res = await http()
      .patch(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Billetera marrón', location: moved, status: 'RESOLVED' })
      .expect(200);
    expect(res.body).toMatchObject({
      title: 'Billetera marrón',
      status: 'RESOLVED',
      location: moved,
      radiusM: 50,
      attributes: { color: 'marrón', brand: 'prune' },
    });
  });

  it('returns 404 for unknown ids and 400 for malformed ones', async () => {
    await http().get(`/api/posts/${randomUUID()}`).expect(404);
    await http().get('/api/posts/not-a-uuid').expect(400);
  });

  it('only lets the author delete', async () => {
    await http()
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
    await http()
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(204);
    await http().get(`/api/posts/${postId}`).expect(404);
  });
});
