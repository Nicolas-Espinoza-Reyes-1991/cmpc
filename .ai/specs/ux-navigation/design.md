# Spec ux-navigation: Diseño

Sin cambios en el backend. Todo ocurre en `frontend/src`.

## 1. Listado: botón «Ver» y columna «Acciones» (N1)
- `BookTable`: el título pasa a texto (`<td>` con `wrap-anywhere`, como ahora). La última celda es `BookActionsCell` (reemplaza a `BookDownloadCell`): `Ver` siempre y, si hay portada que cargó, `Descargar`. Se apilan en vertical (la fila ya mide 88 px por la miniatura de 72 px, caben dos botones compactos de 32 px).
- Encabezado «Acciones» visible (antes era `sr-only` «Descargar portada», que además obligó a la solución `relative` de `books-table-cover`; el texto visible ya no es absoluto, pero se conserva la prueba de la caja).
- «Ver» es un `Link` con aspecto de botón (`rounded-md border border-blue-700 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50`, foco con `outline-blue-700`), `aria-label="Ver detalle de {título}"`. Es un enlace porque navega (semántica correcta y se puede abrir en otra pestaña).
- Ancho: la columna ocupa lo mismo que la de «Descargar» (≈ 113 px); el ancho total no crece, así que N1.5 se mantiene.

## 2. Volver a la vista del listado (N2.4, N2.5, N4.2)
El estado del listado ya vive en la URL (`/books?q=…&page=2`), pero al entrar a una ficha se pierde. Se guarda la última URL del listado:
- `lib/listingView.ts`: `saveListingSearch(search)`, `readListingSearch()` y `clearListingSearch()` sobre `sessionStorage` (clave `cmpc.listing.search`), con `try/catch`: sin almacenamiento todo vuelve a `''`.
- `BooksPage` guarda `location.search` cada vez que cambia (un `useEffect`).
- `useListingPath()` devuelve `'/books' + search guardado` y es lo que usan: el botón y la ruta de la ficha, «Libro no encontrado», `NotFoundPage`, el «Cancelar» del formulario, la navegación tras eliminar y el logo/«Libros» de la cabecera.
- Se eligió `sessionStorage` y no `location.state` porque sobrevive al ciclo ficha → editar → guardar → ficha, a recargar la página y al botón «Atrás» del navegador; es por pestaña, así que dos pestañas no se pisan. «Cerrar sesión» borra la vista guardada.

## 3. Ficha: botón y ruta (N2.1 a N2.3, N2.6)
`BookDetail` arma arriba (antes de la rejilla de portada y datos):
```
Libros › Dune                    ← <nav aria-label="Ruta de navegación"><ol>
[← Volver a los libros]          ← Link con aspecto de botón (borde slate, hover relleno)
```
Se elimina el enlace subrayado del final. En 360 px la ruta y el botón se apilan y el título largo se parte (`break-words`).

## 4. Cabecera y título de pestaña (N3)
- `AppLayout`: junto al logo, `NavLink` «Libros» hacia `useListingPath()` con `end={false}` sobre `/books`, de modo que queda activo en `/books`, `/books/:id`, `/books/new` y `/books/:id/edit`. Activo: `font-semibold`, subrayado con `aria-current="page"` (lo pone `NavLink`).
- `hooks/useDocumentTitle.ts`: `useDocumentTitle(title)` asigna `document.title = "{title} · CMPC Libros"` y restaura el anterior al salir. Cada página lo usa (la ficha, con el título del libro cuando carga y «Libro» mientras tanto).

## 5. Pruebas
- `listingView.spec`: guarda, lee, borra; sin `sessionStorage` o con error al escribir no falla.
- `useListingPath.spec`, `useDocumentTitle.spec`.
- `BookTable.spec`: título sin enlace, «Ver» por fila con nombre único y destino correcto, «Descargar» solo con portada, encabezado «Acciones».
- `BookDetailPage.spec`: botón arriba, ruta con `aria-current`, enlace del final eliminado, volver restaura filtros guardados, eliminar vuelve a la vista.
- `BookFormPage.spec`, `BookNotFound`, `AppLayout.spec`: destino de vuelta y «Libros» activo.

## 6. Decisiones y riesgos
- **Título sin enlace:** quien busca «cómo abro este libro» ve un botón «Ver». A cambio se pierde el atajo del título como enlace. La fila clicable completa queda como mejora futura (choca con la miniatura que se amplía y con «Descargar»).
- **Texto «Ver»:** corto para no ensanchar la tabla (la lección de `books-table-cover`); el nombre accesible largo lo lee el lector de pantalla.
- **Riesgo:** una vista guardada con filtros que ya no devuelven nada muestra el listado vacío con «Limpiar filtros» (ya existe). No hay datos sensibles en la vista guardada (solo parámetros de búsqueda).
