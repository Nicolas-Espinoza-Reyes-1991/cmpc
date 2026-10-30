# Spec book-detail-cover: Tareas

Orden de implementación. Cada tarea se marca como hecha solo cuando su prueba pasa, y cada una termina en un commit `feat:` o `test:` propio. **No empezar hasta aprobar `requirements.md` y `design.md`.**

- [x] **T1. Miniatura de la portada y estado sin imagen** (V1, V4.1)
  - Portada a tamaño fijo, `loading="lazy"`, `decoding="async"`, marcador ante error de carga.
  - Prueba: `BookDetailPage.spec.tsx` con y sin portada, con imagen rota.

- [x] **T2. Ampliar la portada en un diálogo** (V2)
  - `components/CoverPreview.tsx` con `<dialog>`; cierre por botón, Escape y fondo; retorno del foco.
  - Prueba: `CoverPreview.spec.tsx` (apertura, cierre por cada vía, foco) y `test/setup.ts` con el mock de `showModal`.

- [x] **T3. Botón de descarga de la portada** (V3)
  - `lib/cover-file-name.ts` y `components/CoverDownload.tsx`; solo se muestra con portada.
  - Prueba: `cover-file-name.spec.ts` (acentos, símbolos, título vacío, extensión) y `CoverDownload.spec.tsx` (`href` y `download`).

- [x] **T4. Diseño responsive y accesible** (V4)
  - Clases de los breakpoints de `design.md` §3; `motion-safe:` en las transiciones.
  - Prueba: `BookDetailPage.spec.tsx` (orden de las acciones en el DOM, etiquetas) y verificación manual a 375, 768 y 1280 px sin desplazamiento horizontal.

- [x] **T5. Verificación completa** (V5)
  - `npm run lint`, `npm run test:cov` (≥ 80 %), `npm run build` en `frontend/`.
  - Navegador real: capturas en tres anchos, descarga real con el nombre esperado.
  - Documentar en `README.md` (guía de uso del detalle) si cambia algo visible para el usuario.
