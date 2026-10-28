# Spec book-image-upload: Diseño

Implementa los requisitos de `requirements.md`. Los códigos U# remiten a ese archivo.

## 1. Decisiones (a revisar: esta spec se implementó sin la pausa de aprobación)

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| **Memoria** (`memoryStorage` de multer) con tope de 2 MB, y el servicio escribe el archivo solo tras validarlo | `diskStorage` directo | Con 2 MB como máximo la memoria es segura; así nunca queda un archivo a medio validar en el disco y el nombre lo decide el servidor, no multer |
| El tipo se decide por los **primeros bytes** (JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`, WebP `RIFF????WEBP`) y la extensión sale de ahí | Confiar en `mimetype` o en la extensión | Ambos los controla el cliente: un `.png` que en realidad es HTML o un script pasaría. Se implementa a mano para no añadir una dependencia fuera de `tech-stack.md` (`file-type`) |
| Nombre `<uuid>.<ext>`; `imageUrl` guarda la ruta relativa `/api/uploads/<nombre>` | Nombre original del cliente, o URL absoluta | El nombre del cliente permite colisiones, caracteres peligrosos y `..`; una ruta relativa funciona igual detrás de nginx, en desarrollo y en otro dominio |
| `GET /api/uploads/...` **público** (middleware estático de Express) | Servirlo detrás del token con un controlador | Una etiqueta `<img>` no envía `Authorization`; la alternativa sería descargar con `fetch` y crear URLs `blob:`, mucho más código para una portada. UUID no adivinable; no es un dato sensible |
| Caché `immutable` de un año | Caché corta | Cada subida crea un nombre nuevo, así que un archivo nunca cambia; el navegador no vuelve a pedirlo |
| Orden: escribir el archivo → actualizar la base → borrar el archivo anterior | Base primero | Si falla la base se borra el archivo nuevo (U1.7) y el libro sigue intacto; si falla el borrado del anterior solo queda un archivo sin referencia, que se registra y se puede barrer. Lo inverso dejaría un libro apuntando a un archivo que no existe |
| La actualización de la base usa `prisma.live.$transaction` como el resto de escrituras | `update` suelto | `audit-log` añadirá su registro en la misma transacción sin cambiar la forma del código |
| `POST` y `DELETE` sobre `/books/:id/image` | `PATCH /books/:id` con multipart | Mantiene `PATCH` en JSON puro (límite de 100 KB y DTO validados) y separa el binario |
| En el alta, primero se crea el libro y después se sube la imagen | Un solo `multipart` para todo | Reutiliza el endpoint de alta y su validación; si la subida falla el libro ya existe y el usuario lo corrige en la edición (U5.4) |
| El frontend valida tipo y tamaño antes de enviar, pero **el servidor decide** | Solo servidor | Respuesta inmediata y sin gastar ancho de banda; el cliente puede mentir, por eso el servidor repite todo |
| `multer` se fija en 2.5.0 con `overrides` en `package.json` | `npm audit fix` (no puede: `@nestjs/platform-express` 11.2.8 fija exactamente la 2.4.0), o esperar a una versión de Nest que lo incluya | Cierra el hallazgo de DoS que `platform` dejó anotado para esta spec (U4.5). No es una dependencia nueva, solo la versión de una transitiva; la vulnerabilidad exige un `fileFilter` asíncrono, que esta spec no usa, pero se corrige igual. Cuando Nest publique una 11.x que fije ≥ 2.5.0 se puede quitar el `overrides` |

## 2. Backend

```
backend/src/
├── books/
│   ├── images/
│   │   ├── image-type.ts            # sniffImageType(buffer): { mime, extension } | null
│   │   ├── image-storage.ts         # ImageStorage: save, remove, urlFor, nameFromUrl
│   │   └── image-upload.config.ts   # límite de 2 MB y opciones de multer
│   ├── books.service.ts             # + setImage, removeImage
│   └── books.controller.ts          # + POST/DELETE :id/image
└── app.setup.ts                     # + useStaticAssets(UPLOAD_DIR, prefix /api/uploads)
```

- **`sniffImageType(buffer)`**: función pura. JPEG: `FF D8 FF`; PNG: los 8 bytes de la firma; WebP: `RIFF` + 4 bytes de tamaño + `WEBP`. Devuelve `{ mime, extension }` (`jpg`, `png`, `webp`) o `null`. Un buffer de menos de 12 bytes es `null`.
- **`ImageStorage`** (inyectable, depende de `ConfigService`): `onModuleInit` resuelve `UPLOAD_DIR` a una ruta absoluta y la crea (`mkdir -p`). `save(buffer, extension)` genera el nombre con `randomUUID()`, escribe con la bandera `wx` (falla si existiera) y devuelve el nombre; `remove(name)` borra y **valida el nombre** con la expresión `^[0-9a-f-]{36}\.(jpg|png|webp)$` antes de tocar el disco (un `imageUrl` manipulado en la base nunca puede apuntar fuera del directorio); `urlFor(name)` da `/api/uploads/<name>` y `nameFromUrl(url)` lo invierte (o `null` si no es una URL de este servicio). Los errores de `remove` se capturan y se registran (U2.3).
- **`BooksService.setImage(id, file)`**: `sniffImageType(file.buffer)` (si `null` → `BadRequestException` con el motivo); comprueba que el libro exista **antes** de escribir (`findUnique` por `prisma.live`; 404 sin dejar archivo, U1.6); `name = storage.save(...)`; transacción `tx.book.update({ imageUrl })`; si falla → `storage.remove(name)` y relanza (U1.7); si va bien → borra el archivo anterior (`nameFromUrl(previous)`) y devuelve el `BookDto`.
- **`BooksService.removeImage(id)`**: lee el libro (404 si no existe), si no tiene imagen lo devuelve tal cual (U2.2), si la tiene la pone en `null` en la transacción y después borra el archivo.
- **`BooksController`**: `@Post(':id/image')` con `@UseInterceptors(FileInterceptor('image', multerOptions))`, `@UploadedFile()` y `@ApiConsumes('multipart/form-data')` con el esquema de Swagger (`type: 'string', format: 'binary'`); `@Delete(':id/image')`. Un archivo ausente es `BadRequestException('An image file is required in the field "image"')`. Los errores de multer: `LIMIT_FILE_SIZE` lo traduce Nest a 413 (`PayloadTooLargeException`) y un campo inesperado o más de un archivo a 400, ambos por el filtro de errores único.
- **Configuración de multer**: `limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0 }`, `storage: memoryStorage()`. `fileSize` corta la lectura del flujo en cuanto lo supera (U4.3). Sin `fileFilter` por `mimetype` (lo decide el contenido).
- **Servir (`app.setup.ts`)**: `app.useStaticAssets(uploadDir, { prefix: '/api/uploads', index: false, dotfiles: 'ignore', redirect: false, maxAge: '1y', immutable: true, setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff') })`. Va después del middleware de seguridad y antes de las rutas, y por ser middleware de Express queda fuera del guard JWT. `helmet` mantiene `Cross-Origin-Resource-Policy`; con el proxy de nginx y el de Vite todo es del mismo origen.
- **`app.setup.ts` y `NestExpressApplication`**: `configureApp` ya recibe esa clase, así que `useStaticAssets` está disponible. La ruta `/api/uploads` no aparece en Swagger (no es un controlador).

## 3. Frontend

```
frontend/src/
├── lib/image-file.ts               # validateImageFile(file): mensaje en español | null
├── services/books.service.ts       # + uploadBookImage(id, file), deleteBookImage(id)
├── components/ImageField.tsx       # campo de archivo con vista previa, errores y «Quitar imagen»
└── components/BookForm.tsx / pages/BookFormPage.tsx   # integran el campo y el flujo
```

- **`validateImageFile`**: tipo en {`image/jpeg`, `image/png`, `image/webp`} y tamaño ≤ 2 MB; devuelve el mensaje («La portada debe ser una imagen JPG, PNG o WebP.», «La portada no puede pesar más de 2 MB.») o `null`. El navegador informa `file.type` según la extensión: es una ayuda, no una garantía.
- **`uploadBookImage`**: `FormData` con el campo `image`; no se fija `Content-Type` (el navegador añade el `boundary`); devuelve el `Book` actualizado.
- **`ImageField`**: `<input type="file" accept="image/jpeg,image/png,image/webp">`, vista previa con `URL.createObjectURL` (se revoca al cambiar o desmontar), imagen actual cuando se edita, «Quitar imagen» (casilla que, al guardar, borra la imagen) y el mensaje de validación enlazado con `aria-describedby`. No pertenece al esquema de Zod (un `File` no es un valor del formulario de React Hook Form): el estado del archivo lo guarda `BookForm` junto al formulario y se entrega a `onSubmit` como segundo argumento `{ image, removeImage }`.
- **Flujo de guardado** (`BookFormPage`): alta → `createBook` → si hay archivo, `uploadBookImage`; edición → `updateBook` (solo lo que cambió) → `deleteBookImage` si se marcó «Quitar» o `uploadBookImage` si se eligió otro archivo. Si la imagen falla, el libro ya está guardado: se navega a `/books/:id/edit` con `state: { imageError }` y la pantalla de edición muestra el aviso (U5.4). La caché se actualiza con el libro que devuelve la última operación.
- **Edición sin cambios de datos**: si solo cambió la imagen, no se envía `PATCH` (la API respondería 400 a una edición vacía) y se sube la imagen.

## 4. Seguridad: amenazas y mitigaciones

| Amenaza | Mitigación |
|---|---|
| Archivo que se hace pasar por imagen (HTML, script, SVG con JavaScript) | El tipo sale de los bytes; solo JPEG, PNG y WebP. SVG no se acepta. Se sirve con su `Content-Type` real y `nosniff` |
| Nombre de archivo malicioso o `../` | Nunca se usa el nombre del cliente; el servidor genera `<uuid>.<ext>` y valida el patrón antes de borrar |
| Agotar memoria o disco con archivos enormes | Tope de 2 MB aplicado al leer el flujo; un solo archivo; sin otros campos |
| Rutas fuera del directorio al servir | El middleware estático de Express normaliza la ruta y rechaza `..`, ocultos y absolutas; se prueba con peticiones reales |
| Archivos huérfanos en el disco | Orden escribir → base → borrar el anterior; limpieza si falla la base; el fallo al borrar se registra |
| Subida sin sesión | El guard global exige token en `POST` y `DELETE`; solo la lectura de la imagen es pública (U3.1) |
| Vulnerabilidad conocida de `multer` | Actualización con `npm audit fix` |

## 5. Pruebas

- **Unitarias (backend):** `sniffImageType` con firmas reales (cada formato, buffers cortos o vacíos, firmas parciales y falsas), `ImageStorage` con un directorio temporal real (crea el directorio, nombres únicos, escribe, borra, rechaza nombres inválidos, tolera un archivo inexistente), `BooksService.setImage/removeImage` (éxito, reemplazo, libro inexistente sin escribir, contenido falso, fallo de la base con limpieza, fallo al borrar el anterior) y el controlador.
- **HTTP con Passport real y `multipart` real (backend):** 401 sin token; 200 con un PNG, un JPEG y un WebP válidos; 400 con texto renombrado a `.png`, GIF, SVG y archivo vacío; 413 con 2 MB + 1; 400 sin archivo, con otro campo y con dos archivos; 404 sin dejar archivos; `GET /api/uploads/<nombre>` público con `Cache-Control` y `nosniff`, y 404 con `..`.
- **Contra PostgreSQL y disco reales:** ver U6.4.
- **Unitarias (frontend):** `validateImageFile`, `uploadBookImage`/`deleteBookImage`, `ImageField` (vista previa, errores, quitar, revocar la URL) y los flujos de alta y edición (con subida, reemplazo, quitar, solo imagen y fallo de subida).
- **Punta a punta:** Docker y navegador real, incluida la persistencia del volumen tras reiniciar el backend.

## 6. Mejoras futuras
- Almacenamiento en la nube (S3/MinIO) detrás de `ImageStorage` (la interfaz ya aísla el disco).
- Redimensionado y miniaturas para el listado; conversión a WebP.
- Eliminación de metadatos (EXIF) y análisis antivirus del contenido.
- Tarea de limpieza que borre archivos sin referencia en la base.
- URLs firmadas si algún día las imágenes dejaran de ser públicas.
