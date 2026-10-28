# Spec books-export-csv: Diseño

Implementa los requisitos de `requirements.md`. Los códigos X# remiten a ese archivo.

## 1. Decisiones (a revisar: esta spec se implementó sin la pausa de aprobación)

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| `GET /api/books/export` reutiliza `buildBookWhere` y `buildBookOrderBy` del listado | Una consulta propia | Así el CSV y la tabla no pueden divergir (X1.2); un filtro nuevo se añade en un solo lugar |
| La exportación es un **flujo**: un generador asíncrono lee la base en lotes de 500 y `fast-csv` escribe a medida que llegan | Cargar todos los libros y construir el texto | La memoria queda acotada por el tamaño del lote y no por el de la tabla (X3.1); `fast-csv` es el paquete de `tech-stack.md` |
| Lotes con **cursor** (`cursor` + `skip: 1` de Prisma) sobre el orden del listado | `skip`/`take` con desplazamiento creciente | Con desplazamiento la base recorre y descarta todas las filas anteriores en cada lote (costo cuadrático); el cursor retoma desde la última fila. Es válido porque el orden termina en `id` (único) |
| Sin transacción de lectura larga durante la descarga | `REPEATABLE READ` mientras dure el flujo | Una transacción abierta mientras el cliente descarga bloquea limpieza de la base y se queda colgada si el cliente es lento. A cambio, un libro editado durante la descarga puede salir en su versión nueva o la vieja (nunca repetido ni omitido por el cursor, salvo que cambie de lugar en el orden); es aceptable para un informe de inventario |
| Sin tope de filas | Tope de 50.000 filas | El flujo no consume memoria; un tope haría un CSV engañosamente incompleto. Si algún día hace falta limitar, se añade con una cabecera que lo avise |
| Encabezados en **español**, precio sin formato, fechas ISO 8601 | Encabezados en inglés o precio con `$` y puntos de miles | El CSV es un producto para el usuario de la tienda (español), pero los datos deben poder analizarse: número con punto decimal y fecha ISO se leen sin ambigüedad en cualquier herramienta |
| Separador **coma** y BOM de UTF-8 | `;` (lo que espera Excel con configuración regional chilena) | RFC 4180 es el estándar y lo leen todas las herramientas; el BOM arregla acentos y `ñ` en Excel. Con configuración regional que use `;`, Excel puede mostrar todo en una columna: se usa «Datos → Desde texto/CSV». Un selector de separador queda como mejora futura |
| Las celdas de texto que empiezan con `=`, `+`, `-`, `@`, tabulador o retorno de carro llevan una comilla simple delante | Ignorar el riesgo, o rechazar esos títulos al crearlos | Es la defensa que exige `conventions.md` contra la inyección de fórmulas (un título como `=HYPERLINK(...)` ejecutaría algo al abrir el archivo). Se hace al exportar y no al guardar, para no alterar los datos |
| El frontend descarga con `axios` (`responseType: 'blob'`) y un enlace temporal | `<a href="/api/books/export">` | Un enlace no puede enviar `Authorization`; la alternativa de poner el token en la URL lo dejaría en el historial y los registros |
| El nombre del archivo lo decide el servidor (`libros-AAAA-MM-DD.csv`) | Que lo decida el cliente | Un solo lugar; `exposedHeaders: Content-Disposition` ya está configurado en CORS (`platform`) |
| La fecha del nombre es la del día en UTC | Hora local del servidor | Determinista entre entornos (los contenedores corren en UTC) |

## 2. Backend

```
backend/src/books/
├── export/
│   ├── book-csv.ts            # BOOK_CSV_COLUMNS, toCsvRow, escapeCsvCell, csvFileName, CSV_BOM
│   └── export-books-query.dto.ts   # PickType del DTO del listado: filtros y orden, sin page ni limit
├── books.service.ts           # + exportRows(query): AsyncGenerator<BookDto[]>
└── books.controller.ts        # + GET export (declarado antes que GET :id)
```

- **`book-csv.ts`** (funciones puras): `CSV_HEADERS` (X2.1); `toCsvRow(book): string[]` arma las nueve celdas (`escapeCsvCell` en las de texto, `String(price)`, `Sí`/`No`, `toISOString()`); `escapeCsvCell(text)` antepone `'` si empieza con uno de `= + - @ \t \r`; `csvFileName(date)` da `libros-AAAA-MM-DD.csv`; `CSV_BOM = '﻿'`.
- **`ExportBooksQueryDto`** = `PickType(ListBooksQueryDto, ['search', 'author', 'publisher', 'genre', 'availability', 'sort'])`: hereda validación y Swagger, y deja fuera `page` y `limit` (el `ValidationPipe` con `forbidNonWhitelisted` los rechaza, X1.3).
- **`BooksService.exportRows(query)`**: `async *` que repite `findMany({ where, orderBy, take: 500, include, ...(cursor && { cursor: { id: cursor }, skip: 1 }) })` sobre `prisma.live`, entrega cada lote ya mapeado (`toBookDto`) y se detiene cuando el lote trae menos de 500 filas. Al ser un generador, no pide el lote siguiente hasta que el consumidor lo pide (contrapresión) y termina limpiamente si el consumidor lo cierra (`return`).
- **`BooksController.export`**: `@Get('export')` (antes de `@Get(':id')`, X1.6), `@RawResponse()` (el interceptor no envuelve), cabeceras `Content-Type`, `Content-Disposition` y `Cache-Control: no-store` (un informe con datos del inventario no debe quedar en cachés intermedias). Construye la tubería: `Readable.from(rows())` → `format({ headers, writeHeaders })` de `fast-csv` → `res`, con `pipeline` de `node:stream` para propagar errores y cierres. La tubería es una sola (`pipeline(filas, formateador, escritor de BOM, respuesta)`), porque `a.pipe(b)` no cierra `a` cuando `b` se destruye y el generador de lotes se quedaría abierto. El BOM lo escribe una etapa propia (`createBomWriter`) y no la opción `writeBOM` de `fast-csv`, que lo escribe junto con la primera fila: una exportación sin libros no lo llevaría y su encabezado (`Título`, `Género`) se vería mal en Excel (hallado al probar el caso vacío). Con `alwaysWriteHeaders: true` el encabezado sale aunque no haya filas. Si el cliente se desconecta, `pipeline` destruye las etapas y el generador se cierra (X3.3). Si la base falla a mitad, la respuesta se aborta y el error se registra con el `Logger` sin detalles hacia el cliente (X3.4).
- **Swagger**: `@ApiProduces('text/csv')`, parámetros del DTO y respuestas 200 (con el esquema `string`), 400 y 401.

## 3. Frontend

```
frontend/src/
├── services/books.service.ts   # + exportBooksCsv(params): { blob, fileName }
├── lib/download-file.ts        # saveBlob(blob, fileName): enlace temporal + revokeObjectURL
├── lib/content-disposition.ts  # fileNameFromDisposition(header, fallback)
├── hooks/useExportBooks.ts     # estado: idle | exporting | error, y export()
└── pages/BooksPage.tsx         # botón «Exportar CSV» junto a «Nuevo libro»
```

- **`exportBooksCsv(params)`**: `GET /books/export` con `toApiQuery(params)` **sin** `page` ni `limit` (un parámetro que la API rechazaría), `responseType: 'blob'`; devuelve el `Blob` y el nombre de `Content-Disposition`. Con `responseType: 'blob'` un error de la API llega como Blob: el cliente HTTP ya normaliza a `ApiError`; `toApiError` debe leer el cuerpo de un blob de error o, como mínimo, usar el estado (los mensajes por estado ya están en español).
- **`fileNameFromDisposition`**: lee `filename="..."` (y la forma sin comillas), recorta rutas (`/`, `\`) y caracteres de control para que el servidor no pueda escribir fuera de la carpeta de descargas; si falta, `libros.csv`.
- **`saveBlob`**: `URL.createObjectURL(blob)`, `<a download>` temporal, `click()`, y `URL.revokeObjectURL` en el siguiente ciclo (X4.6).
- **`useExportBooks`**: `export()` usa los parámetros vigentes de la vista; mientras corre ignora una segunda llamada (X4.2); expone `error` para el aviso con «Reintentar».
- **`BooksPage`**: el botón vive en la cabecera, junto a «Nuevo libro»; texto «Exportar CSV» / «Exportando…»; el aviso de error reutiliza el estilo del aviso del listado (`role="alert"`).

## 4. Seguridad

| Amenaza | Mitigación |
|---|---|
| Inyección de fórmulas (CSV injection) al abrir el archivo en una hoja de cálculo | `escapeCsvCell` en todas las celdas de texto; pruebas con `=`, `+`, `-`, `@`, tabulador y retorno de carro, y verificación real |
| Exportar sin sesión | El guard global exige token (el e2e recorre el OpenAPI) |
| Agotar memoria o la base con una exportación enorme | Flujo por lotes de 500, cursor, contrapresión y corte al cerrar el cliente |
| Nombre de archivo malicioso en el cliente | El servidor lo genera; el cliente recorta rutas y caracteres de control de la cabecera |
| Datos en cachés intermedias | `Cache-Control: no-store` |
| Fuga de datos internos | El CSV solo trae las nueve columnas de X2.1 (sin `imageUrl` ni `deletedAt`) |

## 5. Pruebas

- **Unitarias (backend):** `escapeCsvCell` (cada carácter peligroso, texto normal, vacío, el carácter en medio), `toCsvRow` (cada columna, `Sí`/`No`, precio con decimales, fechas), `csvFileName`, `exportRows` (un lote, varios lotes con cursor, lote exacto, vacío, filtros y orden iguales a los del listado, cancelación) y el controlador.
- **HTTP con Passport real (backend):** se lee el CSV recibido y se analiza con `fast-csv`: encabezado, BOM, filas, comillas y saltos de línea dentro de un título, acentos, fórmulas escapadas, `Content-Type`, `Content-Disposition`, `Cache-Control`, 401, 400 por `page`/`limit` y por parámetros inválidos, resultado vacío, ruta `export` no tomada por `:id`, y el cierre del cliente a mitad de la descarga.
- **Contra PostgreSQL real:** el CSV coincide fila por fila con el listado; con 300.000 libros la memoria del proceso no crece y los primeros bytes llegan enseguida; el archivo se relee con un analizador y coincide con la base; un título con `=HYPERLINK(...)` sale escapado.
- **Unitarias (frontend):** servicio (parámetros sin `page`/`limit`, `Blob`, nombre), `fileNameFromDisposition`, `saveBlob` y el botón en `BooksPage` (filtros vigentes, «Exportando…», una sola descarga a la vez, error con reintento, liberación de la URL).
- **Punta a punta:** Docker y navegador real: descargar con y sin filtros, leer el archivo capturado y comparar con lo que muestra la tabla.

## 6. Mejoras futuras
- Selector de separador (`;`) y de codificación para Excel con configuración regional que lo requiera.
- Columnas configurables y otros formatos (XLSX).
- Exportaciones muy grandes en segundo plano con una cola y descarga posterior.
- Registro de las exportaciones en `AuditLog`.
