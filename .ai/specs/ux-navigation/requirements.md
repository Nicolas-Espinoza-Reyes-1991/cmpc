# Spec ux-navigation: Requisitos

Mejora de experiencia de usuario: que la navegación entre el listado y la ficha de un libro sea evidente. **No cubre ningún ID de `enunciado.md`**; aporta al criterio «usabilidad y experiencia de usuario» y es un complemento de `books-listing`, `books-crud` y `books-table-cover`. Va fuera del alcance obligatorio y no cambia la API.

Origen: observaciones del usuario al probar el sistema.
1. En el listado, el título del libro es el enlace a su ficha, pero no se reconoce como enlace (texto azul sin subrayado) y no se entiende que es la forma de «ver» el libro.
2. En la ficha, «Volver a los libros» es un enlace subrayado al final de la fila de acciones: no se ve ni parece un control.

Formato: CUANDO <evento>, EL SISTEMA DEBERÁ <respuesta>. Cada criterio es verificable.

## Fuera de alcance
- Notificaciones tras guardar o eliminar, *chips* de filtros activos, esqueletos de carga, deshacer eliminación y fila clicable (se proponen como mejoras futuras, cada una con su spec).
- Cambios en la API, las rutas o el modelo de datos.
- Un menú con más secciones: la aplicación tiene una sola sección (Libros).

## N1. Ver un libro desde el listado
- N1.1 EN cada fila del listado, EL SISTEMA DEBERÁ mostrar un botón «Ver» (borde y texto azules, con aspecto de botón) que lleva a la ficha del libro.
- N1.2 EL título del libro DEBERÁ mostrarse como texto normal, no como enlace.
- N1.3 EL botón DEBERÁ tener un nombre accesible único por fila («Ver detalle de <título>»).
- N1.4 LA última columna DEBERÁ llamarse «Acciones» (visible) y agrupar «Ver» y, cuando hay portada, «Descargar».
- N1.5 CON datos con palabras largas a 1400 px, LA tabla NO DEBERÁ necesitar desplazamiento horizontal (se mantiene lo logrado en `books-table-cover`).

## N2. Volver desde la ficha
- N2.1 EN la ficha, EL SISTEMA DEBERÁ mostrar arriba, antes del título, un botón «← Volver a los libros» con aspecto de botón (borde, relleno al pasar el cursor, foco visible).
- N2.2 EN la ficha, EL SISTEMA DEBERÁ mostrar una ruta de navegación «Libros › <título>» donde «Libros» es un enlace y el título es la página actual (`aria-current="page"`).
- N2.3 EL enlace «Volver a los libros» del final de la fila de acciones DEBERÁ eliminarse (queda un solo control, arriba).
- N2.4 CUANDO el usuario vuelve al listado desde la ficha, el formulario, «Libro no encontrado» o tras eliminar, EL SISTEMA DEBERÁ restaurar la vista que tenía: filtros, búsqueda, orden, página y tamaño de página.
- N2.5 SI no hay vista guardada (acceso directo a la ficha), EL SISTEMA DEBERÁ volver a `/books` sin filtros.
- N2.6 EN pantallas estrechas (360 px) el botón y la ruta DEBERÁN verse sin desbordar la página.

## N3. Navegación global
- N3.1 EN la cabecera, EL SISTEMA DEBERÁ mostrar el enlace «Libros» junto al logo, marcado como activo (`aria-current="page"`, subrayado y negrita) mientras el usuario está en el listado, la ficha o el formulario de un libro.
- N3.2 EL título de la pestaña DEBERÁ indicar dónde está el usuario: «Libros · CMPC Libros», «<título> · CMPC Libros», «Nuevo libro · CMPC Libros», «Editar libro · CMPC Libros» y «Iniciar sesión · CMPC Libros».

## N4. Restricciones técnicas
- N4.1 SIN dependencias nuevas ni cambios en el backend.
- N4.2 LA vista guardada del listado DEBERÁ vivir en `sessionStorage` (solo de esa pestaña), con tolerancia a que el almacenamiento no exista o falle.
- N4.3 NO DEBERÁ cambiar ningún comportamiento de filtros, orden, paginación, exportación ni descarga.

## N5. Pruebas y verificación
- N5.1 Pruebas unitarias de lo nuevo y de lo modificado; cobertura 100 % (umbral 80 %).
- N5.2 Verificación en navegador real con Docker: «Ver», volver con y sin filtros, volver tras editar y tras eliminar, cabecera activa, título de pestaña, teclado (Tab y foco visible), 1400 y 360 px sin desbordar.
