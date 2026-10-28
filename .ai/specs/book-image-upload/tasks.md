# Spec book-image-upload: Tareas

Reglas: seguir el orden; una tarea está hecha solo cuando su criterio se cumple y sus pruebas pasan. Un commit por tarea (formato convencional, en inglés).
Antes de cada tarea se leen `requirements.md` y `design.md`; cada cambio de decisión se refleja en `design.md`.
Marcar con `[x]` al terminar.

## Backend
- [x] **U-01 Actualizar `multer`** (U4.5)
  - `npm audit fix` no puede resolverlo: ninguna versión 11.x de `@nestjs/platform-express` fija todavía `multer` 2.5.0 (la 11.2.8 fija la 2.4.0, vulnerable). Se fija con `overrides` en `package.json` (`multer: 2.5.0`) y se comprueba que `npm audit --omit=dev` ya no lista `multer` (de 7 hallazgos a 5).
  - Hecho cuando: `lint`, `tsc`, build, `test:cov` y e2e siguen pasando.
  - Commit: `build(backend): update multer to fix the denial of service advisory`

- [ ] **U-02 Validación por contenido y almacenamiento** (U1.3, U1.5, U3.4, U4.2, U4.4, U6.1)
  - `image-type.ts` (`sniffImageType`) e `image-storage.ts` (`ImageStorage`: `save`, `remove`, `urlFor`, `nameFromUrl`).
  - Pruebas: firmas reales de JPEG, PNG y WebP; buffers cortos, vacíos y firmas falsas; el almacenamiento con un directorio temporal real (crea el directorio, nombres únicos, escribe, borra, rechaza nombres inválidos y `..`, tolera un archivo inexistente).
  - Commit: `feat(books): add image type detection and file storage`

- [ ] **U-03 Servicio y controlador de la imagen** (U1.1, U1.2, U1.4, U1.6, U1.7, U2.1 a U2.3, U4.1, U4.3)
  - `BooksService.setImage` y `removeImage`, `POST` y `DELETE /api/books/:id/image` con `FileInterceptor` y Swagger multipart.
  - Pruebas: éxito, reemplazo (borra el anterior), libro inexistente sin escribir, contenido falso, fallo de la base con limpieza, fallo al borrar el anterior, idempotencia de quitar; controlador; HTTP con Passport y `multipart` real (401, 200, 400, 413, 404 sin archivos).
  - Commit: `feat(books): add book image upload and removal endpoints`

- [ ] **U-04 Servir las imágenes** (U3.1 a U3.3)
  - `useStaticAssets` en `configureApp` con caché larga y `nosniff`; el e2e comprueba que `/api/uploads` es público y no entra en Swagger.
  - Pruebas HTTP: se sirve el archivo subido con sus cabeceras; 404 si no existe; `..` y archivos ocultos no salen del directorio; no lista el directorio.
  - Commit: `feat(app): serve uploaded images with long cache headers`

- [ ] **U-05 Verificación contra PostgreSQL y disco reales** (U6.4)
  - Backend compilado: subir PNG, JPEG y WebP reales; texto renombrado, GIF, SVG, vacío y 2 MB + 1 rechazados sin dejar archivos; reemplazo y borrado sin huérfanos; libro eliminado → 404 sin archivo; cabeceras; sin token; intentos de salir del directorio.
  - Hecho cuando: cada comprobación queda en el registro de verificación.
  - Commit: `docs(book-image-upload): record the backend verification`

## Frontend
- [ ] **U-06 Servicio y validación del archivo** (U5.2, U6.2)
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
