# Spec books-export-xlsx: Requisitos

Complementa a `books-export-csv`. **No cubre un ID nuevo del enunciado**: BE-4 pide CSV y sigue cubierto por esa spec. Esta spec añade un **archivo Excel (`.xlsx`)** porque, al abrir el CSV en un Excel con configuración regional en español (separador de lista `;`), todos los campos caían en una sola celda (hallazgo del usuario al probar). Aporta a «usabilidad y experiencia de usuario».

Depende de `books-export-csv` (`exportRows`, `ExportBooksQueryDto`, `CSV_HEADERS`, `useExportBooks`, `@RawResponse()`) y de `books-listing` (los mismos filtros y orden).

Formato: CUANDO <evento>, EL SISTEMA DEBERÁ <respuesta>. Cada criterio es verificable.

> **Nota sobre el proceso.** Decisión del usuario: se eligió `.xlsx` (opción B) sobre cambiar el separador del CSV (opción A). Aprobó la librería `write-excel-file` y el tope de 20.000 filas. La librería no estaba en `tech-stack.md`: se añade como parte de esta spec.

## Fuera de alcance
- Cambiar el CSV (queda tal como está: coma, RFC 4180, para herramientas y para el enunciado).
- Exportaciones de más de 20.000 libros a Excel (para eso está el CSV, sin tope y en flujo).
- Varias hojas, gráficos, fórmulas, imágenes de portada y estilos de marca en el archivo.
- Leer o importar archivos Excel.

## E1. Endpoint (E = Excel)
- E1.1 CUANDO se envíe `GET /api/books/export/xlsx`, EL SISTEMA DEBERÁ responder 200 con un archivo Excel (`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) y `Content-Disposition: attachment; filename="libros-AAAA-MM-DD.xlsx"` con la fecha del día en UTC.
- E1.2 EL SISTEMA DEBERÁ aceptar los mismos `search`, `author`, `publisher`, `genre`, `availability` y `sort` que el listado y el CSV, con las mismas reglas y los mismos 400, y devolver los mismos libros en el mismo orden. NO DEBERÁ aceptar `page` ni `limit` (400).
- E1.3 EL SISTEMA NO DEBERÁ incluir libros eliminados y DEBERÁ exigir token como el resto de las rutas.
- E1.4 La ruta DEBERÁ resolverse antes que `/books/:id`.
- E1.5 EL SISTEMA DEBERÁ enviar `Cache-Control: no-store` y el tamaño exacto (`Content-Length`).

## E2. Contenido del archivo
- E2.1 EL archivo DEBERÁ tener una hoja llamada «Libros» con **una columna por campo**, en este orden y con estos encabezados: `ID`, `Título`, `Autor`, `Editorial`, `Género`, `Precio`, `Disponible`, `Registrado`, `Actualizado` (los mismos de `CSV_HEADERS`: una sola fuente).
- E2.2 CADA libro DEBERÁ ocupar una fila: textos como texto; `Precio` como **número** con formato de miles y dos decimales; `Disponible` como `Sí` o `No`; `Registrado` y `Actualizado` como **fecha y hora reales** (UTC) con formato `aaaa-mm-dd hh:mm:ss`.
- E2.3 LA fila de encabezados DEBERÁ ir en negrita y fija al desplazarse; cada columna DEBERÁ tener un ancho que deje leer su contenido típico.
- E2.4 Un texto que empiece con `=`, `+`, `-` o `@` DEBERÁ guardarse como **texto** y mostrarse tal cual (sin comilla delante): Excel no lo ejecuta como fórmula. EL SISTEMA NO DEBERÁ incluir la URL de la portada ni datos internos.
- E2.5 CUANDO ningún libro cumpla los filtros, EL SISTEMA DEBERÁ responder 200 con la hoja y solo los encabezados.

## E3. Tope y robustez
- E3.1 EL SISTEMA DEBERÁ generar el Excel solo si el número de libros que cumplen los filtros es **≤ 20.000**.
- E3.2 CUANDO sea mayor, EL SISTEMA DEBERÁ responder **422** con un mensaje claro (en inglés, como la API) que indique el tope y proponga aplicar filtros o usar el CSV, sin leer ni armar el archivo.
- E3.3 EL tope DEBERÁ cumplirse también si los libros crecen entre el conteo y la lectura (nunca se arma un archivo mayor al tope).
- E3.4 UN fallo de la base DEBERÁ responder el error normal (500 genérico) antes de enviar el primer byte.

## E4. Pantalla
- E4.1 EN `/books` DEBERÁ haber un botón «Exportar Excel» junto a «Exportar CSV»; ambos descargan según la búsqueda, los filtros y el orden vigentes, sin importar la página.
- E4.2 MIENTRAS corra una exportación (de cualquiera de los dos formatos) ambos botones DEBERÁN quedar desactivados, el pulsado DEBERÁ decir «Exportando…» y no se DEBERÁ iniciar una segunda descarga.
- E4.3 CUANDO la API responda 422 por el tope, la pantalla DEBERÁ mostrar en español: «Hay demasiados libros para Excel (máximo 20.000). Aplica filtros o descarga el CSV.» con la opción de cerrar o reintentar; el listado no cambia.
- E4.4 CUANDO la exportación falle por otra causa, la pantalla DEBERÁ mostrar el aviso de error de la exportación con «Reintentar», sin tocar el listado.
- E4.5 EL nombre del archivo DEBERÁ ser el que propone el servidor, saneado igual que el del CSV.

## E5. Pruebas y verificación
- E5.1 Pruebas unitarias del generador, del tope, del controlador y de la pantalla; cobertura ≥ 80 % en ambas apps (objetivo 100 %).
- E5.2 Pruebas HTTP con Passport real que abren el `.xlsx` recibido (se descomprime y se lee su XML).
- E5.3 Contra PostgreSQL real: el archivo se abre con un lector independiente (`openpyxl`) y coincide con la base; el tope funciona con datos reales.
- E5.4 En Docker y navegador real: descargar el Excel, abrirlo y comprobar columnas, formatos, encabezado fijo y el aviso del tope.
