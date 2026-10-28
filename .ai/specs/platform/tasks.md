# Spec platform: Tareas

Reglas: seguir el orden; una tarea está hecha solo cuando su criterio se cumple y sus pruebas pasan. Los commits sugeridos usan formato convencional en inglés y se hacen cuando el usuario lo autorice.
Marcar con `[x]` al terminar.

## Base del repositorio
- [x] **P-01 Repositorio base** (R1.1, R2.2)
  - Inicializar Git, `.gitignore` (node_modules, dist, `.env`, uploads, coverage), `.editorconfig`, `.env.example` con todas las variables de `design.md` §2.
  - Hecho cuando: `git status` no muestra `.env` ni dependencias; `.env.example` lista todas las variables.
  - Commit: `chore: initialize repository`

## Backend
- [x] **P-02 Scaffold del backend** (R1.1, R1.2, R1.3, R8.1, R9)
  - Proyecto NestJS en `backend/`, `strict: true`, ESLint con `no-explicit-any` en error y una regla `no-restricted-imports` que prohíbe importar `PrismaService` en archivos `*.controller.ts`, Prettier, scripts `test`, `test:cov`, `lint` y `coverageThreshold` de 80 con las exclusiones de `design.md` §10.
  - Hecho cuando: `npm run lint` y `npm run test:cov` terminan sin errores sobre el proyecto base.
  - Commit: `chore(backend): scaffold NestJS project`

- [x] **P-03 Configuración validada** (R2.1, R2.3)
  - `ConfigModule` global con esquema `joi`; `JWT_SECRET` mínimo 32 caracteres cuando `NODE_ENV=production`.
  - Pruebas: arranca con variables válidas; falla nombrando la variable cuando falta; rechaza un `JWT_SECRET` corto en producción.
  - Commit: `feat(config): validate environment variables`

- [x] **P-04 Prisma y migración inicial** (R3.1, R3.2, R3.3, R3.4)
  - `schema.prisma` con `datasource`, `generator` y modelo `User`; migración inicial; `PrismaModule` global y `PrismaService` (`$connect` y `$disconnect`).
  - Pruebas: `PrismaService` conecta en `onModuleInit` y desconecta en `onModuleDestroy` (cliente simulado).
  - Hecho cuando: `npx prisma migrate dev` crea la tabla `users` en una base local.
  - Commit: `feat(prisma): add schema, initial migration and PrismaService`

- [x] **P-05 Seed del administrador** (R7.3)
  - Función `seedAdmin(client, env)` en `src/seed/seed-admin.ts` con `upsert` y hash `argon2`, invocada desde `src/seed/run-seed.ts` (`npm run seed`, `prisma db seed` y `node dist/seed/run-seed.js` en Docker); falla si faltan `ADMIN_EMAIL` o `ADMIN_PASSWORD`.
  - Pruebas: crea el usuario; es idempotente; el hash no es la contraseña en claro; error si faltan variables.
  - Commit: `feat(seed): add idempotent admin user seed`

- [x] **P-06 Filtro global de excepciones** (R4.1 a R4.5)
  - `HttpExceptionFilter` según la tabla de `design.md` §4.
  - Pruebas: una por fila de la tabla, más comprobar que el 500 no filtra el mensaje interno ni el stack.
  - Commit: `feat(common): add global exception filter`

- [x] **P-07 Interceptor de transformación** (R5.1, R5.3)
  - `TransformInterceptor` y decorador `@RawResponse()`.
  - Pruebas: envuelve un valor simple; transforma `{ items, meta }`; no envuelve con `@RawResponse()`.
  - Commit: `feat(common): add response transform interceptor`

- [x] **P-08 Logging HTTP** (R5.2)
  - `createHttpLogger()` (middleware de Express) con el formato de `design.md` §5; se activa en P-10. Cambio respecto a la versión inicial de la spec: un interceptor no vería los 401/403 ni los 404.
  - Pruebas (HTTP reales): registra método, ruta, estado y duración; usa `anonymous` sin usuario; registra el id del usuario autenticado; registra 404, 403 y 500 con su nivel; nunca incluye query string, cuerpo ni cabeceras.
  - Commit: `feat(common): add HTTP access logger middleware`

- [x] **P-09 Health** (R6.3)
  - `HealthModule` con `GET /api/health`, público.
  - Pruebas: 200 con la base disponible; 503 cuando `$queryRaw` falla.
  - Commit: `feat(health): add health endpoint`

- [x] **P-10 Arranque de la aplicación** (R2, R4.2, R4.4, R6, R9)
  - `main.ts` en el orden de `design.md` §3, `ValidationPipe` con `exceptionFactory` (extraída a una función exportada y probada), Swagger base, `helmet`, CORS, límite de cuerpo y shutdown hooks.
  - Pruebas: la función `exceptionFactory` produce el arreglo `errors` con campo y mensajes.
  - Hecho cuando: `npm run start` con una base local responde en `/api/health` y muestra Swagger en `/api/docs`.
  - Commit: `feat(app): bootstrap application with global pipes, security and Swagger`

- [x] **P-11 Docker del backend** (R7.2, R7.3, R7.5)
  - `Dockerfile` multi-etapa y `docker-entrypoint.sh` (migrar, seed opcional, `exec node`).
  - Hecho cuando: la imagen construye, corre como usuario no root y no contiene dependencias de desarrollo.
  - Commit: `build(backend): add multi-stage Dockerfile and entrypoint`

## Frontend
- [x] **P-12 Scaffold del frontend** (R1.1, R8.2, R9)
  - Proyecto Vite + React + TypeScript en `frontend/`, Tailwind, ESLint (`no-explicit-any`), Prettier, Vitest + React Testing Library, proxy de `/api` en Vite, scripts `test`, `test:cov`, `lint` y umbrales de 80.
  - Hecho cuando: `npm run lint` y `npm run test:cov` terminan sin errores.
  - Commit: `chore(frontend): scaffold Vite React project`

- [x] **P-13 Cliente HTTP y errores** (R4.6, R4.7)
  - `lib/api-client.ts` con token en cabecera, `ApiError` y normalización; en 401 limpia sesión y redirige a `/login`.
  - Pruebas: normaliza un error con `errors`; error de red genera el mensaje de conexión; 401 cierra sesión y redirige; la petición lleva el token.
  - Commit: `feat(frontend): add API client with error normalization`

- [x] **P-14 Base de la aplicación** (R1.1)
  - `QueryClient`, rutas `/login` y `/books` (protegida), componente de aviso de error global.
  - Pruebas: una ruta protegida redirige a `/login` sin sesión; el aviso muestra el mensaje del `ApiError`.
  - Commit: `feat(frontend): add routing, query client and error notice`

- [ ] **P-15 Docker del frontend** (R7.5, R7.6)
  - `Dockerfile` multi-etapa y `nginx.conf` con *fallback* SPA y proxy de `/api/`.
  - Hecho cuando: la imagen construye y sirve el SPA sin privilegios de root.
  - Commit: `build(frontend): add multi-stage Dockerfile and nginx config`

## Integración y cierre
- [ ] **P-16 Docker Compose** (R7.1 a R7.8, OPS-1)
  - `docker-compose.yml` según `design.md` §8.
  - Hecho cuando, desde un clon limpio con `.env` copiado de `.env.example`: `docker compose up --build` levanta `db`, `backend` y `frontend`; `http://localhost:8080` carga el SPA; `/api/health` responde 200 a través de nginx; reiniciar conserva los datos; `pgadmin` solo aparece con `--profile tools`.
  - Commit: `build: add docker-compose for the full stack`

- [ ] **P-17 Verificación de la spec**
  - Recorrer R1 a R9 y marcar cómo se comprobó cada criterio (prueba automática, comando manual o revisión). Registrar el resultado al final de este archivo.
  - Hecho cuando: ningún criterio queda sin comprobación o sin una nota que explique por qué.

## Registro de verificación
(Se completa en P-17.)
