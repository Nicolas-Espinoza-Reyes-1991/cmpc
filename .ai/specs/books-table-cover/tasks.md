# Spec books-table-cover: Tareas

Reglas: seguir el orden; una tarea está hecha solo cuando su criterio se cumple y sus pruebas pasan. Un commit por tarea (formato convencional, en inglés).
**No empezar hasta aprobar `requirements.md` y `design.md`.**
Marcar con `[x]` al terminar.

- [x] **M-01 Variante de fila de los componentes compartidos** (M1.5, M2.4, M4.3)
  - `CoverPreview` y `CoverDownload` reciben `size` (`'detail'` por defecto, `'row'`); `CoverDownload` pone el título en su nombre accesible.
  - Hecho cuando: la ficha se ve igual (pruebas de `BookDetailPage` sin cambios) y las pruebas de ambos componentes cubren las dos variantes.
  - Commit: `feat(frontend): add a compact size to the cover components`

- [x] **M-02 Celdas de portada y de descarga** (M1.1 a M1.4, M2.1 a M2.4)
  - `BookCoverCell` y `BookDownloadCell`, con su estado de imagen rota.
  - Commit: `feat(frontend): add the cover and download cells of the books table`

- [x] **M-03 La tabla** (M3.2, M3.4)
  - `BookTable` con la columna de portada al inicio y la de descarga al final, sin ordenar; la imagen rota de una fila no afecta a las demás.
  - Commit: `feat(frontend): show the cover and a download button in the books table`

## Integración y cierre
- [x] **M-04 Verificación en navegador real** (M3.3, M5.2)
  - Docker y navegador: libros con y sin portada, imagen rota, ampliar, descargar con el nombre esperado, teclado, 360 px y escritorio, consola limpia; anotar cada escenario y el peso real de las imágenes.
  - Commit: `docs(books-table-cover): record the browser verification`

- [x] **M-05 Documentación y verificación de la spec**
  - README (guía de uso del listado), `lint`, `tsc`, build, cobertura ≥ 80 % y fallando por debajo, `npm audit`; registrar el resultado.
  - Commit: `docs(books-table-cover): record the spec verification`

## Registro de verificación

### M-04: verificación en navegador real con Docker (2026-10-30)
Entorno: `docker compose up --build` de la rama en su **propio proyecto, puertos e imágenes** (`:18082`), sin tocar el sistema del usuario; 6 libros cargados por la API: tres con portada real (PNG de 5 KB, JPEG de 26 KB y WebP de 5 KB, de 600 × 900 px), uno **sin portada**, uno con la **imagen rota** (su `image_url` apunta a un archivo que no existe) y uno con un título larguísimo.

| Escenario | Resultado |
|---|---|
| Columnas | `Portada`, `Título`, `Autor`, `Editorial`, `Género`, `Precio`, `Disponibilidad`, `Registrado` y una última sin texto visible (`Descargar portada`, solo para lectores de pantalla); las dos nuevas no se ordenan |
| Miniaturas | 48 × 72 px, con la proporción de libro, en la primera columna; la fila con el título largo mide 113 px |
| Sin portada y con la imagen rota | Marcador «Sin portada» de las mismas dimensiones; el rotado dice «La portada de … no se pudo cargar» y **no** ofrece descarga; las otras filas no se afectan |
| Botón «Descargar» | Solo en los 4 libros con portada; nombres `cien-anos-de-soledad.webp`, `neuromante.jpg`, `dune.png` y el del título largo; nombre accesible «Descargar portada de <título>» |
| Los archivos de las descargas | 200, tipo correcto (`image/png`, `image/jpeg`, `image/webp`) y `Cache-Control: public, max-age=31536000, immutable` |
| Ampliar | Al pulsar la miniatura se abre el diálogo con la portada de 600 × 900, el foco va a «Cerrar»; Escape lo cierra y el foco **vuelve a la miniatura** |
| Consola | Solo el 404 de la imagen rota que se provocó a propósito. El aviso de `script-src` lo escribe el propio panel del navegador (también en el login) |
| Móvil (360 px) | **Defecto hallado, corregido** (abajo); después: ancho de la página 360 px, la tabla se desplaza dentro de su caja, el botón «Descargar» mide 44 px de alto y la miniatura 48 × 72 |

**Defecto hallado y corregido.** El texto oculto del encabezado de la última columna (`sr-only`, que es de posición absoluta) escapaba del contenedor con desplazamiento y **ensanchaba toda la página a 918 px en un viewport de 360 px**. Se hizo `relative` el contenedor para que lo recorte con el resto de la tabla; repetido: 360 px. Una prueba lo protege. Commit: `fix(frontend): keep the hidden download header from widening the page`.

Observaciones:
- El peso es el de la **imagen original** reducida por CSS (aquí 5–26 KB): con portadas reales de hasta 2 MB y 50 libros por página sería mucho; es el riesgo de `design.md` §3 y la mejora futura de miniaturas en el servidor.
- Al terminar se eliminó el sistema aislado con sus volúmenes e imágenes.

### M-05: verificación de la spec (2026-10-30)
Evidencia nueva: frontend `lint`, `tsc -b` y build limpios, `test:cov` (**46 archivos, 703 pruebas, 100 %** en sentencias, ramas, funciones y líneas; con el umbral forzado a 101 % falla) y `npm audit --omit=dev`: **0**. Sin cambios en el backend ni en la API (M4.1).

| Criterio | Evidencia |
|---|---|
| M1.1 a M1.5 | `BookCoverCell.spec`, `CoverPreview.spec` (variante `row`) y `BookTable.spec` (primera columna, marcador, imagen rota por fila, ampliar con retorno del foco); M-04 |
| M2.1 a M2.4 | `BookDownloadCell.spec`, `CoverDownload.spec` (nombre y `download`), `BooksPage.spec` y M-04 con los archivos reales |
| M3.1 a M3.4 | Nombres accesibles únicos por fila, columnas no ordenables sin `aria-sort`, objetivo táctil de 44 px (clases y medición a 360 px) y la prueba del contenedor `relative` |
| M4.1 a M4.3 | Solo cambia el frontend; las pruebas de `BookDetailPage` pasan sin tocarlas (la ficha no cambia) |
| M5.1, M5.2 | Suites citadas y M-04 |

Resultado: sin criterios pendientes.
