# Lost & Found — API

Backend de la plataforma Lost & Found: publicar objetos perdidos/encontrados y conectar a sus dueños con quienes los encontraron.

## Stack
- NestJS (TypeScript)
- PostgreSQL + PostGIS
- TypeORM

## Desarrollo local

```bash
cp .env.example .env
docker compose up -d     # PostgreSQL + PostGIS
npm install
npm run start:dev
```

## Scripts
- `npm run start:dev` — servidor en modo watch
- `npm run build` — compila a `dist/`
- `npm test` / `npm run test:e2e` — tests (Vitest)
- `npm run lint` — oxlint
