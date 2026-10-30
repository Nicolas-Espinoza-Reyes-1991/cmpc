# Spec book-detail-cover: Requisitos

Cubre los IDs del enunciado: **FE-4** (visualizar los datos de un libro) y **FE-3b** (imagen por libro, en su visualización). Relacionados: GEN-2 (producción), T-1, T-3.
Depende de `books-crud` (pantalla de detalle `BookDetailPage`) y de `book-image-upload` (`imageUrl` y `GET /api/uploads/<nombre>`, público y con caché).

Formato: CUANDO <evento>, EL SISTEMA DEBERÁ <respuesta>. Cada criterio es verificable.

> **Estado: pendiente de aprobación.** Según `CLAUDE.md`, esta spec no se implementa hasta que el usuario la apruebe. Las decisiones que requieren confirmación están en `design.md` §1.

## Fuera de alcance
- Generar miniaturas en el servidor (archivos redimensionados, recorte, WebP de vista previa). `product.md` deja «miniaturas» y «redimensionado» como mejoras futuras; aquí la miniatura es solo una presentación en el navegador.
- Descargar el libro completo (datos, CSV de un solo libro) o varias imágenes.
- Galería o varias imágenes por libro.
- Cambios en el listado (`books-listing`) y en el formulario (`books-crud`, `book-image-upload`).

## V1. Miniatura de la portada (FE-4)
- V1.1 EL SISTEMA DEBERÁ mostrar la portada del libro en el detalle como miniatura de tamaño fijo y proporción de libro (2:3), sin deformarla (`object-fit: cover`).
- V1.2 CUANDO el libro no tenga portada, EL SISTEMA DEBERÁ mostrar el marcador «Sin portada» actual, con las mismas dimensiones, y NO DEBERÁ ofrecer el botón de descarga.
- V1.3 CUANDO la imagen no cargue, EL SISTEMA DEBERÁ mostrar el marcador «Sin portada» (o un aviso equivalente) en lugar de un icono roto, y el texto alternativo DEBERÁ incluir el título del libro.
- V1.4 EL SISTEMA DEBERÁ cargar la imagen con `loading="lazy"` y `decoding="async"` y reservar su espacio (dimensiones por CSS) para que la página no salte al cargar.

## V2. Ampliar la portada (FE-4)
- V2.1 CUANDO el usuario active la miniatura, EL SISTEMA DEBERÁ mostrar la portada a tamaño grande en un diálogo.
- V2.2 El diálogo DEBERÁ cerrarse con el botón «Cerrar», con la tecla Escape y al pulsar fuera de la imagen; al cerrarse, el foco DEBERÁ volver a la miniatura.
- V2.3 El diálogo DEBERÁ ser accesible: rol de diálogo con nombre, foco atrapado mientras está abierto y la imagen con texto alternativo.
- V2.4 EL SISTEMA DEBERÁ mostrar la imagen ampliada a como máximo el 90 % del alto y del ancho de la ventana, sin desbordar en móvil.

## V3. Descargar la portada (FE-4)
- V3.1 CUANDO el libro tenga portada, EL SISTEMA DEBERÁ ofrecer un botón «Descargar portada» en el detalle.
- V3.2 El botón DEBERÁ descargar el archivo que ya sirve `GET /api/uploads/<nombre>` (sin token; la ruta es pública según U3.1 de `book-image-upload`), sin pasar por una petición con cabeceras.
- V3.3 El nombre del archivo DEBERÁ construirse a partir del título (`título-normalizado.<extensión>`: minúsculas, sin acentos ni símbolos, espacios por guiones) y conservar la extensión real de la imagen; si el título queda vacío, `portada`.
- V3.4 EL SISTEMA NO DEBERÁ exponer en el nombre de descarga el nombre interno del archivo (UUID) ni ningún dato interno.

## V4. Diseño responsive
- V4.1 EL SISTEMA DEBERÁ mostrar en una columna en móvil (≤ 640 px): portada centrada y ancho limitado, luego título, datos y acciones; desde 640 px, portada a la izquierda y datos a la derecha (el diseño actual).
- V4.2 Las acciones («Editar», «Descargar portada», «Eliminar», «Volver a los libros») DEBERÁN ocupar todo el ancho en móvil con un área táctil de al menos 44 px de alto, y agruparse en fila desde 640 px.
- V4.3 EL SISTEMA NO DEBERÁ producir desplazamiento horizontal en ningún ancho desde 320 px.
- V4.4 Los datos (autor, editorial, género, precio, disponibilidad, fechas) DEBERÁN ser legibles en una columna en móvil y en dos columnas desde 640 px, con el contraste de texto de WCAG AA.
- V4.5 EL SISTEMA DEBERÁ respetar la preferencia de movimiento reducido (`prefers-reduced-motion`) en cualquier transición del diálogo.

## V5. Pruebas (T-1, T-3)
- V5.1 Pruebas de `BookDetailPage` para: con y sin portada, imagen rota, apertura y cierre del diálogo (botón, Escape, fondo), retorno del foco, enlace de descarga con el nombre esperado y ausencia del botón sin portada.
- V5.2 Prueba unitaria de la función que construye el nombre de descarga (acentos, símbolos, título vacío, extensión).
- V5.3 La cobertura del frontend DEBERÁ seguir en 80 % o más (`npm run test:cov`).
- V5.4 EL SISTEMA DEBERÁ verificarse en un navegador real a 375 px, 768 px y 1280 px: sin desplazamiento horizontal, diálogo usable con teclado, descarga real del archivo.
