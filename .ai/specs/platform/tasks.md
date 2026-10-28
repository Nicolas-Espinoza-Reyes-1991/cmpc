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

- [x] **P-15 Docker del frontend** (R7.5, R7.6)
  - `Dockerfile` multi-etapa y `nginx.conf` con *fallback* SPA y proxy de `/api/`.
  - Hecho cuando: la imagen construye y sirve el SPA sin privilegios de root.
  - Commit: `build(frontend): add multi-stage Dockerfile and nginx config`

## Integración y cierre
- [x] **P-16 Docker Compose** (R7.1 a R7.8, OPS-1)
  - `docker-compose.yml` según `design.md` §8.
  - Hecho cuando, desde un clon limpio con `.env` copiado de `.env.example`: `docker compose up --build` levanta `db`, `backend` y `frontend`; `http://localhost:8080` carga el SPA; `/api/health` responde 200 a través de nginx; reiniciar conserva los datos; `pgadmin` solo aparece con `--profile tools`.
  - Commit: `build: add docker-compose for the full stack`

- [x] **P-17 Verificación de la spec**
  - Recorrer R1 a R9 y marcar cómo se comprobó cada criterio (prueba automática, comando manual o revisión). Registrar el resultado al final de este archivo.
  - Hecho cuando: ningún criterio queda sin comprobación o sin una nota que explique por qué.

## Registro de verificación (P-17)

Fecha: 2026-10-27. Entorno: Windows 11, Docker Desktop (Docker 29.2.1, Compose 5.1.0), Node 22.22.0.
Leyenda: **AUTO** = prueba automática; **CMD** = comando ejecutado en esta verificación; **REV** = revisión de archivos.

**Resultado: 40 de 40 criterios cumplidos, 6 de ellos con una salvedad documentada.** No quedó ningún criterio sin comprobar.

Estado en el momento de la verificación:
- Backend: `npm run lint` sin errores, `tsc` y build correctos, 99 pruebas (10 archivos) con 100% de cobertura en las cuatro métricas, 3 pruebas e2e.
- Frontend: `npm run lint` sin errores, `tsc -b` y build correctos, 69 pruebas (9 archivos) con 100% de cobertura en las cuatro métricas.
- Stack completo: `docker compose up -d --build --wait` desde cero con un `.env` copiado de `.env.example` deja los tres servicios `healthy` en 24 s.

| Criterio | Cómo se comprobó | Resultado |
|---|---|---|
| R1.1 | CMD: `backend/`, `frontend/`, `docker-compose.yml` y `.env.example` existen en la raíz | Cumple |
| R1.2 | REV: `backend/src` contiene `prisma/`, `health/` y `common/` (además de `config/` y `seed/`) | Cumple |
| R1.3 | AUTO/CMD: regla ESLint `no-restricted-imports` (probada: da error) y `grep` sin ningún controlador que importe Prisma | Cumple |
| R2.1 | AUTO: `env.validation.spec.ts`. CMD: en un contenedor sin variables falla nombrando `DATABASE_URL` y `JWT_SECRET` (código 1); con `PORT=abc` falla nombrando `PORT` | Cumple con salvedad (1) |
| R2.2 | CMD: `.env` ignorado, el único `.env*` versionado es `.env.example`, el historial nunca contuvo `.env`; escaneo de 101 archivos versionados sin claves reales; las 21 variables que usa el código y Compose están las 21 documentadas | Cumple |
| R2.3 | AUTO: spec (31 caracteres se rechaza, 32 se acepta). CMD: `NODE_ENV=production` con 31 caracteres no arranca, con 32 arranca | Cumple |
| R3.1 | CMD: esquema en `backend/prisma/schema.prisma`; `prisma migrate diff` entre una base migrada y el esquema da "No difference detected"; contraprueba: con un campo añadido sin migración detecta la diferencia (código 2) | Cumple |
| R3.2 | CMD: `grep` de `queryRaw` y `executeRaw` en `src`: una sola aparición, `health.service.ts` (`SELECT 1`) | Cumple |
| R3.3 | CMD: `prisma migrate deploy` sobre una base vacía termina con código 0 (también dentro del contenedor, en cada arranque de Compose) | Cumple |
| R3.4 | AUTO: `prisma.service.spec.ts` (conecta, desconecta, propaga el error). CMD: `docker compose stop backend` cierra con código 0 | Cumple |
| R4.1 | AUTO: `http-exception.filter.spec.ts` (una prueba por fila de la tabla y 3 por HTTP) y `app.setup.spec.ts`. CMD: 404, 413 y 503 reales con el formato único | Cumple |
| R4.2 | AUTO: `app.setup.spec.ts` (errores por campo con un DTO de prueba) y `validation-exception.factory.spec.ts` (campos anidados) | Cumple |
| R4.3 | AUTO: pruebas del filtro y de `app.setup.spec.ts` (500 genérico, sin traza, la causa va al log) | Cumple |
| R4.4 | AUTO: `app.setup.spec.ts` rechaza una propiedad no declarada con 400 | Cumple |
| R4.5 | AUTO: el filtro traduce `P2025` a 404 y `P2002` a 409 | Cumple con salvedad (2) |
| R4.6 | AUTO: `api-error.spec.ts` y `api-client.spec.ts` (mensaje en español, error de red). CMD: contra el backend real normalizó 404, 413 y la falta de red | Cumple |
| R4.7 | AUTO: `api-client.spec.ts` (401 con token cierra la sesión y avisa al router; sin token no) y `router.spec.tsx` (navega a `/login` sin recargar). Navegador real: redirección de `/books` sin sesión | Cumple |
| R5.1 | AUTO: `transform.interceptor.spec.ts` (unitarias y HTTP) y `app.setup.spec.ts` | Cumple |
| R5.2 | AUTO: `http-logger.middleware.spec.ts` (8 pruebas HTTP: método, ruta sin query, estado, duración, usuario, 404, 403, 500, sin cuerpos ni credenciales). CMD: las líneas aparecen en los logs de Docker. Implementado como middleware, no interceptor (ver `design.md` §5) | Cumple |
| R5.3 | AUTO: `@RawResponse()` en método y en clase, y `StreamableFile` sin envolver; `/api/health` sin envoltorio | Cumple |
| R6.1 | AUTO: `app.setup.spec.ts` (helmet con CSP, CORS permitido y no permitido). CMD sobre el stack: `Access-Control-Allow-Origin` solo para `http://localhost:8080`, sin `X-Powered-By` | Cumple |
| R6.2 | AUTO: 413 con el formato único. CMD: 150 KB directo al backend da 413; por nginx 200 KB y 3 MB llegan al backend (413 JSON) y 6 MB los corta nginx | Cumple |
| R6.3 | AUTO: `health.service.spec.ts` y `health.controller.spec.ts`. CMD sobre el stack: 200, con la base detenida 503 en formato único, y de nuevo 200 en unos 2 s | Cumple |
| R6.4 | CMD: `docker compose stop backend` tarda 1,2 s con código 0 (un SIGKILL daría 137 tras 10 s); frontend y base también salen con 0 | Cumple |
| R6.5 | AUTO: `app.setup.spec.ts`. CMD: `/api/health` 200, `/health` sin prefijo 404, `/api/docs` 200 por nginx y en un navegador real | Cumple |
| R7.1 | CMD: `up -d --build --wait` desde cero con `.env` copiado de `.env.example`: código 0 en 24 s, tres servicios `healthy` | Cumple con salvedad (3) |
| R7.2 | CMD: `docker compose config` muestra `service_healthy` en el backend y el frontend; el log muestra migraciones, seed y luego la API | Cumple |
| R7.3 | CMD: con `SEED_ON_START=true` el log muestra "Seeding initial data"; con `false`, cero líneas de seed (comprobado en P-16) | Cumple |
| R7.4 | CMD: volúmenes `cmpc-libros_pgdata` y `cmpc-libros_uploads`; tras `down` y `up` el usuario conserva su id y el archivo de `uploads` sigue ahí | Cumple |
| R7.5 | REV/CMD: backend con 4 etapas y una base común, frontend con 2; procesos como `node` (uid 1000) y `nginx` (uid 101); sin `jest`, `eslint`, `ts-node` ni `@nestjs/cli` en el backend; el frontend no contiene Node | Cumple con salvedad (4) |
| R7.6 | CMD: `healthcheck` en `db`, `backend` y `frontend` (los tres `healthy`) y definido en `pgadmin` | Cumple con salvedad (5) |
| R7.7 | CMD: por defecto `db backend frontend`; con `--profile tools` se añade `pgadmin` | Cumple |
| R7.8 | REV: ningún puerto ni credencial fijo; todo usa `${VAR}` (la única línea sin variable es el `healthcheck` de la base, que lee variables del propio contenedor con `$$`) | Cumple con salvedad (6) |
| R8.1 | CMD: con un archivo grande sin probar, `npm run test:cov` del backend sale con código 1 (cobertura 14%); sin él, código 0 | Cumple |
| R8.2 | CMD: igual en el frontend (código 1 con cobertura de sentencias 9%; sin el archivo, código 0) | Cumple |
| R8.3 | CMD: con el PostgreSQL de desarrollo **detenido** pasan las 99 pruebas del backend y las 69 del frontend | Cumple |
| R8.4 | REV: `collectCoverageFrom` y `coverage.exclude` coinciden con `design.md` §10 (corregido durante esta verificación) | Cumple |
| R9.1 | CMD: `"strict": true` en `backend/tsconfig.json` y `frontend/tsconfig.app.json` | Cumple |
| R9.2 | CMD: `npm run lint` con código 0 en ambos; la regla `no-explicit-any` da error con código de prueba | Cumple |
| R9.3 | CMD: los dos `.prettierrc` son idénticos (comillas simples, comas finales) y ambos proyectos usan Prettier 3.9.10 | Cumple |

### Salvedades
1. **R2.1.** En local, el cliente de Prisma carga `backend/.env` al importarse y puede completar variables antes de que `ConfigModule` valide; por eso la prueba de "sin variables" se hace en un entorno limpio (el contenedor). Está documentado en `design.md` §2.
2. **R4.5.** Se probó con errores de Prisma construidos a mano. La comprobación con una base real (un `P2002` de verdad por un título duplicado) llega con la spec `books-crud`.
3. **R7.1.** Verificado en Windows con Docker Desktop; no se probó en Linux ni en un clon desde GitHub.
4. **R7.5.** La imagen del backend incluye la CLI de `prisma` (necesaria para `migrate deploy` en el arranque) y `typescript` (dependencia par de Prisma, 23 MB). No incluye herramientas de prueba ni de compilación de Nest. Documentado en `design.md` §8.
5. **R7.6.** El servicio `pgadmin` solo se validó por configuración; no se arrancó (la imagen pesa cerca de 500 MB).
6. **R7.8.** Quedan valores de respaldo dentro de `${VAR:-valor}` (por ejemplo `5442`, `8080` y el correo `admin@example.com` de pgAdmin); los valores fijos son solo los puertos internos de los contenedores.

### Pendientes conocidos para las demás specs
- **`trust proxy`** (`auth`, `audit-log`): detrás de nginx el backend ve la IP del contenedor de nginx; sin `app.set('trust proxy', 1)`, el límite de intentos del login y el campo `ip` de `AuditLog` usarían esa IP para todos.
- **`npm audit` del backend: 15 hallazgos** (8 bajos, 2 moderados, 5 altos). En producción: `multer` (denegación de servicio, alto; el arreglo de `npm audit fix` no rompe nada; se aplica con la spec `book-image-upload` o antes de la entrega), `deepmerge-ts` (alto) y `js-yaml` (moderado), cuyos arreglos exigen `--force` y no se evaluaron. Frontend: 0.
- **Herramientas con soporte limitado:** ESLint 9 (npm avisa de que ya no tiene soporte) y Prisma 6.19.3 (`package.json#prisma` quedará obsoleto en Prisma 7). Ambos se actualizan como mejora futura.
- **Autenticación en el frontend:** `ProtectedRoute` lee el token directamente; la spec `auth` lo sustituirá por un `AuthProvider` reactivo, y `LoginPage` y `BooksPage` son marcadores de posición.
- **Mensajes de validación por campo del servidor:** siguen en inglés; los formularios validarán antes en español con Zod.
- **`backend/README.md`** sigue siendo el README genérico de Nest; la spec `docs-delivery` lo reemplaza junto con el README del proyecto.

### Errores de mi propio método durante la verificación (no del código)
- La primera comprobación de R8.1 usó un archivo demasiado pequeño para bajar del 80% con 99 pruebas y daba código 0; se repitió con un archivo grande.
- La primera prueba de "arranque sin variables" quedó contaminada por `backend/.env` (ver salvedad 1) y dejó un servidor huérfano que se detuvo y se repitió en un entorno limpio.
- `design.md` §10 describía las exclusiones del frontend de forma imprecisa y se corrigió.
