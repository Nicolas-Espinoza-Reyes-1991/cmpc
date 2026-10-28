# Spec books-export-csv: Tareas

Reglas: seguir el orden; una tarea está hecha solo cuando su criterio se cumple y sus pruebas pasan. Un commit por tarea (formato convencional, en inglés).
Antes de cada tarea se leen `requirements.md` y `design.md`; cada cambio de decisión se refleja en `design.md`.
Marcar con `[x]` al terminar.

## Backend
- [x] **X-01 Dependencia y codificación del CSV** (X2.1 a X2.6, X5.1)
  - Instalar `fast-csv` (ya previsto en `tech-stack.md`; línea CommonJS 5.x) y escribir `book-csv.ts`: columnas, `toCsvRow`, `escapeCsvCell`, `csvFileName` y `CSV_BOM`.
  - Pruebas: cada columna y su formato; `Sí`/`No`; precio con y sin decimales; fechas ISO; cada carácter peligroso de la inyección de fórmulas, en medio del texto (no se toca) y texto vacío; el nombre del archivo.
  - Hecho cuando: `lint`, `tsc`, build, `test:cov` y `npm audit --omit=dev` (sin hallazgos nuevos de `fast-csv`) pasan.
  - Commit: `feat(books): add the CSV encoding of a book`

- [ ] **X-02 Lectura por lotes** (X1.2, X1.4, X3.1, X3.2, X3.5)
  - `ExportBooksQueryDto` (`PickType` del DTO del listado) y `BooksService.exportRows`, un generador asíncrono con cursor y lotes de 500.
  - Pruebas: un lote, varios lotes con el cursor, lote exacto de 500, vacío, mismos filtros y orden que el listado, `id` como último criterio, el generador no pide más lotes si el consumidor se detiene.
  - Commit: `feat(books): add batched reading of the books to export`

- [ ] **X-03 Endpoint** (X1.1, X1.3, X1.5, X1.6, X3.3, X3.4)
  - `GET /api/books/export` con `@RawResponse()`, cabeceras, tubería `Readable.from` → `fast-csv` → respuesta con `pipeline`, Swagger y manejo de errores y cierres.
  - Pruebas HTTP con Passport real que leen y analizan el CSV recibido (encabezado, BOM, filas, comillas, saltos de línea, acentos, fórmulas escapadas, cabeceras, 401, 400, vacío, `export` no tomada por `:id`, error a mitad, cierre del cliente).
  - Commit: `feat(books): add the CSV export endpoint`

- [ ] **X-04 Verificación contra PostgreSQL real** (X5.4)
  - Backend compilado: el CSV coincide con el listado para varios filtros y órdenes; con 300.000 libros la memoria no crece y los primeros bytes llegan enseguida; el archivo se relee con un analizador y coincide con la base; título con fórmula escapado; cierre del cliente a mitad sin dejar la base ocupada.
  - Hecho cuando: cada comprobación queda en el registro de verificación.
  - Commit: `docs(books-export-csv): record the backend verification`

## Frontend
- [ ] **X-05 Servicio, utilidades y botón** (X4.1 a X4.6, X5.2)
  - `exportBooksCsv`, `fileNameFromDisposition`, `saveBlob`, `useExportBooks` y el botón «Exportar CSV» en `BooksPage`.
  - Pruebas: parámetros sin `page`/`limit`; nombre de la cabecera y el de respaldo; recorte de rutas; descarga con enlace temporal y `revokeObjectURL`; botón con filtros vigentes, «Exportando…», una descarga a la vez, error con reintento y listado intacto.
  - Commit: `feat(frontend): add the CSV export button to the books page`

## Integración y cierre
- [ ] **X-06 Verificación de punta a punta** (X5.4)
  - Docker y navegador real: descargar con y sin filtros y con otro orden, capturar el archivo y compararlo con la tabla; título con fórmula; error de sesión; botón con resultado vacío.
  - Hecho cuando: cada escenario queda anotado.
  - Commit: `docs(books-export-csv): record the end-to-end verification`

- [ ] **X-07 Verificación de la spec**
  - Recorrer X1 a X5 con evidencia nueva (lint, tipos, build, cobertura ≥ 80 % y fallando por debajo en ambas apps; `npm audit`) y registrar el resultado.
  - Commit: `docs(books-export-csv): record the spec verification`

## Registro de verificación
(Se completa en X-04, X-06 y X-07.)
