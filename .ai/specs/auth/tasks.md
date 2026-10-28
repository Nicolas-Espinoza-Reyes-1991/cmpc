# Spec auth: Tareas

Reglas: seguir el orden; una tarea está hecha solo cuando su criterio se cumple y sus pruebas pasan. Los commits sugeridos usan formato convencional en inglés y se hacen cuando el usuario lo autorice.
Antes de cada tarea se leen `requirements.md` y `design.md`; cada cambio de decisión se refleja en `design.md`.
Marcar con `[x]` al terminar.

## Backend
- [x] **A-01 Dependencias del backend** (§8)
  - Instalar `@nestjs/jwt@^11.0.2`, `@nestjs/passport@^11.0.5`, `passport@^0.7.0`, `passport-jwt@^4.0.1`, `@nestjs/throttler@^6.7.1` y, en desarrollo, `@types/passport-jwt@^4.0.1`.
  - Añadir a `tech-stack.md` la advertencia de que `@nestjs/jwt` y `@nestjs/passport` 12.x son ESM y se usan las 11.x.
  - Hecho cuando: `npm run build`, `npm run lint` y `npm run test:cov` siguen pasando y `npm audit` no suma hallazgos nuevos de estas librerías.
  - Commit: `build(backend): add jwt, passport and throttler dependencies`

- [x] **A-02 Módulo de usuarios** (§2, A8.1)
  - `UsersModule` y `UsersService` con `findByEmail` y `findById`, sobre `PrismaService`; devuelve el usuario con su hash solo a quien lo pide dentro del backend.
  - Pruebas: busca por correo y por id; devuelve `null` si no existe; solo consulta la tabla `users`.
  - Commit: `feat(users): add users service`

- [x] **A-03 Servicio de autenticación** (A1.1 a A1.4, A1.6, A2.1)
  - `AuthService` con `login`, `JwtModule` con `registerAsync` (`JWT_SECRET`, `JWT_EXPIRES_IN`, HS256) y el hash de relleno.
  - Pruebas: contraseña correcta devuelve token, `tokenType`, `expiresAt` y usuario; contraseña errónea y correo inexistente dan el mismo `UnauthorizedException('Invalid credentials')`; con correo inexistente se verifica igualmente contra el hash de relleno; el token contiene solo `sub`, `iat` y `exp`; el resultado nunca incluye el hash.
  - Commit: `feat(auth): add credential validation and token signing`

- [x] **A-04 Estrategia, guard global y decorador** (A2.2, A2.3, A3.1 a A3.3, A3.5)
  - `JwtStrategy` (solo HS256, consulta al usuario), `JwtAuthGuard` (respeta `@Public()`) y `@CurrentUser()`.
  - Pruebas: usuario existente devuelve `{ id, email }`; usuario ausente y `sub` inválido dan 401; ruta pública pasa sin token; ruta sin `@Public()` exige token; el decorador devuelve `request.user`.
  - Commit: `feat(auth): add JWT strategy, global guard and current user decorator`

- [x] **A-05 Controlador, límite de intentos y `trust proxy`** (A1.1, A1.5, A3.4, A4.1 a A4.3, A7.2)
  - `AuthController` con `POST /auth/login` (público, `@HttpCode(200)`, `ThrottlerGuard`) y `GET /auth/me`; DTOs con validación y decoradores de Swagger; `ThrottlerModule.forRootAsync`; `app.set('trust proxy', 1)` en `configureApp`.
  - Pruebas HTTP con Passport real y `configureApp`: login correcto y `me`; sin cabecera; esquema distinto de Bearer; token expirado; firma alterada; token con `alg: none`; usuario eliminado; cuerpo inválido con errores por campo; contraseña de más de 128 caracteres; el 429 con `Retry-After` al sexto intento sin afectar a `me`; correo normalizado; ninguna respuesta ni log contiene la contraseña o el hash. Prueba de `configureApp` con `trust proxy`.
  - Commit: `feat(auth): add login and me endpoints with rate limiting`

- [x] **A-06 Integración en la aplicación** (A3.1)
  - Importar `AuthModule` en `AppModule`; actualizar la prueba e2e: `/api/health` sigue público, `/api/auth/me` sin token da 401 con el formato único y el documento OpenAPI incluye las rutas de auth.
  - Hecho cuando: lint, tipos, build, `test:cov` y e2e pasan.
  - Commit: `feat(auth): protect every route by default`

- [x] **A-07 Verificación del backend contra PostgreSQL real** (A8.4, parcial)
  - Con la base de desarrollo y el administrador sembrado, contra el backend compilado: login correcto; contraseña errónea y correo inexistente (misma respuesta; tiempos comparables); `me` con el token; sin token; token alterado; token expirado (con `JWT_EXPIRES_IN` de pocos segundos); el sexto intento de login da 429; el contenedor de Docker responde igual.
  - Hecho cuando: los resultados quedan anotados en el registro de verificación de este archivo.

## Frontend
- [x] **A-08 Dependencias, tipos y servicio** (§5, §8, A6.1, A8.2)
  - Instalar `react-hook-form`, `zod` y `@hookform/resolvers`; `types/auth.ts`, `services/auth.service.ts` (`login`, `getMe`) y `lib/login-schema.ts`.
  - Pruebas: el servicio llama a las rutas correctas y devuelve `data`; el esquema valida correo y contraseña con sus mensajes en español (vacío, formato inválido, espacios, contraseña vacía).
  - Commit: `feat(frontend): add auth service and login schema`

- [x] **A-09 Sesión observable** (A5.4, A5.6)
  - `session.subscribe` y escucha del evento `storage`.
  - Pruebas: `setToken` y `clear` avisan a los oyentes; darse de baja funciona; un evento `storage` con la clave del token avisa; con otra clave no; se quita el oyente de `storage` al no quedar suscriptores.
  - Commit: `feat(frontend): make the session observable across tabs`

- [x] **A-10 `AuthProvider`, `useAuth` y `ProtectedRoute`** (A5.1 a A5.5, A5.7)
  - `AuthProvider` con `status`, `user`, `login`, `logout` y `retry`; `ProtectedRoute` con las pantallas de carga y de error (`AuthStatusScreen`).
  - Pruebas: los cinco estados (`anonymous`, `loading`, `authenticated`, 401, error de red); `login` guarda el token y siembra la caché; `logout` limpia token y caché; `retry` reintenta; `ProtectedRoute` en cada estado; `useAuth` fuera del proveedor falla con un mensaje claro.
  - Commit: `feat(frontend): add auth provider and session-aware protected route`

- [x] **A-11 Pantalla de login** (A5.1, A5.7, A6.1 a A6.6)
  - Reemplazar el marcador de `LoginPage` por el formulario.
  - Pruebas: validación en español por campo; envío correcto con navegación a `from` y a `/books`; `from` peligroso (`//evil.test`, `https://evil.test`) se ignora; 401, 429, error de red y 400 por campo; sin duplicar el aviso global; botón deshabilitado con "Ingresando…" y sin doble envío; mostrar y ocultar contraseña con `aria-pressed`; foco en el primer campo con error; la contraseña no se guarda en `localStorage`; un usuario autenticado es redirigido a `/books`.
  - Commit: `feat(frontend): add login form`

- [x] **A-12 Diseño de las pantallas protegidas** (A5.5, A6.7)
  - `AppLayout` con el correo y "Cerrar sesión"; rutas protegidas dentro de `ProtectedRoute` y `AppLayout`; mantener `registerUnauthorizedNavigation`.
  - Pruebas: muestra el correo; el botón cierra la sesión, vacía la caché y lleva a `/login`; las rutas protegidas se muestran dentro del diseño.
  - Hecho cuando: lint, tipos, build y `test:cov` (con el umbral de 80%, A8.3) pasan en el frontend.
  - Commit: `feat(frontend): add authenticated layout with logout`

## Integración y cierre
- [x] **A-13 Verificación de punta a punta** (A8.4)
  - Reconstruir el stack con Docker (`docker compose up --build`) y, en un navegador real: `/books` sin sesión lleva a `/login`; contraseña incorrecta muestra el mensaje y conserva el correo; el sexto intento muestra el aviso de demasiados intentos; login correcto lleva a `/books` con el correo en la cabecera; recargar mantiene la sesión sin parpadeo; cerrar sesión lleva a `/login` y vacía los datos; con `JWT_EXPIRES_IN` corto, tras expirar la siguiente acción lleva a `/login`; un token alterado en `localStorage` devuelve a `/login`; cerrar sesión en una pestaña cierra la otra.
  - Comprobar también (A7.1) que la cabecera `Content-Security-Policy` de nginx sigue presente en las páginas y que la aplicación no carga scripts de otros orígenes.
  - Hecho cuando: cada escenario queda anotado en el registro de verificación.

- [x] **A-14 Verificación de la spec**
  - Recorrer A1 a A8, comprobar cada criterio con evidencia nueva (prueba automática, comando o revisión) y registrar el resultado al final de este archivo. En particular: A7.1 (`design.md` §7 documenta el compromiso del token en `localStorage` y la CSP de nginx sigue activa) y A8.3 (`npm run test:cov` con 80% o más, y fallando por debajo, en backend y frontend).
  - Marcar como resuelto el pendiente `trust proxy` en `.ai/specs/platform/tasks.md`.
  - Hecho cuando: ningún criterio queda sin comprobación o sin una nota que explique por qué.
  - Commit: `docs(auth): record the spec verification`

## Registro de verificación
(Se completa en A-07, A-13 y A-14.)

### A-07: backend contra PostgreSQL real (2026-10-27)
Entorno: Windows 11, Docker Desktop, Node 22.22. Parte 1 con el backend compilado (`node dist/main`) contra el PostgreSQL de desarrollo y el administrador sembrado; parte 2 con el stack de Docker (`docker compose up --build`) a través de nginx.

| Comprobación | Backend compilado | Docker (por nginx) |
|---|---|---|
| Login correcto: respuesta `data` con `accessToken`, `tokenType`, `expiresAt` y `user`; token con solo `exp`, `iat`, `sub`; sin hash ni contraseña | 200, cumple | 200, cumple |
| Contraseña errónea y correo inexistente: misma respuesta (sin el `timestamp`) | idénticas | idénticas |
| Tiempos, 12 intentos de cada caso | mediana 290 ms (existente) frente a 285 ms (inexistente), 1,7% de diferencia, medido con `curl` | no repetido (se mide en A-03: 86 ms frente a 82 ms, y 2 ms sin el hash de relleno) |
| `/auth/me` con token, sin token, basura, payload alterado, `alg: none` y esquema Basic | 200, 401, 401, 401, 401, 401 | 200 y 401 (sin token y basura) |
| Token con vida de 6 s (`JWT_EXPIRES_IN=6s`): recién emitido y 7 s después | 200 y 401; la respuesta no menciona "expired" ni "jwt" | 200 y 401; ídem |
| Límite: 5 intentos pasan y el sexto da 429 con `Retry-After: 60` y el mensaje `Too many requests` | cumple | cumple |
| Con la contraseña correcta desde la IP bloqueada | 429 (el límite es por IP) | 429 |
| Otra IP no queda bloqueada; `/auth/me` no cuenta para el límite | 200 y 200 | `/auth/me` 200 |
| Falsear `X-Forwarded-For` (`9.9.9.9`, `1.1.1.1, 2.2.2.2`, `203.0.113.50`) para escapar del límite | prefijo falso ignorado (prueba HTTP) | los tres siguen en 429: gana la dirección que añade nginx |
| Contraprueba: llegando **directo** al backend con `X-Forwarded-For` propio | n/a | 200 (el cliente sí elige su IP; por eso el puerto solo se publica en `127.0.0.1`) |
| Usuario eliminado después de iniciar sesión | `/auth/me` con el mismo token da 401; el login también | n/a |
| Caída real de PostgreSQL con un token válido | `/auth/me` y login 500, `/health` 503, token inválido 401; vuelve a 200 en ~2 s con el mismo token y sin reiniciar | idéntico (500, 503, 401, recuperación en ~2 s) |
| Logs: contraseñas, hash `argon2` y tokens | 0 apariciones | 0 en el backend y 0 en nginx |
| Log de acceso | `GET /api/auth/me 200 5ms user=<id>`; las peticiones rechazadas salen con `user=anonymous` | ídem |

Resultado: **todo cumple**. Cubre los criterios A1.1 a A1.3, A1.6, A2.1 a A2.3, A3.1 a A3.4, A4.1 a A4.3 y A5.4 (parte del servidor).

Hallazgos de esta verificación:
- Ningún defecto nuevo. El único defecto de la spec auth se encontró en A-04 con una prueba automática (los errores de base de datos se convertían en 401) y aquí queda comprobado en el sistema real: una caída de la base da 500, no 401, de modo que el frontend no cerraría las sesiones.
- Un usuario temporal creado para la prueba del usuario eliminado se borró; la base de desarrollo quedó con su único usuario.
- La compilación de las imágenes con las dependencias de auth tardó 253 s (instalación en frío); es un costo de una sola vez.

### A-13: frontend contra el stack de Docker, en un navegador real (2026-10-28)
Entorno: `docker compose up --build` (db, backend y frontend `healthy`), navegador integrado de la aplicación, administrador sembrado. Las comprobaciones se hicieron leyendo el DOM y `localStorage` de la página (el panel del navegador estaba oculto, sin capturas).

| Escenario | Resultado |
|---|---|
| `/books` sin sesión | Lleva a `/login` |
| Contraseña incorrecta | "Correo o contraseña incorrectos."; el correo se conserva, la contraseña se vacía y el foco pasa a ella |
| Sexto intento en la ventana de 60 s | "Demasiados intentos. Espera un momento e inténtalo de nuevo."; sin token guardado |
| Login correcto (tras vencer la ventana) | Lleva a `/books`; la cabecera muestra "CMPC Libros", el correo y "Cerrar sesión" |
| Recargar con sesión | Se mantiene en `/books` con la cabecera; no se puede observar el parpadeo en vivo (la CSP impide el iframe y se bloquean las ventanas emergentes), por lo que ese punto lo cubren las pruebas de `ProtectedRoute` y `LoginPage` (estado `loading` sin formulario ni redirección) |
| Token alterado en `localStorage` + recarga | Lleva a `/login` y borra el token |
| Cerrar sesión | Lleva a `/login` y deja el token en `null`; la caché se vacía según la prueba de `AuthProvider` (no es inspeccionable desde la página) |
| Cerrar sesión en una pestaña con otra abierta | La otra pestaña pasa a `/login` sin recargar, con el token en `null` |
| `JWT_EXPIRES_IN=15s`, recarga a los 17 s | Lleva a `/login` y borra el token |
| A7.1: CSP de nginx | `Content-Security-Policy: default-src 'self'; ...; frame-ancestors 'none'; ...` presente; la página carga un único script del mismo origen y ningún recurso externo |

Hallazgos: ningún defecto. El límite de intentos también rechaza un login correcto durante la ventana de 60 s (es por IP, no por resultado); es el comportamiento diseñado, y queda en la documentación como detalle de uso. El stack se detuvo con `docker compose down` al terminar.

### A-14: verificación de la spec (2026-10-28)
Evidencia nueva de esta sesión: backend `lint` limpio, `test:cov` (213 pruebas, 100%) y `test:e2e` (8 pruebas); frontend `lint`, `tsc`, `build` y `test:cov` (214 pruebas, 100%); más lo observado en A-07 y A-13.

| Criterio | Evidencia |
|---|---|
| A1.1–A1.6 | Pruebas de `AuthService`, `AuthController`, DTO y e2e; A-07 (respuesta real, mismo 401 para correo inexistente o contraseña errónea, tiempos 2 ms sin la verificación frente a 82–86 ms con ella) |
| A2.1–A2.3 | Pruebas de `JwtStrategy` y e2e (expirado, alterado, `none`, usuario inexistente); A-07 con `JWT_EXPIRES_IN=6s` |
| A3.1–A3.5 | e2e recorre las rutas del OpenAPI y exige 401 salvo las públicas; prueba de mutación del guard global |
| A4.1–A4.2 | Prueba e2e del 429 con `Retry-After`; A-07 y A-13 (sexto intento) |
| A4.3 | `app.set('trust proxy', 1)` en `app.setup.ts:71`; A-07 por nginx con el límite aplicado por IP real |
| A5.1–A5.7 | Pruebas de `AuthProvider`, `ProtectedRoute`, `LoginPage`, `redirect` y `session`; A-13 (reintento tras 5xx por pruebas; recarga, token alterado, expirado y cierre en dos pestañas en el navegador). El parpadeo de A5.2 solo está cubierto por pruebas unitarias |
| A6.1–A6.7 | `LoginPage.spec.tsx` (37 pruebas) y `AppLayout.spec.tsx`; A-11 y A-13 en navegador real |
| A7.1 | `design.md` §7 documenta el compromiso del token en `localStorage`; la CSP de nginx está presente (A-13). Corrección: la CSP usa `default-src 'self'` y no un `script-src` propio; funciona igual, y los textos de la spec se ajustaron |
| A7.2 | `AuthController` declara 200, 400, 401 y 429 en el login, `ApiBearerAuth` en `me` y ejemplos en el DTO; la comprobación de la UI de Swagger se hará con la spec `docs-delivery` |
| A8.1–A8.2 | 21 suites de backend y 17 de frontend, incluidas todas las citadas |
| A8.3 | Umbral de 80% en `package.json` (backend) y `vite.config.ts` (frontend); forzado a 101% falla en ambos ("does not meet global threshold") |
| A8.4 | A-07 y A-13 |

Resultado: sin criterios pendientes. Notas: el aviso de chunk de más de 500 kB del build y los 15 hallazgos de `npm audit` del backend siguen abiertos (ver `platform`); en `platform/tasks.md` se marcaron como resueltos `trust proxy` y la autenticación del frontend.
