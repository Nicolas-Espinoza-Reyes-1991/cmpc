# Spec auth: Diseño

Implementa los requisitos de `requirements.md`. Los códigos A# remiten a ese archivo.

## 1. Alcance y decisiones

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Un solo token de acceso, sin token de refresco; dura `JWT_EXPIRES_IN` (1 h por defecto) | Refresco con rotación | Menos piezas y superficie para esta escala. Al expirar, el usuario vuelve a iniciar sesión. Queda como mejora futura (§10) |
| El token solo lleva `sub`, `iat` y `exp` | Incluir el correo y un rol | El token es legible por el cliente; menos datos personales en él. El correo se obtiene con `GET /api/auth/me` |
| La estrategia JWT consulta el usuario en cada petición (búsqueda por clave primaria) | Confiar solo en la firma | Es la única forma de invalidar a un usuario eliminado sin lista de revocación; el costo es una consulta indexada |
| Token en `localStorage` | Cookie `httpOnly` con protección CSRF | Más simple con una API de cabecera `Authorization` y un frontend en el mismo origen; el riesgo y su mitigación están en §7 |
| Límite de intentos por IP, en memoria | Por cuenta, o con Redis | Basta para una instancia; el bloqueo por cuenta permitiría a un atacante dejar fuera al administrador |
| `GET /api/auth/me` | Decodificar el token en el cliente | El servidor valida la sesión de verdad (usuario existente, token vigente) |
| Guard JWT **global** con `@Public()` | Guard por controlador | Una ruta nueva nace protegida (A3.5) |
| Mismo mensaje 401 para correo inexistente y contraseña errónea | Mensajes distintos | Evita enumerar correos (A1.2) |
| Los eventos de login a `AuditLog` los añade `audit-log` | Hacerlo aquí | `AuditService` aún no existe; `AuthService` se amplía entonces con un par de líneas |

## 2. Backend: estructura
```
backend/src/
├── auth/
│   ├── auth.module.ts          # JwtModule, PassportModule, ThrottlerModule y el guard global
│   ├── auth.controller.ts      # POST /auth/login, GET /auth/me
│   ├── auth.service.ts         # validar credenciales y firmar el token
│   ├── password-hasher.ts      # envoltorio inyectable de argon2 (hash, verify)
│   ├── jwt.config.ts           # opciones de JwtModule: secreto, HS256, duración
│   ├── jwt.strategy.ts         # verifica el token y carga el usuario
│   ├── jwt-auth.guard.ts       # guard global; respeta @Public()
│   └── dto/                    # login.dto.ts, login-response.dto.ts, user.dto.ts
├── users/
│   ├── users.module.ts
│   └── users.service.ts        # findByEmail, findById (único acceso a la tabla users)
└── common/decorators/current-user.decorator.ts   # @CurrentUser()
```
`AuthModule` se importa en `AppModule`. `UsersService` es el único que toca la tabla `users`; `AuthService` depende de él y no de Prisma (D de SOLID).

## 3. API

| Ruta | Acceso | Cuerpo | Éxito | Errores |
|---|---|---|---|---|
| `POST /api/auth/login` | público, con límite de intentos | `{ email, password }` | 200 `{ data: { accessToken, tokenType, expiresAt, user: { id, email } } }` | 400 (campos), 401, 429 |
| `GET /api/auth/me` | token | — | 200 `{ data: { id, email } }` | 401 |

- `POST` responde 200 (no 201) porque no crea un recurso: `@HttpCode(200)`.
- `DTO` de entrada (`LoginDto`): `email` con `@IsEmail` y transformación a minúsculas sin espacios; `password` con `@IsString`, `@IsNotEmpty` y `@MaxLength(128)`. Los mensajes de validación siguen el formato único de `platform`.
- Errores de esta spec, todos en el formato `{ statusCode, message, errors?, path, timestamp }`:
  - 401 al iniciar sesión: `message: "Invalid credentials"` (siempre igual).
  - 401 por token ausente, inválido o expirado: `message: "Unauthorized"` (sin la causa).
  - 429: lo lanza `ThrottlerGuard`; trae `Retry-After` en segundos.
- Swagger: `@ApiTags('auth')`, ejemplos y respuestas en el login y `@ApiBearerAuth()` en `me`. Swagger describe el contenido de `data`; el envoltorio `{ data }` se explica en la descripción general de la API (`docs-delivery` puede mejorarlo con un tipo genérico).

## 4. Backend: componentes

**`UsersService`** (`users/`), con dos métodos pensados para exponer lo mínimo:
- `findByEmail(email)` devuelve el usuario completo, con el hash, porque solo el login lo necesita. Pasa el correo a minúsculas y sin espacios: los correos se guardan así (el seed lo hace) y esa regla vive junto al acceso a los datos, no en cada llamador.
- `findById(id)` devuelve solo `{ id, email }` (`UserSummary`); el hash ni siquiera se lee de la base. Si `id` no tiene forma de UUID devuelve `null` sin consultar: la columna es de tipo UUID y Prisma lanzaría `P2023` (un 500 con error en el log) para cualquier otro texto. Se comprobó contra PostgreSQL real. Así un `sub` raro en un token termina siempre en 401 y no en un error interno.

**`AuthService.login(email, password)`**
1. `UsersService.findByEmail(email)` (el correo ya llega normalizado desde el DTO).
2. Si no existe, verifica la contraseña contra `DUMMY_HASH` (un hash `argon2` generado una vez al arrancar con los mismos parámetros que los hashes reales) y lanza `UnauthorizedException('Invalid credentials')`. Así el tiempo no delata si el correo existe (A1.3).
3. Si existe, `argon2.verify(user.passwordHash, password)`; si falla, el mismo 401.
4. Firma el token con `JwtService.signAsync({ sub: user.id })` y calcula `expiresAt` a partir de la fecha de expiración (`exp`) del propio token.
5. Devuelve `{ accessToken, tokenType: 'Bearer', expiresAt, user: { id, email } }`; nunca el hash.

**`JwtModule`** se configura con `registerAsync` leyendo `JWT_SECRET` y `JWT_EXPIRES_IN` de `ConfigService`, con `algorithm: 'HS256'` para firmar y `verifyOptions: { algorithms: ['HS256'] }` para verificar (`jwt.config.ts`). Así, aunque quien llame a `verify` no pida un algoritmo, un token HS384, `none` o con otro secreto se rechaza.

Detalles de implementación de `AuthService` (A-03):
- **Una sola verificación en todos los casos.** `login` elige el hash (el del usuario o el de relleno) y llama una vez a `PasswordHasher.verify`; el trabajo realizado no depende de si el correo existe. Además de comprobar `matches`, rechaza si no hay usuario, de modo que el hash de relleno nunca pueda dar acceso.
- **El hash de relleno se construye en `onModuleInit`**, con un texto aleatorio de 64 caracteres que nadie conoce. Si `argon2` no funciona, la aplicación no arranca en vez de fallar con el primer correo desconocido.
- **`PasswordHasher`** envuelve `argon2` con sus parámetros por defecto (`argon2id`, `m=65536,p=4,t=3`), los mismos del seed y del administrador sembrado en la base, para que todos los hashes cuesten lo mismo. Si el hash guardado está corrupto, `verify` lanza (500 y registro) en lugar de responder "contraseña incorrecta".
- **Medición contra PostgreSQL real** (mediana de 15 intentos): correo inexistente **sin** hash de relleno, 2,1 ms; correo inexistente **con** hash de relleno, 82 ms; correo existente con contraseña errónea, 86 ms. Sin la defensa la diferencia sería de unas 42 veces y cualquiera podría medirla; con ella es de un -5%, dentro del ruido (en esta máquina cada intento oscila entre 66 y 367 ms porque `argon2` usa 4 hilos). Las respuestas de error son idénticas byte a byte.
- Un error de base de datos se propaga como tal; no se disfraza de "credenciales inválidas".

**`JwtStrategy`** (`passport-jwt`):
- Extrae el token de `Authorization: Bearer`, con `ignoreExpiration: false` y `algorithms: ['HS256']` (A2.2).
- `validate({ sub })`: si `sub` no es texto, o `UsersService.findById(sub)` no encuentra al usuario, lanza `UnauthorizedException`. Devuelve `{ id, email }` (`AuthenticatedUser`), que Passport deja en `request.user` (A3.3).

**`JwtAuthGuard`** extiende `AuthGuard('jwt')`; en `canActivate` consulta con `Reflector` si la ruta lleva `IS_PUBLIC_KEY` (decorador `@Public()` de `platform`) y, en ese caso, deja pasar. Se registra con `APP_GUARD` en `AuthModule`. Los problemas del token (cabecera ausente, expirado, firma inválida) llegan a `handleRequest` como "no hay usuario" y, igual que un usuario inexistente, producen el mismo 401 genérico: el motivo (por ejemplo "jwt expired") no se revela.

**Los errores de infraestructura no se convierten en 401.** Si `validate` lanza algo que no es un 401 (por ejemplo, la base de datos caída), `handleRequest` lo relanza intacto y llega al filtro como un 500. La primera versión del guard hacía `if (err || !user) throw 401`; una prueba HTTP lo detectó: una caída de la base de datos se veía como una sesión expirada y, como el frontend cierra la sesión ante cualquier 401, **habría deslogueado a todos los usuarios durante la caída**. Solo "no hay usuario" es un 401. Se comprobó con una caída real de PostgreSQL (el error `PrismaClientInitializationError` llega al guard y se queda en 500).

**`@CurrentUser()`**: decorador de parámetro que devuelve `request.user` tipado como `AuthenticatedUser`.

**Límite de intentos**: `ThrottlerModule.forRootAsync` con `ttl = THROTTLE_TTL * 1000` y `limit = THROTTLE_LIMIT`, almacenamiento en memoria. `ThrottlerGuard` se aplica **solo** a `login` con `@UseGuards(ThrottlerGuard)` (no es un guard global), así que ninguna otra ruta cuenta (A4.2). El identificador es `request.ip`.

Detalles de implementación (A-05):
- El mensaje del 429 es `Too many requests` (opción `errorMessage` en `throttler.config.ts`): el predeterminado de la librería, `ThrottlerException: Too Many Requests`, expone el nombre de una clase interna. La respuesta lleva `Retry-After` en segundos.
- Los guards se ejecutan antes que la validación, así que un cuerpo mal formado también cuenta como intento. El límite es por IP y no por cuenta: con la contraseña correcta desde una IP bloqueada también se responde 429.
- Con `trust proxy` = 1, `request.ip` es la última dirección de `X-Forwarded-For`, la que añade nginx. Lo que el cliente ponga antes no cambia su contador (probado con `1.1.1.1, <ip>`); sí podría falsearse llegando directo al backend, que por eso solo se publica en `127.0.0.1`.
- `LoginDto` normaliza el correo (espacios y minúsculas) antes de validarlo, limita el correo a 254 caracteres y la contraseña a 128, y rechaza propiedades no declaradas. `LoginResponseDto` y `UserDto` solo describen el contenido de `data` para Swagger.
- Se comprobó contra PostgreSQL real, con el administrador sembrado: 5 intentos pasan y el sexto da 429; no aparecen contraseñas, el token ni el hash en el log del servidor; el log de `/auth/me` muestra `user=<id>`.

**`trust proxy`**: `configureApp` añade `app.set('trust proxy', 1)`, de modo que `request.ip` sea la IP que nginx vio y no la del contenedor de nginx (A4.3). Con un solo salto, un cliente no puede falsear su IP mediante `X-Forwarded-For` a través de nginx, porque nginx añade la dirección real al final. Si alguien llega directo al backend (puerto publicado solo en `127.0.0.1`), sí podría falsearla; por eso ese puerto no se abre a la red.

**Log y auditoría**: con `request.user` presente, el log de accesos de `platform` ya muestra `user=<id>`. Las contraseñas no se registran porque ese log nunca lee cuerpos.

## 5. Frontend: estructura y componentes
```
frontend/src/
├── types/auth.ts                # LoginCredentials, AuthUser, LoginResponse
├── services/auth.service.ts     # login(), getMe() sobre apiClient
├── lib/session.ts               # (existe) + subscribe() y escucha del evento "storage"
├── lib/login-schema.ts          # esquema Zod del formulario, en español
├── hooks/useAuth.ts             # AuthContext y useAuth()
├── components/AuthProvider.tsx  # estado de sesión, login y logout
├── components/ProtectedRoute.tsx# (existe) ahora usa useAuth: carga, error, anónimo, autenticado
├── components/AppLayout.tsx     # cabecera con correo y "Cerrar sesión" + <Outlet />
├── components/AuthStatusScreen.tsx # pantalla de "Verificando sesión…" y de error con "Reintentar"
└── pages/LoginPage.tsx          # (reemplaza el marcador) formulario
```
Las rutas pasan a ser: `/login` (pública) y, dentro de `ProtectedRoute` y `AppLayout`, `/books` y las futuras.

**Esquema del formulario (`lib/login-schema.ts`, A-08).** Zod 4 con los mismos límites que `LoginDto`: correo de hasta 254 caracteres y contraseña de hasta 128. El correo se recorta (la contraseña nunca, porque los espacios en los extremos pueden formar parte de ella) y todos los mensajes salen en español, incluso con un valor que no sea texto (por defecto Zod respondería en inglés). La regla es que **el formulario puede ser más estricto que la API, pero nunca más permisivo**: Zod no aplica tres límites de la RFC 5321 que sí aplica el validador del backend (parte local de hasta 64 caracteres, etiquetas de dominio de hasta 63 y sin guion al principio ni al final), así que se añaden con una comprobación propia, anidada en un segundo `pipe` para que solo se ejecute sobre un correo bien formado (sin eso, Zod repetía el mismo mensaje dos veces). Se comparó con `class-validator` sobre 48 direcciones límite: ninguna pasa el formulario y el API la rechaza. Quedan 8 en que el formulario es más estricto (comillas en la parte local, caracteres no ASCII, `%` y símbolos como `!#$&'*`), que bloquean direcciones que la API aceptaría pero que no son realistas en este sistema.

**`session`** se vuelve observable: `subscribe(listener)` devuelve la función para darse de baja; `setToken` y `clear` avisan a los oyentes, y el evento `storage` de otras pestañas también (A5.6). `useSyncExternalStore(session.subscribe, session.getToken)` da un valor reactivo del token, de modo que un 401 que limpia la sesión actualiza la interfaz sin recargar (A5.4).

Detalles de implementación (A-09):
- Los miembros de `session` son funciones flecha y no métodos: ninguno usa `this`, así que se pasan sueltos a `useSyncExternalStore` sin envoltorio (ESLint avisaba del riesgo de pasar métodos sueltos).
- `notify` recorre una copia de los oyentes: uno que se suscribe durante el aviso espera al siguiente cambio y no puede provocar un bucle infinito.
- El evento `storage` se filtra por `storageArea === localStorage` y por la clave del token; `key === null` (vaciado total) también cuenta. El oyente de `window` existe solo mientras haya suscriptores.
- Comprobado con **dos pestañas reales** y el módulo `session` auténtico: una pestaña no recibe el evento `storage` de sus propias escrituras (se avisa a sí misma directamente); la otra recibe un evento por cada cambio (token puesto, borrado, de nuevo y vaciado total con `key: null`) y `session` avisa en todos menos en el de otra clave.

**`AuthProvider`** (dentro de `AppProviders`, porque usa el `QueryClient`):
- `token` reactivo desde `session`.
- `useQuery(['auth', 'me'], getMe)` habilitada solo con token, con `staleTime: Infinity` y `meta: { silent: true }` (el provider decide qué mostrar).
- `status`: sin token → `anonymous`; con token y la consulta en curso → `loading`; consulta correcta → `authenticated`; error 401 → `anonymous` (el cliente ya limpió la sesión); otro error → `error` (A5.3).
- `login(credentials)`: llama a `auth.service.login`, guarda el token con `session.setToken` y siembra la caché `['auth','me']` con el usuario de la respuesta para no hacer otra petición.
- `logout()`: `session.clear()` y `queryClient.clear()` (A5.5). Como `ProtectedRoute` observa el estado, la redirección a `/login` ocurre sola.
- `retry()`: vuelve a ejecutar la consulta `me` (botón "Reintentar").

**`ProtectedRoute`**: `loading` muestra `AuthStatusScreen` ("Verificando sesión…"); `error` muestra el error con "Reintentar"; `anonymous` redirige a `/login` con `state.from`; `authenticated` muestra el `<Outlet />`.

Detalles de implementación (A-10):
- **La consulta de `me` lleva el token en su clave** (`['auth', 'me', token]`, no `['auth', 'me']` como decía el primer diseño). Con una clave fija, si otra pestaña inicia sesión como otro usuario, esta pestaña seguiría mostrando al anterior hasta recargar, porque la consulta nunca caduca (`staleTime: Infinity`). Con el token en la clave, un token nuevo es otra consulta. Se comprobó con una prueba.
- La consulta no reintenta (`retry: false`): la pantalla de error ofrece su propio "Reintentar" y el usuario no espera un reintento automático escondido.
- **Estados:** sin token es `anonymous`; con token y la consulta exitosa, `authenticated`; con error y sin petición en curso, `error`; en cualquier otro caso, `loading`. Tras "Reintentar" la consulta conserva su error hasta que llega la respuesta nueva, así que el estado se calcula con `isFetching` y la pantalla dice "Verificando sesión…" en vez de repetir el error.
- **`login`** siembra la caché con el usuario de la respuesta **antes** de guardar el token: no hay destello de "cargando" ni una petición extra a `/auth/me`.
- **`logout`** limpia el token y toda la caché de consultas. La propia consulta de `me` se vuelve a crear vacía y deshabilitada (sin token): no conserva ningún dato, que es lo que exige A5.5. Las pruebas comprueban que no queda ni un dato.
- `AuthProvider` va dentro de `AppProviders`, que sigue montando el aviso global; el error de `me` no se repite allí (`meta.silent`).
- `ProtectedRoute` ya no lee el token directamente; usa `useAuth()`. Las pruebas de rutas protegidas necesitan el proveedor y una respuesta simulada de `/auth/me`: `src/test/mock-api.ts` (`mockApi`) sustituye la capa HTTP del cliente real, que conserva sus interceptores, y una ruta sin respuesta simulada se comporta como fallo de red para que un mock olvidado falle en vez de colgarse.
- Comprobado en un **navegador real con el backend real**: con un token válido la secuencia de pantallas es "Verificando sesión…" y luego "Libros", sin pasar por el login; con un token inválido se llega a `/login` con `from: "/books"` y el token se borra; con el backend caído y un token válido aparece la pantalla de error con "Reintentar" y **la sesión se conserva**, y al volver el backend "Reintentar" lleva a "Libros"; y al quitar el token en una pestaña, la otra pasa de `/books` a `/login` sola, sin recargar.

**`LoginPage`**:
- React Hook Form con `zodResolver` y `mode: 'onTouched'` (valida al salir de cada campo y luego en cada cambio). Esquema en `lib/login-schema.ts`: correo con `trim` y formato; contraseña obligatoria; mensajes en español.
- Al enviar, llama a `login` del `AuthProvider` dentro de un `useMutation` con `meta: { silent: true }`.
- Errores: 401 → "Correo o contraseña incorrectos." en un bloque `role="alert"` bajo el formulario; 429 y red → el mensaje del `ApiError`; 400 con `fieldErrors` → `setError` por campo con un mensaje en español («Este valor no es válido. Revísalo.»); el texto del servidor, en inglés, no se muestra.
- Estado de envío: botón deshabilitado con "Ingresando…".
- Si `status === 'authenticated'`, redirige a `from` o a `/books`; `from` solo se acepta si empieza con `/` y no con `//`.
- Accesibilidad: `label` asociado a cada campo, `autoComplete="username"` y `"current-password"`, mensajes con `aria-describedby` y `aria-invalid`, foco en el primer campo con error y un botón de mostrar u ocultar la contraseña con `aria-pressed`.

Detalles de implementación de `LoginPage` (A-11):
- **Sin `useMutation`.** El primer diseño preveía envolver el login en una mutación con `meta: { silent: true }`. No hace falta: el formulario captura el error él mismo y el aviso global solo reacciona a consultas y mutaciones de TanStack Query, de modo que llamar a `login` directamente ya cumple A6.3 (no se repite el error) con una pieza menos. El estado de envío sale de `formState.isSubmitting`, porque `handleSubmit` espera la promesa.
- **Un solo punto de redirección.** La página no navega al terminar el login: `login` cambia el estado de la sesión a `authenticated` y el propio componente, que ya redirige a los usuarios con sesión (A5.7), los lleva a `from` o a `/books`. Mientras el token guardado se verifica (`loading`) muestra "Verificando sesión…" en vez de enseñar el formulario un instante; con `anonymous` o `error` muestra el formulario.
- **`from` seguro** (`lib/redirect.ts`): solo se acepta una ruta interna (empieza con una sola `/`, no con `//` ni `/\`, sin esquema) y nunca `/login`; cualquier otra cosa lleva a `/books`. Se prueba con `//evil.test`, `https://…`, `javascript:`, `data:` y la variante con barra invertida.
- **Errores:** 401 → "Correo o contraseña incorrectos." en un bloque `role="alert"`; se conserva el correo, se vacía la contraseña y se le da el foco. 429, red y 5xx → el mensaje del `ApiError`, conservando todo lo escrito (no tiene sentido borrar la contraseña si el problema no es ella). 400 con errores por campo → un mensaje en español bajo el campo («Este valor no es válido. Revísalo.», con `setError`); el texto del servidor, en inglés, no se muestra; si el campo no existe en el formulario o no hay lista, el mensaje general. Un error que no es `ApiError`, por ejemplo un navegador que no deja guardar el token (almacenamiento lleno o modo privado), muestra "Ocurrió un error inesperado." y el formulario sigue utilizable.
- **Accesibilidad:** `noValidate` (valida Zod, no el navegador), `autoFocus` en el correo, `aria-invalid` y `aria-describedby` por campo, foco automático en el primer campo con error, `aria-busy` mientras se envía y un botón para mostrar la contraseña con `aria-pressed` y `aria-label` fijo ("Mostrar contraseña"; el texto visible cambia entre "Mostrar" y "Ocultar"). Con `mode: 'onTouched'`, salir de un campo lo valida, de modo que pulsar "Mostrar" sin haber escrito el correo ya marca el correo como obligatorio.
- Comprobado en un **navegador real con el backend y PostgreSQL reales**: envío vacío; contraseña incorrecta (una sola alerta, correo conservado, contraseña vacía con el foco); botón "Ingresando…" deshabilitado mientras la petición está en vuelo; mostrar y ocultar la contraseña; login correcto sin recargar y con solo `cmpc.token` en el almacenamiento (la contraseña no aparece en `localStorage` ni en `sessionStorage`); al sexto intento desde la misma IP, el mensaje de "demasiados intentos" conservando lo escrito; y un usuario con sesión que abre `/login` es llevado a `/books`.

**`AppLayout`**: `<header>` con el nombre de la aplicación, el correo del usuario y el botón "Cerrar sesión", y debajo el `<Outlet />`. "Cerrar sesión" llama a `logout` (borra el token y la caché) y no navega: `ProtectedRoute` ve el estado `anonymous` y redirige a `/login`. En `router.tsx` las rutas quedan anidadas como `ProtectedRoute` → `AppLayout` → página.

## 6. Flujos
- **Login:** formulario válido → `POST /auth/login` → token guardado → caché `me` sembrada → estado `authenticated` → navega a `from` o `/books`.
- **Recarga con sesión:** token en `localStorage` → `status: loading` → `GET /auth/me` → `authenticated` (o `anonymous` si el servidor responde 401).
- **Token expirado:** la siguiente petición recibe 401 → el cliente HTTP limpia el token → `session` avisa → `status: anonymous` → `ProtectedRoute` redirige a `/login`.
- **Cerrar sesión:** `logout()` limpia token y caché → `anonymous` → `/login`.
- **Varias pestañas:** el evento `storage` avisa a las otras pestañas cuando una limpia el token.

## 7. Seguridad: amenazas y mitigaciones

| Amenaza | Mitigación |
|---|---|
| Fuerza bruta sobre el login | Límite por IP (A4.1), `argon2` (costoso por intento) y mensajes iguales |
| Enumeración de usuarios (mensaje o tiempo) | Mismo 401 y verificación contra hash de relleno (A1.2, A1.3) |
| Cuerpos enormes para agotar CPU con `argon2` | Contraseña de máximo 128 caracteres y JSON de máximo 100 KB (`platform`) |
| Falsificación del token (`alg: none`, cambio de algoritmo) | Solo HS256, `ignoreExpiration: false` y pruebas con tokens alterados (A2.2, A8.1) |
| Usuario eliminado con token vigente | La estrategia consulta al usuario en cada petición |
| Robo del token por XSS | El token está en `localStorage`, legible por cualquier script de la página. Se reduce el riesgo con la CSP de nginx (`default-src 'self'`, que al no haber `script-src` propio también limita los scripts a este origen), con React escapando el contenido y con la expiración de 1 h. La alternativa más robusta (cookie `httpOnly` + CSRF) queda como mejora futura |
| CSRF | No aplica: la API usa la cabecera `Authorization`, que el navegador no envía solo |
| Falsear la IP con `X-Forwarded-For` | Un solo salto de confianza y backend publicado solo en `127.0.0.1` (§4) |
| Secreto débil | Producción exige 32 caracteres o más (`platform` R2.3) |
| Contraseñas en logs | El log de accesos no lee cuerpos; el hash nunca sale del servicio de usuarios |
| Redirección abierta tras el login | `from` solo se acepta si es una ruta interna |
| Datos de un usuario visibles para el siguiente en el mismo navegador | `queryClient.clear()` al cerrar sesión (A5.5) |

## 8. Dependencias
Backend: `@nestjs/jwt@^11.0.2`, `@nestjs/passport@^11.0.5`, `passport@^0.7.0`, `passport-jwt@^4.0.1`, `@types/passport-jwt@^4.0.1` (desarrollo) y `@nestjs/throttler@^6.7.1`.
Frontend: `react-hook-form@^7.91`, `zod@^4.6` y `@hookform/resolvers@^6.0.1` (declara soporte para Zod 4).

**Atención:** `@nestjs/jwt` 12 y `@nestjs/passport` 12 son solo ESM y Jest (CommonJS) no puede cargarlos, igual que pasó con `@nestjs/config` y `@nestjs/swagger`. Se usan las líneas 11.x, que son CommonJS y declaran soporte para Nest 11. Se comprobó con `require()` en un proyecto limpio antes de escribir esta spec.

## 9. Estrategia de pruebas
- **Unitarias (backend):** `UsersService` (consultas con Prisma simulado), `AuthService` (éxito, contraseña errónea, correo inexistente con verificación contra el hash de relleno, token sin datos sobrantes, `expiresAt`), `JwtStrategy` (usuario existente y ausente, `sub` inválido), `JwtAuthGuard` (ruta pública y protegida), `AuthController`.
- **HTTP con Passport real (backend):** módulo de prueba con `AuthModule`, `PrismaService` simulado y `configureApp`: login → `me`; sin cabecera; esquema distinto de Bearer; token expirado (firmado con `expiresIn` negativo); firma alterada; token con `alg: none`; usuario eliminado; el 429 al sexto intento (con `Retry-After`) sin afectar a otras rutas; y que ninguna respuesta ni log contenga la contraseña o el hash.
- **Unitarias (frontend):** `session` (suscripción, evento `storage`), `auth.service`, `login-schema`, `AuthProvider` (los cinco estados, `login`, `logout`, `retry`), `ProtectedRoute`, `LoginPage` (validación, éxito, 401, 429, red, 400 por campo, envío en curso, redirección, `from` peligroso, mostrar contraseña) y `AppLayout` (cierre de sesión).
- **Punta a punta (manual, contra Docker, en un navegador real):** A8.4.

## 10. Mejoras futuras (documentadas, no implementadas)
- Token de refresco con rotación y lista de revocación, para sesiones largas y cierre de sesión real en el servidor.
- Cookie `httpOnly` + `SameSite` + protección CSRF en lugar de `localStorage`.
- Bloqueo progresivo por cuenta y almacenamiento del límite en Redis para varias instancias.
- Roles y permisos, registro de usuarios y cambio o recuperación de contraseña.
- Autenticación de dos factores.
- Proteger o desactivar Swagger en producción. Hoy `/api/docs` y `/api/docs-json` son públicos: Nest los sirve fuera de los guards y los evaluadores deben poder verlos sin iniciar sesión. Solo describen la forma de la API (no contienen datos ni secretos), pero exponen su superficie.
