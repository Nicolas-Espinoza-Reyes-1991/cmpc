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

- [x] **X-02 Lectura por lotes** (X1.2, X1.4, X3.1, X3.2, X3.5)
  - `ExportBooksQueryDto` (`PickType` del DTO del listado) y `BooksService.exportRows`, un generador asíncrono con cursor y lotes de 500.
  - Pruebas: un lote, varios lotes con el cursor, lote exacto de 500, vacío, mismos filtros y orden que el listado, `id` como último criterio, el generador no pide más lotes si el consumidor se detiene.
  - Commit: `feat(books): add batched reading of the books to export`

- [x] **X-03 Endpoint** (X1.1, X1.3, X1.5, X1.6, X3.3, X3.4)
  - `GET /api/books/export` con `@RawResponse()`, cabeceras, tubería `Readable.from` → `fast-csv` → respuesta con `pipeline`, Swagger y manejo de errores y cierres.
  - Pruebas HTTP con Passport real que leen y analizan el CSV recibido (encabezado, BOM, filas, comillas, saltos de línea, acentos, fórmulas escapadas, cabeceras, 401, 400, vacío, `export` no tomada por `:id`, error a mitad, cierre del cliente).
  - Commit: `feat(books): add the CSV export endpoint`

- [x] **X-04 Verificación contra PostgreSQL real** (X5.4)
  - Backend compilado: el CSV coincide con el listado para varios filtros y órdenes; con 300.000 libros la memoria no crece y los primeros bytes llegan enseguida; el archivo se relee con un analizador y coincide con la base; título con fórmula escapado; cierre del cliente a mitad sin dejar la base ocupada.
  - Hecho cuando: cada comprobación queda en el registro de verificación.
  - Commit: `docs(books-export-csv): record the backend verification`

## Frontend
- [x] **X-05 Servicio, utilidades y botón** (X4.1 a X4.6, X5.2)
  - `exportBooksCsv`, `fileNameFromDisposition`, `saveBlob`, `useExportBooks` y el botón «Exportar CSV» en `BooksPage`.
  - Pruebas: parámetros sin `page`/`limit`; nombre de la cabecera y el de respaldo; recorte de rutas; descarga con enlace temporal y `revokeObjectURL`; botón con filtros vigentes, «Exportando…», una descarga a la vez, error con reintento y listado intacto.
  - Commit: `feat(frontend): add the CSV export button to the books page`

## Integración y cierre
- [x] **X-06 Verificación de punta a punta** (X5.4)
  - Docker y navegador real: descargar con y sin filtros y con otro orden, capturar el archivo y compararlo con la tabla; título con fórmula; error de sesión; botón con resultado vacío.
  - Hecho cuando: cada escenario queda anotado.
  - Commit: `docs(books-export-csv): record the end-to-end verification`

- [x] **X-07 Verificación de la spec**
  - Recorrer X1 a X5 con evidencia nueva (lint, tipos, build, cobertura ≥ 80 % y fallando por debajo en ambas apps; `npm audit`) y registrar el resultado.
  - Commit: `docs(books-export-csv): record the spec verification`

## Registro de verificación
(Se completa en X-04, X-06 y X-07.)

### X-04: exportación contra PostgreSQL real (2026-10-29)
Entorno: PostgreSQL 16 del contenedor de desarrollo; base **nueva** migrada con `migrate deploy` (eliminada al terminar); backend compilado (`node dist/main`) con login real; 5.000 libros con acentos, comas, comillas, saltos de línea y 39 títulos que empiezan como una fórmula (más autores como `=HYPERLINK(...)`, `+34 600 000`, `-Anónimo` y `@arroba`), y después 300.000 más (305.000 en total). El CSV se leyó de vuelta con el analizador de `fast-csv`.

**Contenido y coincidencia (por HTTP real)**

| Comprobación | Resultado |
|---|---|
| Respuesta | 200, `text/csv; charset=utf-8`, `attachment; filename="libros-AAAA-MM-DD.csv"`, `Cache-Control: no-store`, `nosniff`, BOM `efbbbf`, termina en CRLF; encabezado de 9 columnas en español |
| Filas frente a la base | 5.000 en el CSV y 5.000 activos en la base |
| CSV frente al listado (7 combinaciones: sin filtros; disponibilidad; título; autor + género; precio desc + título asc; género asc + precio desc + no disponibles; título + editorial + autor desc) | Mismos libros **en el mismo orden** en las 7 (5.000, 3.334, 699, 139, 5.000, 1.666 y 27 filas) |
| Cada celda de las 5.000 filas frente a la base (id, textos, precio, `Sí`/`No`, fechas ISO) | 0 diferencias |
| Inyección de fórmulas | 39 celdas escapadas con `'`; **0** celdas de título, autor, editorial o género que sigan empezando como una fórmula |
| Acentos, `ñ`, comas, comillas y un título con salto de línea | Se conservan; el salto de línea queda entre comillas y el libro sigue en una sola fila (5.001 filas al releer) |
| Sin coincidencias | 200 con solo el encabezado **y con BOM** |
| Libro eliminado | Desaparece del CSV (5.000 → 4.999) |
| Sin token / con `page=1` / con `sort=foo:asc` | 401 / 400 (campo `page`) / 400; `/books/export` no se toma por un `:id` |

**Rendimiento y robustez (305.000 libros, en proceso)**

| Comprobación | Resultado |
|---|---|
| Exportar los 305.000 (60,6 MB), orden por defecto | **Primer byte a los 253 ms**; 62,6 s en total (~4.900 filas/s); memoria del montón +24 MB sobre la base |
| Mismo con orden por título | Primer byte 130 ms; 90,9 s; +24,6 MB |
| Filtro de título `relleno` (300.000 coincidencias, el peor caso) | Primer byte 271 ms; **303 s** (~1.000 filas/s: cada lote filtra con el índice de trigramas y ordena); +24,3 MB |
| La memoria no crece con el tamaño | +16,7 MB con 4.872 filas y +24 MB con 305.044: acotada por un lote y los búfers, no por la tabla |
| Coste de un lote según su profundidad (lote 1 a 400 de 610) | 50–150 ms en los tres órdenes: el cursor no tiene coste cuadrático |
| Cliente lento (20 ms por trozo) | Tras 1,5 s el cliente había tomado 49 trozos y la aplicación había leído **1 de 610 lotes**: la contrapresión frena la lectura |
| Cliente que se va a los 491 ms (204 KB recibidos), por HTTP real | La base recibe 9 lecturas en los 500 ms siguientes (lo que estaba en vuelo) y **0** entre 0,5 y 3 s; 0 consultas activas sobre `books`; el servidor registra `CSV export aborted: Premature close` |
| Un libro eliminado (borrado lógico) justo entre dos lotes, siendo el último del lote | Se exportan los 304.999 restantes, sin repetidos ni truncamiento: la fila del cursor sigue existiendo |

Observaciones:
- **Exportaciones enormes.** Una exportación de cientos de miles de libros tarda de uno a cinco minutos (según el filtro); la memoria no es un problema pero el tiempo sí lo es para una petición HTTP: el cliente HTTP del frontend tiene un tiempo máximo de 15 s y lo cortaría (se corrige en X-05 con un tiempo máximo propio para la exportación). Para millones de libros haría falta una exportación en segundo plano (mejora futura en `design.md` §6). Para el tamaño real de una tienda (miles de libros) la descarga es inmediata.
- **Defecto de método.** El primer intento usó la base de desarrollo por error: `. ./.env` volvió a poner `DATABASE_URL` después de mi `export`. Se detectó porque el CSV salió vacío y se repitió contra la base nueva.
- Dos defectos del propio código ya se habían hallado y corregido al escribir las pruebas (X-03): el generador quedaba abierto con `.pipe` y el CSV vacío salía sin BOM.

### X-06: recorrido de punta a punta con Docker y navegador real (2026-10-28)
Entorno: `docker compose up --build` (db, backend y frontend sanos), navegador integrado, administrador sembrado y 23 libros cargados por la API (entre ellos `=HYPERLINK("http://malo.example","Clic")` con autor `+Anónimo`, `Uno, dos "tres"` y acentos). Para leer el archivo sin guardarlo en disco se envolvieron `URL.createObjectURL` y el `click` del enlace en la página (solo registran el `Blob` que la aplicación entrega al navegador). El token se puso en `localStorage` en lugar de escribir la contraseña en el formulario.

| Escenario | Resultado |
|---|---|
| Botón «Exportar CSV» en `/books` | Presente junto a «Nuevo libro» |
| Exportar sin filtros (8 libros) | Archivo `libros-2026-10-28.csv`, `text/csv`, **BOM** `ef bb bf`, encabezado de 9 columnas, 8 filas en el **mismo orden** que la tabla; el enlace temporal estaba en el documento al hacer clic y no queda ninguno después; el botón vuelve a «Exportar CSV» y no hay avisos |
| Fórmula | El título sale como `"'=HYPERLINK(""http://malo.example"",""Clic"")"` y el autor como `'+Anónimo` (la tabla sigue mostrando los datos originales) |
| Comas, comillas y acentos | `"Uno, dos ""tres"""`, `Autor Ñandú`, `Sudamericana` y `Plaza & Janés` bien entrecomillados y codificados |
| Filtros y orden de la vista (`género=Novela`, disponibles, precio descendente) | La petición lleva `?genre=Novela&availability=true&sort=price:desc`, **sin `page` ni `limit`**; el archivo trae las mismas 4 filas en el mismo orden que la tabla |
| Más de una página (23 libros, la tabla muestra 10) | El archivo trae **23** filas, no las 10 visibles |
| Búsqueda escrita en el cuadro (`Relleno 1`, con la pausa) | La petición lleva `?search=Relleno+1`; el archivo y la tabla coinciden (7 filas, mismo orden) |
| Sin resultados | La tabla dice «Ningún libro coincide…»; el archivo pesa 80 bytes: BOM más el encabezado, sin filas |
| Cabeceras a través de nginx | `200`, `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="libros-2026-10-28.csv"`, `Access-Control-Expose-Headers: Content-Disposition`, `Cache-Control: no-store`, `nosniff` |
| Backend detenido | Tras unos segundos el aviso «No se pudo exportar el CSV. Ocurrió un error en el servidor. Inténtalo más tarde.» con «Reintentar exportación»; el botón vuelve a estar activo, la tabla sigue en pantalla y no hay descarga ni segundo aviso global |
| Reintentar con el backend de nuevo sano | Se descarga el archivo y el aviso desaparece |
| Sesión caducada (token inválido en `localStorage`) | La exportación recibe 401, la sesión se borra y se navega a `/login`; no hay descarga; el backend registra el 401 |

Observaciones:
- **Mi instrumentación y la CSP.** El primer intento leyó el `Blob` con `fetch(blob:...)` y la política de seguridad de la aplicación (`default-src 'self'`) lo bloqueó. Era un defecto de mi forma de medir y no de la aplicación (la descarga con enlace no usa `connect-src`); se cambió por registrar el `Blob` en `createObjectURL`.
- **No se probó** el cuadro de guardado del sistema ni el nombre final que decide el navegador: el panel integrado no los expone. Lo que se verificó es lo que la aplicación entrega al navegador (nombre, tipo y contenido).
- Al terminar se eliminó el stack con sus volúmenes (`docker compose down -v`).

### X-07: verificación de la spec (2026-10-28)
Evidencia nueva de esta sesión: backend `lint`, `tsc` y build limpios, `test:cov` (**44 suites, 759 pruebas, 100 %**) y e2e (**9**); frontend `lint`, `tsc -b` y build limpios, `test:cov` (**42 archivos, 646 pruebas, 100 %** en sentencias, ramas, funciones y líneas; con el umbral forzado a 101 % falla: "does not meet global threshold"); registros X-04 y X-06.

| Criterio | Evidencia |
|---|---|
| X1.1–X1.6 | 28 pruebas HTTP con Passport real (`books-export.http.spec`): ruta, filtros y orden iguales a los del listado, 401 sin token, 400 con `page`/`limit` y con parámetros inválidos, `export` no tomado por `:id`; el e2e recorre el OpenAPI y exige 401; X-04: el CSV coincide con el listado, en el mismo orden, en 7 combinaciones |
| X2.1–X2.5 | `book-csv.spec` y las pruebas HTTP: encabezados en español, `Sí`/`No`, precio y fechas ISO, UTF-8 con BOM (también sin filas), CRLF, comillas y saltos de línea; X-04: cada celda de 5.000 filas coincide con la base; X-06: acentos y comillas en el navegador |
| X3.1–X3.4 | `book-csv-stream.spec` (lotes con cursor, contrapresión con prueba de control, cierre del generador al irse el cliente, fallo de la base antes y durante); X-04 con 305.000 libros: memoria +24 MB acotada, primer byte en ~250 ms, coste de lote constante, cliente lento y cliente que se va, libro eliminado entre lotes |
| X3.5 | Inyección de fórmulas: pruebas de cada carácter peligroso; X-04: 39 celdas escapadas y 0 sin escapar; X-06: `=HYPERLINK(...)` y `+Anónimo` salen con `'` |
| X4.1–X4.6 | `BooksPage.spec` (descarga con el nombre del servidor, filtros y orden sin página, «Exportando…» con una sola petición, error con reintento y lista intacta), `useExportBooks.spec`, `books.service.spec`, `content-disposition.spec` (rutas y caracteres de control), `download-file.spec` (enlace temporal y `revokeObjectURL`); X-06 en el navegador real |
| X5.1–X5.4 | Suites citadas; cobertura 100 % en ambas apps; X-04 contra PostgreSQL real y X-06 con Docker y navegador |

Resultado: sin criterios pendientes.

Hallazgos de la verificación: (1) el cliente HTTP del frontend corta a los 15 s y una exportación de cientos de miles de libros tarda minutos: la exportación tiene su propio tiempo máximo de 10 minutos (con prueba) y la exportación en segundo plano queda como mejora futura; (2) el CSV vacío salía sin BOM y el generador de lotes quedaba abierto al irse el cliente (corregidos en X-03 con pruebas).

Pendientes (no son de esta spec): `npm audit --omit=dev` del backend sigue con 5 hallazgos (3 altos y 2 moderados: `deepmerge-ts` y `js-yaml`, cuyas correcciones exigen `--force`; se evalúan en `docs-delivery`); el paquete del frontend pesa ~570 kB (aviso de Vite).
