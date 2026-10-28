# Spec auth: Requisitos

Cubre los IDs del enunciado: **FE-1, BE-2**. Relacionados: GEN-2 (seguridad de producción), ADD-1 (errores) y T-1, T-2, T-3 (pruebas).
Depende de la spec `platform` (filtro de errores, `@Public()`, `AuthenticatedUser`, `session`, cliente HTTP, rutas).

Formato: CUANDO <evento>, EL SISTEMA DEBERÁ <respuesta>. Cada criterio es verificable.

## Fuera de alcance
- Registro de usuarios, roles y permisos, recuperación de contraseña y cambio de contraseña (el usuario inicial lo crea el seed).
- Tokens de refresco y revocación de tokens (ver "Mejoras futuras" en `design.md`).
- Registrar los inicios de sesión en `AuditLog`: lo añade la spec `audit-log` sobre `AuthService`.

## A1. Inicio de sesión (BE-2)
- A1.1 CUANDO se envíe `POST /api/auth/login` con un correo y una contraseña válidos, EL SISTEMA DEBERÁ responder 200 con `{ data: { accessToken, tokenType: "Bearer", expiresAt, user: { id, email } } }`, donde `expiresAt` es la fecha de expiración del token en ISO 8601.
- A1.2 CUANDO el correo no exista o la contraseña sea incorrecta, EL SISTEMA DEBERÁ responder 401 con el mismo mensaje en ambos casos, de modo que no se pueda saber si un correo está registrado.
- A1.3 CUANDO el correo no exista, EL SISTEMA DEBERÁ hacer igualmente una verificación `argon2` contra un hash de relleno, para que el tiempo de respuesta no delate si el correo existe.
- A1.4 EL SISTEMA DEBERÁ normalizar el correo (quitar espacios y pasar a minúsculas) antes de buscarlo.
- A1.5 CUANDO el cuerpo no sea válido, EL SISTEMA DEBERÁ responder 400 con errores por campo: el correo con formato válido; la contraseña no vacía y de 128 caracteres como máximo (así se evita hacer `argon2` sobre cuerpos enormes).
- A1.6 La contraseña y su hash NUNCA DEBERÁN aparecer en una respuesta ni en un log.

## A2. Token JWT (BE-2)
- A2.1 EL SISTEMA DEBERÁ firmar el token con HS256 y `JWT_SECRET`, con los datos `sub` (id del usuario), `iat` y `exp` (según `JWT_EXPIRES_IN`), sin correo ni otros datos personales.
- A2.2 EL SISTEMA DEBERÁ aceptar únicamente HS256 al verificar: un token con algoritmo `none` o con otro algoritmo DEBERÁ rechazarse.
- A2.3 CUANDO el token esté expirado, tenga la firma alterada, esté mal formado o pertenezca a un usuario que ya no existe, EL SISTEMA DEBERÁ responder 401 con el formato de error único y sin detalles de la causa.

## A3. Protección de rutas (BE-2)
- A3.1 EL SISTEMA DEBERÁ exigir un token válido en toda ruta, salvo las marcadas con `@Public()`. Son públicas `POST /api/auth/login` y `GET /api/health`.
- A3.2 CUANDO falte la cabecera `Authorization` o no use el esquema `Bearer`, EL SISTEMA DEBERÁ responder 401.
- A3.3 CUANDO el token sea válido, EL SISTEMA DEBERÁ adjuntar `request.user = { id, email }` (tipo `AuthenticatedUser`), de modo que el log de accesos muestre `user=<id>` y la auditoría pueda usarlo.
- A3.4 CUANDO se pida `GET /api/auth/me` con un token válido, EL SISTEMA DEBERÁ responder 200 con `{ data: { id, email } }`.
- A3.5 Una ruta nueva NO DEBERÁ ser pública por omisión: olvidar `@Public()` la deja protegida.

## A4. Límite de intentos (GEN-2)
- A4.1 EL SISTEMA DEBERÁ permitir como máximo `THROTTLE_LIMIT` intentos de login cada `THROTTLE_TTL` segundos por dirección IP; el intento siguiente DEBERÁ responder 429 con el formato de error único y la cabecera `Retry-After`.
- A4.2 Las rutas distintas del login NO DEBERÁN contar para ese límite.
- A4.3 EL SISTEMA DEBERÁ confiar en un único salto de proxy (`trust proxy` = 1) para usar la IP real del cliente detrás de nginx y no la del contenedor de nginx.

## A5. Sesión en el frontend (FE-1)
- A5.1 CUANDO el usuario envíe el formulario con credenciales válidas, EL SISTEMA DEBERÁ guardar el token, cargar los datos del usuario y llevarlo a la ruta que intentaba abrir (`from`) o a `/books`; `from` solo DEBERÁ aceptarse si es una ruta interna (empieza con `/` y no con `//`).
- A5.2 CUANDO se abra la aplicación con un token guardado, EL SISTEMA DEBERÁ validarlo con `GET /api/auth/me` y mostrar un estado de carga, sin parpadeo del login, antes de decidir si muestra la ruta protegida.
- A5.3 CUANDO esa validación falle por red o por un error 5xx, EL SISTEMA DEBERÁ mostrar un mensaje con un botón "Reintentar" y NO DEBERÁ cerrar la sesión.
- A5.4 CUANDO el servidor responda 401 con una sesión activa, EL SISTEMA DEBERÁ cerrar la sesión y actualizar el estado de autenticación sin recargar la página (se mantiene el criterio R4.7 de `platform`).
- A5.5 CUANDO el usuario cierre sesión, EL SISTEMA DEBERÁ borrar el token, vaciar la caché de consultas (para que otro usuario no vea datos ajenos) y llevar a `/login`.
- A5.6 CUANDO se cierre sesión o expire en una pestaña, EL SISTEMA DEBERÁ cerrarla también en las demás pestañas abiertas.
- A5.7 CUANDO un usuario autenticado abra `/login`, EL SISTEMA DEBERÁ redirigirlo a `/books`.

## A6. Formulario de login (FE-1)
- A6.1 EL SISTEMA DEBERÁ validar de forma reactiva con React Hook Form y Zod, con mensajes en español: correo obligatorio y con formato válido; contraseña obligatoria.
- A6.2 CUANDO el servidor responda 401, EL SISTEMA DEBERÁ mostrar "Correo o contraseña incorrectos." bajo el formulario (`role="alert"`) sin borrar el correo escrito; con 429, el aviso de demasiados intentos; con un error de red, el aviso de conexión; con un 400 con errores por campo, cada mensaje asociado a su campo.
- A6.3 Esos errores NO DEBERÁN repetirse en el aviso global (se marca la operación como `silent`).
- A6.4 MIENTRAS se envía el formulario, EL SISTEMA DEBERÁ deshabilitar el botón, mostrar "Ingresando…" y no permitir un segundo envío.
- A6.5 EL SISTEMA DEBERÁ cumplir lo básico de accesibilidad: etiquetas asociadas a cada campo, `autocomplete` correcto (`username` y `current-password`), foco en el primer campo con error y un botón para mostrar u ocultar la contraseña con su estado anunciado.
- A6.6 La contraseña NO DEBERÁ guardarse en `localStorage` ni en el estado global; solo existe en el formulario hasta el envío.
- A6.7 EL SISTEMA DEBERÁ ofrecer en la parte superior de las pantallas protegidas el correo del usuario y un botón "Cerrar sesión".

## A7. Seguridad transversal (GEN-2)
- A7.1 EL SISTEMA DEBERÁ guardar el token en `localStorage` con el compromiso documentado en `design.md` §7 (legible por scripts de la página), mitigado por la CSP de nginx (`script-src 'self'`) y por la expiración corta del token.
- A7.2 La documentación Swagger DEBERÁ describir el login (con ejemplo de cuerpo y respuestas 200, 400, 401 y 429) y marcar como protegidas las rutas que exigen token.

## A8. Pruebas (T-1, T-2, T-3)
- A8.1 El backend DEBERÁ tener pruebas unitarias de `UsersService`, `AuthService`, `JwtStrategy`, `JwtAuthGuard` y `AuthController`, y pruebas HTTP del flujo completo con Passport real: login, acceso con token, token ausente, expirado, alterado, con algoritmo `none` y de un usuario inexistente, y el 429 al superar el límite.
- A8.2 El frontend DEBERÁ tener pruebas de `session`, del servicio de auth, de `AuthProvider`/`useAuth`, de `ProtectedRoute`, de `LoginPage` y de `AppLayout`.
- A8.3 La cobertura DEBERÁ seguir en 80% o más en ambas aplicaciones (umbral de `platform` R8).
- A8.4 EL SISTEMA DEBERÁ verificarse de punta a punta contra el stack de Docker con el administrador sembrado: login real, contraseña incorrecta, límite de intentos, token expirado y cierre de sesión (en un navegador real).
