# Spec audit-log: Requisitos

Cubre los IDs del enunciado: **BE-6** (logging para auditoría de operaciones) y la parte de auditoría de **DB-2** (transacciones en operaciones críticas). Relacionados: GEN-2, T-2, T-3.
Depende de `books-crud` (las transacciones de escritura y los comentarios `audit-log adds here`), de `book-image-upload` (cambiar o quitar la portada es una edición) y de `auth` (`AuthService.login`).

Formato: CUANDO <evento>, EL SISTEMA DEBERÁ <respuesta>. Cada criterio es verificable.

> **Nota sobre el proceso.** Esta spec se redactó y se implementó sin la pausa de aprobación que pide `CLAUDE.md`, por indicación expresa del usuario (trabajo autónomo durante la noche). Las decisiones que habrían ido a aprobación están en `design.md` §1 para su revisión.

## Fuera de alcance
- Endpoint o pantalla para consultar la auditoría (se consulta en la base de datos). Queda como mejora futura.
- Auditar lecturas (listado, detalle, exportación) y los cambios de catálogos (se crean como parte de crear o editar un libro).
- Retención, archivado o anonimización de registros antiguos.
- Impedir la modificación de `audit_logs` desde la propia base (permisos del rol, *triggers*): se documenta en `design.md` §6.

## G1. Modelo de datos (DB-1, BE-6)
- G1.1 EL SISTEMA DEBERÁ tener una tabla `audit_logs` con: `id` (UUID), `action` (enumeración `CREATE`, `UPDATE`, `DELETE`, `LOGIN_SUCCESS`, `LOGIN_FAILED`), `entity` (texto, p. ej. `Book` o `User`), `entityId` (UUID, opcional), `before` y `after` (JSON, opcionales), `userId` (opcional), `ip` (texto, opcional) y `createdAt`.
- G1.2 `userId` DEBERÁ referenciar a `users` y quedar en `NULL` si el usuario se elimina (el historial sobrevive al usuario). `entityId` NO DEBERÁ ser clave foránea: el registro de un libro eliminado debe conservarse.
- G1.3 EL SISTEMA DEBERÁ tener índices por `(entity, entityId)`, por `userId` y por `createdAt`.
- G1.4 `AuditService` DEBERÁ ser el único código que escribe en `audit_logs` (una prueba de arquitectura lo comprueba).

## G2. Operaciones sobre libros (BE-6, DB-2)
- G2.1 CUANDO se cree un libro, EL SISTEMA DEBERÁ registrar `CREATE` con `entity = Book`, el id del libro, `before = null` y `after` = el libro creado.
- G2.2 CUANDO se edite un libro (incluido cambiar o quitar su portada), EL SISTEMA DEBERÁ registrar `UPDATE` con `before` = el libro antes del cambio y `after` = el libro después.
- G2.3 CUANDO se elimine un libro, EL SISTEMA DEBERÁ registrar `DELETE` con `before` = el libro y `after = null`.
- G2.4 El registro DEBERÁ escribirse **dentro de la misma transacción** que la operación: si falla el registro no se guarda el libro (ni los catálogos que creó) y si falla la operación no queda registro (DB-2).
- G2.5 EL SISTEMA NO DEBERÁ registrar nada cuando la operación falle (400, 404, 409) ni cuando quitar la portada de un libro que no la tiene no cambie nada.
- G2.6 Cada registro DEBERÁ llevar el `userId` del usuario autenticado y la IP del cliente (la que ve la aplicación detrás de nginx, `trust proxy` = 1).
- G2.7 Las instantáneas `before`/`after` DEBERÁN contener los datos de negocio del libro (id, título, autor, editorial, género, precio, disponibilidad y URL de portada) y nunca datos internos ni de otros modelos.

## G3. Inicios de sesión (BE-6)
- G3.1 CUANDO un inicio de sesión sea correcto, EL SISTEMA DEBERÁ registrar `LOGIN_SUCCESS` con `entity = User`, `entityId` y `userId` = el usuario, y la IP.
- G3.2 CUANDO falle (correo desconocido o contraseña incorrecta), EL SISTEMA DEBERÁ registrar `LOGIN_FAILED` con la IP; `userId` y `entityId` DEBERÁN ser los del usuario si el correo existe y `NULL` si no.
- G3.3 EL SISTEMA NO DEBERÁ guardar contraseñas, hashes, tokens ni el correo escrito en un intento fallido (conventions: nunca registrar datos personales completos).
- G3.4 La respuesta de un login fallido DEBERÁ seguir siendo idéntica para correo desconocido y contraseña incorrecta, y el trabajo realizado DEBERÁ ser el mismo (también una escritura en ambos casos) para no revelar qué correos existen.
- G3.5 CUANDO no se pueda escribir el registro de un inicio de sesión, EL SISTEMA DEBERÁ dejar el error en el log de la aplicación y **continuar** con la respuesta normal (un fallo de auditoría no debe impedir entrar ni cambiar el error 401). Es distinto de G2.4: allí la auditoría es parte de la operación.
- G3.6 Las peticiones rechazadas por el limitador de intentos (429) no llegan al servicio y no se registran; queda anotado en `design.md`.

## G4. Pruebas y verificación (T-2, T-3)
- G4.1 Pruebas unitarias de `AuditService`, de cada operación de `BooksService` (registro correcto, orden dentro de la transacción, atomicidad con registro que falla) y de `AuthService`; pruebas de los controladores que pasan el actor.
- G4.2 Pruebas HTTP con Passport real: cada operación deja exactamente un registro con el usuario y la IP esperados.
- G4.3 Cobertura ≥ 80 % (objetivo del proyecto: 100 %).
- G4.4 Verificación contra PostgreSQL real: cada operación deja un único registro correcto; con un registro que falla no queda libro ni catálogo nuevo; con operaciones concurrentes no se pierden registros; el `userId` pasa a `NULL` al eliminar un usuario; la migración se aplica sobre una base con datos.
