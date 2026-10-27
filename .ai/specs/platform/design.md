# Spec platform: Diseño

Implementa los requisitos de `requirements.md`. Los números R# remiten a ese archivo.

## 1. Estructura del repositorio
```
cmpc-libros/
├── backend/
│   ├── prisma/            # schema.prisma, migrations/, seed.ts
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── config/        # validación de variables de entorno
│   │   ├── prisma/        # PrismaModule, PrismaService
│   │   ├── health/        # HealthModule
│   │   └── common/
│   │       ├── filters/       # http-exception.filter.ts
│   │       ├── interceptors/  # transform.interceptor.ts, logging.interceptor.ts
│   │       ├── decorators/    # raw-response.decorator.ts
│   │       └── dto/           # pagination, respuestas comunes
│   ├── Dockerfile
│   └── docker-entrypoint.sh
├── frontend/
│   ├── src/ (components, pages, services, hooks, types, lib)
│   ├── nginx.conf
│   └── Dockerfile
├── docs/
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```
Decisión: dos aplicaciones independientes con su propio `package.json`, sin gestor de monorepo (workspaces, Nx). Es más simple de entender y de dockerizar para el tamaño de esta prueba (R1.1).

## 2. Variables de entorno
Validadas con `joi` al arrancar el backend (R2.1). Las de `POSTGRES_*` las usa también Compose.

| Variable | Uso | Ejemplo en `.env.example` |
|---|---|---|
| `NODE_ENV` | Entorno | `development` |
| `PORT` | Puerto del backend | `3000` |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Credenciales de la base | `cmpc`, `change-me`, `cmpc_libros` |
| `DATABASE_URL` | Conexión de Prisma | `postgresql://cmpc:change-me@db:5432/cmpc_libros` |
| `JWT_SECRET` | Firma de tokens; mínimo 32 caracteres en producción (R2.3) | `change-me-with-at-least-32-characters` |
| `JWT_EXPIRES_IN` | Duración del token | `1h` |
| `CORS_ORIGIN` | Orígenes permitidos, separados por coma (R6.1) | `http://localhost:8080,http://localhost:5173` |
| `UPLOAD_DIR` | Carpeta de imágenes | `/app/uploads` |
| `THROTTLE_TTL`, `THROTTLE_LIMIT` | Límite de intentos del login | `60`, `5` |
| `SEED_ON_START` | Ejecutar seed al iniciar (R7.3) | `true` en desarrollo |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Usuario inicial del seed | `admin@cmpc.local`, `change-me` |
| `BACKEND_PORT`, `FRONTEND_PORT`, `DB_PORT` | Puertos publicados por Compose (R7.8) | `3000`, `8080`, `5432` |

Los valores del ejemplo son marcadores; en producción se sustituyen y nunca se versiona `.env` (R2.2).

## 3. Arranque del backend (`main.ts`)
Orden de configuración:
1. `NestFactory.create` con `ConfigService`.
2. `app.setGlobalPrefix('api')` (R6.5).
3. `helmet()` y CORS con la lista de `CORS_ORIGIN` (R6.1).
4. Límite de cuerpo JSON de 100 KB (R6.2).
5. `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted`, `transform` y `exceptionFactory` que produce el arreglo `errors` (R4.2, R4.4).
6. `HttpExceptionFilter`, `TransformInterceptor` y `LoggingInterceptor` globales (R4, R5).
7. `enableShutdownHooks()` (R6.4).
8. Swagger en `/api/docs`, configurado con `DocumentBuilder` y `addBearerAuth` (R6.5).
9. `listen(PORT, '0.0.0.0')`.

## 4. Manejo de errores
`HttpExceptionFilter` (`@Catch()` sin argumentos) normaliza todo error al formato de R4.1:

| Origen | Estado | Mensaje |
|---|---|---|
| `HttpException` de Nest | el suyo | el suyo |
| `ValidationPipe` | 400 | `Validation failed`, con `errors: [{ field, messages[] }]` |
| `PrismaClientKnownRequestError` `P2025` | 404 | `Resource not found` |
| `PrismaClientKnownRequestError` `P2002` | 409 | `Resource already exists` |
| Cualquier otro | 500 | `Internal server error` (detalle solo en el log, R4.3) |

Los mensajes de la API van en inglés; la interfaz los traduce a español (ver `conventions.md`).

## 5. Interceptores
- **`TransformInterceptor`:** transforma `{ items, meta }` en `{ data: items, meta }` y cualquier otro valor en `{ data: valor }` (R5.1). Si el handler lleva el decorador `@RawResponse()` (leído con `Reflector`), la respuesta pasa sin envolver (R5.3); lo usan CSV e imágenes.
- **`LoggingInterceptor`:** mide la duración con `Date.now()` y escribe una línea con `Logger`: `GET /api/books 200 12ms user=<id|anonymous>`. No registra cuerpos ni cabeceras (R5.2).

## 6. Prisma
- `PrismaService extends PrismaClient` e implementa `OnModuleInit` (`$connect`) y `OnModuleDestroy` (`$disconnect`) (R3.4).
- `PrismaModule` es global y exporta `PrismaService`.
- El `schema.prisma` inicial contiene `datasource`, `generator` y el modelo `User` (lo necesita el seed). Los demás modelos y sus migraciones los añade cada spec: `books-crud` (catálogos, `Book`, extensión de soft delete) y `audit-log` (`AuditLog`).
- El seed vive en `src/seed/` para compilarse con el resto del backend: `seed-admin.ts` (lógica, con pruebas) y `run-seed.ts` (punto de entrada). Crea el usuario administrador a partir de `ADMIN_EMAIL` y `ADMIN_PASSWORD` con hash `argon2`, de forma idempotente (`upsert` con `update` vacío: no sobrescribe una contraseña cambiada después). Valida sus propias variables (correo con cualquier dominio, para admitir `.local`; contraseña de 8 caracteres o más) y falla si faltan. Se ejecuta con `npm run seed`, `prisma db seed` o, compilado, `node dist/seed/run-seed.js`.
- La migración manual de `pg_trgm` (`CREATE EXTENSION IF NOT EXISTS pg_trgm` y el índice GIN) pertenece a `books-crud`.

## 7. Health
`GET /api/health` ejecuta `SELECT 1` con `$queryRaw` y devuelve `{ status: "ok" }` o lanza `ServiceUnavailableException` (503) (R6.3). Es público y excluido del guard JWT y del límite de intentos. La consulta `SELECT 1` es la única excepción a la regla de no usar SQL en crudo (R3.2).

## 8. Docker
### Dockerfile del backend (multi-etapa, R7.5)
1. `deps`: `node:22-bookworm-slim`, instala todas las dependencias y genera el cliente Prisma (`openssl` instalado).
2. `build`: compila TypeScript a `dist/`.
3. `runtime`: copia `dist/`, `prisma/` y solo las dependencias de producción, crea el usuario `node` sin privilegios y ejecuta `docker-entrypoint.sh`.

Se usa una imagen basada en Debian (no Alpine) para evitar problemas de compilación nativa con `argon2` y de motor de Prisma en musl.

### `docker-entrypoint.sh`
1. `npx prisma migrate deploy` (R7.2).
2. Si `SEED_ON_START=true`, ejecuta el seed compilado (R7.3).
3. `exec node dist/main.js`, para que SIGTERM llegue a la aplicación (R6.4).

### Dockerfile del frontend (multi-etapa)
`node` compila con Vite; la etapa final es `nginx:stable` sin privilegios que sirve el SPA con *fallback* a `index.html` y hace *proxy* de `/api/` al servicio `backend:3000`. Con esto el navegador solo habla con un origen y no hace falta CORS en el despliegue. En desarrollo con `npm run dev`, el servidor de Vite hace el mismo proxy.

### `docker-compose.yml`
- `db`: `postgres:16`, volumen `pgdata`, `healthcheck` con `pg_isready` (R7.4, R7.6).
- `backend`: build de `backend/`, `depends_on: db (service_healthy)`, volumen `uploads` montado en `UPLOAD_DIR`, `healthcheck` contra `/api/health` (R7.2, R7.4, R7.6).
- `frontend`: build de `frontend/`, `depends_on: backend (service_healthy)`, `healthcheck` contra `/`.
- `pgadmin` con `profiles: ["tools"]` (R7.7).
- Credenciales y puertos solo desde variables de entorno (R7.8).

## 9. Frontend: base técnica
- **Cliente HTTP (`lib/api-client.ts`):** instancia de Axios con `baseURL: '/api'`; un interceptor de petición añade `Authorization: Bearer <token>`.
- **Errores (R4.6, R4.7):** un interceptor de respuesta convierte cualquier fallo en `ApiError { status, message, fieldErrors? }`. Si `status === 401` limpia la sesión y navega a `/login`. Sin respuesta del servidor genera un `ApiError` con el mensaje de conexión.
- **TanStack Query:** `QueryClient` global con `retry: 1` y `refetchOnWindowFocus: false`.
- **Routing:** React Router con rutas `/login` y `/books` (protegida); las páginas reales llegan en las demás specs.
- **Almacenamiento del token:** `localStorage`, con el compromiso documentado en `auth/design.md`.

## 10. Pruebas y cobertura (R8)
- **Backend:** Jest con `coverageThreshold.global` de 80 en `statements`, `branches`, `functions` y `lines`. Exclusiones (`collectCoverageFrom`): `main.ts`, `seed/run-seed.ts`, `*.module.ts`, `*.dto.ts`, `*.d.ts` y código generado (R8.4). `PrismaService` y `seed-admin.ts` sí se miden.
- **Frontend:** Vitest con proveedor `v8` y los mismos umbrales. Exclusiones: `main.tsx`, `src/types/`, archivos de configuración y `*.d.ts`.
- Scripts: `test`, `test:cov` y `lint` en ambas aplicaciones.
- Las pruebas usan dobles de `PrismaService` y de Axios; ninguna toca base de datos ni red (R8.3).

## 11. Calidad estática (R9)
- `tsconfig`: `strict: true`, `noImplicitOverride`, `noUncheckedIndexedAccess`.
- ESLint con `@typescript-eslint` y la regla `no-explicit-any` en error; Prettier compartido en ambas aplicaciones.

## 12. Decisiones y alternativas descartadas
| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Nginx hace proxy de `/api` | Backend accesible desde el navegador con CORS | Un único origen; menos configuración y superficie |
| Imagen Debian slim | Alpine | Evita problemas con `argon2` y el motor de Prisma |
| Repos independientes sin workspaces | Monorepo con Nx o pnpm workspaces | Sobrecoste innecesario para esta escala |
| Health con `SELECT 1` manual | `@nestjs/terminus` | Una dependencia menos para una sola comprobación |
| Seed controlado por variable | Seed siempre o nunca | Útil en local; evita credenciales por defecto en producción |
