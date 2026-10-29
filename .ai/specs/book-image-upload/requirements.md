# Spec book-image-upload: Requisitos

Cubre los IDs del enunciado: **FE-3b**. Relacionados: GEN-2 (seguridad de producción), BE-3, T-1, T-2, T-3 y OPS-1 (volumen persistente de imágenes).
Depende de `books-crud` (modelo `Book` con `imageUrl`, formulario, detalle y `BooksService`) y de `platform` (configuración `UPLOAD_DIR`, filtro de errores, volumen `uploads` de Docker).

Formato: CUANDO <evento>, EL SISTEMA DEBERÁ <respuesta>. Cada criterio es verificable.

> **Nota sobre el proceso.** Esta spec se redactó y se implementó sin la pausa de aprobación que pide `CLAUDE.md`, por indicación expresa del usuario (trabajo autónomo durante la noche). Las decisiones que habrían ido a aprobación están en `design.md` §1 para su revisión.

## Fuera de alcance
- Varias imágenes por libro, recorte o redimensionado, miniaturas y almacenamiento en la nube (S3/MinIO): `product.md` los deja como mejoras futuras.
- Miniaturas en el listado (el listado no cambia en esta spec).
- Análisis antivirus del contenido y limpieza de metadatos (EXIF); se documentan como mejoras futuras.

## U1. Subir y reemplazar la imagen (FE-3b)
- U1.1 CUANDO se envíe `POST /api/books/:id/image` con un cuerpo `multipart/form-data` cuyo campo `image` sea una imagen válida, EL SISTEMA DEBERÁ guardarla, fijar `imageUrl` del libro y responder 200 con `{ data: Book }`.
- U1.2 CUANDO el libro ya tenga una imagen, EL SISTEMA DEBERÁ reemplazarla y borrar del disco el archivo anterior.
- U1.3 EL SISTEMA DEBERÁ aceptar solo JPEG, PNG y WebP y verificar el tipo por el **contenido** del archivo (los primeros bytes), no por el nombre, la extensión ni el `Content-Type` que declare el cliente; CUANDO el contenido no sea una de esas imágenes, DEBERÁ responder 400.
- U1.4 EL SISTEMA DEBERÁ rechazar con 413 un archivo de más de 2 MB y con 400 una petición sin archivo, con un campo distinto de `image`, con más de un archivo o que no sea `multipart/form-data`.
- U1.5 EL SISTEMA DEBERÁ guardar el archivo con un nombre generado por el servidor (`<uuid>.<extensión según el contenido>`) y NUNCA usar el nombre que envía el cliente.
- U1.6 CUANDO el libro no exista o esté eliminado, EL SISTEMA DEBERÁ responder 404 SIN dejar ningún archivo en el disco; CUANDO `:id` no sea un UUID, 400.
- U1.7 CUANDO falle la actualización del libro en la base de datos, EL SISTEMA DEBERÁ borrar el archivo recién escrito, de modo que no queden archivos huérfanos.

## U2. Quitar la imagen
- U2.1 CUANDO se envíe `DELETE /api/books/:id/image` de un libro con imagen, EL SISTEMA DEBERÁ dejar `imageUrl` en `null`, borrar el archivo y responder 200 con `{ data: Book }`.
- U2.2 CUANDO el libro no tenga imagen, EL SISTEMA DEBERÁ responder 200 con el libro sin cambios (la operación es idempotente); CUANDO no exista o esté eliminado, 404.
- U2.3 CUANDO no se pueda borrar el archivo anterior (por ejemplo, ya no existe), EL SISTEMA NO DEBERÁ fallar la operación: el libro ya quedó actualizado; DEBERÁ registrar el hecho en el log.

## U3. Servir las imágenes
- U3.1 EL SISTEMA DEBERÁ servir los archivos de `UPLOAD_DIR` en `GET /api/uploads/<nombre>` sin exigir token (una etiqueta `<img>` no puede enviar la cabecera `Authorization`); los nombres no se pueden adivinar (UUID) y las portadas no son datos sensibles.
- U3.2 EL SISTEMA DEBERÁ enviar cabeceras de caché de larga duración (`Cache-Control: public, max-age=31536000, immutable`; los nombres son únicos por subida) y `X-Content-Type-Options: nosniff`.
- U3.3 EL SISTEMA NO DEBERÁ listar el directorio ni servir archivos fuera de él (`..`, rutas absolutas, archivos ocultos) y DEBERÁ responder 404 para un archivo que no existe.
- U3.4 Los archivos DEBERÁN persistir entre reinicios (volumen `uploads` de Docker, R7.4 de `platform`).
- U3.5 EL SISTEMA DEBERÁ mostrar la imagen en el detalle del libro (`BookDetailPage` ya lo hace con `imageUrl`).

## U4. Seguridad
- U4.1 Las rutas de subida y de borrado DEBERÁN exigir token como el resto (A3.1 de `auth`).
- U4.2 EL SISTEMA NO DEBERÁ ejecutar ni interpretar el contenido subido: solo se guardan bytes de imágenes validadas y se sirven con su tipo correcto y `nosniff`.
- U4.3 El límite de 2 MB DEBERÁ aplicarse mientras se lee la petición (no después de cargar todo el archivo en memoria).
- U4.4 EL SISTEMA DEBERÁ resolver el directorio de subida desde `UPLOAD_DIR` y crearlo si no existe; el usuario del contenedor DEBERÁ poder escribir en él.
- U4.5 Las dependencias de subida (`multer`) DEBERÁN estar sin vulnerabilidades conocidas de gravedad alta (`npm audit --omit=dev` sin el hallazgo de `multer` que `platform` dejó anotado).

## U5. Formulario y pantallas (FE-3b)
- U5.1 EL SISTEMA DEBERÁ ofrecer en el formulario de libro (alta y edición) un campo opcional «Portada» para elegir un archivo, con vista previa antes de guardar.
- U5.2 EL SISTEMA DEBERÁ validar en el navegador, con mensajes en español, que el archivo sea JPEG, PNG o WebP y no supere 2 MB, antes de enviar nada; el servidor sigue siendo la autoridad (U1.3, U1.4).
- U5.3 EN la edición de un libro con imagen, EL SISTEMA DEBERÁ mostrar la imagen actual y ofrecer «Quitar imagen»; elegir un archivo nuevo DEBERÁ reemplazarla al guardar.
- U5.4 CUANDO se guarde un libro con una imagen elegida, EL SISTEMA DEBERÁ guardar primero los datos y subir después la imagen; CUANDO la subida falle, el libro DEBERÁ quedar guardado y el usuario DEBERÁ ver un aviso claro en la pantalla de edición (no perder el libro ni los datos).
- U5.5 CUANDO la subida o el borrado terminen, EL SISTEMA DEBERÁ mostrar el libro actualizado (la caché y las listas al día).
- U5.6 EL SISTEMA DEBERÁ ser accesible: etiqueta asociada al campo, mensajes de error enlazados y vista previa con texto alternativo.

## U6. Pruebas (T-1, T-2, T-3)
- U6.1 El backend DEBERÁ tener pruebas unitarias de la validación por contenido, del almacenamiento de archivos (con un directorio temporal real), de `BooksService` (subida, reemplazo, borrado, limpieza ante fallos) y del controlador, y pruebas HTTP con Passport real y `multipart` real (401, 200, 400 por contenido falso, 413, 404 sin dejar archivos, servir la imagen con sus cabeceras y sin salir del directorio).
- U6.2 El frontend DEBERÁ tener pruebas del servicio, de la validación del archivo, del campo de imagen y de los flujos de alta y edición con subida, reemplazo, quitar y fallo de subida.
- U6.3 La cobertura DEBERÁ seguir en 80 % o más en ambas aplicaciones.
- U6.4 EL SISTEMA DEBERÁ verificarse contra PostgreSQL y el sistema de archivos reales (reemplazo y borrado, sin huérfanos, archivos falsos rechazados, cabeceras de caché) y de punta a punta con Docker y un navegador real, incluida la persistencia del volumen tras reiniciar el backend.
