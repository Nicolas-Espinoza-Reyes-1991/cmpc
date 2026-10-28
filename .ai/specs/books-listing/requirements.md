# Spec books-listing: Requisitos

Cubre los IDs del enunciado: **FE-2a, FE-2b, FE-2c, FE-2d**. Relacionados: BE-3 (el listado es un endpoint REST más), DB-1 (índices que el listado aprovecha), T-1, T-2, T-3 (pruebas).
Depende de `books-crud` (modelos, `prisma.live`, catálogos, `BookDto`, formulario y detalle) y de `platform` (interceptor `{ data, meta }`).

Formato: CUANDO <evento>, EL SISTEMA DEBERÁ <respuesta>. Cada criterio es verificable.

> **Nota sobre el proceso.** Esta spec se redactó y se implementó sin la pausa de aprobación que pide `CLAUDE.md`, por indicación expresa del usuario (trabajo autónomo durante la noche). Las decisiones que habrían ido a aprobación están en `design.md` §1 para su revisión.

## Fuera de alcance
- Exportación a CSV (spec `books-export-csv`; reutilizará los mismos filtros).
- Selección múltiple de filas, acciones en lote y columnas configurables.
- Búsqueda en autor o editorial (la búsqueda de texto es solo por título, como define `product.md`).
- Filtros por rango de precio o de fechas (mejora futura).

## L1. Endpoint del listado (BE-3, FE-2c)
- L1.1 CUANDO se envíe `GET /api/books`, EL SISTEMA DEBERÁ responder 200 con `{ data: Book[], meta: { page, limit, total } }`, donde `total` es el número de libros activos que cumplen los filtros (no solo los de la página).
- L1.2 EL SISTEMA DEBERÁ aceptar `page` (entero ≥ 1, 1 por defecto) y `limit` (entero de 1 a 100, 10 por defecto) y rechazar otros valores con 400 y el error por campo.
- L1.3 CUANDO `page` sobrepase la última página, EL SISTEMA DEBERÁ responder 200 con `data: []` y el `total` real (no un error).
- L1.4 El listado NO DEBERÁ incluir libros eliminados (los filtra `prisma.live`) y DEBERÁ exigir token como el resto de las rutas.

## L2. Filtros y búsqueda (FE-2a, FE-2d)
- L2.1 EL SISTEMA DEBERÁ aceptar `search` y devolver los libros cuyo título contiene ese texto, sin distinguir mayúsculas; los comodines de `LIKE` (`%`, `_`, `\`) DEBERÁN tratarse como texto literal.
- L2.2 EL SISTEMA DEBERÁ aceptar `author`, `publisher` y `genre` y devolver los libros cuyo autor, editorial o género contiene ese texto, sin distinguir mayúsculas y con los comodines escapados.
- L2.3 EL SISTEMA DEBERÁ aceptar `availability` (`true` o `false`) y devolver solo los libros con esa disponibilidad; cualquier otro valor DEBERÁ rechazarse con 400.
- L2.4 CUANDO se combinen varios filtros, EL SISTEMA DEBERÁ aplicarlos todos a la vez (Y lógico).
- L2.5 Los textos de `search`, `author`, `publisher` y `genre` DEBERÁN normalizarse (espacios en los extremos y repetidos) y tener como máximo 100 caracteres; un texto vacío DEBERÁ equivaler a no filtrar.
- L2.6 La búsqueda por título DEBERÁ usar el índice `pg_trgm` existente (se comprueba con `EXPLAIN`).

## L3. Orden por múltiples campos (FE-2b)
- L3.1 EL SISTEMA DEBERÁ aceptar `sort` como una lista separada por comas de `campo:dirección`, por ejemplo `sort=genre:asc,price:desc`, y aplicar los criterios en ese orden de prioridad.
- L3.2 Los campos permitidos DEBERÁN ser `title`, `author`, `publisher`, `genre`, `price`, `availability` y `createdAt`; la dirección, `asc` o `desc`. CUANDO aparezca otro campo, otra dirección, un campo repetido o más de 4 criterios, EL SISTEMA DEBERÁ responder 400.
- L3.3 SIN `sort`, EL SISTEMA DEBERÁ ordenar por `createdAt` descendente (lo más nuevo primero).
- L3.4 EL SISTEMA DEBERÁ añadir siempre `id` como último criterio, de modo que el orden sea determinista y una página no repita ni omita libros respecto de la siguiente.

## L4. Pantalla del listado (FE-2a a FE-2d)
- L4.1 EL SISTEMA DEBERÁ mostrar en `/books` una tabla con título (enlace al detalle), autor, editorial, género, precio con formato y disponibilidad, y conservar el enlace «Nuevo libro».
- L4.2 EL SISTEMA DEBERÁ ofrecer un cuadro de búsqueda por título que consulte al servidor solo cuando el usuario deja de escribir (300 ms), sin una petición por tecla.
- L4.3 EL SISTEMA DEBERÁ ofrecer filtros de autor, editorial y género con sugerencias de los catálogos, y un filtro de disponibilidad (todos, disponibles, no disponibles).
- L4.4 CUANDO el usuario pulse el encabezado de una columna, EL SISTEMA DEBERÁ recorrer ascendente → descendente → sin orden para esa columna; el orden de activación fija la prioridad y cada columna activa DEBERÁ mostrar su dirección y su número de prioridad (`aria-sort` en el encabezado). Un botón «Quitar orden» DEBERÁ limpiar todos.
- L4.5 EL SISTEMA DEBERÁ paginar en el servidor: «Anterior» y «Siguiente» (deshabilitados en los extremos), «Página X de Y», el total de resultados y un selector de libros por página (10, 20, 50).
- L4.6 CUANDO cambie la búsqueda, un filtro, el orden o los libros por página, EL SISTEMA DEBERÁ volver a la página 1.
- L4.7 EL SISTEMA DEBERÁ guardar búsqueda, filtros, orden y página en la URL, de modo que recargar, el botón «Atrás» y compartir el enlace conserven la vista.
- L4.8 MIENTRAS se carga una consulta nueva, EL SISTEMA DEBERÁ mantener visibles los resultados anteriores (`aria-busy`); CUANDO falle, mostrar el mensaje con «Reintentar»; CUANDO no haya resultados, mostrar «No hay libros todavía» con un enlace para registrar el primero (sin filtros) o «Ningún libro coincide con los filtros» (con filtros; el botón «Limpiar filtros» de la barra de filtros sigue a la vista).
- L4.9 CUANDO la URL traiga valores inválidos (página 0, orden desconocido, disponibilidad extraña), EL SISTEMA DEBERÁ ignorarlos y usar los valores por defecto, sin error.
- L4.10 EL SISTEMA DEBERÁ ser accesible: etiquetas en los controles, encabezados ordenables como botones con `aria-sort`, y un anuncio (`role="status"`) del número de resultados.
- L4.11 Tras guardar o eliminar un libro, el listado DEBERÁ mostrar los datos al día (las consultas de libros se invalidan, como ya hacen `books-crud`).

## L5. Rendimiento
- L5.1 EL SISTEMA DEBERÁ resolver el listado con una consulta de datos y una de conteo, ambas sobre columnas indexadas (`deletedAt`, claves foráneas, `availability` y el índice `pg_trgm` del título).
- L5.2 EL SISTEMA DEBERÁ devolver en cada petición como máximo `limit` libros (nunca la tabla entera).

## L6. Pruebas (T-1, T-2, T-3)
- L6.1 El backend DEBERÁ tener pruebas unitarias de `buildBookWhere`, `parseSort`/`buildBookOrderBy`, `ListBooksQueryDto`, `BooksService.findAll` y el controlador, y pruebas HTTP con Passport real (401 sin token, 200 con `meta`, 400 por parámetros inválidos).
- L6.2 El frontend DEBERÁ tener pruebas del servicio, del estado en la URL (lectura, validación y escritura), de la tabla (orden y prioridades), de la paginación, de los filtros y de la página completa (búsqueda con espera, filtros combinados, orden múltiple, paginación y estados vacío, error y carga).
- L6.3 La cobertura DEBERÁ seguir en 80 % o más en ambas aplicaciones.
- L6.4 EL SISTEMA DEBERÁ verificarse contra PostgreSQL real (orden determinista entre páginas, filtros combinados, comodines, eliminados fuera, `EXPLAIN` del índice con muchas filas) y de punta a punta en un navegador real con Docker.
