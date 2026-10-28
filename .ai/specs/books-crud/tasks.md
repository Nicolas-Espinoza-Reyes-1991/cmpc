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

- [x] **C-02 Borrado lógico en Prisma** (C5.2, C5.3, C10.1)
  - `soft-delete.extension.ts`, `PrismaService.live` y la prueba de arquitectura sobre el uso de `prisma.book`.
  - Pruebas: cada operación fusiona `deletedAt: null`; respeta un `deletedAt` explícito; no toca otros modelos; la prueba de arquitectura falla si un servicio usa `prisma.book` fuera de `live`.
  - Commit: `feat(prisma): add soft delete extension`

- [x] **C-03 Catálogos** (C2.4, C6.1 a C6.3, C7.1)
  - `CatalogModule`, `CatalogService` (`list`, `resolve`), `CatalogController` (`/authors`, `/publishers`, `/genres`) y DTOs.
  - Pruebas: listado con y sin `search`, `limit` fuera de rango → 400, orden por nombre; `resolve` devuelve el existente sin distinguir mayúsculas y hace `upsert` si no existe; el controlador no usa Prisma; no hay rutas de escritura.
  - Commit: `feat(catalog): add read-only catalog endpoints and resolver`

- [x] **C-04 DTOs y mapper de libros** (C2.2, C2.3, C3.2, C4.2, C4.5)
  - `CreateBookDto`, `UpdateBookDto`, `BookDto`, `trimText` y `toBookDto`.
  - Pruebas: cada regla de validación (vacíos, longitudes, precio 0, negativo, tres decimales, mayor al máximo, `availability` no booleano, propiedades no declaradas como `id`, `imageUrl` y `deletedAt`); normalización de espacios; el mapper convierte `price` a número y no incluye `deletedAt`.
  - Commit: `feat(books): add book DTOs and mapper`

- [x] **C-05 Servicio de libros** (C2.1, C2.4 a C2.6, C3.1, C3.3, C4.1 a C4.4, C5.1, C5.3, C5.4)
  - `BooksService` con `create`, `findOne`, `update` y `remove` dentro de `prisma.live.$transaction`; traducción de `P2002` a `ConflictException`.
  - Pruebas: alta resuelve los tres catálogos y crea el libro en la misma transacción; si el segundo paso falla el error se propaga y no se llama a `book.create`; `findOne` 404; `update` parcial resuelve solo los catálogos recibidos y rechaza el cuerpo vacío; duplicado → 409; `remove` pone `deletedAt` y un segundo borrado da 404; nunca se toca un catálogo al eliminar.
  - Commit: `feat(books): add books service with transactional writes`

- [x] **C-06 Controlador y documentación** (C2.1, C3.1, C3.3, C4.1, C5.1, C7.1 a C7.3, C10.1)
  - `BooksController` (`POST`, `GET :id`, `PATCH :id`, `DELETE :id` con 204 y `ParseUUIDPipe`), `BooksModule` importado en `AppModule`, decoradores de Swagger.
  - Pruebas: el controlador delega en el servicio y no usa Prisma; HTTP con Passport real: 401 sin token en todas las rutas nuevas, `POST` válido 201, inválido 400, `:id` no UUID 400, `DELETE` 204 sin cuerpo; el recorrido del OpenAPI de `auth` sigue pasando.
  - Commit: `feat(books): add books REST endpoints`

- [x] **C-07 Verificación contra PostgreSQL real** (C1.2 a C1.5, C2.5, C2.6, C5.1 a C5.4, C10.4)
  - Backend compilado contra la base de desarrollo: migración desde cero; índices presentes y `prisma migrate diff` sin intentar borrar los manuales; alta, detalle, edición, baja lógica y 404 posterior; duplicado real → 409; reversión: un fallo tras crear un autor no lo deja guardado; dos altas simultáneas con la misma editorial nueva dejan una fila; volver a registrar un libro eliminado; `EXPLAIN` del índice `pg_trgm`; el hash y las filas eliminadas no salen en ninguna respuesta.
  - Hecho cuando: cada comprobación queda en el registro de verificación.
  - Commit: `docs(books-crud): record the backend verification`

## Frontend
- [x] **C-08 Contrato, servicios y utilidades** (C8.2, C8.3, C9.1, C10.2)
  - `types/book.ts`, `books.service.ts`, `catalog.service.ts`, `book-schema.ts`, `format.ts`, `useDebounce`, `useBook`, `useCatalogOptions`.
  - Pruebas: cada servicio llama a la ruta y método correctos y desenvuelve `data`; esquema Zod (cada regla y los bordes del precio); formatos de moneda y fecha; `useDebounce` con temporizadores simulados.
  - Commit: `feat(frontend): add book services, schema and debounce hook`

- [x] **C-09 Formulario de libro** (C8.2 a C8.5, C8.8)
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
(Se completa en C-01 a C-09, C-11 y C-12.)

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

### C-02: borrado lógico contra PostgreSQL real (2026-10-28)
Backend compilado contra la base de desarrollo, con libros creados y eliminados a mano (todo se borró al terminar; `books` quedó en 0 filas).

| Comprobación | Resultado |
|---|---|
| Cliente normal (`prisma.book`) con un libro eliminado | Ve los 2 libros (la extensión no lo afecta) |
| `live.book.findMany` con y sin argumentos, y `count` | Solo el libro activo |
| `live.book.findUnique` del eliminado / del activo | `null` / el activo |
| `live.book.update` sobre el eliminado (editar y volver a eliminar) | `P2025` en ambos casos: no revive ni se elimina dos veces |
| `update` y `findFirst` dentro de `live.$transaction` | La transacción también filtra (actualiza el activo; no ve el eliminado) |
| `where` con `deletedAt: { not: null }` explícito | Respetado: devuelve el eliminado |
| Catálogos (`live.author`) | Sin filtro |
| Prueba de arquitectura con un archivo que usa `this.prisma.book` | Falla nombrando el archivo; sin él, pasa |
| `lint`, tipos, build, `test:cov` y e2e | Pasan: 239 pruebas (26 nuevas) con 100% de cobertura, y 8 pruebas e2e |

### C-03: catálogos contra PostgreSQL real y HTTP real (2026-10-28)
Backend compilado contra la base de desarrollo; datos de prueba con prefijo `C03` borrados al terminar (0 filas sobrantes en catálogos). Servidor real (`node dist/main`) con login del administrador sembrado.

| Comprobación | Resultado |
|---|---|
| `resolve("C03 Planeta")` y luego `resolve("c03 planeta")` | Mismo id; una sola fila |
| 8 transacciones simultáneas con el mismo autor nuevo | Las 8 terminan bien, 1 fila, 1 id (el `upsert` usa `ON CONFLICT`) |
| `resolve` y fallo posterior en la misma transacción | El género no queda guardado (0 filas) |
| Listado: orden por nombre, `search` sin distinguir mayúsculas, `limit` | Correctos |
| Comodines: `search=a_b` y `C03 %` | **Defecto encontrado**: Prisma no escapa `%` ni `_` (`a_b` devolvía también `axb`; `C03 %` devolvía todo). Corregido con `escapeLike`; repetido: `a_b` solo devuelve `a_b`, `C03 %` devuelve vacío |
| HTTP: `GET /api/authors` sin token | 401 |
| HTTP: con token y `?search=c03&limit=5` | `{ data: [...] }` ordenado por nombre |
| HTTP: `?limit=99` | 400 con `errors: [{ field: "limit", ... }]` |
| HTTP: `POST /api/authors` | 404 (no hay escritura, C6.3) |
| OpenAPI | Documenta `/api/authors`, `/api/publishers` y `/api/genres`; el e2e de `auth` las recorre y exige 401 sin token |
| Log del servidor | 0 líneas con contraseña o cabecera `Bearer` |
| `lint`, tipos, build, `test:cov` y e2e | Pasan: 276 pruebas (37 nuevas) con 100% de cobertura, y 8 e2e |

### C-04: DTOs y mapper (2026-10-28)
Las pruebas de validación usan el `ValidationPipe` con la misma configuración que la aplicación (`whitelist`, `forbidNonWhitelisted`, `transform` y el filtro de errores único), de modo que comprueban lo que recibiría un cliente.

| Comprobación | Resultado |
|---|---|
| Texto: vacío, solo espacios, ausente o no textual (`42`, `null`, arreglo) | 400 con el campo correspondiente, en `title`, `author`, `publisher` y `genre` |
| Longitudes: 200 (título) y 100 (nombres) | El límite se acepta y uno más se rechaza; la longitud se mide después de colapsar espacios |
| Normalización: `"  Gabriel   García 	 Márquez  "` | `"Gabriel García Márquez"` |
| Precio: 0,01, 1, 12990, 1234,5, 99,99 y el máximo | Aceptados |
| Precio: 0, negativo, tres decimales, sobre el máximo, `1e21`, texto, `null`, booleano, ausente | 400 en `price` |
| **Defecto encontrado**: precio `1e-7` | `@IsNumber({ maxDecimalPlaces })` lanzaba `TypeError` (500). Reemplazado por `@IsMoney`; ahora responde 400 |
| `availability`: `"true"`, `1`, `0`, `null`, ausente | 400; solo `true` y `false` pasan |
| Propiedades `id`, `imageUrl`, `deletedAt`, `createdAt`, `authorId`, desconocida | 400 en `CreateBookDto` y (`id`, `imageUrl`, `deletedAt`) en `UpdateBookDto` |
| `UpdateBookDto` | Acepta cada campo por separado y `{}` (el servicio rechazará el cuerpo vacío en C-05); mismas reglas y normalización |
| Mapper | Nombres en lugar de ids, `price` numérico exacto (hasta 99.999.999,99), sin `deletedAt` ni claves foráneas |
| `lint`, tipos, build, `test:cov` y e2e | Pasan: 355 pruebas (79 nuevas) con 100% de cobertura, y 8 e2e |

### C-05: servicio de libros contra PostgreSQL real (2026-10-28)
Backend compilado contra la base de desarrollo, llamando a `BooksService` con `PrismaService` y `CatalogService` reales; datos con prefijo `C05` borrados al terminar (0 filas sobrantes). El servicio todavía no tiene controlador (C-06); la comprobación por HTTP llega allí y en C-07.

| Comprobación | Resultado |
|---|---|
| Alta con autor, editorial y género nuevos | Devuelve el libro con nombres y `price: 9990.5`; crea 1 fila en cada catálogo y 1 libro |
| Segundo libro con `"c05 frank herbert"` y `"C05 CIENCIA FICCIÓN"` | Reutiliza el autor y el género existentes (siguen siendo 1 fila) |
| Mismo título (otra capitalización), autor y editorial | `ConflictException` (409) con el mensaje de la spec |
| **Reversión**: catálogos nuevos y precio fuera del rango de la base (1e9, saltándose el DTO) | El insert falla y no queda ningún autor, editorial, género ni libro nuevo |
| Detalle | Devuelve el libro |
| Edición de `price` y `publisher` | Cambia solo esos campos, crea la editorial nueva y `updatedAt` avanza |
| Edición con cuerpo vacío / que produce un duplicado / de un id inexistente | 400 `At least one field is required` / 409 / 404 `Book not found` |
| Baja lógica | Sin error; la fila sigue en la tabla con `deletedAt` |
| Detalle, nueva baja y edición del libro ya eliminado | 404 en los tres (la edición no lo revive) |
| Catálogos tras eliminar | Se conservan |
| Volver a registrar el libro eliminado | Permitido (nuevo id) |
| `lint`, tipos, build, `test:cov` y e2e | Pasan: 374 pruebas (19 nuevas del servicio) con 100% de cobertura, y 8 e2e |

Observación: el insert que sobrepasa `Decimal(10,2)` llega como `PrismaClientUnknownRequestError` (un 500 si se omitiera la validación); el DTO lo evita con el máximo de `@IsMoney`, de modo que no es alcanzable desde la API.

### C-06: rutas de libros por HTTP real (2026-10-28)
Servidor real (`node dist/main`) contra la base de desarrollo, con login del administrador sembrado y `curl`; datos con prefijo `C06` borrados al terminar (0 filas sobrantes).

| Comprobación | Resultado |
|---|---|
| `POST`, `GET`, `PATCH` y `DELETE` sin token | 401 las cuatro |
| `POST` válido con título `"  C06   Dune "` | 201 `{ data }` con título normalizado `C06 Dune`, nombres, `price: 9990.5`, `imageUrl: null`, sin `deletedAt` |
| `POST` del mismo libro con otra capitalización | 409 con el mensaje de duplicado y el formato de error único |
| `POST` con título vacío, autor numérico, precio `1e-7`, `availability: "yes"` e `imageUrl` | 400 con un error por campo (incluido `imageUrl should not exist`); el precio da 400, no 500 |
| `GET` de un libro / de un id que no es UUID / de uno inexistente | 200 / 400 `Validation failed (uuid is expected)` / 404 `Book not found` |
| `PATCH` de `price` y `availability` | 200; el resto de los campos intacto y `updatedAt` avanza |
| `PATCH` con `{}` / con `imageUrl` | 400 `At least one field is required` / 400 `property imageUrl should not exist` |
| `DELETE` | 204 sin cuerpo; la fila sigue en la tabla con `deletedAt` |
| `GET`, `DELETE` y `PATCH` del libro eliminado | 404 los tres |
| Texto con `ñ` y `ó` | Ida y vuelta correcta por la API y en la base (`c3 b3` para "ó") |
| OpenAPI | `POST /books` [201,400,401,409]; `GET`, `PATCH` y `DELETE /books/{id}` documentan 200/204, 400, 401, 404 y (PATCH) 409 |
| Log del servidor | 0 líneas con contenido de los libros, `Bearer` o contraseñas |
| Pruebas | Controlador (5), HTTP con Passport real (25): 401 sin token sin tocar la base, 201/400/409/500 sin detalles internos, 404, 204 sin cuerpo y `:id` no UUID. Mutaciones: sin `ParseUUIDPipe` fallan 3; sin `@HttpCode(204)` falla 1 |
| `lint`, tipos, build, `test:cov` y e2e | Pasan: 404 pruebas (30 nuevas) con 100% de cobertura, y 8 e2e |

El e2e de `auth` recorre ahora también las cuatro operaciones nuevas del OpenAPI y exige 401 sin token.

### C-07: verificación del backend contra PostgreSQL real (2026-10-28)
Entorno: PostgreSQL 16 del contenedor de desarrollo; base **nueva y vacía** (`c07_check`, eliminada al terminar) migrada con `prisma migrate deploy`; `BooksService` y `CatalogService` reales, compilados.

| Comprobación | Resultado |
|---|---|
| `migrate deploy` desde cero | Aplica las tres migraciones |
| `prisma migrate diff` base ↔ esquema | Vacío |
| Índices de `books` | Pkey, único parcial, los cinco B-tree y `books_title_trgm_idx` |
| 6 altas simultáneas de libros distintos con la misma editorial y género nuevos | Las 6 terminan bien; 1 fila de editorial y 1 de género |
| 2 altas simultáneas del mismo libro | Una se crea y la otra recibe `ConflictException`; 1 fila |
| Duplicado con otra capitalización (`P2002` real del índice único) | `ConflictException` con el mensaje de la spec. Cierra la salvedad 2 de `platform` |
| Reversión: catálogos nuevos y el insert del libro falla | No queda ningún autor, editorial, género ni libro |
| Reversión en la edición: catálogo nuevo y libro inexistente | 404 y ningún catálogo nuevo |
| Baja lógica | La fila se conserva; detalle, nueva baja y edición dan 404; se puede volver a registrar (2 filas, 1 activa) |
| Respuesta del servicio | Solo `id`, `title`, `author`, `publisher`, `genre`, `price`, `availability`, `imageUrl`, `createdAt`, `updatedAt` |
| `pg_trgm` con 300.009 libros, `ILIKE '%a1b2c3d4e5%'` | Plan natural: `Bitmap Index Scan on books_title_trgm_idx`, 4,1 ms. Con índices desactivados: `Parallel Seq Scan`, 319,8 ms |

**Defecto encontrado y corregido.** Con 6 (luego 16) transacciones simultáneas que crean el mismo catálogo nuevo, una fallaba con `P2002` sobre `publishers.name`, y `BooksService` lo presentaba como "libro duplicado". La causa: `upsert` con `update: {}` no usa `INSERT … ON CONFLICT`. Correcciones: `update: { name }` en `CatalogService.resolve`, y `translate` solo convierte el `P2002` del modelo `Book`. Tras el cambio: 20 rondas de 16 transacciones simultáneas (publisher, publisher+género, con el cliente `live` y con autores distintos) sin ningún error. La afirmación de C-03 ("8 de 8 correctas") era suerte de tiempos, no una garantía.

**Observación sobre las pruebas.** Una ejecución completa de `test:cov` tuvo 27 fallos (las pruebas HTTP de libros y dos de `argon2`) que no se reprodujeron: las mismas pruebas pasan solas y en tres ejecuciones completas seguidas (405 pruebas, 100% de cobertura). Se atribuye a carga de la máquina (tiempos de espera con `argon2` y Passport en paralelo); queda anotado por si reaparece.

`lint`, tipos, build, `test:cov` y e2e pasan: 405 pruebas con 100% de cobertura (tres ejecuciones seguidas) y 8 pruebas e2e.

### C-08: contrato, servicios y utilidades del frontend (2026-10-28)
Pruebas con la capa HTTP simulada (`mockApi`, los interceptores reales siguen activos) y `renderHook` con un `QueryClient` sin reintentos (`src/test/query-wrapper.tsx`).

- **Servicios:** `createBook`, `getBook`, `updateBook`, `deleteBook` y `listCatalog` llaman a la ruta y el método correctos, desenvuelven `data`, pasan la señal de cancelación, codifican el id en la ruta (`../auth/me` no cambia el camino) y rechazan con `ApiError` (404, 500 y los errores por campo de un 400). Una búsqueda vacía no se envía.
- **Esquema:** cada texto (vacío, solo espacios, ausente, no textual, límite y límite + 1, longitud tras colapsar espacios), cada caso del precio y `availability`.
- **Defecto encontrado:** el esquema aceptaba `1e-7` (la comprobación de decimales con tolerancia lo daba por válido). Corregido con la regla del mínimo de 0,01 (`priceProblem`).
- **Formato:** `formatPrice` (`$12.990`, `$9.990,50`) y `formatDateTime`; en `es-CL` la fecha sale como `28-10-2026, 10:30 a. m.` (no con mes abreviado, como había supuesto en el diseño).
- **Hooks:** `useDebounce` (temporizadores simulados, reinicio de la espera, desmontaje), `useBook` (carga, 404 expuesto como `ApiError`, `meta.silent`) y `useCatalogOptions` (primera carga inmediata, espera de 250 ms, texto recortado y fallo silencioso). `useBook` recibe un `id` obligatorio: la página decide qué hacer cuando la ruta no trae `:id`, en vez de que el hook tenga una rama inalcanzable.
- **Estabilidad:** las pruebas con temporizadores se repitieron 5 veces seguidas sin fallos.
- **Calidad:** `lint`, tipos y build limpios; 308 pruebas (97 nuevas) con 100% de cobertura en sentencias, ramas, funciones y líneas.

### C-09: formulario de libro (2026-10-28)
Pruebas con la capa HTTP simulada y, aparte, navegador real (servidor de desarrollo de Vite con el proxy a `/api`, backend compilado y PostgreSQL de desarrollo, con login del administrador sembrado). Los datos de prueba se borraron al terminar (la base quedó con 0 libros y 0 catálogos) y los servidores se detuvieron.

| Comprobación en el navegador real | Resultado |
|---|---|
| `/books/new` sin sesión | Lleva al login y, tras entrar, vuelve a `/books/new` con el foco en el título y la cabecera con el correo |
| Envío vacío | 5 mensajes en español (título, autor, editorial, género, precio), los 5 campos `aria-invalid` y el foco en el primero |
| Precio `10.123` | "El precio admite como máximo dos decimales." y el foco en el precio |
| Alta válida con título `"  Dune   Messiah "` | Guardado como `Dune Messiah`, precio `9990.5`, disponible; navega a `/books/<id>` |
| `/books/<id>/edit` | Rellena título, autor, editorial, género, precio y disponibilidad; "Cancelar" apunta al detalle; botón "Guardar cambios" |
| Guardar sin cambios | No se envía ninguna petición y vuelve al detalle |
| Cambiar precio y desmarcar disponible | La petición es `PATCH {"price":11000,"availability":false}` (solo lo cambiado); título intacto y `updatedAt` avanza |
| Alta duplicada (`dune messiah` / `FRANK HERBERT` / `ace books`) | Aviso "Ya existe un libro con el mismo título, autor y editorial.", se queda en el formulario con lo escrito y el botón habilitado |
| Sugerencias | Al abrir, cada lista trae el nombre existente; al escribir `ace` queda `Ace Books`; con `zzz-no-existe` queda vacía |
| Libro inexistente (`/books/0000…/edit`) | "Libro no encontrado" con enlace a `/books` |
| Id mal formado (`/books/not-a-uuid/edit`) | **Defecto encontrado**: mostraba "Los datos enviados no son válidos" con un "Reintentar" inútil. Corregido: ahora "Libro no encontrado" sin botón de reintento |

Pruebas automáticas nuevas: `BookForm` (27: campos, foco, validación por campo y al salir, cada regla del precio, título de 201 caracteres, envío normalizado, disponibilidad, "Guardando…" sin doble envío, 400 por campo y de un campo ajeno, 409, red, 5xx y error inesperado, el aviso se limpia al reintentar, sugerencias con espera y fallo silencioso), `BookFormPage` (14: alta, caché, invalidación, 409 y 400; edición con carga, relleno, solo lo cambiado, sin cambios, 409, 404, 400 de id mal formado y reintento), `changedFields` (9) y las rutas `/books/new` y `/books/:id/edit` dentro del diseño y protegidas (4). Dos mutaciones comprobadas: con la invalidación de listas desactivada falla 1 prueba y con el libro guardado también invalidado fallan 2.

Hallazgos de método: `prettier --write` y `git checkout` entre ramas dejaron `eslint.config.js` y `vite.config.ts` con fin de línea CRLF en el árbol de trabajo (Git con `autocrlf=true` en Windows); es inocuo, el índice sigue en LF, y se normalizaron. El primer borrador de la prueba de invalidación fabricaba un objeto `Query` con una conversión de tipo; se reescribió para comprobar el estado real de la caché.

`lint` (0 avisos), `tsc`, build y `test:cov`: 362 pruebas con 100% de sentencias, ramas, funciones y líneas (tres ejecuciones seguidas estables).
