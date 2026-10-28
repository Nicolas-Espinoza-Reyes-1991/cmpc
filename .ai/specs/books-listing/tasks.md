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

- [ ] **L-04 Verificación contra PostgreSQL real** (L2.6, L6.4)
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
