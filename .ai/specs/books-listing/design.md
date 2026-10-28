# Spec books-listing: Diseño

Implementa los requisitos de `requirements.md`. Los códigos L# remiten a ese archivo.

## 1. Decisiones (a revisar: esta spec se implementó sin la pausa de aprobación)

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Los filtros de autor, editorial y género son **texto que contiene** (sin distinguir mayúsculas), con sugerencias de los catálogos | Listas desplegables por id | Una lista exige cargar el catálogo completo (la API de catálogos limita a 50) y no escala; el texto con sugerencias escala y es coherente con el formulario. Se pierde el "elegir de una lista cerrada"; queda como mejora futura un *combobox* con búsqueda |
| `sort` es una lista `campo:dirección` separada por comas (`sort=genre:asc,price:desc`) | `sort` repetido, o `orderBy`/`order` por separado | Un solo parámetro conserva el orden de prioridad, es legible en la URL y se valida en un único punto |
| `id` siempre es el último criterio de orden | Confiar en el orden natural de PostgreSQL | Sin un desempate único, dos libros con el mismo precio pueden aparecer en cualquier orden y la paginación repetiría u omitiría filas entre páginas |
| Orden por defecto `createdAt` descendente | Por título | Lo recién registrado es lo que el administrador quiere ver primero |
| El estado de la vista (búsqueda, filtros, orden, página) vive en la **URL** (`useSearchParams`) | Estado local del componente | Recargar, «Atrás» y compartir un enlace conservan la vista; no hay que sincronizar dos fuentes de verdad |
| Cualquier cambio de búsqueda, filtro, orden o tamaño de página vuelve a la página 1 | Mantener la página | Con menos resultados la página actual puede no existir |
| Conteo y datos en dos consultas (`count` y `findMany`) dentro de una misma `$transaction` | Una consulta con `COUNT(*) OVER()` en SQL crudo | `platform` R3.2 prohíbe SQL crudo; la transacción da una lectura coherente entre ambas |
| `limit` máximo 100 | Sin tope | Evita que una petición pida la tabla entera (L5.2) |
| Tamaños de página 10, 20 y 50 en la interfaz | Libre | Opciones predecibles; la API admite hasta 100 |
| Mientras llega una página nueva se conserva la anterior (`keepPreviousData`) | Vaciar la tabla con un «cargando» | Evita el parpadeo al paginar o escribir |

## 2. Backend

```
backend/src/books/
├── book-list.query.ts          # buildBookWhere, parseSort, buildBookOrderBy (funciones puras)
├── dto/list-books-query.dto.ts # page, limit, search, author, publisher, genre, availability, sort
└── books.service.ts / books.controller.ts   # findAll y GET /books
```

- **`ListBooksQueryDto`**: `page` (`@Type(Number)`, `@IsInt`, `@Min(1)`, 1), `limit` (`@IsInt`, `@Min(1)`, `@Max(100)`, 10); `search`, `author`, `publisher`, `genre` (`trimText`, `@IsString`, `@MaxLength(100)`, opcionales); `availability` (`'true' | 'false'` → booleano con `@Transform`, `@IsBoolean` cuando viene); `sort` (`@IsString`, validado con `parseSort` mediante un validador propio para que el error salga por el campo `sort`).
- **`buildBookWhere(query)`** (función pura, principio abierto/cerrado de `architecture.md`): devuelve un `Prisma.BookWhereInput` con `AND` de las condiciones presentes: `title contains escapeLike(search) insensitive`, `author: { name: contains … }`, `publisher`, `genre`, `availability: equals`. Un texto vacío no añade condición. `deletedAt` lo añade `prisma.live`, no esta función.
- **`escapeLike`** se extrae de `catalog.service.ts` a `common/utils/escape-like.ts` porque ahora lo usan dos módulos (lo anticipaba `books-crud/design.md` §4).
- **`parseSort(text)`** devuelve una lista de `{ field, direction }` validada: campos permitidos (`SORT_FIELDS`), direcciones, sin repetidos y como máximo 4; lanza un error con el motivo. **`buildBookOrderBy(sort)`** la traduce a `Prisma.BookOrderByWithRelationInput[]` (`author` → `{ author: { name: dir } }`, igual para editorial y género; `createdAt` y el resto, directos), con `createdAt desc` si no hay criterios y `{ id: 'asc' }` al final.
- **`BooksService.findAll(query)`**: `const where = buildBookWhere(query)`; `prisma.live.$transaction([book.count({ where }), book.findMany({ where, orderBy, skip: (page-1)*limit, take: limit, include: BOOK_INCLUDE })])`; devuelve `{ items: books.map(toBookDto), meta: { page, limit, total } }`, que el interceptor transforma en `{ data, meta }`.
- **`BooksController`**: `@Get()` con `@Query() query: ListBooksQueryDto`; Swagger documenta cada parámetro (`@ApiPropertyOptional`), el formato de `sort` con ejemplo y la respuesta `{ data, meta }` (`PaginatedBooksDto` para el esquema).
- **Índices**: el filtro por título usa `books_title_trgm_idx`; los de relación usan los índices de clave foránea; `availability` tiene el suyo. Las columnas del `ORDER BY` combinadas no tienen un índice dedicado: con la escala de una tienda un orden en memoria sobre las filas ya filtradas es adecuado; añadir índices compuestos por patrón de orden queda como mejora futura.

## 3. Frontend

```
frontend/src/
├── types/book.ts                 # + BookListParams, BookSort, SortField, SortDirection, Page<T>
├── services/books.service.ts     # + listBooks(params, signal)
├── lib/book-list-params.ts       # leer/validar/escribir los parámetros en la URL (puro)
├── hooks/useBookListParams.ts    # useSearchParams + funciones de cambio (vuelven a la página 1)
├── hooks/useBooks.ts             # useQuery(['books','list',params]) con keepPreviousData
├── components/
│   ├── BookTable.tsx             # tabla con encabezados ordenables y prioridades
│   ├── BookFilters.tsx           # búsqueda, autor, editorial, género y disponibilidad
│   └── Pagination.tsx            # anterior/siguiente, «Página X de Y», total y tamaño de página
└── pages/BooksPage.tsx           # compone todo; estados de carga, error y vacío
```

- **`book-list-params.ts`**: `readParams(searchParams)` produce los valores válidos y descarta los inválidos (L4.9): `page` entero ≥ 1; `limit` ∈ {10, 20, 50}; `search`/`author`/`publisher`/`genre` recortados; `availability` ∈ {`true`, `false`}; `sort` solo con campos y direcciones conocidos, sin repetidos y hasta 4. `writeParams(params)` deja en la URL solo lo que difiere del valor por defecto, para URLs cortas. `toApiQuery(params)` produce lo que se envía al API (`sort` como `campo:dirección,…`).
- **Orden por clic**: `cycleSort(sort, field)` pasa de «sin orden» a ascendente, a descendente y de nuevo a «sin orden»; al activar una columna nueva se añade al final (menor prioridad) y al quitarla las demás suben. El encabezado muestra la flecha y, si hay más de un criterio, su número. `aria-sort` lleva `ascending`/`descending`/`none`.
- **Búsqueda con espera**: el cuadro mantiene su propio texto y `useDebounce(texto, 300)` actualiza la URL; así escribir no vuelve a renderizar la tabla por tecla ni cambia la URL por tecla. Lo mismo para los tres filtros de texto.
- **Sugerencias de los filtros**: reutilizan `useCatalogOptions` y el `<datalist>` de `CatalogField`; se extrae un campo base común si hace falta para no duplicar el código.
- **`useBooks(params)`**: clave `['books', 'list', params]` (dentro de la familia `['books']` que invalidan alta, edición y baja), `placeholderData: keepPreviousData`; el error NO se silencia a nivel global porque la página lo muestra ella misma (`meta.silent`).
- **`BooksPage`**: cabecera con «Libros» y «Nuevo libro»; `BookFilters`; región `role="status"` con «N resultados»; `BookTable` (con `aria-busy` mientras carga una página nueva); `Pagination`; estados vacío y de error (L4.8).

## 4. Pruebas

- **Unitarias (backend):** `buildBookWhere` (cada filtro, combinaciones, vacío, comodines escapados), `parseSort`/`buildBookOrderBy` (válido, defecto, `id` al final, campos relacionados, cada error), `ListBooksQueryDto` (cada regla, con el `ValidationPipe` de la aplicación), `findAll` (cálculo de `skip`/`take`, `meta`, mapeo) y el controlador.
- **HTTP con Passport real (backend):** 401 sin token, 200 con `data` y `meta`, 400 por `limit=101`, `page=0`, `availability=maybe`, `sort=foo:asc`, `sort` repetido y de más de 4 criterios.
- **Contra PostgreSQL real:** sin repeticiones ni omisiones al recorrer todas las páginas con un orden que empata (`price`); filtros combinados; comodines; eliminados fuera; página fuera de rango; `EXPLAIN` del filtro por título con muchas filas.
- **Unitarias (frontend):** servicio, `book-list-params` (lectura, valores inválidos, escritura mínima), `cycleSort`, `BookTable`, `Pagination`, `BookFilters` y la página completa con la API simulada.
- **Punta a punta:** Docker + navegador real con varios libros (búsqueda con espera, filtros, orden múltiple, paginación, recarga con URL, «Atrás»).

## 5. Mejoras futuras
- *Combobox* con búsqueda para autor, editorial y género.
- Índices compuestos según los patrones de orden más usados, o paginación por cursor si el catálogo crece mucho.
- Filtros por rango de precio y de fechas; selección de filas y acciones en lote; columnas configurables.
