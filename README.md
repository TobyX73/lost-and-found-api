# Lost & Found — API

Backend de la plataforma Lost & Found: publicar objetos perdidos/encontrados y conectar a sus dueños con quienes los encontraron.

La arquitectura, el modelo de datos, el algoritmo de matching y el roadmap completo están en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Estado

| Fase | Contenido | Estado |
| --- | --- | --- |
| 0 | Base: env validado, migraciones, PostGIS, Swagger, health check | ✅ |
| 1 | Auth (JWT + refresh rotativo) y usuarios | ✅ |
| 2 | Categorías y publicaciones con geolocalización y ubicación privada | ✅ |
| 3 | Búsqueda por distancia, fecha y texto | ⏳ |
| 4 | Fotos | ⏳ |
| 5 | Matching entre publicaciones | ⏳ |
| 6 | Notificaciones | ⏳ |
| 7 | Verificación de propiedad (claims) | ⏳ |
| 8 | Chat privado | ⏳ |

## Stack
- NestJS 12 (TypeScript, ESM)
- PostgreSQL 17 + PostGIS 3.5, `pg_trgm`, `unaccent`
- TypeORM 1.x (migraciones escritas a mano)
- Zod 4 para validación (`StandardSchemaValidationPipe`) y variables de entorno
- JWT (access) + refresh tokens opacos rotativos con detección de reutilización
- Vitest + Supertest

## Desarrollo local

```bash
cp .env.example .env     # y completar JWT_ACCESS_SECRET
docker compose up -d     # PostgreSQL + PostGIS en el puerto 5434
npm install
npm run start:dev        # las migraciones corren al iniciar (DB_MIGRATIONS_RUN=true)
```

Para generar un `JWT_ACCESS_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> El contenedor usa el puerto **5434** para no chocar con PostgreSQL instalados localmente (5432/5433). Se cambia con `DB_PORT` en `.env`.

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

## Probar con Postman

En [`postman/lost-and-found.postman_collection.json`](postman/lost-and-found.postman_collection.json) hay una colección lista con todos los endpoints y tests automáticos.

1. Postman → **Import** → elegir el archivo. Se crea la colección **Lost & Found API** con una carpeta por módulo.
2. Levantar la API (`npm run start:dev`).
3. Correr en orden: `0. Health` → `1. Auth / Register` → `3. Categories / Listar categorías` → `4. Posts`.
   - **Register** usa un email aleatorio y guarda solo `accessToken` y `refreshToken`.
   - **Listar categorías** guarda el `categoryId` de *billeteras*.
   - **Publicar** guarda el `postId`.
   - Todos los requests autenticados usan `{{accessToken}}` (auth heredada de la colección).
4. También se puede correr todo de una: botón derecho sobre la colección → **Run collection**.

Para apuntar a otro servidor, cambiar la variable `baseUrl` de la colección (por defecto `http://localhost:3000/api`).

## Autenticación

Las rutas requieren `Authorization: Bearer <accessToken>` salvo las marcadas como públicas. Algunas rutas públicas responden distinto si se manda un token válido (por ejemplo, el autor ve la ubicación exacta de su publicación).

- **Access token:** JWT de 15 minutos.
- **Refresh token:** opaco y de un solo uso. Cada `/auth/refresh` devuelve uno nuevo. Reutilizar uno ya gastado revoca toda la sesión.

Errores de validación (400):

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["email: Invalid email address", "password: Too small: expected string to have >=8 characters"]
}
```

## Endpoints

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| GET | `/api/health` | pública | Estado de la API y la DB |
| POST | `/api/auth/register` | pública | Crear cuenta |
| POST | `/api/auth/login` | pública | Iniciar sesión |
| POST | `/api/auth/refresh` | pública | Rotar el refresh token |
| POST | `/api/auth/logout` | pública | Revocar el refresh token |
| GET | `/api/users/me` | Bearer | Mi perfil |
| PATCH | `/api/users/me` | Bearer | Editar mi perfil |
| GET | `/api/categories` | pública | Listar categorías |
| GET | `/api/posts` | pública | Listar publicaciones (filtros + paginación) |
| GET | `/api/posts/mine` | Bearer | Mis publicaciones (todos los estados) |
| GET | `/api/posts/:id` | pública* | Ver una publicación |
| POST | `/api/posts` | Bearer | Publicar objeto perdido o encontrado |
| PATCH | `/api/posts/:id` | Bearer (autor) | Editar publicación |
| DELETE | `/api/posts/:id` | Bearer (autor) | Borrar publicación |

\* Si se envía el token del autor, la respuesta incluye la ubicación exacta.

### Auth

```bash
# Registro
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@example.com","password":"super-secret-1","displayName":"Ana"}'

# Login → { user, accessToken, refreshToken, tokenType, expiresIn }
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@example.com","password":"super-secret-1"}'

# Refresh
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'

# Perfil
curl http://localhost:3000/api/users/me -H "Authorization: Bearer <accessToken>"
```

### Publicaciones

Una publicación es un objeto **perdido** (`LOST`) o **encontrado** (`FOUND`).

**Privacidad de la ubicación:**
- La ubicación exacta (`location`) se guarda pero solo la ve el autor.
- El resto ve `approximateLocation`: el punto ajustado a una grilla de ~300 m. El ajuste es determinístico, así que no se puede promediar editando varias veces.
- El resto también ve `approximateRadiusM`, que nunca es menor a 300 m.

```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "FOUND",
    "title": "Billetera de cuero marrón",
    "description": "La encontré en un banco de Plaza de Mayo, cerca de la catedral.",
    "categoryId": 1,
    "attributes": { "color": "marrón", "brand": "Prune" },
    "occurredAt": "2026-11-25T15:30:00-03:00",
    "location": { "lat": -34.60837, "lng": -58.37224 },
    "radiusM": 50,
    "locationLabel": "Plaza de Mayo"
  }'
```

| Campo | Tipo | Reglas |
| --- | --- | --- |
| `type` | `LOST` \| `FOUND` | obligatorio |
| `title` | string | 3–120 caracteres |
| `description` | string | 10–2000 caracteres |
| `categoryId` | number | id de `/api/categories` |
| `attributes` | objeto | opcional: `color`, `brand`, `model`, `size` (se guardan en minúscula) |
| `occurredAt` | fecha ISO 8601 con zona horaria | cuándo se perdió o encontró, no puede ser futura |
| `location` | `{ lat, lng }` | ubicación exacta (privada) |
| `radiusM` | number | 10–5000, incertidumbre en metros (default 100) |
| `locationLabel` | string | opcional, ej. "Plaza de Mayo" |

Respuesta para alguien que no es el autor (el autor además recibe `location` y `radiusM`):

```json
{
  "id": "5f0c…",
  "type": "FOUND",
  "status": "OPEN",
  "title": "Billetera de cuero marrón",
  "description": "La encontré en un banco de Plaza de Mayo, cerca de la catedral.",
  "category": { "id": 1, "slug": "billeteras", "name": "Billeteras y carteras" },
  "attributes": { "color": "marrón", "brand": "prune" },
  "occurredAt": "2026-11-25T18:30:00.000Z",
  "approximateLocation": { "lat": -34.609, "lng": -58.371981 },
  "approximateRadiusM": 300,
  "locationLabel": "Plaza de Mayo",
  "author": { "id": "a1b2…", "displayName": "Ana" },
  "isOwner": false,
  "createdAt": "…",
  "updatedAt": "…"
}
```

**Listar:**

```bash
# Filtros opcionales: type, categoryId, status (default OPEN), page (default 1), limit (default 20, máx 50)
curl "http://localhost:3000/api/posts?type=FOUND&categoryId=1&page=1&limit=10"
```

Devuelve `{ "data": [...], "meta": { "page", "limit", "total", "totalPages" } }`.

**Editar** (solo el autor; todos los campos son opcionales salvo `type`, que no se puede cambiar):

```bash
curl -X PATCH http://localhost:3000/api/posts/<id> \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"status":"RESOLVED"}'
```

El autor solo puede poner `status` en `OPEN` o `RESOLVED`. `MATCHED` y `EXPIRED` los asigna el sistema.

**Estados de error:**
- `401`: falta el token.
- `403`: no sos el autor.
- `404`: la publicación no existe.
- `400`: body inválido, id que no es UUID o categoría inexistente.
