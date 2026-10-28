# Spec books-crud: Diseño

Implementa los requisitos de `requirements.md`. Los códigos C# remiten a ese archivo.

## 1. Alcance y decisiones

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| La API recibe y devuelve `author`, `publisher` y `genre` como **nombres** (texto) | Recibir ids y obligar a crear antes cada catálogo | Es lo que decide `architecture.md`: el catálogo se crea al registrar el libro. Mismo formato de entrada y salida, así el formulario de edición no transforma nada |
| Resolver catálogos con una búsqueda sin distinguir mayúsculas y, si no existe, `upsert` por nombre exacto | `connectOrCreate` literal | `connectOrCreate` distingue mayúsculas: "Planeta" y "planeta" serían dos editoriales. El `upsert` por clave única usa `INSERT … ON CONFLICT`, así dos peticiones simultáneas con el mismo nombre nuevo no chocan (§4). Es un refinamiento de la decisión de `architecture.md`, que se actualiza al aprobar esta spec |
| Un índice único parcial `(lower(title), author_id, publisher_id) WHERE deleted_at IS NULL` | Sin restricción, o único total | Evita duplicados por descuido en un inventario y permite volver a registrar un libro eliminado. Prisma no expresa índices parciales: va en la migración SQL manual (como el índice `pg_trgm`) |
| `price` es `Decimal(10,2)` en la base y **número** en la API | Texto (`"12990.00"`) | El rango (hasta 99.999.999,99) cabe exacto en un `double`, así que el número no pierde precisión; la base mantiene decimales exactos para ordenar y sumar. La conversión vive en un único mapper |
| `PATCH` parcial, no `PUT` | `PUT` con el libro completo | Cambiar el precio no debería exigir reenviar todo; menos riesgo de pisar campos |
| `DELETE` responde 204 sin cuerpo | 200 con el libro | No hay nada útil que devolver; el cliente ya tiene el id |
| Extensión del cliente Prisma que filtra `deletedAt: null` (propiedad `prisma.live`) | Escribir `deletedAt: null` en cada consulta | Es la decisión de `architecture.md` (C5.2); un servicio nuevo no puede olvidar el filtro si usa `prisma.live` (§3) |
| Las transacciones se estructuran ya para recibir la auditoría | Esperar a `audit-log` y reescribir | Cada operación corre dentro de `prisma.live.$transaction` con un único punto donde `audit-log` añadirá `auditService.log(tx, …)`; no cambia la forma del código (§5) |
| Sin control de concurrencia optimista | `version` con `If-Match` | Es una tienda con un administrador; queda como mejora futura (§10) |
| Autocompletado con `<datalist>` nativo | Librería de combobox | `tech-stack.md` no admite librerías de componentes; el `<datalist>` basta para sugerir y permite escribir un valor nuevo |
| Precio mostrado con `Intl.NumberFormat('es-CL', CLP)` | Moneda configurable | Supuesto: la tienda es chilena. Es solo presentación; el dato guardado no lleva moneda. Queda en GEN-1 de `docs-delivery` |

## 2. Modelo de datos (C1)

```prisma
model Author {
  id        String   @id @default(uuid()) @db.Uuid
  name      String   @unique
  createdAt DateTime @default(now()) @map("created_at")
  books     Book[]
  @@map("authors")
}
// Publisher y Genre: idénticos (tablas publishers, genres)

model Book {
  id           String    @id @default(uuid()) @db.Uuid
  title        String
  price        Decimal   @db.Decimal(10, 2)
  availability Boolean
  imageUrl     String?   @map("image_url")
  authorId     String    @map("author_id") @db.Uuid
  publisherId  String    @map("publisher_id") @db.Uuid
  genreId      String    @map("genre_id") @db.Uuid
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  deletedAt    DateTime? @map("deleted_at")

  author    Author    @relation(fields: [authorId], references: [id], onDelete: Restrict)
  publisher Publisher @relation(fields: [publisherId], references: [id], onDelete: Restrict)
  genre     Genre     @relation(fields: [genreId], references: [id], onDelete: Restrict)

  @@index([authorId])
  @@index([publisherId])
  @@index([genreId])
  @@index([availability])
  @@index([deletedAt, createdAt])
  @@map("books")
}
```

Dos migraciones: la generada por Prisma (tablas e índices B-tree) y una **manual** (`prisma migrate dev --create-only`, luego se edita el SQL):
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX books_title_trgm_idx ON books USING GIN (title gin_trgm_ops);
CREATE UNIQUE INDEX books_active_title_author_publisher_key
  ON books (lower(title), author_id, publisher_id) WHERE deleted_at IS NULL;
```
`pg_trgm` es una extensión de confianza en PostgreSQL 13 o superior: el dueño de la base puede crearla sin ser superusuario, de modo que `migrate deploy` funciona con el usuario normal del stack. El índice GIN **sí se declara** en `schema.prisma` (`@@index([title(ops: raw("gin_trgm_ops"))], type: Gin, map: "books_title_trgm_idx")`): sin esa línea, `prisma migrate diff` (y el próximo `migrate dev`) lo ve como sobrante y genera un `DROP INDEX`; se comprobó en C-01. La extensión y el SQL del índice siguen en la migración manual. El índice único parcial usa una expresión (`lower(title)`) y Prisma no lo incluye en sus diferencias, por lo que solo vive en la migración manual, con un comentario en el esquema.

## 3. Backend: estructura
```
backend/src/
├── books/
│   ├── books.module.ts
│   ├── books.controller.ts        # POST/GET/PATCH/DELETE /books
│   ├── books.service.ts           # create, findOne, update, remove (transacciones)
│   ├── book.mapper.ts             # fila de Prisma -> BookDto (price a número, sin deletedAt)
│   └── dto/                       # create-book.dto.ts, update-book.dto.ts, book.dto.ts
├── catalog/
│   ├── catalog.module.ts
│   ├── catalog.controller.ts      # GET /authors, /publishers, /genres
│   ├── catalog.service.ts         # list(kind, query) y resolve(tx, kind, name)
│   ├── catalog-kind.ts            # 'author' | 'publisher' | 'genre' y su delegado de Prisma
│   └── dto/                       # catalog-query.dto.ts, catalog-item.dto.ts
├── common/
│   └── transformers/trim-text.transformer.ts   # normaliza espacios (C2.3)
└── prisma/
    ├── soft-delete.extension.ts   # filtro deletedAt: null para Book
    └── prisma.service.ts          # añade `live` (cliente extendido)
```
`BooksModule` importa `CatalogModule` (usa `CatalogService.resolve`); ninguno de los dos importa al otro por ciclo: el catálogo no conoce los libros.

**`prisma.live`.** `$extends` devuelve un cliente nuevo y no puede sustituir a la clase `PrismaService extends PrismaClient`, así que `PrismaService` añade `readonly live = this.$extends(softDeleteExtension)`. Quien lee o escribe libros usa `prisma.live`; el resto (`health`, `users`) sigue con el cliente normal. Una prueba de arquitectura (C-02) recorre `src/**/*.service.ts` y falla si un servicio fuera de `prisma/` usa `prisma.book` sin pasar por `live`, para que el filtro no dependa de la memoria de nadie. Dentro de `prisma.live.$transaction(async (tx) => …)`, `tx` ya es el cliente extendido.

**Extensión (`soft-delete.extension.ts`).** Para el modelo `Book` y las operaciones `findFirst`, `findFirstOrThrow`, `findMany`, `findUnique`, `findUniqueOrThrow`, `count`, `aggregate`, `groupBy`, `update`, `updateMany`, `delete` y `deleteMany`, fusiona `deletedAt: null` con el `where` recibido. Incluye `update` para que editar o eliminar un libro ya eliminado dé `P2025` (404 por el filtro de errores) y no lo reviva. Un `where` que ya traiga `deletedAt` se respeta (nadie lo usa hoy; `audit-log` o una futura papelera podrían). `findUnique` admite filtros extra desde Prisma 5. `delete`/`deleteMany` reales no se usan en la aplicación; quedan filtrados por prudencia.

## 4. API

| Ruta | Cuerpo / query | Éxito | Errores |
|---|---|---|---|
| `POST /api/books` | `CreateBookDto` | 201 `{ data: Book }` | 400, 401, 409 |
| `GET /api/books/:id` | — | 200 `{ data: Book }` | 400 (UUID), 401, 404 |
| `PATCH /api/books/:id` | `UpdateBookDto` | 200 `{ data: Book }` | 400, 401, 404, 409 |
| `DELETE /api/books/:id` | — | 204 | 400, 401, 404 |
| `GET /api/authors` `/publishers` `/genres` | `?search=&limit=` | 200 `{ data: [{ id, name }] }` | 400, 401 |

`GET /api/books` (listado) lo añade `books-listing` en el mismo controlador.

- **`CreateBookDto`**: `title` (`@IsString`, `@IsNotEmpty`, `@MaxLength(200)`), `author`, `publisher`, `genre` (igual, 100), `price` (`@IsNumber({ maxDecimalPlaces: 2 })`, `@IsPositive`, `@Max(99999999.99)`), `availability` (`@IsBoolean`). Los textos pasan por `@Transform(trimText)` antes de validar: `trim` y `replace(/\s+/g, ' ')`; si el valor no es texto lo deja igual para que `@IsString` lo rechace. Con `whitelist` y `forbidNonWhitelisted`, `id`, `imageUrl` y `deletedAt` dan 400 (C2.2).
- **`UpdateBookDto`** = `PartialType(CreateBookDto)` de `@nestjs/swagger` (hereda validación y documentación). Un cuerpo sin ninguna propiedad se rechaza en el servicio con `BadRequestException('At least one field is required')`. DTOs separados por caso de uso (I de SOLID) aunque uno derive del otro.
- **`:id`** con `ParseUUIDPipe`: un id mal formado es 400 sin consultar la base (misma razón que en `UsersService.findById`).
- **`BookDto`** (respuesta): ver C3.2. El mapper convierte `price` con `toNumber()`, devuelve los nombres de las relaciones y quita `deletedAt`. Para eso las consultas hacen `include: { author: true, publisher: true, genre: true }` y el mapper se tipa con `Prisma.BookGetPayload`.
- **Errores** en el formato único. Mensajes: 404 `Book not found`; 409 `A book with the same title, author and publisher already exists` (la captura el servicio al ver `P2002` y la traduce; así el mensaje es específico y no el genérico del filtro); `PATCH` vacío `At least one field is required`.
- **Comodines de `LIKE`.** Prisma pasa `contains` a `LIKE` sin escapar: en la base real, `a_b` también encontraba `axb` y `%` encontraba todo (C-03). `CatalogService.list` escapa `\`, `%` y `_` antes de consultar, de modo que la búsqueda es de texto literal. `books-listing` debe hacer lo mismo con la búsqueda por título (usará la misma función; se extraerá a `common/` cuando se necesite una segunda vez).
- **Tipos del catálogo.** `catalog-kind.ts` define `CatalogKind`, `CatalogItem`, la interfaz mínima `CatalogDelegate` (lo que el servicio usa de un delegado de Prisma) y `CatalogClient` (los tres delegados). El cliente de Prisma y el cliente de una transacción encajan en `CatalogClient` sin conversiones de tipo, y las pruebas lo simulan sin importar el cliente generado. `trimText` (`common/transformers/`) se creó en esta tarea porque la búsqueda ya lo usa; `CreateBookDto` lo reutilizará.
- **Catálogo**: `CatalogQueryDto` con `search` opcional (`@IsString`, `@MaxLength(100)`, mismo `trimText`) y `limit` (`@Type(() => Number)`, `@IsInt`, `@Min(1)`, `@Max(50)`, 20 por defecto). La consulta: `findMany({ where: { name: { contains: search, mode: 'insensitive' } }, orderBy: { name: 'asc' }, take: limit, select: { id, name } })`.
- Swagger: `@ApiTags('books')` / `('catalog')`, `@ApiBearerAuth()` en ambos controladores, `@ApiProperty` con ejemplos y las respuestas de C7.3.

## 5. Backend: componentes

**`CatalogService`**
- `list(kind, query)`: lo de arriba, con el delegado correcto según `kind`.
- `resolve(tx, kind, name)`: devuelve el id del catálogo. 1) `findFirst({ where: { name: { equals: name, mode: 'insensitive' } } })`; si existe, devuelve su id. 2) Si no, `upsert({ where: { name }, update: {}, create: { name } })`. Dos peticiones que crean a la vez el mismo nombre nuevo terminan en una sola fila y ninguna falla, porque Prisma traduce el `upsert` por clave única a `INSERT … ON CONFLICT DO UPDATE`. Dos nombres que solo difieren en mayúsculas y llegan a la vez podrían crear dos filas; es un caso extremo que se documenta (§10). `tx` se tipa con la interfaz mínima que el servicio necesita, para poder simularla en las pruebas sin importar el cliente completo.

**`BooksService`** (recibe `PrismaService` y `CatalogService` por inyección; no conoce `AuditService` todavía)

`create(dto)`:
```ts
return this.prisma.live.$transaction(async (tx) => {
  const authorId = await this.catalog.resolve(tx, 'author', dto.author);
  const publisherId = await this.catalog.resolve(tx, 'publisher', dto.publisher);
  const genreId = await this.catalog.resolve(tx, 'genre', dto.genre);
  const book = await tx.book.create({ data: { …, authorId, publisherId, genreId }, include: BOOK_INCLUDE });
  // audit-log añadirá aquí: await this.audit.log(tx, { action: 'CREATE', … })
  return toBookDto(book);
});
```
`Promise.all` dentro de una transacción interactiva de Prisma comparte una sola conexión y las consultas se encolan: es correcto, pero sin ganancia. Se hacen en secuencia (`await` uno tras otro) para que el orden sea determinista y la lectura sencilla.

`findOne(id)`: `prisma.live.book.findUnique({ where: { id }, include })`; `null` → `NotFoundException('Book not found')`.

`update(id, dto)`: rechaza el cuerpo vacío; dentro de la transacción resuelve solo los catálogos presentes en el `dto`, y `tx.book.update({ where: { id }, data })`. Si `P2025` (no existe o eliminado, por la extensión), el filtro global lo convierte en 404.

`remove(id)`: en la transacción, `tx.book.update({ where: { id }, data: { deletedAt: new Date() } })`; un segundo `DELETE` del mismo libro da `P2025` → 404 (C5.3).

**Traducción de `P2002`.** Un helper `rethrowDuplicate(error)` en `books.service.ts` captura `Prisma.PrismaClientKnownRequestError` con código `P2002` y lanza `ConflictException` con el mensaje de C2.6. El nombre del catálogo (`name` único) nunca provoca este error gracias al `upsert`; solo puede venir del índice único de libros.

**Fechas.** `deletedAt` y `updatedAt` salen de la hora del proceso (`new Date()` y `@updatedAt`); con una sola instancia no hay desfase relevante.

## 6. Frontend: estructura
```
frontend/src/
├── types/book.ts                  # Book, BookInput, CatalogItem (contrato de la API)
├── services/books.service.ts      # create, getById, update, remove
├── services/catalog.service.ts    # list(kind, { search, limit })
├── lib/book-schema.ts             # esquema Zod + tipo BookFormValues
├── lib/format.ts                  # formatPrice (CLP), formatDate
├── hooks/useDebounce.ts           # reutilizado por books-listing (FE-2d)
├── hooks/useBook.ts               # useQuery(['books', id])
├── hooks/useCatalogOptions.ts     # useQuery(['catalog', kind, debouncedSearch])
├── components/BookForm.tsx        # formulario controlado por React Hook Form
├── components/CatalogField.tsx    # input + <datalist> con sugerencias
├── components/ConfirmDialog.tsx   # <dialog> nativo con foco y Escape
├── pages/BookFormPage.tsx         # alta (/books/new) y edición (/books/:id/edit)
└── pages/BookDetailPage.tsx       # /books/:id
```
Rutas (dentro de `ProtectedRoute` → `AppLayout`): `/books/new`, `/books/:id`, `/books/:id/edit`. `/books/new` se declara antes de `/books/:id` (React Router las ordena por especificidad, pero se deja explícito).

**Esquema Zod** (`book-schema.ts`): `title` texto `trim` 1–200; `author`/`publisher`/`genre` `trim` 1–100; `price` número (el campo `type="number"` con `valueAsNumber`), positivo, máximo 99.999.999,99 y como mucho dos decimales (se comprueba con `Math.round(v * 100) === v * 100` tolerando el error de coma flotante con `Number.EPSILON`, no con regex sobre texto); `availability` booleano. Mensajes en español. El formulario puede ser más estricto que la API, nunca más permisivo (mismo criterio que el login). Los espacios repetidos se reducen igual que en el servidor, para que lo que se ve sea lo que se guarda.

**`BookForm`**: recibe `defaultValues`, `onSubmit(values)` (promesa), `submitLabel`. Captura el error del envío por sí mismo, como `LoginPage`: 400 con `fieldErrors` conocidos → `setError` por campo; 409 → aviso `role="alert"` bajo el formulario; otros → `getErrorMessage`. No usa `useMutation` con aviso global: la página llama al servicio y navega, y el formulario es dueño de sus errores (C8.5). `formState.isSubmitting` da el estado "Guardando…" (C8.4). Foco en el primer campo con error con `shouldFocusError`.

**`CatalogField`**: `<input list="…">` con `<datalist>`; el texto escrito pasa por `useDebounce(250 ms)` y alimenta `useCatalogOptions` (`staleTime` de 30 s). Si la consulta falla no se muestra aviso (solo se pierden las sugerencias, el usuario puede escribir igual): `meta: { silent: true }`.

**`BookFormPage`**: `useParams` decide alta o edición. Edición: `useBook(id)`; loading → `AuthStatusScreen`-like de carga; 404 → mensaje "Libro no encontrado" y enlace. `onSubmit` llama a `books.service`, pone el libro en la caché (`setQueryData(['books', id], book)`), invalida `['books']` con `exact: false` y excluye el detalle recién puesto, y `navigate(`/books/${id}`)`.

**`BookDetailPage`**: `useBook(id)`; muestra los campos con `<dl>`; la portada con `<img alt="Portada de …">` o un marcador. "Eliminar" abre `ConfirmDialog`; al confirmar `books.service.remove(id)`, luego `queryClient.removeQueries(['books', id])`, invalida `['books']` y `navigate('/books')`. Un error de borrado se muestra en el diálogo/pantalla (C9.4).

**`ConfirmDialog`**: `<dialog>` con `showModal()` (foco atrapado y `Escape` nativos), título, mensaje, botones "Cancelar" y "Eliminar". jsdom no implementa `showModal`: la prueba lo simula en `test/setup.ts` de forma mínima (`open` + eventos `close`), documentado allí.

**Marcador del listado**: `BooksPage` añade el enlace "Nuevo libro" (C8.9). `books-listing` lo conserva dentro de su cabecera.

## 7. Seguridad
- Autorización: toda ruta exige token por el guard global; la prueba HTTP de `auth` que recorre el OpenAPI y exige 401 salvo en las públicas cubre automáticamente las rutas nuevas.
- Entrada: `whitelist` + `forbidNonWhitelisted`; longitudes máximas; cuerpo ≤ 100 KB; `ParseUUIDPipe` en `:id`; `search` acotado a 100 caracteres. Sin SQL en crudo: el `contains` de Prisma va parametrizado.
- Salida: React escapa los textos del libro; no se usa `dangerouslySetInnerHTML`. `imageUrl` no es editable por el cliente en esta spec (la fija `book-image-upload`), de modo que no puede inyectarse una URL arbitraria en `<img src>`.
- Logs: el middleware HTTP no registra cuerpos (C7.4); los errores de validación no repiten el valor recibido.

## 8. Dependencias
Ninguna nueva. Backend: `class-validator`, `class-transformer`, `@nestjs/swagger` (`PartialType`) y `@prisma/client` ya están. Frontend: Axios, TanStack Query, React Hook Form, Zod y React Router ya están.

## 9. Estrategia de pruebas
- **Unitarias (backend):** `BooksService` (alta, edición parcial, `PATCH` vacío, 404, duplicado → 409, baja lógica, y que un fallo del segundo paso propaga el error sin escribir el libro), `CatalogService` (listado con y sin `search`, resolución: existente sin distinguir mayúsculas, nuevo con `upsert`), extensión de borrado lógico (fusión de `where` en cada operación, respeto de `deletedAt` explícito, otros modelos intactos), mapper, DTOs (cada regla de C2.2 y la normalización), controladores, y la prueba de arquitectura sobre `prisma.live`.
- **HTTP con Passport real (backend):** las rutas nuevas responden 401 sin token; flujo con servicio simulado: `POST` válido e inválido, `GET`, `PATCH`, `DELETE` 204 y 404 posterior, `:id` no UUID.
- **Contra PostgreSQL real (C-07, manual y registrado):** migración desde cero; los índices existen; duplicado real → 409 (cierra la salvedad 2 de `platform`); reversión (un fallo después de crear un autor no deja el autor); dos altas simultáneas con la misma editorial nueva dejan una sola fila; el libro eliminado no se ve y puede volver a registrarse; `EXPLAIN` del índice `pg_trgm`; `prisma migrate diff` sin intentar borrar los índices manuales.
- **Unitarias (frontend):** servicios, esquema Zod (cada regla y borde del precio), `useDebounce` (temporizadores simulados), `BookForm` (validación, éxito, 400 por campo, 409, red, doble envío, foco), `CatalogField`, páginas de alta/edición/detalle (carga, 404, éxito y navegación, invalidación de caché), `ConfirmDialog` y el cierre con `Escape`.
- **Punta a punta (manual, Docker + navegador real, C-13):** alta, validaciones en la pantalla, duplicado, edición, detalle, eliminación y 404 posterior.

## 10. Mejoras futuras (documentadas, no implementadas)
- Control de concurrencia optimista (`version` + `If-Match`) para que dos editores no se pisen.
- Un índice único insensible a mayúsculas también en los catálogos (`lower(name)`), para cerrar la carrera de dos nombres que solo difieren en mayúsculas.
- Pantalla de administración de catálogos (renombrar, fusionar duplicados, borrar sin libros).
- Varios autores por libro (relación N:M) y ISBN como identificador.
- Papelera con restauración de libros eliminados y borrado definitivo programado.
- Moneda configurable.
