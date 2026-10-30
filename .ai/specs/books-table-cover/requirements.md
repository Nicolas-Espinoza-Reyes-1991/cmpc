# Spec books-table-cover: Requisitos

Cubre los IDs del enunciado: **FE-2** (listado de libros: se mejora su presentación) y **FE-3b** (imagen por libro, en su visualización). Relacionados: GEN-2, T-1, T-3.
Depende de `books-listing` (la tabla `BookTable`), de `book-image-upload` (`imageUrl` y `GET /api/uploads/<nombre>`, público y con caché) y de `book-detail-cover` (componentes de miniatura, diálogo y descarga, y `coverFileName`).

Formato: CUANDO <evento>, EL SISTEMA DEBERÁ <respuesta>. Cada criterio es verificable.

> **Estado: pendiente de aprobación.** Las decisiones de `design.md` §1 se revisan antes de escribir código. La spec parte de la rama `feat/book-detail-cover` (PR #20), de la que reutiliza los componentes.

## Fuera de alcance
- Generar miniaturas en el servidor (archivos redimensionados): `product.md` lo deja como mejora futura. Aquí la miniatura es la misma imagen reducida por CSS (ver el riesgo de peso en `design.md` §3).
- Cambiar los datos, el orden, los filtros, la paginación o la exportación (CSV y Excel) del listado.
- Descargar varias portadas a la vez o todas las de la página.
- Subir o cambiar la portada desde el listado (se sigue haciendo en el formulario del libro).

## M1. Miniatura en la tabla
- M1.1 CUANDO se muestre el listado, EL SISTEMA DEBERÁ mostrar, como **primera columna**, la portada de cada libro como miniatura de tamaño fijo y proporción de libro (2:3), sin deformarla.
- M1.2 CUANDO el libro no tenga portada, EL SISTEMA DEBERÁ mostrar un marcador de las mismas dimensiones («Sin portada» como texto accesible) y NO DEBERÁ ofrecer descarga.
- M1.3 CUANDO la imagen no cargue, EL SISTEMA DEBERÁ mostrar ese mismo marcador en lugar de un icono roto, solo en esa fila.
- M1.4 EL SISTEMA DEBERÁ cargar las imágenes con `loading="lazy"` y `decoding="async"` y reservar su espacio, para que la tabla no salte al cargar ni se descarguen las que no se ven.
- M1.5 CUANDO el usuario active la miniatura, EL SISTEMA DEBERÁ ampliarla en el mismo diálogo accesible de la ficha (cierre por botón, Escape y fondo; el foco vuelve a la miniatura).

## M2. Descargar desde la tabla
- M2.1 CUANDO el libro tenga portada, EL SISTEMA DEBERÁ ofrecer en su fila un botón «Descargar» que guarde el archivo con el nombre legible de `coverFileName` (por ejemplo `dune.png`).
- M2.2 EL botón DEBERÁ descargar el archivo público de `/api/uploads` sin pasar por una petición con cabeceras (igual que en la ficha).
- M2.3 CUANDO el libro no tenga portada o la imagen no cargue, la celda del botón DEBERÁ quedar vacía (no un botón que no pueda funcionar).
- M2.4 EL botón DEBERÁ tener un nombre accesible único por fila: «Descargar portada de <título>».

## M3. Accesibilidad y adaptación
- M3.1 CADA miniatura DEBERÁ tener texto alternativo «Portada de <título>» y su botón de ampliar, nombre accesible «Ampliar portada de <título>».
- M3.2 LAS dos columnas nuevas DEBERÁN tener encabezado (la de descarga, solo para lectores de pantalla) y NO DEBERÁN ser ordenables; el orden y `aria-sort` de las demás no cambian.
- M3.3 EN pantallas estrechas (360 px) la página NO DEBERÁ desbordar: la tabla sigue desplazándose dentro de su contenedor.
- M3.4 EL objetivo de pulsación del botón y de la miniatura DEBERÁ medir al menos 44 px de alto en móvil, y el foco con teclado DEBERÁ verse.

## M4. Restricciones
- M4.1 SIN dependencias nuevas y SIN cambios en el backend ni en la API (la lista ya trae `imageUrl`).
- M4.2 NO DEBERÁ cambiar ninguna ruta ni la URL del listado.
- M4.3 LA ficha del libro DEBERÁ seguir viéndose y comportándose igual (los componentes compartidos mantienen su tamaño actual en ella).

## M5. Pruebas y verificación
- M5.1 Pruebas unitarias de la celda de portada, de la celda de descarga, de las variantes de los componentes compartidos y de la tabla; cobertura ≥ 80 % (objetivo 100 %).
- M5.2 Navegador real con Docker: tabla con y sin portadas, imagen rota, ampliar, descargar con el nombre esperado, teclado, móvil (360 px) y escritorio, y consola sin errores.
