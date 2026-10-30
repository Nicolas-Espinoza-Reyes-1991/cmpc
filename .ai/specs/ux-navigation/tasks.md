# Spec ux-navigation: Tareas

Reglas: seguir el orden; una tarea está hecha solo cuando su criterio se cumple y sus pruebas pasan. Un commit por tarea (formato convencional, en inglés).
Antes de cada tarea se leen `requirements.md` y `design.md`; cada cambio de decisión se refleja en `design.md`.
Marcar con `[x]` al terminar.

- [x] **N-01 Vista guardada del listado** (N2.4, N2.5, N4.2, N5.1)
  - `lib/listingView.ts`, `useListingPath` y que `BooksPage` guarde su `search`; «Cerrar sesión» la borra.
  - Hecho cuando: pruebas de guardar/leer/borrar, sin `sessionStorage` y con error; `lint`, `tsc` y cobertura pasan.
  - Commit: `feat(frontend): remember the listing view of the tab`

- [ ] **N-02 Botón «Ver» y columna «Acciones»** (N1.1 a N1.5, N5.1)
  - Título como texto; `BookActionsCell` con «Ver» y «Descargar»; encabezado visible.
  - Hecho cuando: pruebas de la tabla pasan y, en el navegador a 1400 px con palabras largas, no hay desplazamiento.
  - Commit: `feat(frontend): replace the title link with a View button in the books table`

- [ ] **N-03 Ficha: botón y ruta de navegación** (N2.1 a N2.3, N2.6, N5.1)
  - Ruta «Libros › título» y botón «← Volver a los libros» arriba; se elimina el enlace del final.
  - Commit: `feat(frontend): add a back button and breadcrumb to the book detail`

- [ ] **N-04 Volver siempre a la vista guardada** (N2.4, N2.5, N5.1)
  - La ficha, «Libro no encontrado», `NotFoundPage`, «Cancelar» del formulario y la navegación tras eliminar usan `useListingPath`.
  - Commit: `feat(frontend): return to the saved listing view from every screen`

- [ ] **N-05 Cabecera activa y título de pestaña** (N3.1, N3.2, N5.1)
  - `NavLink` «Libros» con estado activo y `useDocumentTitle` en cada página.
  - Commit: `feat(frontend): mark the active section and title every page`

## Integración y cierre
- [ ] **N-06 Verificación en navegador real** (N1.5, N2.6, N4.3, N5.2)
  - Docker y navegador: «Ver», volver con y sin filtros, tras editar y tras eliminar, cabecera activa, título de pestaña, teclado y foco, 1400 y 360 px; anotar cada escenario.
  - Commit: `docs(ux-navigation): record the browser verification`

- [ ] **N-07 Verificación de la spec**
  - Recorrer N1 a N5 con evidencia nueva (lint, tipos, build, cobertura ≥ 80 % y fallando por debajo, `npm audit`), actualizar las cifras del README y registrar el resultado.
  - Commit: `docs(ux-navigation): record the spec verification`

## Registro de verificación
(Se completa al terminar N-06 y N-07.)
