# Spec books-export-xlsx: Diseño

Implementa los requisitos de `requirements.md`. Los códigos E# remiten a ese archivo.

## 1. Decisiones

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Archivo `.xlsx` real, además del CSV | Cambiar el CSV a `;` con coma decimal (opción A) | Lo eligió el usuario: columnas siempre separadas, encabezado con formato y números reales, sin depender de la configuración regional. El CSV queda intacto para herramientas y para el enunciado |
| Librería **`write-excel-file` 4.1.1** (MIT, 1 dependencia: `fflate`, 0 hallazgos de `npm audit`, 1,8 MB, publicada en 2026) con su compilación CommonJS (`write-excel-file/node`, `require`) | `exceljs` (194 paquetes, 22 MB, hallazgos de `npm audit`, sin versión desde 2024); SheetJS `xlsx` (la versión de npm está desactualizada y vulnerable) | Menor superficie y mantenimiento activo. Su `exports` trae `require`, compatible con el backend CommonJS (decisión de `tech-stack.md`) |
| El archivo se arma **en memoria** y se envía de una vez, con **tope de 20.000 filas** | Flujo como el CSV | `.xlsx` es un zip: no se puede escribir fila a fila sin una librería de flujo (`exceljs`). Medido con la librería: 1.000 filas 0,1 s / 64 MB; 50.000 filas 2,9 s / 233 MB; 100.000 filas 5,9 s / 370 MB. 20.000 filas ≈ 1 s y unos 130 MB, aceptable. El CSV (en flujo, sin tope) cubre los casos grandes |
| El tope se comprueba con **`count` antes de leer** y otra vez **mientras se lee** | Solo contar; solo cortar al leer | Contar primero evita leer 20.000 filas para rechazar; comprobar al leer garantiza el tope si la tabla crece entre ambas consultas (E3.3) |
| Se responde **422** al pasar el tope | 400 o 413 | La petición es válida, pero el servidor no puede procesarla con ese tamaño; 413 es del cuerpo de la petición. 422 se distingue de los 400 de validación y la pantalla lo traduce a su aviso propio (el cuerpo de un error con `responseType: 'blob'` no se lee) |
| Los libros se leen con `exportRows` (los mismos lotes de 500 con cursor) y se juntan en una lista | Una consulta nueva | Mismo filtro, mismo orden, mismo comportamiento ante cambios que el CSV; no se duplica `buildBookWhere`/`buildBookOrderBy` |
| Encabezados desde `CSV_HEADERS` | Repetirlos | Una sola fuente para los dos formatos |
| Textos como texto, **sin comilla de escape** | Reusar `escapeCsvCell` | En CSV la comilla evita que Excel ejecute `=…`. En `.xlsx` la celda lleva el tipo «texto»: Excel no la evalúa, y mostrar una comilla estorbaría. Se comprueba con un título `=HYPERLINK(...)` |
| Fechas como fecha real con formato `yyyy-mm-dd hh:mm:ss` (UTC) | Texto ISO | En Excel se pueden ordenar y filtrar como fechas; el formato fijo evita ambigüedades de idioma. Excel guarda fechas sin zona: se documentan como UTC |
| Precio como número con formato `#,##0.00` | Texto | Se puede sumar y ordenar; Excel muestra los separadores según el idioma del usuario (`9.990,50` en español) |
| Un solo hook `useExportBooks` con el formato como parámetro y un solo estado «exportando» | Un hook por formato | Garantiza una descarga a la vez (E4.2) y comparte la gestión del error |
| Dos botones («Exportar Excel» primero, «Exportar CSV» después) | Un menú desplegable | Es una acción de un clic, visible; no se añade un componente nuevo |
| El aviso de «demasiados libros» se escribe en el frontend con el tope como constante (`XLSX_MAX_ROWS`) | Leer el mensaje del servidor | Con `responseType: 'blob'` el cuerpo del error llega como `Blob`; se mantiene la regla de la app de mostrar siempre mensajes en español por estado |

## 2. Backend

```
backend/src/books/
├── export/
│   ├── book-xlsx.ts           # XLSX_MAX_ROWS, XLSX_CONTENT_TYPE, xlsxFileName, buildBooksXlsx(books): Promise<Buffer>
│   └── read-xlsx.test-helper.ts   # solo pruebas: descomprime un .xlsx y devuelve su XML
├── books.service.ts           # + exportAll(query): Promise<BookDto[]> (con tope)
└── books.controller.ts        # + GET export/xlsx (antes de GET :id)
```

- **`buildBooksXlsx(books)`** (función pura salvo la librería): columnas con `header` en negrita y `cell(book)` que devuelve la celda tipada (`Number` con formato, `Date` con formato, texto); `width` por columna; `stickyRowsCount: 1`; `sheet: 'Libros'`; devuelve un `Buffer`.
- **`BooksService.exportAll(query)`**: `count` con `buildBookWhere`; si `> XLSX_MAX_ROWS` lanza `UnprocessableEntityException`; después recorre `exportRows` acumulando y lanza lo mismo si supera el tope por el camino (E3.3).
- **`BooksController.exportXlsx`**: `@Get('export/xlsx')`, `@RawResponse()`, `@Res()`; llama a `exportAll`, arma el buffer, fija cabeceras (`Content-Type`, `Content-Disposition`, `Content-Length`, `Cache-Control: no-store`) y envía. Los errores salen por el filtro global (aún no hay cabeceras enviadas, a diferencia del CSV en flujo).
- **Swagger:** `@ApiProduces(XLSX_CONTENT_TYPE)`, parámetros del DTO, 200 (binario), 400, 401 y 422. La prueba e2e que lista las operaciones se actualiza (15).
- **Dependencia:** `write-excel-file` 4.1.1 exacta en `package.json`; se añade a `tech-stack.md` con su motivo.

## 3. Frontend

```
frontend/src/
├── services/books.service.ts   # exportBooksCsv + exportBooksXlsx sobre una función común
├── hooks/useExportBooks.ts     # exportFile('csv' | 'xlsx'), isExporting, format, error
└── pages/BooksPage.tsx         # dos botones y el aviso
```

- **Servicio:** una función interna `downloadExport(path, accept, params)` compartida (timeout propio, `responseType: 'blob'`, nombre de `Content-Disposition`); `exportBooksXlsx` la usa y convierte un `ApiError` 422 en uno con el mensaje en español de E4.3.
- **Hook:** `useExportBooks(params)` devuelve `{ exportFile, isExporting, exportingFormat, error }`; ignora una segunda llamada mientras corre.
- **Página:** «Exportar Excel» y «Exportar CSV» se desactivan juntos; el pulsado muestra «Exportando…». El aviso de error reutiliza el de la exportación («Reintentar» repite el mismo formato).

## 4. Seguridad
| Amenaza | Mitigación |
|---|---|
| Ejecución de fórmulas al abrir el archivo | Celdas de texto tipadas como texto; prueba con `=HYPERLINK(...)` |
| Agotar memoria con una exportación enorme | Tope de 20.000 filas, comprobado antes y durante la lectura (422) |
| Exportar sin sesión | Guard global (la prueba e2e recorre el OpenAPI) |
| Nombre de archivo malicioso | Lo genera el servidor; el cliente lo sanea igual que el CSV |
| Datos internos | Solo las nueve columnas de E2.1 |
| Dependencia nueva | `npm audit` en 0; versión exacta; una sola dependencia transitiva |

## 5. Pruebas
- **Unitarias (backend):** `buildBooksXlsx` (encabezados, orden, tipos, formatos, anchos, fila fija, hoja «Libros», vacío, texto con `=`), `xlsxFileName`, `exportAll` (bajo el tope, justo en el tope, sobre el tope sin leer, crecimiento durante la lectura, mismos filtros que el listado) y el controlador.
- **HTTP con Passport real:** el `.xlsx` recibido se descomprime y se lee: cabeceras, columnas, filas, celdas numéricas y de fecha, texto con fórmula, 401, 400 por `page`, 422 por el tope, vacío, ruta no tomada por `:id`.
- **PostgreSQL real:** el archivo se abre con `openpyxl` (lector independiente) y se compara con la base; el tope con 20.001 libros.
- **Frontend:** servicio (parámetros sin `page`/`limit`, `Blob`, nombre, 422 → mensaje), hook, y la página (dos botones, «Exportando…» en el correcto, una descarga a la vez, aviso del tope, error con reintento).
- **Navegador real (Docker):** descargar, abrir con `openpyxl`, comprobar columnas, formatos y encabezado fijo; el aviso del tope.

## 6. Mejoras futuras
- Excel en flujo para más de 20.000 filas (cambiar a una librería de escritura en flujo o generar en segundo plano).
- Filtros automáticos y totales en el archivo; varias hojas; portadas.
- Elegir columnas.
