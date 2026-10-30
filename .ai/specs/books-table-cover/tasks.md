# Spec books-table-cover: Tareas

Reglas: seguir el orden; una tarea está hecha solo cuando su criterio se cumple y sus pruebas pasan. Un commit por tarea (formato convencional, en inglés).
**No empezar hasta aprobar `requirements.md` y `design.md`.**
Marcar con `[x]` al terminar.

- [x] **M-01 Variante de fila de los componentes compartidos** (M1.5, M2.4, M4.3)
  - `CoverPreview` y `CoverDownload` reciben `size` (`'detail'` por defecto, `'row'`); `CoverDownload` pone el título en su nombre accesible.
  - Hecho cuando: la ficha se ve igual (pruebas de `BookDetailPage` sin cambios) y las pruebas de ambos componentes cubren las dos variantes.
  - Commit: `feat(frontend): add a compact size to the cover components`

- [ ] **M-02 Celdas de portada y de descarga** (M1.1 a M1.4, M2.1 a M2.4)
  - `BookCoverCell` y `BookDownloadCell`, con su estado de imagen rota.
  - Commit: `feat(frontend): add the cover and download cells of the books table`

- [ ] **M-03 La tabla** (M3.2, M3.4)
  - `BookTable` con la columna de portada al inicio y la de descarga al final, sin ordenar; la imagen rota de una fila no afecta a las demás.
  - Commit: `feat(frontend): show the cover and a download button in the books table`

## Integración y cierre
- [ ] **M-04 Verificación en navegador real** (M3.3, M5.2)
  - Docker y navegador: libros con y sin portada, imagen rota, ampliar, descargar con el nombre esperado, teclado, 360 px y escritorio, consola limpia; anotar cada escenario y el peso real de las imágenes.
  - Commit: `docs(books-table-cover): record the browser verification`

- [ ] **M-05 Documentación y verificación de la spec**
  - README (guía de uso del listado), `lint`, `tsc`, build, cobertura ≥ 80 % y fallando por debajo, `npm audit`; registrar el resultado.
  - Commit: `docs(books-table-cover): record the spec verification`

## Registro de verificación
(Se completa al terminar M-04 y M-05.)
