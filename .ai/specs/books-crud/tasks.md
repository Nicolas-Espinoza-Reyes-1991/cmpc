# Spec books-crud: Tareas

Reglas: seguir el orden; una tarea está hecha solo cuando su criterio se cumple y sus pruebas pasan. Los commits sugeridos usan formato convencional en inglés y se hacen cuando el usuario lo autorice.
Antes de cada tarea se leen `requirements.md` y `design.md`; cada cambio de decisión se refleja en `design.md`.
Marcar con `[x]` al terminar.

## Preparación
- [x] **C-00 Alinear la arquitectura** (§1)
  - Actualizar `architecture.md`: la resolución de catálogos usa búsqueda sin distinguir mayúsculas + `upsert` (no `connectOrCreate` literal), y `AuditLog` se añade en `audit-log`.
  - Hecho cuando: `architecture.md` y `design.md` no se contradicen.
  - Commit: `docs(books-crud): align the architecture notes with the spec`

## Base de datos y backend
- [x] **C-01 Modelos y migraciones** (C1.1 a C1.5)
  - `Author`, `Publisher`, `Genre` y `Book` en `schema.prisma`; migración generada y migración manual con `pg_trgm`, el índice GIN y el índice único parcial (§2).
  - Hecho cuando: `prisma migrate deploy` sobre una base vacía aplica todo; `\d books` en PostgreSQL real muestra los índices; `prisma generate` y `npm run build` pasan.
  - Commit: `feat(db): add catalog and book models with indexes`

- [ ] **C-02 Borrado lógico en Prisma** (C5.2, C5.3, C10.1)
  - `soft-delete.extension.ts`, `PrismaService.live` y la prueba de arquitectura sobre el uso de `prisma.book`.
  - Pruebas: cada operación fusiona `deletedAt: null`; respeta un `deletedAt` explícito; no toca otros modelos; la prueba de arquitectura falla si un servicio usa `prisma.book` fuera de `live`.
  - Commit: `feat(prisma): add soft delete extension`

- [ ] **C-03 Catálogos** (C2.4, C6.1 a C6.3, C7.1)
  - `CatalogModule`, `CatalogService` (`list`, `resolve`), `CatalogController` (`/authors`, `/publishers`, `/genres`) y DTOs.
  - Pruebas: listado con y sin `search`, `limit` fuera de rango → 400, orden por nombre; `resolve` devuelve el existente sin distinguir mayúsculas y hace `upsert` si no existe; el controlador no usa Prisma; no hay rutas de escritura.
  - Commit: `feat(catalog): add read-only catalog endpoints and resolver`

- [ ] **C-04 DTOs y mapper de libros** (C2.2, C2.3, C3.2, C4.2, C4.5)
  - `CreateBookDto`, `UpdateBookDto`, `BookDto`, `trimText` y `toBookDto`.
  - Pruebas: cada regla de validación (vacíos, longitudes, precio 0, negativo, tres decimales, mayor al máximo, `availability` no booleano, propiedades no declaradas como `id`, `imageUrl` y `deletedAt`); normalización de espacios; el mapper convierte `price` a número y no incluye `deletedAt`.
  - Commit: `feat(books): add book DTOs and mapper`

- [ ] **C-05 Servicio de libros** (C2.1, C2.4 a C2.6, C3.1, C3.3, C4.1 a C4.4, C5.1, C5.3, C5.4)
  - `BooksService` con `create`, `findOne`, `update` y `remove` dentro de `prisma.live.$transaction`; traducción de `P2002` a `ConflictException`.
  - Pruebas: alta resuelve los tres catálogos y crea el libro en la misma transacción; si el segundo paso falla el error se propaga y no se llama a `book.create`; `findOne` 404; `update` parcial resuelve solo los catálogos recibidos y rechaza el cuerpo vacío; duplicado → 409; `remove` pone `deletedAt` y un segundo borrado da 404; nunca se toca un catálogo al eliminar.
  - Commit: `feat(books): add books service with transactional writes`

- [ ] **C-06 Controlador y documentación** (C2.1, C3.1, C3.3, C4.1, C5.1, C7.1 a C7.3, C10.1)
  - `BooksController` (`POST`, `GET :id`, `PATCH :id`, `DELETE :id` con 204 y `ParseUUIDPipe`), `BooksModule` importado en `AppModule`, decoradores de Swagger.
  - Pruebas: el controlador delega en el servicio y no usa Prisma; HTTP con Passport real: 401 sin token en todas las rutas nuevas, `POST` válido 201, inválido 400, `:id` no UUID 400, `DELETE` 204 sin cuerpo; el recorrido del OpenAPI de `auth` sigue pasando.
  - Commit: `feat(books): add books REST endpoints`

- [ ] **C-07 Verificación contra PostgreSQL real** (C1.2 a C1.5, C2.5, C2.6, C5.1 a C5.4, C10.4)
  - Backend compilado contra la base de desarrollo: migración desde cero; índices presentes y `prisma migrate diff` sin intentar borrar los manuales; alta, detalle, edición, baja lógica y 404 posterior; duplicado real → 409; reversión: un fallo tras crear un autor no lo deja guardado; dos altas simultáneas con la misma editorial nueva dejan una fila; volver a registrar un libro eliminado; `EXPLAIN` del índice `pg_trgm`; el hash y las filas eliminadas no salen en ninguna respuesta.
  - Hecho cuando: cada comprobación queda en el registro de verificación.
  - Commit: `docs(books-crud): record the backend verification`

## Frontend
- [ ] **C-08 Contrato, servicios y utilidades** (C8.2, C8.3, C9.1, C10.2)
  - `types/book.ts`, `books.service.ts`, `catalog.service.ts`, `book-schema.ts`, `format.ts`, `useDebounce`, `useBook`, `useCatalogOptions`.
  - Pruebas: cada servicio llama a la ruta y método correctos y desenvuelve `data`; esquema Zod (cada regla y los bordes del precio); formatos de moneda y fecha; `useDebounce` con temporizadores simulados.
  - Commit: `feat(frontend): add book services, schema and debounce hook`

- [ ] **C-09 Formulario de libro** (C8.2 a C8.5, C8.8)
  - `BookForm`, `CatalogField` y rutas `/books/new` y `/books/:id/edit` con `BookFormPage` (alta y edición).
  - Pruebas: validación en español por campo; envío correcto; 400 por campo; 409; red; botón "Guardando…" sin doble envío; foco en el primer error; sugerencias del catálogo con debounce y fallo silencioso; edición carga los datos y 404 muestra "Libro no encontrado"; éxito navega al detalle e invalida la caché.
  - Commit: `feat(frontend): add book create and edit form`

- [ ] **C-10 Detalle y eliminación** (C8.9, C9.1 a C9.5)
  - `BookDetailPage`, `ConfirmDialog`, ruta `/books/:id` y el enlace "Nuevo libro" en `BooksPage`.
  - Pruebas: muestra todos los campos con formato; sin imagen muestra el marcador; 404; "Editar" y "Volver"; el diálogo pide confirmación, `Escape` cancela sin enviar nada, confirmar elimina, quita la caché y navega a `/books`; el error de borrado se muestra sin salir.
  - Commit: `feat(frontend): add book detail page with delete confirmation`

## Integración y cierre
- [ ] **C-11 Verificación de punta a punta** (C10.4)
  - `docker compose up --build` y, en un navegador real: alta con catálogos nuevos y existentes; validaciones visibles; duplicado (409 en pantalla); edición; detalle; eliminación con confirmación y 404 al volver al detalle; sesión expirada durante un envío lleva a `/login`.
  - Hecho cuando: cada escenario queda anotado en el registro de verificación.
  - Commit: `docs(books-crud): record the end-to-end verification`

- [ ] **C-12 Verificación de la spec**
  - Recorrer C1 a C10 con evidencia nueva (lint, tipos, build, `test:cov` ≥ 80% en ambas aplicaciones y fallando por debajo) y registrar el resultado al final de este archivo. Marcar como resuelta la salvedad 2 de `.ai/specs/platform/tasks.md` (P2002 real) y anotar los pendientes que sigan abiertos (`npm audit`, tamaño del paquete del frontend).
  - Hecho cuando: ningún criterio queda sin comprobación o sin una nota que explique por qué.
  - Commit: `docs(books-crud): record the spec verification`

## Registro de verificación
(Se completa en C-01, C-07, C-11 y C-12.)

### C-01: migraciones contra PostgreSQL real (2026-10-28)
Entorno: PostgreSQL 16 del contenedor de desarrollo; base vacía temporal (`c01_check`, eliminada al terminar) para la prueba desde cero.

| Comprobación | Resultado |
|---|---|
| `prisma migrate deploy` sobre una base vacía | Aplica las tres migraciones (`init`, `add_catalog_and_books`, `add_title_search_and_uniqueness`) sin error |
| Base de desarrollo | `migrate status`: al día; `\d books` muestra las claves foráneas `ON DELETE RESTRICT`, los cinco índices B-tree, el GIN `gin_trgm_ops` y el único parcial; `pg_trgm` instalada |
| `prisma migrate diff` (base ↔ `schema.prisma`) | Primero propuso `DROP INDEX "books_title_trgm_idx"`; tras declarar el índice en el esquema, queda vacío en la base nueva y en la de desarrollo |
| Duplicado "Dune" / "DUNE" con el mismo autor y editorial | Rechazado por `books_active_title_author_publisher_key` |
| Borrar un autor con libros | Rechazado por la clave foránea (`RESTRICT`) |
| Volver a registrar "dune" tras marcar `deleted_at` en el anterior | Permitido |
| Precio de 100.000.000 | `numeric field overflow` (el máximo de `Decimal(10,2)` es 99.999.999,99, igual que la validación del DTO) |
| `prisma generate`, `build`, `lint`, `test:cov` (213 pruebas, 100%) y e2e (8) | Pasan |

Hallazgos: el índice GIN debía declararse en el esquema para que el próximo `migrate dev` no intente borrarlo (corregido y anotado en `design.md` §2). `prisma migrate dev` se queda esperando entrada en este entorno no interactivo, aunque aplica las migraciones; la creación de la migración manual se hizo a mano y se aplicó con `migrate dev`/`deploy`; el flujo del stack usa `migrate deploy`.
