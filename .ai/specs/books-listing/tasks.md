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
- [ ] **L-05 Contrato, parámetros en la URL y consulta** (L4.7, L4.9, L4.11, L6.2)
  - Tipos, `listBooks`, `book-list-params.ts`, `useBookListParams`, `useBooks`.
  - Pruebas: servicio; lectura con valores inválidos descartados; escritura mínima; `cycleSort`; cambios que vuelven a la página 1; el hook con la API simulada.
  - Commit: `feat(frontend): add list parameters in the URL and the books query`

- [ ] **L-06 Tabla, filtros, paginación y página** (L4.1 a L4.6, L4.8, L4.10)
  - `BookTable`, `BookFilters`, `Pagination` y `BooksPage` con los estados de carga, error y vacío.
  - Pruebas: encabezados ordenables con prioridades y `aria-sort`; búsqueda con espera; filtros combinados; paginación y tamaño de página; estados; accesibilidad básica.
  - Commit: `feat(frontend): add the books table with filters, sorting and pagination`

## Integración y cierre
- [ ] **L-07 Verificación de punta a punta** (L6.4)
  - Docker y navegador real con varios libros: búsqueda con espera, filtros, orden múltiple, paginación, recarga, «Atrás» y enlace compartido.
  - Hecho cuando: cada escenario queda anotado.
  - Commit: `docs(books-listing): record the end-to-end verification`

- [ ] **L-08 Verificación de la spec**
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
