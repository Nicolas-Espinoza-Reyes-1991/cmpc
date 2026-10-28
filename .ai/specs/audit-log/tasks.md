# Spec audit-log: Tareas

Reglas: seguir el orden; una tarea está hecha solo cuando su criterio se cumple y sus pruebas pasan. Un commit por tarea (formato convencional, en inglés).
Antes de cada tarea se leen `requirements.md` y `design.md`; cada cambio de decisión se refleja en `design.md`.
Marcar con `[x]` al terminar.

- [x] **G-01 Modelo y migración** (G1.1 a G1.3)
  - `AuditAction` y `AuditLog` en `schema.prisma`, relación inversa en `User`, migración generada y aplicada.
  - Hecho cuando: `prisma migrate deploy` sobre una base con datos funciona, `prisma validate` y `tsc` pasan, y las claves foráneas e índices son los del diseño (comprobado en la base).
  - Commit: `feat(audit): add the audit log model and migration`

- [x] **G-02 Servicio de auditoría** (G1.4, G3.5, G4.1)
  - `AuditModule`, `AuditService` (`log`, `logBestEffort`), tipos, decorador `@Actor()` y la prueba de arquitectura.
  - Pruebas: escribe con el cliente dado, propaga el error, el mejor esfuerzo captura y registra sin contenido, `@Actor()` con y sin usuario, solo `audit.service.ts` escribe en `auditLog`.
  - Commit: `feat(audit): add the audit service and the actor decorator`

- [x] **G-03 Auditoría de libros en la transacción** (G2.1 a G2.7, G4.1)
  - `BooksService` recibe el actor, lee `before` dentro de la transacción y llama a `audit.log(tx, ...)` en `create`, `update`, `remove`, `setImage` y `removeImage`; el controlador pasa `@Actor()`.
  - Pruebas: acción, entidad, `before`/`after` y actor de cada operación; el registro va después de la escritura y en la misma transacción; si el registro falla la operación se deshace; sin registro si la operación falla o no cambia nada.
  - Commit: `feat(books): record create, update and delete in the audit log`

- [x] **G-04 Auditoría de inicios de sesión** (G3.1 a G3.4, G3.6)
  - `AuthService.login` registra `LOGIN_SUCCESS` y `LOGIN_FAILED` con mejor esfuerzo; el controlador pasa la IP.
  - Pruebas: éxito, contraseña incorrecta, correo desconocido (misma escritura, sin `userId`), sin correo ni contraseña en lo escrito, el fallo de la auditoría no cambia la respuesta.
  - Commit: `feat(auth): record successful and failed logins in the audit log`

- [x] **G-05 Pruebas HTTP** (G4.2)
  - `audit.http.spec`: Passport real y un PrismaService simulado que captura lo escrito; cada operación y cada login; IP por `X-Forwarded-For`; las rutas rechazadas (400, 401, 404, 409) no escriben.
  - Commit: `test(audit): cover the audit trail over HTTP`

## Integración y cierre
- [x] **G-06 Verificación contra PostgreSQL real** (G4.4)
  - Backend compilado y base real: una fila por operación con el contenido esperado; atomicidad forzando un fallo del registro; concurrencia; `SET NULL`; migración sobre una base con datos; Docker.
  - Hecho cuando: cada comprobación queda en el registro de verificación.
  - Commit: `docs(audit-log): record the real database verification`

- [ ] **G-07 Verificación de la spec**
  - Recorrer G1 a G4 con evidencia nueva (lint, tipos, build, cobertura ≥ 80 % y fallando por debajo; `npm audit`) y registrar el resultado.
  - Commit: `docs(audit-log): record the spec verification`

## Registro de verificación

### G-06: verificación contra PostgreSQL real y Docker (2026-10-28)
Entorno: PostgreSQL 16 del contenedor de desarrollo; base **nueva** `g06_check` migrada con `migrate deploy` (eliminada al terminar); backend compilado (`node dist/main`) con el administrador sembrado; peticiones HTTP reales con `X-Forwarded-For: 198.51.100.7`; el contenido se leyó de la propia tabla. Para forzar fallos de la auditoría se creó un *trigger* temporal en `audit_logs` que rechaza las acciones puestas en una tabla auxiliar.

| Comprobación | Resultado |
|---|---|
| Una fila por operación | login con correo desconocido, login con contraseña incorrecta, login correcto, `POST`, `PATCH`, poner portada, quitar portada y `DELETE` dejan **8 filas**, una por operación, en ese orden |
| Contenido | `LOGIN_FAILED` sin usuario si el correo no existe y con el usuario si existe; `LOGIN_SUCCESS` con usuario; `CREATE` con `before` NULL y `after` completo; cada `UPDATE` con su `before` y `after` (título y precio; portada nula → URL → nula); `DELETE` con `before` y `after` NULL; en todas `userId` = el administrador y `ip` = `198.51.100.7` |
| `before`/`after` ausentes | Son **NULL de SQL** (`before IS NULL AND after IS NOT NULL` en el `CREATE`), no el JSON `null` |
| Nada secreto | Buscadas en toda la tabla: la contraseña tecleada, la contraseña errónea, el correo tecleado, el token y el hash `argon2` **no aparecen** |
| Lecturas y rechazos | 400, 404, 409, 401, `GET` y quitar la portada de un libro sin portada **no dejan ninguna fila** |
| Atomicidad: `CREATE` con la auditoría rechazada | 500 genérico (sin «audit refused» ni detalles), **0 libros, 0 autores, 0 editoriales y 0 géneros nuevos**, 0 filas |
| Atomicidad: `PATCH` (cambiando título y autor nuevo) | 500, título sin cambiar, el autor «fantasma» **no se creó**, 0 filas |
| Atomicidad: `DELETE` | 500, el libro sigue sin eliminar (`deleted_at` NULL) y la API lo sigue mostrando (200) |
| Atomicidad: poner portada | 500, `image_url` sigue NULL |
| Login con la auditoría rechazada (G3.5) | Correcto → **200**; incorrecto → **401** con `Invalid credentials` (la respuesta no cambia) |
| Concurrencia: 20 altas simultáneas | 20 × 201 y **20** filas `CREATE` |
| Concurrencia: 20 `PATCH` simultáneos al mismo libro | 20 × 200 y 20 filas `UPDATE`; el precio guardado coincide con el `after` de la última. **Hallazgo, ver abajo** |
| Usuario eliminado | La fila de auditoría se conserva con `user_id` en NULL (`ON DELETE SET NULL`) |
| Índices | La consulta por `(entity, entity_id)` usa `audit_logs_entity_entity_id_idx` |
| Docker (`docker compose up --build`) | Las 4 migraciones se aplican al arrancar el contenedor; un login correcto y uno fallido dejan `LOGIN_SUCCESS` y `LOGIN_FAILED` con usuario e IP; la IP guardada es la que nginx ve (`172.24.0.1`, la pasarela de Docker Desktop) y **no** la que el cliente puso en `X-Forwarded-For` (`203.0.113.50`): `$proxy_add_x_forwarded_for` añade la dirección real al final y `trust proxy = 1` toma esa, así que el cliente no puede falsificar su IP |

**Hallazgo de la verificación real (corregido con prueba).** Con 20 `PATCH` simultáneos al mismo libro la auditoría tenía solo **12 valores `before` distintos** y la cadena no era consistente: dos transacciones leían el mismo estado previo (PostgreSQL en `READ COMMITTED` no lo impide) y su `before` no era el `after` de la entrada anterior. Las pruebas unitarias no podían verlo. Se bloquea la fila con `SELECT … FOR UPDATE` antes de leer el estado previo (`fix(books): lock the book before reading its audit snapshot`), con pruebas del orden (bloqueo → lectura → escritura → auditoría). Repetido contra una base nueva: **20 filas, 20 `before` distintos y 0 eslabones rotos** (cada `before` es el `after` de la entrada anterior).

Observaciones:
- La IP de las pruebas locales con Docker Desktop es la de la pasarela, no la de un navegador remoto; en un servidor real nginx verá la IP del cliente.
- Mi primer intento de la prueba de atomicidad configuraba el *trigger* con un parámetro de base de datos que las conexiones del backend no recargan; se cambió por una tabla auxiliar. Era un defecto de la prueba, no del código.
