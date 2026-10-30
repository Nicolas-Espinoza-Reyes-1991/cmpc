# Spec book-detail-cover: Diseño

Ver `requirements.md` para los criterios (V1–V5). Este diseño es solo de frontend: no cambia la API ni la base de datos.

## 1. Decisiones a aprobar
1. **«Miniatura» sin generar archivos.** La miniatura es la misma imagen servida, mostrada a tamaño fijo con CSS. Generar miniaturas en el servidor (redimensionado con `sharp`, etc.) requeriría una dependencia nueva (no está en `tech-stack.md`) y ya figura como mejora futura en `product.md`. **Pregunta:** ¿basta con este enfoque?
2. **«Descargar» = descargar la portada.** Se interpreta que el botón descarga la imagen del libro, no sus datos. Si se quería el CSV de un libro o una ficha en PDF, cambia el alcance.
3. **Ampliar en diálogo, no en una pestaña nueva.** Mantiene al usuario en la ficha; el diálogo usa `<dialog>` nativo para obtener foco y Escape sin dependencias.
4. **Enlace directo para la descarga.** `GET /api/uploads/<nombre>` es público (U3.1), así que `<a download>` funciona sin pasar por Axios ni por `saveBlob`. El nombre se fija en el atributo `download`; el navegador puede ignorarlo si el origen es distinto (la app sirve la API en el mismo origen por el proxy).

## 2. Componentes
Todo dentro de `frontend/src/pages/BookDetailPage.tsx` y componentes pequeños nuevos:

- `Cover` (ya existe): añade `loading="lazy"`, `decoding="async"`, estado de error (`onError` → marcador «Sin portada») y el botón que abre el diálogo.
- `CoverPreview` (nuevo, `components/CoverPreview.tsx`): `<dialog>` controlado con `showModal()` / `close()`; cierra al pulsar fuera (clic sobre el propio `<dialog>` cuando el objetivo es el `dialog`), restaura el foco al elemento que lo abrió.
- `CoverDownload` (nuevo, `components/CoverDownload.tsx`): enlace `<a href={imageUrl} download={fileName}>` con el estilo de botón.
- `lib/cover-file-name.ts` (nuevo): `coverFileName(title, imageUrl)` — función pura, probada con Vitest.

## 3. Diseño responsive
- Contenedor `max-w-3xl`; `grid gap-6` en móvil y `sm:grid-cols-[12rem_1fr]` desde 640 px (ya existe).
- Portada: `mx-auto w-40 sm:w-full` (ancho fijo 10rem en móvil, 12rem en escritorio), `aspect-[2/3]`.
- Acciones: `flex flex-col gap-3 sm:flex-row sm:flex-wrap`, botones con `min-h-11` (44 px).
- Dialog: `m-auto max-h-[90vh] w-[min(90vw,48rem)]`, imagen `w-full max-h-[75vh] object-contain` (ajustado al probar en navegador: sin ancho fijo, una imagen pequeña se veía en 16 px).
- Movimiento: transición solo bajo `motion-safe:`.

## 4. Accesibilidad
- Miniatura: botón con `aria-label="Ampliar portada de {título}"`.
- Diálogo: `aria-labelledby` apuntando al título del libro; botón «Cerrar» con foco inicial.
- Marcador sin portada: `role="img"` con etiqueta (ya existe).

## 5. Pruebas
- Vitest + React Testing Library en `BookDetailPage.spec.tsx` (ya existe, se amplía) y `CoverPreview.spec.tsx`, `CoverDownload.spec.tsx`, `cover-file-name.spec.ts`.
- Mocks: `useBook` mockeado a través de `mock-api` ya presente; `HTMLDialogElement.showModal` se simula en `test/setup.ts` porque jsdom no lo implementa.

## 6. Verificación manual
Navegador real (Docker o `npm run dev` con el backend) a 375, 768 y 1280 px: capturas, comprobación de desplazamiento horizontal con `document.documentElement.scrollWidth <= clientWidth`, descarga real con el nombre esperado.
