# Spec ux-navigation: Tareas

Reglas: seguir el orden; una tarea está hecha solo cuando su criterio se cumple y sus pruebas pasan. Un commit por tarea (formato convencional, en inglés).
Antes de cada tarea se leen `requirements.md` y `design.md`; cada cambio de decisión se refleja en `design.md`.
Marcar con `[x]` al terminar.

- [x] **N-01 Vista guardada del listado** (N2.4, N2.5, N4.2, N5.1)
  - `lib/listingView.ts`, `useListingPath` y que `BooksPage` guarde su `search`; «Cerrar sesión» la borra.
  - Hecho cuando: pruebas de guardar/leer/borrar, sin `sessionStorage` y con error; `lint`, `tsc` y cobertura pasan.
  - Commit: `feat(frontend): remember the listing view of the tab`

- [x] **N-02 Botón «Ver» y columna «Acciones»** (N1.1 a N1.5, N5.1)
  - Título como texto; `BookActionsCell` con «Ver» y «Descargar»; encabezado visible.
  - Hecho cuando: pruebas de la tabla pasan y, en el navegador a 1400 px con palabras largas, no hay desplazamiento.
  - Commit: `feat(frontend): replace the title link with a View button in the books table`

- [x] **N-03 Ficha: botón y ruta de navegación** (N2.1 a N2.3, N2.6, N5.1)
  - Ruta «Libros › título» y botón «← Volver a los libros» arriba; se elimina el enlace del final.
  - Commit: `feat(frontend): add a back button and breadcrumb to the book detail`

- [x] **N-04 Volver siempre a la vista guardada** (N2.4, N2.5, N5.1)
  - La ficha, «Libro no encontrado», `NotFoundPage`, «Cancelar» del formulario y la navegación tras eliminar usan `useListingPath`.
  - Commit: `feat(frontend): return to the saved listing view from every screen`

- [x] **N-05 Cabecera activa y título de pestaña** (N3.1, N3.2, N5.1)
  - `NavLink` «Libros» con estado activo y `useDocumentTitle` en cada página.
  - Commit: `feat(frontend): mark the active section and title every page`

## Integración y cierre
- [x] **N-06 Verificación en navegador real** (N1.5, N2.6, N4.3, N5.2)
  - Docker y navegador: «Ver», volver con y sin filtros, tras editar y tras eliminar, cabecera activa, título de pestaña, teclado y foco, 1400 y 360 px; anotar cada escenario.
  - Commit: `docs(ux-navigation): record the browser verification`

- [x] **N-07 Verificación de la spec**
  - Recorrer N1 a N5 con evidencia nueva (lint, tipos, build, cobertura ≥ 80 % y fallando por debajo, `npm audit`), actualizar las cifras del README y registrar el resultado.
  - Commit: `docs(ux-navigation): record the spec verification`

## Registro de verificación
### N-06: verificación en navegador real con Docker (2026-10-30)
Entorno: `docker compose up --build` de la rama en su propio proyecto, puertos e imágenes (`:18085`), sin tocar el sistema del usuario; navegador integrado a 1400 px y en móvil (375 px). Datos: libros con palabras largas sin espacios (como los que tecleó el usuario), con y sin portada.

| Escenario | Resultado |
|---|---|
| Listado a 1400 px, palabras largas | Columnas Portada … Registrado, **Acciones**; caja 1086 px = contenido 1086 px (sin desplazamiento); ningún título es enlace (0); un «Ver detalle de <título>» por fila (7 de 7); «Descargar» solo en las filas con portada |
| Filtro y «Ver» | Con `?q=Dune` en el listado, «Ver» abre la ficha: pestaña «Dune · CMPC Libros», ruta «Libros › Dune» (último elemento con `aria-current="page"`), botón «← Volver a los libros» arriba y sin enlace repetido al final |
| Cabecera | «Libros» junto al logo con `aria-current="page"` (subrayado y en negrita) en el listado, la ficha y el formulario; su enlace y el del logo apuntan a `/books?q=Dune` |
| Volver | El botón devuelve a `/books?q=Dune` con el buscador lleno y el filtro aplicado |
| Editar y guardar | Editar → cambiar el precio → Guardar → ficha con el precio nuevo; el botón de volver sigue apuntando a `/books?q=Dune`; pestaña «Editar libro · CMPC Libros» en el formulario |
| Eliminar | Con el filtro activo, confirmar «¿Eliminar «Dune»?» lleva a `/books?q=Dune` (vacío, con «Limpiar filtros») |
| Acceso directo | Sin vista guardada, abrir la ficha por su URL: «Volver a los libros» apunta a `/books` |
| Cerrar sesión | La vista guardada (`?q=titulo`) se borra y se llega a `/login` («Iniciar sesión · CMPC Libros») |
| Teclado | Tab llega a «Cerrar sesión» y a «← Volver a los libros» con anillo de foco sólido de 2 px (`:focus-visible`) |
| Móvil (375 px) | Cabecera con logo, «Libros», correo recortado y «Cerrar sesión» sin solaparse (16 px entre «Libros» y el correo); ruta que baja de línea; botón de 44 px de alto; página de 375 px sin desborde |

**Hallazgos de la verificación (corregidos en el mismo PR)**
1. En móvil la ficha de un libro con palabras largas sin espacios (título, autor, editorial, género) **ensanchaba la página a 540 px** y cortaba el texto. Ya ocurría antes de esta spec. Corrección: `wrap-anywhere` en el título y los datos, y `min-w-0` en la columna de datos (con prueba).
2. En móvil «Libros» quedaba pegado al correo porque el grupo del logo podía encogerse. Corrección: el grupo del logo y el enlace no se encoge y es el correo el que se recorta.

### N-07: verificación de la spec (2026-10-30)
Evidencia nueva: frontend `prettier`, `lint`, `tsc -b` y build limpios, `test:cov` (**52 archivos, 739 pruebas, 100 %** en sentencias, ramas, funciones y líneas; con el umbral forzado a 101 % falla) y `npm audit --omit=dev`: **0**. Sin cambios en el backend, la API ni las dependencias (N4.1).

| Criterio | Evidencia |
|---|---|
| N1.1 a N1.4 | `BookActionsCell.spec` y `BookTable.spec` (título sin enlace, «Ver» con nombre único y destino, «Descargar» solo con portada, encabezado «Acciones») y N-06 |
| N1.5 | `BookTable.spec` (palabras largas) y N-06: caja 1086 = contenido 1086 a 1400 px |
| N2.1 a N2.3 | `BookBreadcrumb.spec`, `BookDetailPage.spec` (un solo «Volver» antes del título; ruta con `aria-current`) y N-06 |
| N2.4, N2.5 | `listingView.spec`, `useListingPath.spec`, pruebas de ficha, «Libro no encontrado», formulario, página 404, cabecera y eliminación; N-06 (filtro conservado al volver, tras guardar y tras eliminar; `/books` sin vista guardada) |
| N2.6 | N-06 a 375 px: sin desborde, botón de 44 px |
| N3.1, N3.2 | `AppLayout.spec` (activo en listado, ficha y formularios) y las pruebas de título de cada pantalla; N-06 |
| N4.1 a N4.3 | Sin dependencias ni cambios de backend; `sessionStorage` con `try/catch` probado (sin almacenamiento y con error); filtros, orden, paginación, exportación y descarga sin cambios (sus pruebas siguen pasando) |
| N5.1, N5.2 | Cobertura 100 % y N-06 |

Resultado: sin criterios pendientes.
