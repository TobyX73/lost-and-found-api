# Lost & Found — API

Backend de la plataforma Lost & Found: publicar objetos perdidos/encontrados y conectar a sus dueños con quienes los encontraron.

La arquitectura, el modelo de datos, el algoritmo de matching y el roadmap están en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Stack
- NestJS 12 (TypeScript, ESM)
- PostgreSQL 17 + PostGIS 3.5, `pg_trgm`, `unaccent`
- TypeORM 1.x (migraciones escritas a mano)
- Zod 4 para validación (`StandardSchemaValidationPipe`) y variables de entorno
- JWT (access) + refresh tokens opacos rotativos con detección de reutilización

## Desarrollo local

```bash
cp .env.example .env     # y completar JWT_ACCESS_SECRET
docker compose up -d     # PostgreSQL + PostGIS
npm install
npm run start:dev        # las migraciones corren al iniciar (DB_MIGRATIONS_RUN=true)
```

- API: http://localhost:3000/api
- Swagger: http://localhost:3000/docs (solo fuera de producción)
- Health: http://localhost:3000/api/health

## Scripts
- `npm run start:dev` — servidor en modo watch
- `npm run build` — compila a `dist/`
- `npm test` — tests unitarios (Vitest)
- `npm run test:e2e` — tests e2e (requieren la DB de docker-compose)
- `npm run lint` — oxlint
- `npm run migration:run` / `migration:revert` — migraciones manuales con el CLI de TypeORM
- `npm run migration:create -- src/database/migrations/<nombre>` — nueva migración vacía (agregarla a `src/database/database.options.ts`)

## Endpoints actuales

| Método | Ruta | Auth |
| --- | --- | --- |
| POST | `/api/auth/register` | pública |
| POST | `/api/auth/login` | pública |
| POST | `/api/auth/refresh` | pública |
| POST | `/api/auth/logout` | pública |
| GET / PATCH | `/api/users/me` | Bearer |
| GET | `/api/health` | pública |
