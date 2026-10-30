# Spec books-export-xlsx: Tareas

Reglas: seguir el orden; una tarea está hecha solo cuando su criterio se cumple y sus pruebas pasan. Un commit por tarea (formato convencional, en inglés).
Antes de cada tarea se leen `requirements.md` y `design.md`; cada cambio de decisión se refleja en `design.md`.
Marcar con `[x]` al terminar.

## Backend
- [x] **E-01 Dependencia y generador del archivo** (E2.1 a E2.5, E5.1)
  - Instalar `write-excel-file` 4.1.1 exacta (CommonJS) y escribir `book-xlsx.ts`: tope, tipo de contenido, nombre del archivo y `buildBooksXlsx`; el ayudante de pruebas que descomprime un `.xlsx`.
  - Pruebas: encabezados y orden, tipos y formatos de precio y fechas, `Sí`/`No`, anchos, fila fija, hoja «Libros», vacío y un título `=HYPERLINK(...)` guardado como texto.
  - Hecho cuando: `lint`, `tsc`, build, `test:cov` y `npm audit --omit=dev` (0) pasan.
  - Commit: `feat(books): add the Excel file builder`

- [x] **E-02 Lectura con tope** (E1.2, E1.3, E3.1 a E3.3)
  - `BooksService.exportAll(query)`: cuenta, rechaza con `UnprocessableEntityException` por encima del tope y comprueba el tope también mientras lee.
  - Pruebas: bajo el tope, exactamente 20.000, 20.001 sin leer, crecimiento durante la lectura, mismos filtros y orden que el listado, fallo de la base.
  - Commit: `feat(books): read the books to export to Excel with a row limit`

- [ ] **E-03 Endpoint** (E1.1 a E1.5, E3.4, E5.1, E5.2)
  - `GET /api/books/export/xlsx` con cabeceras, Swagger y e2e actualizado (15 operaciones).
  - Pruebas HTTP con Passport real que abren el `.xlsx`: columnas, filas, celdas numéricas y de fecha, 401, 400 por `page`, 422 por el tope, vacío, ruta no tomada por `:id`.
  - Commit: `feat(books): add the Excel export endpoint`

- [ ] **E-04 Verificación contra PostgreSQL real** (E5.3)
  - Backend compilado: archivo abierto con `openpyxl` y comparado con la base; mismo orden que el listado; tope con 20.001 libros; tiempo y memoria con 20.000.
  - Commit: `docs(books-export-xlsx): record the backend verification`

## Frontend
- [ ] **E-05 Servicio, hook y botón** (E4.1 a E4.5, E5.1)
  - `exportBooksXlsx`, `useExportBooks` con formato, «Exportar Excel» en `BooksPage`, aviso del tope.
  - Pruebas: parámetros sin `page`/`limit`, `Blob`, nombre, 422 → mensaje, dos botones, «Exportando…» en el correcto, una descarga a la vez, aviso del tope, error con reintento y listado intacto.
  - Commit: `feat(frontend): add the Excel export button to the books page`

## Integración y cierre
- [ ] **E-06 Verificación de punta a punta** (E5.4)
  - Docker y navegador real: descargar el Excel con y sin filtros, abrirlo con `openpyxl`, comprobar columnas, formatos y fila fija; el aviso del tope; ambos botones.
  - Commit: `docs(books-export-xlsx): record the end-to-end verification`

- [ ] **E-07 Documentación**
  - `tech-stack.md` (librería y motivo), README (guía de uso, decisiones, pendientes), `enunciado.md` (la spec en la tabla) y `architecture.md` (flujo de la exportación); enlaces comprobados.
  - Commit: `docs: document the Excel export`

- [ ] **E-08 Verificación de la spec**
  - Recorrer E1 a E5 con evidencia nueva (lint, tipos, build, cobertura ≥ 80 % y fallando por debajo en ambas apps; `npm audit`) y registrar el resultado.
  - Commit: `docs(books-export-xlsx): record the spec verification`

## Registro de verificación
(Se completa al terminar E-04, E-06 y E-08.)
