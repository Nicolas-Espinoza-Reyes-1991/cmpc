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

- [ ] **A-05 Controlador, límite de intentos y `trust proxy`** (A1.1, A1.5, A3.4, A4.1 a A4.3, A7.2)
  - `AuthController` con `POST /auth/login` (público, `@HttpCode(200)`, `ThrottlerGuard`) y `GET /auth/me`; DTOs con validación y decoradores de Swagger; `ThrottlerModule.forRootAsync`; `app.set('trust proxy', 1)` en `configureApp`.
  - Pruebas HTTP con Passport real y `configureApp`: login correcto y `me`; sin cabecera; esquema distinto de Bearer; token expirado; firma alterada; token con `alg: none`; usuario eliminado; cuerpo inválido con errores por campo; contraseña de más de 128 caracteres; el 429 con `Retry-After` al sexto intento sin afectar a `me`; correo normalizado; ninguna respuesta ni log contiene la contraseña o el hash. Prueba de `configureApp` con `trust proxy`.
  - Commit: `feat(auth): add login and me endpoints with rate limiting`

- [ ] **A-06 Integración en la aplicación** (A3.1)
  - Importar `AuthModule` en `AppModule`; actualizar la prueba e2e: `/api/health` sigue público, `/api/auth/me` sin token da 401 con el formato único y el documento OpenAPI incluye las rutas de auth.
  - Hecho cuando: lint, tipos, build, `test:cov` y e2e pasan.
  - Commit: `feat(auth): protect every route by default`

- [ ] **A-07 Verificación del backend contra PostgreSQL real** (A8.4, parcial)
  - Con la base de desarrollo y el administrador sembrado, contra el backend compilado: login correcto; contraseña errónea y correo inexistente (misma respuesta; tiempos comparables); `me` con el token; sin token; token alterado; token expirado (con `JWT_EXPIRES_IN` de pocos segundos); el sexto intento de login da 429; el contenedor de Docker responde igual.
  - Hecho cuando: los resultados quedan anotados en el registro de verificación de este archivo.

## Frontend
- [ ] **A-08 Dependencias, tipos y servicio** (§5, §8, A6.1, A8.2)
  - Instalar `react-hook-form`, `zod` y `@hookform/resolvers`; `types/auth.ts`, `services/auth.service.ts` (`login`, `getMe`) y `lib/login-schema.ts`.
  - Pruebas: el servicio llama a las rutas correctas y devuelve `data`; el esquema valida correo y contraseña con sus mensajes en español (vacío, formato inválido, espacios, contraseña vacía).
  - Commit: `feat(frontend): add auth service and login schema`

- [ ] **A-09 Sesión observable** (A5.4, A5.6)
  - `session.subscribe` y escucha del evento `storage`.
  - Pruebas: `setToken` y `clear` avisan a los oyentes; darse de baja funciona; un evento `storage` con la clave del token avisa; con otra clave no; se quita el oyente de `storage` al no quedar suscriptores.
  - Commit: `feat(frontend): make the session observable across tabs`

- [ ] **A-10 `AuthProvider`, `useAuth` y `ProtectedRoute`** (A5.1 a A5.5, A5.7)
  - `AuthProvider` con `status`, `user`, `login`, `logout` y `retry`; `ProtectedRoute` con las pantallas de carga y de error (`AuthStatusScreen`).
  - Pruebas: los cinco estados (`anonymous`, `loading`, `authenticated`, 401, error de red); `login` guarda el token y siembra la caché; `logout` limpia token y caché; `retry` reintenta; `ProtectedRoute` en cada estado; `useAuth` fuera del proveedor falla con un mensaje claro.
  - Commit: `feat(frontend): add auth provider and session-aware protected route`

- [ ] **A-11 Pantalla de login** (A5.1, A5.7, A6.1 a A6.6)
  - Reemplazar el marcador de `LoginPage` por el formulario.
  - Pruebas: validación en español por campo; envío correcto con navegación a `from` y a `/books`; `from` peligroso (`//evil.test`, `https://evil.test`) se ignora; 401, 429, error de red y 400 por campo; sin duplicar el aviso global; botón deshabilitado con "Ingresando…" y sin doble envío; mostrar y ocultar contraseña con `aria-pressed`; foco en el primer campo con error; la contraseña no se guarda en `localStorage`; un usuario autenticado es redirigido a `/books`.
  - Commit: `feat(frontend): add login form`

- [ ] **A-12 Diseño de las pantallas protegidas** (A5.5, A6.7)
  - `AppLayout` con el correo y "Cerrar sesión"; rutas protegidas dentro de `ProtectedRoute` y `AppLayout`; mantener `registerUnauthorizedNavigation`.
  - Pruebas: muestra el correo; el botón cierra la sesión, vacía la caché y lleva a `/login`; las rutas protegidas se muestran dentro del diseño.
  - Hecho cuando: lint, tipos, build y `test:cov` (con el umbral de 80%, A8.3) pasan en el frontend.
  - Commit: `feat(frontend): add authenticated layout with logout`

## Integración y cierre
- [ ] **A-13 Verificación de punta a punta** (A8.4)
  - Reconstruir el stack con Docker (`docker compose up --build`) y, en un navegador real: `/books` sin sesión lleva a `/login`; contraseña incorrecta muestra el mensaje y conserva el correo; el sexto intento muestra el aviso de demasiados intentos; login correcto lleva a `/books` con el correo en la cabecera; recargar mantiene la sesión sin parpadeo; cerrar sesión lleva a `/login` y vacía los datos; con `JWT_EXPIRES_IN` corto, tras expirar la siguiente acción lleva a `/login`; un token alterado en `localStorage` devuelve a `/login`; cerrar sesión en una pestaña cierra la otra.
  - Comprobar también (A7.1) que la cabecera `Content-Security-Policy` de nginx sigue presente en las páginas y que la aplicación no carga scripts de otros orígenes.
  - Hecho cuando: cada escenario queda anotado en el registro de verificación.

- [ ] **A-14 Verificación de la spec**
  - Recorrer A1 a A8, comprobar cada criterio con evidencia nueva (prueba automática, comando o revisión) y registrar el resultado al final de este archivo. En particular: A7.1 (`design.md` §7 documenta el compromiso del token en `localStorage` y la CSP de nginx sigue activa) y A8.3 (`npm run test:cov` con 80% o más, y fallando por debajo, en backend y frontend).
  - Marcar como resuelto el pendiente `trust proxy` en `.ai/specs/platform/tasks.md`.
  - Hecho cuando: ningún criterio queda sin comprobación o sin una nota que explique por qué.
  - Commit: `docs(auth): record the spec verification`

## Registro de verificación
(Se completa en A-07, A-13 y A-14.)
