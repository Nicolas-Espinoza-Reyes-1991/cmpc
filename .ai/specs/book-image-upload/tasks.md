# Spec book-image-upload: Tareas

Reglas: seguir el orden; una tarea está hecha solo cuando su criterio se cumple y sus pruebas pasan. Un commit por tarea (formato convencional, en inglés).
Antes de cada tarea se leen `requirements.md` y `design.md`; cada cambio de decisión se refleja en `design.md`.
Marcar con `[x]` al terminar.

## Backend
- [x] **U-01 Actualizar `multer`** (U4.5)
  - `npm audit fix` no puede resolverlo: ninguna versión 11.x de `@nestjs/platform-express` fija todavía `multer` 2.5.0 (la 11.2.8 fija la 2.4.0, vulnerable). Se fija con `overrides` en `package.json` (`multer: 2.5.0`) y se comprueba que `npm audit --omit=dev` ya no lista `multer` (de 7 hallazgos a 5).
  - Hecho cuando: `lint`, `tsc`, build, `test:cov` y e2e siguen pasando.
  - Commit: `build(backend): update multer to fix the denial of service advisory`

- [x] **U-02 Validación por contenido y almacenamiento** (U1.3, U1.5, U3.4, U4.2, U4.4, U6.1)
  - `image-type.ts` (`sniffImageType`) e `image-storage.ts` (`ImageStorage`: `save`, `remove`, `urlFor`, `nameFromUrl`).
  - Pruebas: firmas reales de JPEG, PNG y WebP; buffers cortos, vacíos y firmas falsas; el almacenamiento con un directorio temporal real (crea el directorio, nombres únicos, escribe, borra, rechaza nombres inválidos y `..`, tolera un archivo inexistente).
  - Commit: `feat(books): add image type detection and file storage`

- [x] **U-03 Servicio y controlador de la imagen** (U1.1, U1.2, U1.4, U1.6, U1.7, U2.1 a U2.3, U4.1, U4.3)
  - `BooksService.setImage` y `removeImage`, `POST` y `DELETE /api/books/:id/image` con `FileInterceptor` y Swagger multipart.
  - Pruebas: éxito, reemplazo (borra el anterior), libro inexistente sin escribir, contenido falso, fallo de la base con limpieza, fallo al borrar el anterior, idempotencia de quitar; controlador; HTTP con Passport y `multipart` real (401, 200, 400, 413, 404 sin archivos).
  - Commit: `feat(books): add book image upload and removal endpoints`

- [x] **U-04 Servir las imágenes** (U3.1 a U3.3)
  - `useStaticAssets` en `configureApp` con caché larga y `nosniff`; el e2e comprueba que `/api/uploads` es público y no entra en Swagger.
  - Pruebas HTTP: se sirve el archivo subido con sus cabeceras; 404 si no existe; `..` y archivos ocultos no salen del directorio; no lista el directorio.
  - Commit: `feat(app): serve uploaded images with long cache headers`

- [x] **U-05 Verificación contra PostgreSQL y disco reales** (U6.4)
  - Backend compilado: subir PNG, JPEG y WebP reales; texto renombrado, GIF, SVG, vacío y 2 MB + 1 rechazados sin dejar archivos; reemplazo y borrado sin huérfanos; libro eliminado → 404 sin archivo; cabeceras; sin token; intentos de salir del directorio.
  - Hecho cuando: cada comprobación queda en el registro de verificación.
  - Commit: `docs(book-image-upload): record the backend verification`

## Frontend
- [x] **U-06 Servicio y validación del archivo** (U5.2, U6.2)
  - `validateImageFile`, `uploadBookImage` y `deleteBookImage`.
  - Pruebas: cada tipo y tamaño permitido y rechazado (el límite exacto de 2 MB); el servicio envía `FormData` con el campo `image` y desenvuelve `data`.
  - Commit: `feat(frontend): add image file validation and upload services`

- [ ] **U-07 Campo de imagen en el formulario** (U5.1, U5.3 a U5.6)
  - `ImageField` con vista previa, imagen actual, «Quitar imagen» y errores; integración en `BookForm` y en el flujo de `BookFormPage` (alta, edición, solo imagen y fallo de subida con aviso en la edición).
  - Pruebas: vista previa y revocación de la URL; error de tipo y de tamaño sin enviar nada; alta con imagen; edición con reemplazo; quitar; solo imagen sin `PATCH`; fallo de subida deja el libro guardado y avisa; la caché queda al día.
  - Commit: `feat(frontend): add the cover image field to the book form`

## Integración y cierre
- [ ] **U-08 Verificación de punta a punta** (U6.4)
  - Docker y navegador real: subir una portada en el alta, verla en el detalle, reemplazarla y quitarla; archivo falso y archivo grande rechazados en pantalla; la imagen sigue tras reiniciar el backend (volumen); cabeceras de caché.
  - Hecho cuando: cada escenario queda anotado.
  - Commit: `docs(book-image-upload): record the end-to-end verification`

- [ ] **U-09 Verificación de la spec**
  - Recorrer U1 a U6 con evidencia nueva (lint, tipos, build, cobertura ≥ 80 % y fallando por debajo en ambas apps; `npm audit`) y registrar el resultado. Marcar el pendiente de `multer` en `platform/tasks.md` como resuelto.
  - Commit: `docs(book-image-upload): record the spec verification`

## Registro de verificación
(Se completa en U-05, U-08 y U-09.)

### U-05: subida de imágenes contra el servidor, PostgreSQL y el disco reales (2026-10-29)
Entorno: backend compilado (`node dist/main`) contra la base de desarrollo, con `UPLOAD_DIR` en un directorio temporal vacío (borrado al terminar) y peticiones `multipart` reales de Node (`FormData`); PNG, JPEG y WebP reales de 1×1 píxel. Los datos de prueba se borraron de la base.

| Comprobación | Resultado |
|---|---|
| Subir un PNG | 200; `imageUrl` = `/api/uploads/<uuid>.png`; 1 archivo en disco; la base coincide |
| Ver el PNG **sin token** | 200, `Content-Type: image/png`, `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`, bytes idénticos a los subidos |
| Reemplazar por JPEG y luego por WebP | 200 en ambos, extensión `.jpg` y `.webp` según el contenido; el archivo anterior desaparece del disco cada vez (siempre 1 archivo) y la base apunta al nuevo |
| Texto renombrado `.png`, HTML con tipo `image/png`, SVG con script, GIF, archivo vacío y un `.exe` | 400 los seis; el disco y la base no cambian |
| 2 MB exactos / 2 MB + 1 byte | 200 / **413** (cuerpo `statusCode: 413`); el archivo rechazado no deja nada en disco |
| Sin archivo, otro nombre de campo (`photo`), dos archivos, un campo de texto extra y un cuerpo JSON | 400 las cinco |
| `POST` y `DELETE` sin token | 401 las dos |
| Libro inexistente / `:id` que no es UUID | 404 / 400, sin dejar archivos |
| Salir del directorio: `/api/uploads/../package.json`, `..%2f..%2f.env`, `%2e%2e/%2e%2e/.env`, `..%5c..%5c.env`, el directorio con y sin barra y `.hidden` | 404 los siete; ningún contenido secreto en las respuestas |
| `DELETE` de la imagen | 200 con `imageUrl: null`; el archivo se borra; la base queda en `null`; la segunda llamada también da 200 (idempotente) |
| Libro eliminado (borrado lógico) | Subir y quitar imagen dan 404 y no tocan el disco |
| Archivos en disco frente a los que referencia la base | Idénticos: sin archivos huérfanos |
| Log del servidor | Solo líneas `[HTTP]` con método, ruta, estado, duración y usuario (los 4xx como `WARN`); ningún contenido de archivos |

Observaciones:
- **Libro eliminado con imagen**: el borrado lógico conserva la fila y, por tanto, su archivo, que sigue sirviéndose en `/api/uploads/<nombre>` (200). Es coherente con el borrado lógico (el libro podría restaurarse) y con que las portadas no son datos sensibles, pero conviene saberlo; la limpieza de archivos de libros eliminados queda como mejora futura en `design.md` §6.
- Una comprobación de mi script ("ver la imagen sin token" al final del recorrido) dio 404 porque usé la URL de un archivo que el paso anterior (los 2 MB exactos) ya había reemplazado; el 404 es el comportamiento correcto y el acceso público sin token ya quedó probado en el primer paso.
