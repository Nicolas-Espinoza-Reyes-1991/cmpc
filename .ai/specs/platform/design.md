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
│   │       ├── interceptors/  # transform.interceptor.ts
│   │       ├── middleware/    # http-logger.middleware.ts
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

Aviso para quien pruebe la validación en local: el cliente de Prisma carga por su cuenta `backend/.env` al importarse (con independencia del directorio de trabajo) y rellena `process.env` antes de que `ConfigModule` valide. Con ese archivo presente, arrancar con "ninguna variable" no falla. La validación se comprueba en un entorno limpio, que es el del contenedor: la imagen no contiene ningún `.env` y falla nombrando las variables que faltan.

## 3. Arranque del backend (`main.ts`)
Orden de configuración:
1. `NestFactory.create` con `ConfigService`.
2. `app.setGlobalPrefix('api')` (R6.5).
3. `helmet()` y CORS con la lista de `CORS_ORIGIN` (R6.1).
4. Límite de cuerpo JSON de 100 KB (R6.2).
5. `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted`, `transform` y `exceptionFactory` que produce el arreglo `errors` (R4.2, R4.4).
6. `app.use(createHttpLogger())` primero, para ver todas las peticiones, y luego `HttpExceptionFilter` y `TransformInterceptor` globales (R4, R5).
7. `enableShutdownHooks()` (R6.4).
8. Swagger en `/api/docs`, configurado con `DocumentBuilder` y `addBearerAuth` (R6.5).
9. `listen(PORT, '0.0.0.0')`.

Implementación:
- Los pasos 2 a 6 y 8 viven en `configureApp(app)` (`src/app.setup.ts`), no en `main.ts`, para que las pruebas arranquen la aplicación exactamente como producción. `main.ts` solo crea la aplicación, llama a `configureApp`, activa `enableShutdownHooks()` y escucha en `PORT`.
- `helmet` se aplica con su política de seguridad de contenido (CSP) por defecto a la API; las rutas `/api/docs*` reciben el resto de encabezados de `helmet` pero sin CSP, porque bloquearía los scripts de Swagger UI.
- CORS acepta solo los orígenes de `CORS_ORIGIN` y expone `Content-Disposition` para que el navegador lea el nombre del CSV.
- `ValidationPipe` usa `validationExceptionFactory` (`common/validation/`), que convierte el árbol de `class-validator` en `FieldError[]` y usa ruta con puntos para propiedades anidadas.
- Swagger: título "CMPC Libros API", autenticación `bearer`, UI en `/api/docs` y JSON en `/api/docs-json`.
- Se retiró el controlador y servicio "Hello World" que genera Nest.
- El cierre ordenado (R6.4) depende de `enableShutdownHooks()`; las señales no se pueden probar en Windows, así que se comprueba al ejecutar Docker en P-16.

## 4. Manejo de errores
`HttpExceptionFilter` (`@Catch()` sin argumentos) normaliza todo error al formato de R4.1:

| Origen | Estado | Mensaje |
|---|---|---|
| `HttpException` de Nest | el suyo | el suyo |
| `ValidationPipe` | 400 | `Validation failed`, con `errors: [{ field, messages[] }]` |
| `PrismaClientKnownRequestError` `P2025` | 404 | `Resource not found` |
| `PrismaClientKnownRequestError` `P2002` | 409 | `Resource already exists` |
| Error de middleware de Express con `status` 4xx (cuerpo mayor de 100 KB: 413) | el suyo | frase HTTP estándar (`Payload Too Large`); nunca el mensaje original, que puede reflejar el contenido enviado |
| Cualquier otro | 500 | `Internal server error` (detalle solo en el log, R4.3) |

Los mensajes de la API van en inglés; la interfaz los traduce a español (ver `conventions.md`).

Detalles de implementación:
- Los errores de validación se lanzan como `ValidationException` (`common/exceptions/`), que lleva `errors: FieldError[]` tipado. La `exceptionFactory` del `ValidationPipe` (P-10) debe lanzar esa excepción.
- Un `HttpException` de Nest con un arreglo de mensajes (el `ValidationPipe` por defecto) se aplana a un solo `message` unido con `; `.
- Cualquier otro código de Prisma (por ejemplo `P2003`) se trata como error interno 500.
- `path` usa `request.path`, sin query string, para no devolver datos como tokens.
- Si la respuesta ya empezó a enviarse (por ejemplo, una descarga CSV), el filtro solo la cierra.
- Los errores 5xx se registran con su traza; los 4xx no.
- El filtro se registra globalmente en P-10.

## 5. Interceptores
- **`TransformInterceptor`:** transforma `{ items, meta }` en `{ data: items, meta }` y cualquier otro valor en `{ data: valor }` (R5.1). Si el handler lleva el decorador `@RawResponse()` (leído con `Reflector`), la respuesta pasa sin envolver (R5.3); lo usan CSV e imágenes.
  - Un resultado se considera paginado solo si trae `items` (arreglo) y `meta` (objeto); un objeto con una propiedad `items` pero sin `meta` se envuelve como cualquier otro valor.
  - Si el handler no devuelve nada, la respuesta es `{ data: null }` para que el cliente siempre encuentre la clave `data`.
  - Un `StreamableFile` nunca se envuelve, aunque falte `@RawResponse()`.
  - Los tipos `ApiResponse`, `PaginatedResult` y `PaginationMeta` viven en `common/types/api-response.types.ts`.
- **Logging HTTP (`createHttpLogger`):** es un middleware de Express (`common/middleware/http-logger.middleware.ts`), no un interceptor. Un interceptor corre después de los guards y no vería las peticiones rechazadas con 401/403 ni las rutas inexistentes (404), y R5.2 exige registrar cada petición. El middleware escucha el evento `finish` de la respuesta, de modo que registra el estado final (el que dejó el filtro de excepciones) y la duración.
  - Una línea por petición con `Logger('HTTP')`: `GET /api/books 200 12ms user=<id|anonymous>`. Nivel `log` para estados menores de 400, `warn` para 4xx y `error` para 5xx.
  - La ruta se registra sin query string. No se leen cuerpos ni cabeceras, por lo que no pueden filtrarse contraseñas ni tokens.
  - El usuario sale de `request.user.id`, que adjuntará la estrategia JWT (tipos `AuthenticatedUser` y `AuthenticatedRequest` en `common/types/`).

## 6. Prisma
- `PrismaService extends PrismaClient` e implementa `OnModuleInit` (`$connect`) y `OnModuleDestroy` (`$disconnect`) (R3.4).
- `PrismaModule` es global y exporta `PrismaService`.
- El `schema.prisma` inicial contiene `datasource`, `generator` y el modelo `User` (lo necesita el seed). Los demás modelos y sus migraciones los añade cada spec: `books-crud` (catálogos, `Book`, extensión de soft delete) y `audit-log` (`AuditLog`).
- El seed vive en `src/seed/` para compilarse con el resto del backend: `seed-admin.ts` (lógica, con pruebas) y `run-seed.ts` (punto de entrada). Crea el usuario administrador a partir de `ADMIN_EMAIL` y `ADMIN_PASSWORD` con hash `argon2`, de forma idempotente (`upsert` con `update` vacío: no sobrescribe una contraseña cambiada después). Valida sus propias variables (correo con cualquier dominio, para admitir `.local`; contraseña de 8 caracteres o más) y falla si faltan. Se ejecuta con `npm run seed`, `prisma db seed` o, compilado, `node dist/seed/run-seed.js`.
- La migración manual de `pg_trgm` (`CREATE EXTENSION IF NOT EXISTS pg_trgm` y el índice GIN) pertenece a `books-crud`.

## 7. Health
`GET /api/health` ejecuta `SELECT 1` con `$queryRaw` y devuelve `{ status: "ok" }` o lanza `ServiceUnavailableException` (503) (R6.3). Es público: lleva `@Public()` (`common/decorators/public.decorator.ts`), la marca que el guard JWT global de la spec `auth` leerá para dejar pasar la petición. No necesita excluirse del límite de intentos porque `@nestjs/throttler` se aplica solo al login. Lleva también `@RawResponse()`: devuelve `{ status: "ok" }` sin el envoltorio `{ data }`, porque Docker y los balanceadores solo miran el código HTTP. La lógica vive en `HealthService` y la consulta tiene un tiempo máximo de 3 s (`Promise.race`), de modo que una base colgada responde 503 en vez de dejar la sonda esperando. La consulta `SELECT 1` es la única excepción a la regla de no usar SQL en crudo (R3.2).

## 8. Docker
### Dockerfile del backend (multi-etapa, R7.5)
1. `deps`: `node:22-bookworm-slim`, instala todas las dependencias y genera el cliente Prisma (`openssl` instalado).
2. `build`: compila TypeScript a `dist/`.
3. `runtime`: copia `dist/`, `prisma/` y solo las dependencias de producción, crea el usuario `node` sin privilegios y ejecuta `docker-entrypoint.sh`.

Se usa una imagen basada en Debian (no Alpine) para evitar problemas de compilación nativa con `argon2` y de motor de Prisma en musl.

Detalles de implementación (`backend/Dockerfile`):
- Cuatro etapas: `deps` (todas las dependencias y cliente Prisma), `build` (compila), `prod-deps` (solo producción, con el cliente Prisma generado) y `runtime`. Se instala `openssl`, que Prisma necesita y la imagen slim no trae.
- La CLI de `prisma` está en `dependencies` (no en `devDependencies`): el contenedor la necesita en ejecución para `migrate deploy`. Es la única herramienta de "desarrollo" que viaja en la imagen. Además `typescript` llega como dependencia par de Prisma (23 MB, no se usa en ejecución); excluirla obligaría a omitir todas las dependencias par, lo que es más arriesgado.
- El proceso corre como el usuario `node` (uid 1000). `/app/uploads` pertenece a ese usuario y es el punto de montaje del volumen de imágenes.
- `PRISMA_HIDE_UPDATE_MESSAGE` y `CHECKPOINT_DISABLE` evitan consultas de red de Prisma al arrancar.
- La imagen define su propio `HEALTHCHECK` (consulta `/api/health` con `fetch` de Node, sin instalar `curl`); Compose puede reutilizarlo.
- `.dockerignore` deja fuera `node_modules`, `dist`, `.env`, `test` y `uploads`; el `Dockerfile` elimina los `\r` del script de entrada por si se descargó con finales de línea de Windows, y `.gitattributes` fuerza LF en `*.sh` y `Dockerfile*`.
- Medidas: `node_modules` de producción 339 MB y código compilado 1 MB; `docker image inspect` indica 271 MB de contenido.
- Aviso conocido: Prisma 6 muestra que `package.json#prisma` (usado para `prisma.seed`) quedará obsoleto en Prisma 7; migrar a `prisma.config.ts` forma parte de la actualización de Prisma, que queda como mejora futura.

### `docker-entrypoint.sh`
1. `npx prisma migrate deploy` (R7.2).
2. Si `SEED_ON_START=true`, ejecuta el seed compilado (R7.3).
3. `exec node dist/main.js`, para que SIGTERM llegue a la aplicación (R6.4).

### Dockerfile del frontend (multi-etapa)
`node` compila con Vite; la etapa final es `nginxinc/nginx-unprivileged:1.30-alpine` (uid 101, puerto 8080; la etiqueta fija la serie 1.30 en vez de `stable`) que sirve el SPA con *fallback* a `index.html` y hace *proxy* de `/api/` al backend.

Detalles de implementación (`frontend/Dockerfile` y `frontend/nginx/`):
- La configuración es una plantilla (`default.conf.template`) que el *entrypoint* oficial de la imagen renderiza al arrancar con `envsubst`: `BACKEND_UPSTREAM` (por defecto `backend:3000`) y `DNS_RESOLVER` (por defecto `127.0.0.11`, el DNS de Docker). Las `$variables` propias de nginx no se tocan.
- El *upstream* se guarda en una variable (`set $backend ...; proxy_pass http://$backend;`) con `resolver ... valid=10s`, de modo que nginx resuelve el nombre en cada petición. Con un nombre fijo, nginx no arranca si el backend no existe todavía y conserva una IP obsoleta cuando el backend se recrea. Comprobado: el frontend arranca sin backend (502 en `/api`, la app sí se sirve), encuentra al backend cuando aparece y sigue a un backend recreado con otra IP, sin reiniciar nginx.
- `/healthz` responde 200 sin depender del backend (lo usa el `HEALTHCHECK` de la imagen y de Compose).
- `/assets/` (nombres con hash de Vite) lleva `Cache-Control: public, max-age=31536000, immutable`; cualquier otra ruta cae en `index.html` con `no-cache`, para que un despliegue nuevo se vea de inmediato. Un asset inexistente responde 404, no la página.
- Cabeceras de seguridad en páginas y assets (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` y una CSP `default-src 'self'`; `style-src` admite `'unsafe-inline'` por los estilos en línea de React). `/api/` no las repite: el backend ya envía las suyas con `helmet`. Verificado en un navegador real: sin violaciones de CSP. Si una spec futura carga recursos de otro origen (fuentes, imágenes externas), habrá que ampliar la CSP en `security-headers.conf`.
- `/api/` admite cuerpos de hasta 5 MB (`client_max_body_size`), margen para la imagen de 2 MB de un libro; los JSON de más de 100 KB los rechaza el backend con su 413.
- Pendiente para las specs `auth` y `audit-log`: detrás de nginx, el backend ve la IP del contenedor de nginx, no la del cliente. Hay que activar `trust proxy` en Express (`app.set('trust proxy', 1)`) para que el límite de intentos del login y el campo `ip` de `AuditLog` usen la IP real; sin eso, todos los usuarios compartirían el mismo contador de intentos. Con esto el navegador solo habla con un origen y no hace falta CORS en el despliegue. En desarrollo con `npm run dev`, el servidor de Vite hace el mismo proxy.

### `docker-compose.yml`
- `db`: `postgres:16`, volumen `pgdata`, `healthcheck` con `pg_isready` (R7.4, R7.6).
- `backend`: build de `backend/`, `depends_on: db (service_healthy)`, volumen `uploads` montado en `UPLOAD_DIR`, `healthcheck` contra `/api/health` (R7.2, R7.4, R7.6).
- `frontend`: build de `frontend/`, `depends_on: backend (service_healthy)`, `healthcheck` contra `/healthz` (puerto interno 8080; Compose publica `FRONTEND_PORT:8080`).
- `pgadmin` con `profiles: ["tools"]` (R7.7).
- Credenciales y puertos solo desde variables de entorno (R7.8).

Detalles de implementación (`docker-compose.yml` en la raíz):
- Nombre de proyecto `cmpc-libros`. Un `.env` copiado de `.env.example` basta para levantar todo con `docker compose up --build`; sin él, Compose falla con "Copy .env.example to .env" nombrando la variable. Las variables obligatorias (`POSTGRES_*`, `JWT_SECRET`, `PGADMIN_PASSWORD`) usan `${VAR:?...}`; el resto tiene valor por defecto.
- `DATABASE_URL` del backend se arma en Compose a partir de `POSTGRES_USER`, `POSTGRES_PASSWORD` y `POSTGRES_DB`, de modo que haya una sola fuente de verdad (una contraseña con caracteres especiales debe ir codificada como URL). La `DATABASE_URL` de `.env.example` apunta a `localhost:5442` y solo sirve para ejecutar el backend fuera de Docker contra el `db` publicado.
- El backend corre siempre con `NODE_ENV=production` en Compose (activa la exigencia de 32 caracteres para `JWT_SECRET`) y con su `PORT` interno 3000; el `NODE_ENV` y el `PORT` del `.env` son solo para desarrollo local. `UPLOAD_DIR` viene de la imagen (`/app/uploads`).
- Solo el frontend se publica en todas las interfaces (`FRONTEND_PORT`, por defecto 8080). `db` y `backend` se publican únicamente en `127.0.0.1`, porque llegar directo al backend se saltaría nginx. `DB_PORT` vale 5442 por defecto, no 5432, para no chocar con un PostgreSQL local; el contenedor siempre usa 5432.
- `backend` y `frontend` llevan `cap_drop: [ALL]` y `no-new-privileges`. Todos los servicios tienen `restart: unless-stopped` y rotación de logs (10 MB, 3 archivos).
- Volúmenes con nombre: `pgdata`, `uploads` (la primera vez copia la carpeta de la imagen, que pertenece al usuario `node`) y `pgadmin_data`.
- `pgadmin` (`dpage/pgadmin4:9.9`) solo arranca con `--profile tools`, usa el modo por defecto con inicio de sesión (`PGADMIN_EMAIL` y `PGADMIN_PASSWORD`; rechaza dominios reservados como `.local`) y se publica en `127.0.0.1:${PGADMIN_PORT}`.
- Verificado (stack completo desde cero): los tres servicios quedan `healthy` en 23 s; migración y seed aplicados; la app, la API y Swagger responden por el único puerto público; los datos de la base y los archivos de `uploads` sobreviven a `down`/`up`; con `SEED_ON_START=false` no se ejecuta el seed; `docker compose stop` termina en 2,7 s con código 0 en los tres servicios. No se arrancó el servicio `pgadmin` (la imagen pesa cerca de 500 MB); solo se validó que la configuración sea correcta y que aparezca únicamente con el perfil `tools`.

## 9. Frontend: base técnica
- **Cliente HTTP (`lib/api-client.ts`):** instancia de Axios con `baseURL: '/api'`; un interceptor de petición añade `Authorization: Bearer <token>`.
- **Errores (R4.6, R4.7):** un interceptor de respuesta convierte cualquier fallo en `ApiError { status, message, fieldErrors? }`. Si `status === 401` limpia la sesión y navega a `/login`. Sin respuesta del servidor genera un `ApiError` con el mensaje de conexión.
  - `ApiError` (`lib/api-error.ts`) lleva `status`, `message` (siempre en español, según el estado HTTP), `fieldErrors` y `serverMessage` (el mensaje original en inglés, solo para registros). `status === 0` significa "no hubo respuesta HTTP" (`isNetworkError`). Con `erasableSyntaxOnly` los campos se declaran explícitamente, sin propiedades de parámetro.
  - Del cuerpo de error solo se lee lo que cumple el contrato (`message` de tipo texto y `errors` bien formado); cualquier otra cosa, como HTML de un proxy, se ignora.
  - Las cancelaciones (por ejemplo, TanStack Query abortando una petición) pasan sin convertirse en `ApiError` y no cierran la sesión.
  - Un 401 cierra la sesión y navega a `/login` solo si había un token: un 401 sin token es un inicio de sesión fallido y el formulario debe mostrarlo, no redirigir.
  - El router registra la navegación con `setUnauthorizedHandler(...)` (P-14); si nadie la registra, el respaldo es una redirección completa con `window.location.assign('/login')`.
  - `lib/session.ts` guarda el token en `localStorage` (clave `cmpc.token`) y es lo único que lee el cliente.
  - Los tipos del contrato (`FieldError`, `ErrorResponseBody`, `PaginationMeta`, `ApiResponse`) viven en `src/types/api.ts`.
  - Los mensajes de validación por campo que envía el backend siguen en inglés; los formularios validan antes en español con Zod, y esos mensajes del servidor son solo el último recurso.
- **TanStack Query:** `createQueryClient(onError)` (`lib/query-client.ts`) con `refetchOnWindowFocus: false` y mutaciones sin reintentos (no son idempotentes). Las consultas reintentan una sola vez, pero no ante un 4xx: repetir una petición inválida no ayuda y solo retrasa el error (refina el `retry: 1` inicial). Los errores de consultas y mutaciones llegan al aviso global, salvo que lleven `meta: { silent: true }` (para formularios que muestran el error por campo).
- **Aviso global de errores:** `AppProviders` reúne el `QueryClientProvider` y el estado del aviso. `ErrorNotice` (`role="alert"`, con botón para cerrarlo) muestra el mensaje de cualquier `ApiError`; un error que no sea `ApiError` muestra siempre el mensaje genérico, sin detalles. `useErrorNotice()` permite lanzar un aviso a mano y falla con un mensaje claro si se usa fuera del proveedor.
- **Routing:** React Router 8 (`router.tsx`) con `/login`, `/books` dentro de `ProtectedRoute`, `/` que redirige a `/books` y `*` con una página 404. Sin token, `ProtectedRoute` redirige a `/login` con `replace` y guarda `state.from` para volver después. `registerUnauthorizedNavigation(router)` conecta el 401 del cliente con `router.navigate('/login')`, sin recargar la página. `ProtectedRoute` lee `session.getToken()`; la spec `auth` lo sustituirá por un `AuthProvider`/`useAuth` reactivo. `LoginPage` y `BooksPage` son marcadores de posición hasta las specs `auth` y `books-listing`.
- `App` recibe el enrutador por propiedad (`<App router={...} />`): `main.tsx` crea el enrutador del navegador, registra la navegación del 401 y renderiza; las pruebas pasan un enrutador en memoria.
- **Almacenamiento del token:** `localStorage`, con el compromiso documentado en `auth/design.md`.

## 10. Pruebas y cobertura (R8)
- **Backend:** Jest con `coverageThreshold.global` de 80 en `statements`, `branches`, `functions` y `lines`. Exclusiones (`collectCoverageFrom`): `main.ts`, `seed/run-seed.ts`, `*.module.ts`, `*.dto.ts`, `*.d.ts` y código generado (R8.4). `PrismaService` y `seed-admin.ts` sí se miden.
- **Frontend:** Vitest con proveedor `v8` y los mismos umbrales. Exclusiones (`coverage.exclude` en `vite.config.ts`): `src/main.tsx`, `src/types/**`, `src/test/**` (la preparación de las pruebas), `*.d.ts` y los `*.spec.{ts,tsx}`. Solo cuenta el código bajo `src/`; los archivos de configuración de la raíz quedan fuera de `include`.
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
