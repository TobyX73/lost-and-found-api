# Arquitectura — Lost & Found API

Plataforma para publicar objetos perdidos o encontrados y conectar a sus dueños con quienes los encontraron.

## Stack

| Capa | Elección | Motivo |
| --- | --- | --- |
| Framework | NestJS 12 (ESM) | Modular, DI, ecosistema first-party |
| Base de datos | PostgreSQL 17 + PostGIS 3.5 | Búsqueda geoespacial (`ST_DWithin`, índices GiST) |
| Texto | `pg_trgm` + `tsvector` (español) + `unaccent` | Similitud textual para búsqueda y matching |
| ORM | TypeORM 1.x | Integración con `@nestjs/typeorm`, migraciones escritas a mano |
| Validación | Zod 4 + `StandardSchemaValidationPipe` | Un solo schema para validar, tipar y documentar (Swagger) |
| Auth | JWT propio (access) + refresh tokens opacos rotativos | Control total, sin dependencias nativas |
| Docs API | `@nestjs/swagger` en `/docs` (solo fuera de producción) | |
| Tests | Vitest + Supertest | |

## Estilo: monolito modular

Un único deploy, dividido en módulos por dominio. Los módulos se comunican por llamadas a servicios exportados y, para efectos secundarios (matching, notificaciones), por **eventos internos** (`@nestjs/event-emitter`). Así crear una publicación no espera al matching, y si algún día hace falta extraer un módulo a un worker, el corte ya existe.

```
src/
  config/            schema Zod de variables de entorno
  database/          opciones de TypeORM, data source para CLI, migraciones
  common/            decoradores, guards, helpers (geo, paginación)
  modules/
    health/          GET /api/health (ping a la DB)
    auth/            registro, login, refresh, logout
    users/           perfil del usuario
    categories/      categorías precargadas
    posts/           publicaciones LOST / FOUND (núcleo)
    photos/          imágenes (disco en dev, S3 después)
    search/          filtros por distancia, fecha, categoría y texto
    matching/        algoritmo de coincidencias
    claims/          verificación de propiedad con preguntas privadas
    chat/            conversaciones privadas (WebSocket + historial REST)
    notifications/   notificaciones in-app (mail más adelante)
```

## Modelo de datos

```
users ──< refresh_tokens
users ──< posts >── categories
posts ──< photos
posts (LOST) ──< matches >── posts (FOUND)
posts (FOUND) ──< verification_questions
posts ──< claims ──< claim_answers
matches/claims ──1 conversations ──< messages
users ──< notifications
```

### `posts` (fase 2)

| Columna | Tipo | Notas |
| --- | --- | --- |
| `type` | enum `LOST` / `FOUND` | |
| `title`, `description` | text | |
| `category_id` | fk | |
| `attributes` | jsonb | color, marca, modelo… (normalizados en minúscula) |
| `occurred_at` | timestamptz | cuándo se perdió / encontró |
| `location` | `geography(Point,4326)` | **privada**, nunca sale de la API |
| `public_location` | `geography(Point,4326)` | ajustada a una grilla de ~300 m: es la que se muestra |
| `radius_m` | int | incertidumbre declarada por el usuario |
| `status` | enum `OPEN` / `MATCHED` / `RESOLVED` / `EXPIRED` | |
| `search_vector` | tsvector generado | `title` (peso A) + `description` (peso B), config `spanish` + `unaccent` |

Índices: GiST en `location`, GIN en `search_vector`, GIN trigram en `title`, btree `(type, status, category_id, occurred_at)`.

**Privacidad:** quien encontró algo publica rasgos generales. Los detalles que prueban la propiedad (qué hay dentro de la billetera, un sticker, el fondo de pantalla) van como **preguntas de verificación** con respuesta esperada privada.

## Algoritmo de matching (fase 5)

Se dispara con el evento `post.created` (y `post.updated` si cambian campos relevantes).

1. **Candidatos (SQL):** publicaciones del tipo opuesto, `status = OPEN`, misma categoría, `ST_DWithin(a.location, b.location, maxDistance + radioA + radioB)` y una ventana de fechas coherente (lo encontrado no puede ser anterior a lo perdido, con tolerancia de 1 día; máximo 60 días después). Límite de 50.
2. **Puntaje (TypeScript puro, testeable):**

| Señal | Peso | Cálculo |
| --- | --- | --- |
| Texto | 0.35 | `similarity()` de trigramas sobre títulos + `ts_rank` de la descripción, normalizado 0–1 |
| Distancia | 0.30 | `exp(-d / 1500 m)`, descontando los radios declarados |
| Fecha | 0.20 | `exp(-días / 7)` |
| Atributos | 0.15 | proporción de atributos coincidentes (color, marca…) |

3. Con un puntaje ≥ **0.6** se crea un `match` (único por par) con el desglose guardado en `score_breakdown` (jsonb) y se emite `match.created`, que genera notificaciones a ambos usuarios.

Los pesos y el umbral viven en configuración para poder calibrarlos con datos reales.

## Verificación de propiedad (fase 7)

1. Quien publica un FOUND define 1–3 preguntas con su respuesta esperada (solo visible para esa persona).
2. Quien reclama responde y se crea un `claim` (`PENDING`).
3. Quien encontró el objeto compara las respuestas y aprueba o rechaza. Al aprobar se abre una conversación privada y la publicación pasa a `MATCHED`.
4. Al entregarse el objeto, cualquiera de las partes marca `RESOLVED`.

Hay límite de reclamos por usuario y publicación para evitar adivinar respuestas por fuerza bruta.

## Autenticación (fase 1)

- Contraseñas con **scrypt** (`node:crypto`, parámetros OWASP), en formato autodescriptivo `scrypt$N$r$p$salt$hash` para poder subir el costo después.
- **Access token:** JWT HS256, 15 min, `sub` = id del usuario.
- **Refresh token:** valor aleatorio opaco de 32 bytes. En la DB solo se guarda su SHA-256. Es de un solo uso y rota en cada `/auth/refresh`. Los tokens pertenecen a una *familia*: si se reutiliza un token ya gastado se revoca toda la familia (detección de robo).
- Guard global: toda ruta requiere token salvo las marcadas con `@Public()`.

### Endpoints

| Método | Ruta | Auth |
| --- | --- | --- |
| POST | `/api/auth/register` | pública |
| POST | `/api/auth/login` | pública |
| POST | `/api/auth/refresh` | pública (refresh token en el body) |
| POST | `/api/auth/logout` | pública (revoca la familia del refresh token) |
| GET | `/api/users/me` | Bearer |
| PATCH | `/api/users/me` | Bearer |
| GET | `/api/health` | pública |

## Roadmap

- [x] **Fase 0 — Base:** env validado con Zod, migraciones, extensiones (`postgis`, `pg_trgm`, `unaccent`), Swagger, health check, validación global.
- [x] **Fase 1 — Auth + Users.**
- [x] **Fase 2 — Categorías + publicaciones** (CRUD, geolocalización, privacidad de la ubicación).
- [ ] **Fase 3 — Búsqueda** (distancia, fecha, categoría, texto, paginación por cursor).
- [ ] **Fase 4 — Fotos** (subida, validación de tipo y tamaño, miniaturas, borrado de EXIF/GPS).
- [ ] **Fase 5 — Matching** + eventos.
- [ ] **Fase 6 — Notificaciones** (in-app + WebSocket).
- [ ] **Fase 7 — Claims y verificación.**
- [ ] **Fase 8 — Chat.**
- [ ] Extras: rate limiting (`@nestjs/throttler`), expiración automática de publicaciones (`@nestjs/schedule`), mail, CI con GitHub Actions.
