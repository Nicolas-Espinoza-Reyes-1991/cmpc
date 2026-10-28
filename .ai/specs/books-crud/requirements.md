# Spec books-crud: Requisitos

Cubre los IDs del enunciado: **FE-3a, FE-4, BE-3, BE-5, DB-1, DB-2** (la parte de DB-2 que corresponde a libros y catálogos; la auditoría dentro de la misma transacción la añade `audit-log`). Relacionados: FE-3b (la imagen la sube `book-image-upload`), BE-1 (SOLID), ADD-1 (errores), T-1, T-2, T-3 (pruebas).
Depende de `platform` (filtro de errores, interceptor, Prisma, cliente HTTP) y de `auth` (guard global, `ProtectedRoute`, `AppLayout`).

Formato: CUANDO <evento>, EL SISTEMA DEBERÁ <respuesta>. Cada criterio es verificable.

## Fuera de alcance
- Listado, filtros, orden, paginación y búsqueda de libros: spec `books-listing` (`GET /api/books`).
- Subida de la imagen de portada: spec `book-image-upload`. Aquí solo se muestra `imageUrl` si existe.
- Exportación a CSV: spec `books-export-csv`.
- Registro en `AuditLog`: spec `audit-log`, que lo añade dentro de las transacciones de esta spec.
- Pantalla de administración de catálogos (renombrar o borrar autores, editoriales y géneros), varios autores por libro, stock por unidades y control de concurrencia optimista (ver "Mejoras futuras" en `design.md`).

## C1. Modelo de datos (DB-1)
- C1.1 EL SISTEMA DEBERÁ tener los modelos `Author`, `Publisher`, `Genre` (cada uno con `name` único) y `Book` (`title`, `price` como `Decimal(10,2)`, `availability` booleano, `imageUrl` opcional, claves foráneas a los tres catálogos, `createdAt`, `updatedAt`, `deletedAt` opcional), con tablas y columnas en `snake_case` según `conventions.md`.
- C1.2 EL SISTEMA DEBERÁ crear índices en `Book` sobre `authorId`, `publisherId`, `genreId`, `availability` y `(deletedAt, createdAt)`, y un índice GIN con `pg_trgm` sobre `title`, mediante migraciones versionadas (el índice GIN, en una migración SQL manual).
- C1.3 EL SISTEMA DEBERÁ impedir dos libros activos con el mismo título (sin distinguir mayúsculas), autor y editorial, con un índice único parcial que ignora los libros eliminados; así un libro eliminado puede volver a registrarse.
- C1.4 Las claves foráneas DEBERÁN impedir borrar un autor, editorial o género que tenga libros (`onDelete: Restrict`).
- C1.5 CUANDO se ejecute `prisma migrate deploy` sobre una base vacía, EL SISTEMA DEBERÁ aplicar todas las migraciones sin error (se mantiene R3.3 de `platform`).

## C2. Crear un libro (BE-3, DB-2)
- C2.1 CUANDO se envíe `POST /api/books` con un cuerpo válido, EL SISTEMA DEBERÁ responder 201 con `{ data: Book }`.
- C2.2 EL SISTEMA DEBERÁ aceptar `title`, `author`, `publisher`, `genre` (nombres), `price` y `availability`, y rechazar con 400 y errores por campo: textos vacíos, `title` de más de 200 caracteres, nombres de más de 100, `price` que no sea un número mayor que 0 y menor o igual que 99.999.999,99 con como máximo dos decimales, `availability` que no sea booleano, campos obligatorios ausentes y cualquier propiedad no declarada (incluidos `id`, `imageUrl`, `deletedAt`).
- C2.3 EL SISTEMA DEBERÁ normalizar los textos (quitar espacios en los extremos y reducir los espacios repetidos a uno) antes de validarlos y guardarlos.
- C2.4 EL SISTEMA DEBERÁ reutilizar el autor, la editorial o el género que ya exista con ese nombre (sin distinguir mayúsculas) y crearlo si no existe.
- C2.5 EL SISTEMA DEBERÁ ejecutar la resolución de catálogos y la escritura del libro en una sola transacción: CUANDO falle cualquier paso, NO DEBERÁ quedar ningún catálogo ni libro nuevo.
- C2.6 CUANDO ya exista un libro activo con el mismo título, autor y editorial, EL SISTEMA DEBERÁ responder 409.

## C3. Consultar un libro (BE-3, FE-4)
- C3.1 CUANDO se envíe `GET /api/books/:id` de un libro activo, EL SISTEMA DEBERÁ responder 200 con `{ data: Book }`.
- C3.2 `Book` DEBERÁ contener `id`, `title`, `author`, `publisher`, `genre` (nombres), `price` (número), `availability`, `imageUrl` (texto o `null`), `createdAt` y `updatedAt`, y NO DEBERÁ contener `deletedAt`.
- C3.3 CUANDO el libro no exista o esté eliminado, EL SISTEMA DEBERÁ responder 404; CUANDO `:id` no sea un UUID, 400.

## C4. Editar un libro (BE-3, DB-2)
- C4.1 CUANDO se envíe `PATCH /api/books/:id` con uno o más campos válidos, EL SISTEMA DEBERÁ actualizar solo esos campos y responder 200 con el libro completo; `updatedAt` DEBERÁ cambiar.
- C4.2 Las reglas de validación y normalización de C2 DEBERÁN aplicarse a cada campo recibido; un cuerpo vacío DEBERÁ responder 400.
- C4.3 CUANDO se cambie el autor, la editorial o el género, EL SISTEMA DEBERÁ resolverlos como en C2.4, dentro de la misma transacción que la actualización (C2.5).
- C4.4 CUANDO el libro no exista o esté eliminado, EL SISTEMA DEBERÁ responder 404; CUANDO el cambio produzca un duplicado según C1.3, 409.
- C4.5 `PATCH` NO DEBERÁ permitir cambiar `imageUrl`, `deletedAt` ni `id`.

## C5. Eliminación lógica (BE-3, BE-5)
- C5.1 CUANDO se envíe `DELETE /api/books/:id` de un libro activo, EL SISTEMA DEBERÁ marcar `deletedAt` con la fecha actual, NO DEBERÁ borrar la fila y DEBERÁ responder 204 sin cuerpo.
- C5.2 Un libro eliminado NO DEBERÁ aparecer en ninguna consulta de lectura de `Book` (detalle ahora; listado y exportación después), sin que cada servicio tenga que recordar el filtro: DEBERÁ aplicarlo una extensión del cliente Prisma.
- C5.3 CUANDO se elimine, edite o consulte un libro ya eliminado, EL SISTEMA DEBERÁ responder 404.
- C5.4 Eliminar un libro NO DEBERÁ borrar su autor, editorial ni género.

## C6. Catálogos de solo lectura (BE-3)
- C6.1 EL SISTEMA DEBERÁ ofrecer `GET /api/authors`, `GET /api/publishers` y `GET /api/genres`, que respondan `{ data: [{ id, name }] }` ordenados por nombre.
- C6.2 EL SISTEMA DEBERÁ aceptar `search` (texto contenido en el nombre, sin distinguir mayúsculas) y `limit` (entero de 1 a 50, 20 por defecto) y rechazar otros valores con 400.
- C6.3 EL SISTEMA NO DEBERÁ ofrecer rutas para crear, editar ni borrar catálogos: se crean al registrar un libro.

## C7. Seguridad y documentación del backend
- C7.1 Todas las rutas de esta spec DEBERÁN exigir token (A3.1 de `auth`); olvidar el decorador no las deja públicas.
- C7.2 Los controladores NO DEBERÁN usar Prisma directamente; llaman a servicios (R1.3 de `platform`).
- C7.3 Swagger DEBERÁ describir cada ruta con sus cuerpos de ejemplo y las respuestas 200/201/204, 400, 401, 404 y 409 que correspondan.
- C7.4 Los logs NO DEBERÁN contener el cuerpo de las peticiones.

## C8. Formulario de libro en el frontend (FE-3a)
- C8.1 EL SISTEMA DEBERÁ ofrecer `/books/new` y `/books/:id/edit` dentro de `ProtectedRoute` y `AppLayout`, con el mismo formulario de React Hook Form y Zod.
- C8.2 EL SISTEMA DEBERÁ validar de forma reactiva (al salir del campo y luego en cada cambio) con mensajes en español y las mismas reglas que C2.2: obligatorios, longitudes, precio mayor que 0 con hasta dos decimales y disponibilidad.
- C8.3 Los campos de autor, editorial y género DEBERÁN permitir escribir un nombre nuevo o elegir uno existente, sugeridos desde los endpoints de catálogo con la búsqueda retrasada (debounce) y sin librerías nuevas.
- C8.4 MIENTRAS se envía, EL SISTEMA DEBERÁ deshabilitar el botón, mostrar "Guardando…" y no permitir un segundo envío.
- C8.5 CUANDO el servidor responda 400 con errores por campo, cada mensaje DEBERÁ mostrarse en su campo; CUANDO responda 409, un aviso bajo el formulario que explique el duplicado; ante red o 5xx, el aviso correspondiente. Ningún error DEBERÁ repetirse en el aviso global.
- C8.6 CUANDO el alta o la edición terminen bien, EL SISTEMA DEBERÁ llevar al detalle del libro y las consultas de libros en caché DEBERÁN quedar invalidadas.
- C8.7 En edición, EL SISTEMA DEBERÁ cargar los datos del libro en el formulario; CUANDO el libro no exista (404), mostrar "Libro no encontrado" con un enlace a `/books`; mientras carga, un estado de carga.
- C8.8 EL SISTEMA DEBERÁ cumplir lo básico de accesibilidad: etiquetas asociadas, errores enlazados con `aria-describedby`, `aria-invalid` y foco en el primer campo con error.
- C8.9 EL SISTEMA DEBERÁ ofrecer en `/books` (marcador del listado) un enlace "Nuevo libro" hasta que `books-listing` lo reemplace por su propia pantalla.

## C9. Detalle y eliminación en el frontend (FE-4)
- C9.1 EL SISTEMA DEBERÁ ofrecer `/books/:id` con título, autor, editorial, género, precio con formato de moneda, disponibilidad ("Disponible" o "No disponible"), portada (o un marcador si no hay imagen) y fechas de creación y última edición.
- C9.2 La pantalla DEBERÁ ofrecer "Editar" (lleva a `/books/:id/edit`), "Eliminar" y "Volver a los libros".
- C9.3 CUANDO el usuario pulse "Eliminar", EL SISTEMA DEBERÁ pedir confirmación en un diálogo accesible (foco, `Escape` para cancelar) que nombre el libro; solo tras confirmar se envía la petición.
- C9.4 CUANDO la eliminación termine bien, EL SISTEMA DEBERÁ llevar a `/books`, invalidar las consultas de libros y quitar el libro de la caché; CUANDO falle, mostrar el error sin salir de la pantalla.
- C9.5 CUANDO el libro no exista (404), EL SISTEMA DEBERÁ mostrar "Libro no encontrado" con un enlace a `/books`.

## C10. Pruebas (T-1, T-2, T-3)
- C10.1 El backend DEBERÁ tener pruebas unitarias de `BooksService`, `BooksController`, `CatalogService`, `CatalogController`, la extensión de borrado lógico y los DTOs, incluida la transacción (si un paso falla no se guarda nada) y una prueba HTTP con Passport real que verifique 401 sin token en todas las rutas nuevas.
- C10.2 El frontend DEBERÁ tener pruebas de los servicios HTTP, del esquema Zod, de `useDebounce`, del formulario, de las páginas de alta, edición y detalle, y del diálogo de confirmación.
- C10.3 La cobertura DEBERÁ seguir en 80% o más en ambas aplicaciones.
- C10.4 EL SISTEMA DEBERÁ verificarse contra PostgreSQL real: restricciones e índices, el 409 por duplicado (cierra la salvedad 2 de `platform`), la reversión de la transacción, el borrado lógico y 404 posterior, la creación concurrente del mismo catálogo, y el uso del índice `pg_trgm`; y de punta a punta en un navegador real con el stack de Docker.
