# Spec books-listing: Tareas

Reglas: seguir el orden; una tarea está hecha solo cuando su criterio se cumple y sus pruebas pasan. Un commit por tarea (formato convencional, en inglés).
Antes de cada tarea se leen `requirements.md` y `design.md`; cada cambio de decisión se refleja en `design.md`.
Marcar con `[x]` al terminar.

## Backend
- [x] **L-01 Funciones puras del listado** (L2.1 a L2.5, L3.1 a L3.4, L6.1)
  - `common/utils/escape-like.ts` (extraído de `catalog.service.ts`), `book-list.query.ts` con `buildBookWhere`, `parseSort` y `buildBookOrderBy`.
  - Pruebas: cada filtro y sus combinaciones; texto vacío; comodines escapados; orden por defecto; `id` al final; campos relacionados; cada error de `parseSort`.
  - Commit: `feat(books): add pure functions to build the list filters and order`

- [x] **L-02 DTO de consulta** (L1.2, L2.3, L2.5, L3.2)
  - `ListBooksQueryDto` con sus valores por defecto y validación de `sort`.
  - Pruebas con el `ValidationPipe` de la aplicación: cada parámetro válido e inválido, normalización y límites.
  - Commit: `feat(books): add the list query DTO`

- [x] **L-03 Servicio y controlador del listado** (L1.1, L1.3, L1.4, L5.1, L5.2)
  - `BooksService.findAll`, `GET /api/books` con Swagger y `PaginatedBooksDto`.
  - Pruebas: `skip`/`take`/`meta`; página fuera de rango; HTTP con Passport real (401, 200 con `meta`, 400 por parámetros inválidos); el e2e de `auth` sigue exigiendo 401.
  - Commit: `feat(books): add the paginated books listing endpoint`

- [x] **L-04 Verificación contra PostgreSQL real** (L2.6, L6.4)
  - Backend compilado contra una base nueva con muchas filas: recorrer todas las páginas con un orden que empata sin repeticiones ni omisiones; filtros combinados; comodines; eliminados fuera; página fuera de rango; `EXPLAIN` del filtro por título.
  - Hecho cuando: cada comprobación queda en el registro de verificación.
  - Commit: `docs(books-listing): record the backend verification`

## Frontend
- [x] **L-05 Contrato, parámetros en la URL y consulta** (L4.7, L4.9, L4.11, L6.2)
  - Tipos, `listBooks`, `book-list-params.ts`, `useBookListParams`, `useBooks`.
  - Pruebas: servicio; lectura con valores inválidos descartados; escritura mínima; `cycleSort`; cambios que vuelven a la página 1; el hook con la API simulada.
  - Commit: `feat(frontend): add list parameters in the URL and the books query`

- [x] **L-06 Tabla, filtros, paginación y página** (L4.1 a L4.6, L4.8, L4.10)
  - `BookTable`, `BookFilters`, `Pagination` y `BooksPage` con los estados de carga, error y vacío.
  - Pruebas: encabezados ordenables con prioridades y `aria-sort`; búsqueda con espera; filtros combinados; paginación y tamaño de página; estados; accesibilidad básica.
  - Commit: `feat(frontend): add the books table with filters, sorting and pagination`

## Integración y cierre
- [x] **L-07 Verificación de punta a punta** (L6.4)
  - Docker y navegador real con varios libros: búsqueda con espera, filtros, orden múltiple, paginación, recarga, «Atrás» y enlace compartido.
  - Hecho cuando: cada escenario queda anotado.
  - Commit: `docs(books-listing): record the end-to-end verification`

- [x] **L-08 Verificación de la spec**
  - Recorrer L1 a L6 con evidencia nueva (lint, tipos, build, cobertura ≥ 80 % y fallando por debajo en ambas apps) y registrar el resultado.
  - Commit: `docs(books-listing): record the spec verification`

## Registro de verificación
(Se completa en L-04, L-07 y L-08.)

### L-04: listado contra PostgreSQL real (2026-10-29)
Entorno: PostgreSQL 16 del contenedor de desarrollo; base **nueva** migrada con `migrate deploy` (eliminada al terminar); `BooksService` real compilado. Datos: 30 autores, 10 editoriales, 12 géneros y 5.000 libros con solo 5 precios distintos (muchos empates), cuyos títulos incluyen `100%`, `a_b` y `Dune`; después 300.000 libros más para los planes.

| Comprobación | Resultado |
|---|---|
| Recorrer **todas** las páginas con un orden que empata (`price:asc`, 100 por página) | 5.000 recogidos, 5.000 distintos: sin repeticiones ni omisiones |
| Igual con `price:desc,availability:asc` (7 por página), `author:asc,genre:desc` (250) y el orden por defecto (50) | 5.000 / 5.000 distintos en los tres |
| Orden pedido frente al mismo `ORDER BY` escrito en SQL (con `id` al final): precio asc + título desc; autor asc + género desc (página 3 de 50); disponibilidad desc + editorial asc + título asc; lo más nuevo primero | Mismos ids en el mismo orden en los 4 casos |
| Filtros combinados frente al conteo directo en SQL (título; título + disponibilidad; autor + editorial; género + disponibilidad + título; disponibilidad; sin coincidencias) | `total` idéntico en los 6 (714, 476, 167, 91, 1.666 y 0) y la página trae `min(100, total)` filas |
| Comodines: `100%`, `a_b` y `%` solos | Se tratan como texto: 51, 56 y el total de títulos con `%`, iguales al `LIKE` escapado en SQL; todas las filas contienen el texto |
| Eliminar 123 libros | `total` baja de 5.000 a 4.877; el recorrido completo recoge 4.877 distintos |
| Página 9.999 | `items: []` con el `total` real (4.877), sin error |
| Una página nunca trae más de `limit` | 100 con `limit=100` |
| `EXPLAIN` del filtro por título con 304.877 libros | `Bitmap Index Scan on books_title_trgm_idx`, 2,8 ms |

Tiempos con 304.877 libros (incluyen conteo y página): título raro `a1b2c3d4` (trigrama) **10 ms**; autor + editorial + género **113 ms**; orden `genre:asc,price:desc` en la página 100 **205 ms**; disponibilidad + `price:desc` en la página 500 **231 ms**; orden por defecto **418 ms** y búsqueda del texto más común (`relleno`, 300.000 coincidencias) **542 ms**. El conteo recorre todas las filas que cumplen el filtro, así que el costo crece con el tamaño del resultado, no con la página. Es holgado para el tamaño de una tienda; con millones de libros se resolvería con un conteo estimado o paginación por cursor (anotado como mejora futura en `design.md` §5).

Hallazgo de método: una de mis comprobaciones daba `false` para el orden por precio y título. Era un error de la comprobación (comparé títulos con el orden de JavaScript, no con la colación de la base); contra el mismo `ORDER BY` en SQL el resultado coincide. El código no cambió.

### L-07: recorrido de punta a punta con Docker y navegador real (2026-10-29)
Entorno: `docker compose up` (db, backend y frontend sanos), navegador integrado, administrador sembrado y **37 libros creados por la API real** (5 autores, 3 editoriales, 4 géneros, 4 precios que empatan). Se comprobó leyendo el DOM, las peticiones XHR reales y la base. Al terminar se borraron los datos y se detuvo el stack.

| Escenario | Resultado |
|---|---|
| Abrir `/books` | "37 resultados", "Página 1 de 4", 10 filas, lo más nuevo primero; todas las columnas con `aria-sort="none"` |
| Escribir `cien años` letra a letra (70 ms entre teclas) | **0 peticiones mientras se escribe y 1 tras la pausa** (`search=cien+años`); la URL pasa a `?q=cien+años` y a los ~1 s la tabla muestra "1 resultado" |
| Autor `allende` | Una petición `author=allende`; 8 resultados; URL `?author=allende` |
| Disponibilidad "Disponibles" sobre el filtro anterior | Una petición con `author` y `availability=true`; 5 resultados |
| Orden: Género, luego Precio dos veces | URL `?sort=genre:asc,price:desc`; encabezados `Género↑1` (ascending) y `Precio↓2` (descending); el orden de la página verificado fila a fila en el DOM |
| «Quitar orden» | Sin orden en la URL ni en los encabezados; vuelve lo más nuevo primero |
| Paginación | Siguiente → `?page=2` (10 filas); hasta la página 4 (7 filas) con "Siguiente" deshabilitado; "Anterior" deshabilitado en la 1 |
| Tamaño de página 20 desde la página 4 | Vuelve a la 1: "Página 1 de 2", 20 filas, `?limit=20` |
| Botón Atrás del navegador | Vuelve a la vista anterior (`?page=4`) |
| `/books?page=99` | Muestra la última página ("Página 4 de 4", 7 filas) y reemplaza la URL por `?page=4` |
| `/books?page=0&limit=7&sort=foo:asc&availability=maybe` | Vista por defecto (37 resultados, 10 filas, tamaño 10), sin error |
| Abrir un libro de la lista y eliminarlo | Al volver a `/books` el conteo baja a 36 sin recargar |
| Registrar un libro nuevo | Al volver al listado el conteo sube a 37 y el nuevo libro aparece primero, sin recargar |

**Hallazgos de la verificación real**
- La primera carga mostró "No se encontró el recurso solicitado": la **imagen de Docker del backend estaba desactualizada** (solo había reconstruido el frontend y el endpoint del listado es posterior). Se reconstruyó con `docker compose build backend` y funcionó. Conclusión de método: tras cambiar el backend hay que reconstruir su imagen; `docker compose up --build` lo hace siempre.
- Un instante de la búsqueda mostraba aún 37 resultados: era una captura mía antes de que llegara la respuesta; midiendo cada 200 ms la tabla pasó a 1 resultado a los ~1.000 ms (pausa de 300 ms más la respuesta). No es un defecto.
- El `docker compose up --build` del frontend falló una vez con un error de caché de Docker (`parent snapshot ... does not exist`); `docker compose build frontend` inmediatamente después terminó bien (transitorio, como el de `npm ci` en C-11).

### L-08: verificación de la spec (2026-10-29)
Evidencia nueva de esta sesión: backend `lint`, `tsc` y build limpios, `test:cov` (**36 suites, 537 pruebas, 100 %**) y e2e (**8**); frontend `lint`, `tsc -b` y build limpios, `test:cov` (**37 archivos, 553 pruebas, 100 %** en sentencias, ramas, funciones y líneas); más los registros L-04 y L-07.

| Criterio | Evidencia |
|---|---|
| L1.1–L1.4 | Pruebas de servicio, controlador y HTTP con Passport real (200 con `{ data, meta }`, 401 sin token, 400 por parámetros inválidos, página fuera de rango → 200 vacía); L-04 con base real (página 9.999 vacía con el `total` real; eliminados fuera) |
| L2.1–L2.6 | `buildBookWhere` y DTO con cada regla; L-04: filtros combinados iguales al conteo directo en SQL, comodines `%`, `_` como texto y `EXPLAIN` con el índice `pg_trgm` (2,8 ms con 304.877 libros) |
| L3.1–L3.4 | `parseSort`, `buildBookOrderBy` y DTO; L-04: el orden de la API coincide con el mismo `ORDER BY` en SQL y recorre todas las páginas de un orden que empata sin repeticiones ni omisiones |
| L4.1–L4.11 | `BookTable`, `BookFilters`, `Pagination`, `useBookListParams`, `useUrlBoundText` y `BooksPage` (30 pruebas de integración); L-07 en el navegador real: 0 peticiones al escribir y 1 tras la pausa, orden con prioridades, paginación, URL, Atrás, página fuera de rango, valores inválidos, y el listado al día tras eliminar y crear |
| L5.1–L5.2 | Una consulta de conteo y una de datos en una transacción, con `take` ≤ 100 (L-04: nunca más de `limit` filas; con 304.877 libros entre 10 ms y ~540 ms) |
| L6.1–L6.4 | Suites citadas; cobertura 100 % en ambas apps; el umbral forzado a 101 % falla en las dos ("does not meet global threshold"); L-04 y L-07 contra PostgreSQL, Docker y navegador reales |

Resultado: sin criterios pendientes.

Defectos que halló la verificación (corregidos y con prueba): dos cambios de URL seguidos perdían el primero (la forma funcional de `setSearchParams` no los encola); la prueba de `router.spec` que simulaba la expiración con un 401 en `GET /books` dejó de ser válida cuando la página empezó a pedir su lista al abrirse; y la imagen de Docker del backend desactualizada (método: reconstruirla al cambiar el backend).

Pendientes (no son de esta spec): `npm audit` del backend en producción (el de `multer` se corrige con `book-image-upload`); el aviso de paquete mayor de 500 kB del build del frontend (ahora de 565 kB; carga diferida de rutas); la exportación a CSV con los mismos filtros llega con `books-export-csv`; y las mejoras de `design.md` §5 (combobox con búsqueda para autor, editorial y género; conteo estimado o cursor para millones de libros).
