# Spec audit-log: Diseño

Implementa los requisitos de `requirements.md`. Los códigos G# remiten a ese archivo.

## 1. Decisiones (a revisar: esta spec se implementó sin la pausa de aprobación)

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| `AuditService.log(client, entry)` recibe el cliente de la transacción y escribe con él | Un interceptor o middleware de Prisma que audite solo | La auditoría de negocio necesita `before`/`after` y debe estar en la misma transacción (G2.4); un interceptor HTTP corre después de confirmar y puede perder el registro |
| `BooksService` llama a `AuditService` **explícitamente** en cada escritura | Extensión de Prisma que audite todo `Book` | Lo explícito se lee y se prueba; la extensión no sabría quién es el usuario ni distinguiría «quitar portada sin portada» (G2.5) |
| El **actor** (`userId`, `ip`) se pasa como parámetro de los métodos de escritura, construido por un decorador `@Actor()` del controlador | `AsyncLocalStorage` o `nestjs-cls` | Sin dependencia nueva (`CLAUDE.md`), sin estado oculto: la firma dice que la operación necesita saber quién la hace, y las pruebas lo pasan a mano |
| `before` se lee **dentro de la transacción** antes de escribir | Leerlo antes de abrirla | Evita que otra petición cambie el libro entre la lectura y la escritura: el `before` es exactamente lo que se sobrescribió |
| Las instantáneas son el `BookDto` (id, título, autor, editorial, género, precio, disponibilidad, portada) con el precio como número | Guardar la fila cruda de Prisma o solo los campos cambiados | El DTO ya es el contrato público y excluye datos internos (G2.7); guardar el objeto completo hace cada registro legible por sí solo, sin reconstruir el historial |
| Un `UPDATE` sin cambios reales (quitar la portada de un libro sin portada) no escribe nada | Registrar siempre | Es lo que ya decide `removeImage` (devuelve sin tocar la base) y evita ruido en la auditoría |
| El login **no** guarda el correo de un intento fallido | Guardarlo para investigar ataques | Es un dato personal que además puede ser una contraseña tecleada en el campo equivocado (`conventions.md`); la IP y el momento bastan para detectar fuerza bruta. Si el correo existe se guarda el `userId` |
| La auditoría del login es de **mejor esfuerzo**: si falla se registra en el log y se sigue | Que el login falle si no se puede auditar | Un fallo de la tabla de auditoría no debe dejar fuera a los usuarios ni cambiar un 401 en 500 (G3.5). En los libros es al revés: allí el registro es parte de la operación y se hace todo o nada |
| Login fallido con correo desconocido también escribe una fila | Escribir solo si el correo existe | El tiempo de respuesta no debe revelar qué correos existen (G3.4); ambos caminos hacen una escritura |
| `userId` con `ON DELETE SET NULL`; `entityId` sin clave foránea | `RESTRICT` o `CASCADE` | El historial debe sobrevivir al usuario y al libro (G1.2); la app no borra usuarios, pero la base no debe impedirlo ni arrastrar la auditoría |
| IP en texto (`String?`), tomada de `req.ip` | Tipo `inet` de PostgreSQL | Con `trust proxy` = 1 `req.ip` ya es la del cliente y puede venir en forma `::ffff:1.2.3.4`; texto evita rechazar un valor válido para Express y Prisma no soporta `inet` de forma nativa |
| No hay endpoint de consulta | `GET /api/audit` paginado | Fuera del alcance del enunciado (se pide el *logging*); añadir una ruta de lectura sin roles expondría IPs y datos a cualquier usuario autenticado |

## 2. Modelo de datos

```prisma
enum AuditAction { CREATE UPDATE DELETE LOGIN_SUCCESS LOGIN_FAILED }

model AuditLog {
  id        String      @id @default(uuid()) @db.Uuid
  action    AuditAction
  entity    String
  entityId  String?     @map("entity_id") @db.Uuid
  before    Json?
  after     Json?
  userId    String?     @map("user_id") @db.Uuid
  ip        String?
  createdAt DateTime    @default(now()) @map("created_at")
  user      User?       @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([entity, entityId])
  @@index([userId])
  @@index([createdAt])
  @@map("audit_logs")
}
```

`User` gana la relación inversa `auditLogs`. La migración es generada por Prisma (no hace falta SQL manual).

## 3. Backend

```
backend/src/audit/
├── audit.module.ts          # exporta AuditService
├── audit.service.ts         # log(client, entry) ; logBestEffort(entry)
├── audit.types.ts           # AuditEntry, AuditActor
└── audit.architecture.spec.ts   # solo audit.service.ts escribe en auditLog
backend/src/common/decorators/actor.decorator.ts   # @Actor(): { userId, ip } desde la petición
```

- **`AuditEntry`**: `{ action, entity, entityId?, before?, after?, actor }`; **`AuditActor`**: `{ userId: string | null; ip: string | null }`.
- **`AuditService.log(client, entry)`**: `client.auditLog.create(...)`. `client` es `Pick<Prisma.TransactionClient, 'auditLog'>`: sirve la transacción de los libros y el propio `PrismaService`. Propaga el error (G2.4).
- **`AuditService.logBestEffort(entry)`**: llama a `log(this.prisma, entry)` y captura el error, registrándolo con `Logger` sin el contenido (G3.5). Lo usa `AuthService`.
- **`BooksService`**: `create`, `update`, `remove`, `setImage` y `removeImage` reciben `actor: AuditActor`. En cada transacción: resolver catálogos → leer `before` (update/remove/imagen) → escribir → `audit.log(tx, ...)`. Si el libro no existe, el `findUnique` de la transacción lanza `NotFoundException` y se deshace todo.
- **`AuthService.login`**: tras verificar la contraseña, llama a `logBestEffort` con `LOGIN_SUCCESS` o `LOGIN_FAILED` antes de devolver o lanzar. Recibe el `actor` del controlador (solo `ip`; `userId` lo pone el servicio).
- **`@Actor()`**: lee `request.user?.id` y `request.ip` (`null` si faltan).
- **Throttler (G3.6):** el `ThrottlerGuard` responde 429 antes del servicio, así que esos intentos no quedan en `audit_logs`; el middleware HTTP ya los deja en el log de la aplicación (`WARN ... 429`).

## 4. Seguridad y privacidad

| Riesgo | Mitigación |
|---|---|
| Datos sensibles en la auditoría | Las instantáneas son `BookDto`; el login no guarda correo, contraseña ni token (probado con una prueba que inspecciona lo escrito) |
| Fuga por la API | No hay endpoint de lectura; la tabla no aparece en Swagger |
| Registro falsificable por el cliente | `userId` sale del token verificado y `ip` de `req.ip` con `trust proxy` = 1; ningún DTO los admite |
| Pérdida silenciosa de auditoría de negocio | Misma transacción: sin registro no hay operación |
| Enumeración de usuarios por tiempos | Ambos caminos del login fallido escriben una fila |
| Manipulación posterior de los registros | Fuera del alcance: mejora futura (rol de base de datos sin `UPDATE`/`DELETE` sobre `audit_logs`) |

## 5. Pruebas

- **Unitarias:** `AuditService` (escribe con el cliente dado, propaga el error, el mejor esfuerzo captura y registra sin contenido), `@Actor()`, y `BooksService`/`AuthService` con un `AuditService` simulado (acción, entidad, `before`/`after`, actor, orden dentro de la transacción, ningún registro cuando falla la operación o no hay cambio, y la operación se deshace si el registro falla).
- **Arquitectura:** ningún archivo de `src` salvo `audit.service.ts` usa `auditLog` del cliente.
- **HTTP con Passport real** (`audit.http.spec`): cada operación deja una fila con el usuario y la IP (cabecera `X-Forwarded-For` con `trust proxy` = 1); un login fallido deja `LOGIN_FAILED` sin correo.
- **Contra PostgreSQL real:** una fila por operación y con el contenido esperado; atomicidad (registro que falla → ni libro ni catálogo); concurrencia; `SET NULL` al borrar un usuario; la migración sobre una base con datos.

## 6. Mejoras futuras
- `GET /api/audit` paginado y con filtros, solo para un rol administrador (requiere RBAC, fuera del alcance).
- Permisos de base de datos: el rol de la aplicación solo `INSERT`/`SELECT` sobre `audit_logs`, o un *trigger* que rechace `UPDATE`/`DELETE`.
- Retención y archivado (partición por mes, borrado de IP pasado un plazo).
- Auditar exportaciones de CSV y cambios de catálogo.
- Correlación con el `X-Request-Id` de cada petición.
