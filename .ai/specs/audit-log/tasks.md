# Spec audit-log: Tareas

Reglas: seguir el orden; una tarea está hecha solo cuando su criterio se cumple y sus pruebas pasan. Un commit por tarea (formato convencional, en inglés).
Antes de cada tarea se leen `requirements.md` y `design.md`; cada cambio de decisión se refleja en `design.md`.
Marcar con `[x]` al terminar.

- [x] **G-01 Modelo y migración** (G1.1 a G1.3)
  - `AuditAction` y `AuditLog` en `schema.prisma`, relación inversa en `User`, migración generada y aplicada.
  - Hecho cuando: `prisma migrate deploy` sobre una base con datos funciona, `prisma validate` y `tsc` pasan, y las claves foráneas e índices son los del diseño (comprobado en la base).
  - Commit: `feat(audit): add the audit log model and migration`

- [ ] **G-02 Servicio de auditoría** (G1.4, G3.5, G4.1)
  - `AuditModule`, `AuditService` (`log`, `logBestEffort`), tipos, decorador `@Actor()` y la prueba de arquitectura.
  - Pruebas: escribe con el cliente dado, propaga el error, el mejor esfuerzo captura y registra sin contenido, `@Actor()` con y sin usuario, solo `audit.service.ts` escribe en `auditLog`.
  - Commit: `feat(audit): add the audit service and the actor decorator`

- [ ] **G-03 Auditoría de libros en la transacción** (G2.1 a G2.7, G4.1)
  - `BooksService` recibe el actor, lee `before` dentro de la transacción y llama a `audit.log(tx, ...)` en `create`, `update`, `remove`, `setImage` y `removeImage`; el controlador pasa `@Actor()`.
  - Pruebas: acción, entidad, `before`/`after` y actor de cada operación; el registro va después de la escritura y en la misma transacción; si el registro falla la operación se deshace; sin registro si la operación falla o no cambia nada.
  - Commit: `feat(books): record create, update and delete in the audit log`

- [ ] **G-04 Auditoría de inicios de sesión** (G3.1 a G3.4, G3.6)
  - `AuthService.login` registra `LOGIN_SUCCESS` y `LOGIN_FAILED` con mejor esfuerzo; el controlador pasa la IP.
  - Pruebas: éxito, contraseña incorrecta, correo desconocido (misma escritura, sin `userId`), sin correo ni contraseña en lo escrito, el fallo de la auditoría no cambia la respuesta.
  - Commit: `feat(auth): record successful and failed logins in the audit log`

- [ ] **G-05 Pruebas HTTP** (G4.2)
  - `audit.http.spec`: Passport real y un PrismaService simulado que captura lo escrito; cada operación y cada login; IP por `X-Forwarded-For`; las rutas rechazadas (400, 401, 404, 409) no escriben.
  - Commit: `test(audit): cover the audit trail over HTTP`

## Integración y cierre
- [ ] **G-06 Verificación contra PostgreSQL real** (G4.4)
  - Backend compilado y base real: una fila por operación con el contenido esperado; atomicidad forzando un fallo del registro; concurrencia; `SET NULL`; migración sobre una base con datos; Docker.
  - Hecho cuando: cada comprobación queda en el registro de verificación.
  - Commit: `docs(audit-log): record the real database verification`

- [ ] **G-07 Verificación de la spec**
  - Recorrer G1 a G4 con evidencia nueva (lint, tipos, build, cobertura ≥ 80 % y fallando por debajo; `npm audit`) y registrar el resultado.
  - Commit: `docs(audit-log): record the spec verification`

## Registro de verificación
(Se completa al terminar G-06 y G-07.)
