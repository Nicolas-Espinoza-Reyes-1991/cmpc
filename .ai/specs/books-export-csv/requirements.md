# Spec books-export-csv: Requisitos

Cubre los IDs del enunciado: **BE-4**. Relacionados: GEN-2 (seguridad y rendimiento de producción), BE-3, T-1, T-2, T-3.
Depende de `books-listing` (los mismos filtros y orden, `buildBookWhere` y `buildBookOrderBy`), de `books-crud` (`BookDto`, `prisma.live`) y de `platform` (`@RawResponse()`, filtro de errores).

Formato: CUANDO <evento>, EL SISTEMA DEBERÁ <respuesta>. Cada criterio es verificable.

> **Nota sobre el proceso.** Esta spec se redactó y se implementó sin la pausa de aprobación que pide `CLAUDE.md`, por indicación expresa del usuario (trabajo autónomo durante la noche). Las decisiones que habrían ido a aprobación están en `design.md` §1 para su revisión.

## Fuera de alcance
- Otros formatos (Excel, PDF, JSON) y exportar solo las filas seleccionadas.
- Programar exportaciones o enviarlas por correo; exportaciones en segundo plano con una cola.
- Columnas configurables y un separador elegible por el usuario.
- Registro de la exportación en `AuditLog`: lo añade la spec `audit-log` si lo decide.

## X1. Endpoint de exportación (BE-4)
- X1.1 CUANDO se envíe `GET /api/books/export`, EL SISTEMA DEBERÁ responder 200 con el contenido en CSV (`Content-Type: text/csv; charset=utf-8`) y la cabecera `Content-Disposition: attachment; filename="libros-AAAA-MM-DD.csv"` con la fecha del día.
- X1.2 EL SISTEMA DEBERÁ aceptar los mismos `search`, `author`, `publisher`, `genre`, `availability` y `sort` que el listado, con las mismas reglas y los mismos errores 400, y devolver exactamente los libros (y en el orden) que el listado mostraría con esos parámetros.
- X1.3 EL SISTEMA NO DEBERÁ aceptar `page` ni `limit` (400, propiedad no declarada): la exportación contiene todos los libros que cumplen los filtros, no una página.
- X1.4 EL SISTEMA NO DEBERÁ incluir libros eliminados y DEBERÁ exigir token como el resto de las rutas.
- X1.5 CUANDO ningún libro cumpla los filtros, EL SISTEMA DEBERÁ responder 200 con solo la fila de encabezados.
- X1.6 La ruta `/books/export` DEBERÁ resolverse antes que `/books/:id` (no ser tomada por un id).

## X2. Contenido del CSV
- X2.1 La primera fila DEBERÁ ser el encabezado en español: `ID`, `Título`, `Autor`, `Editorial`, `Género`, `Precio`, `Disponible`, `Registrado`, `Actualizado`.
- X2.2 Cada libro DEBERÁ ocupar una fila con: su id; título, autor, editorial y género como texto; `Precio` como número con punto decimal y sin símbolo ni separador de miles (`12990.5`); `Disponible` como `Sí` o `No`; y las fechas en ISO 8601 (UTC).
- X2.3 EL SISTEMA DEBERÁ seguir RFC 4180: separador coma, fin de línea CRLF, y comillas dobles para los campos que contengan comas, comillas, saltos de línea o espacios en los extremos, duplicando las comillas internas.
- X2.4 EL SISTEMA DEBERÁ empezar el archivo con la marca BOM de UTF-8 para que Excel interprete bien los acentos y la `ñ`.
- X2.5 **Inyección de fórmulas.** CUANDO una celda de texto empiece con `=`, `+`, `-`, `@`, tabulador o retorno de carro, EL SISTEMA DEBERÁ anteponerle una comilla simple (`'`) para que una hoja de cálculo no la ejecute como fórmula (`conventions.md`). Las celdas numéricas y de fecha no se tocan.
- X2.6 EL SISTEMA NO DEBERÁ incluir la URL de la portada, `deletedAt` ni ningún dato interno.

## X3. Rendimiento y robustez
- X3.1 EL SISTEMA DEBERÁ generar el CSV en **flujo** (*streaming*): leer la base por lotes y escribir al cliente a medida que llegan, de modo que la memoria usada no crezca con el número de libros.
- X3.2 EL SISTEMA DEBERÁ respetar la contrapresión: si el cliente lee despacio, la lectura de la base se detiene hasta que pueda seguir.
- X3.3 CUANDO el cliente cierre la conexión a mitad de la descarga, EL SISTEMA DEBERÁ dejar de leer la base y liberar los recursos.
- X3.4 CUANDO ocurra un error de la base después de enviar las primeras filas, EL SISTEMA DEBERÁ cortar la respuesta (el CSV queda incompleto y el cliente lo nota por la conexión abortada) y registrar el error, sin enviar detalles internos.
- X3.5 EL SISTEMA DEBERÁ ordenar de forma determinista (`id` como último criterio, igual que el listado) para que ningún libro se repita ni se omita entre lotes.

## X4. Pantalla (BE-4 en el frontend)
- X4.1 EL SISTEMA DEBERÁ ofrecer en `/books` un botón «Exportar CSV» que descargue los libros según la búsqueda, los filtros y el orden vigentes, sin importar la página en que esté el usuario.
- X4.2 MIENTRAS se prepara la descarga, EL SISTEMA DEBERÁ mostrar «Exportando…» y no permitir una segunda descarga a la vez.
- X4.3 EL SISTEMA DEBERÁ descargar con la sesión del usuario (la cabecera `Authorization` no se puede enviar desde un enlace), guardar el archivo con el nombre que indique el servidor (`Content-Disposition`) y, si faltara, `libros.csv`.
- X4.4 CUANDO la descarga falle, EL SISTEMA DEBERÁ mostrar el mensaje de error y permitir reintentar; el listado NO DEBERÁ cambiar.
- X4.5 CUANDO se exporte con filtros activos, EL SISTEMA DEBERÁ descargar solo lo filtrado; el botón DEBERÁ estar habilitado también cuando no haya resultados (el CSV solo traerá el encabezado).
- X4.6 EL SISTEMA DEBERÁ liberar el recurso temporal del archivo (`URL.revokeObjectURL`) después de iniciar la descarga.

## X5. Pruebas (T-1, T-2, T-3)
- X5.1 El backend DEBERÁ tener pruebas unitarias de la codificación (columnas, escape de fórmulas, BOM), del generador por lotes de `BooksService` (lotes, cursor, filtros, orden, cancelación) y del controlador, y pruebas HTTP con Passport real que lean el CSV recibido (encabezado, filas, comillas, acentos, fórmulas escapadas, `Content-Disposition`, 401, 400 por `page` y por parámetros inválidos, vacío, cierre del cliente a mitad).
- X5.2 El frontend DEBERÁ tener pruebas del servicio de descarga, del nombre de archivo y del botón (filtros vigentes, «Exportando…», error y reintento, liberación de la URL).
- X5.3 La cobertura DEBERÁ seguir en 80 % o más en ambas aplicaciones.
- X5.4 EL SISTEMA DEBERÁ verificarse contra PostgreSQL real (el CSV coincide con el listado, con muchas filas la memoria no crece, el archivo se vuelve a leer con un analizador de CSV y coincide con la base) y de punta a punta en un navegador real con Docker.
