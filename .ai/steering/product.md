# Producto: CMPC Libros

## Objetivo
Digitalizar el inventario de la tienda CMPC-libros: registrar, consultar, editar, eliminar (lógicamente) y exportar libros.

## Entidad principal: Libro
Datos obligatorios: título, autor, editorial, precio, disponibilidad y género.
Opcional: imagen de portada.

## Alcance (incluido)
- Login con usuario y contraseña (usuario inicial creado por seed; sin registro público).
- Listado de libros con filtros (género, editorial, autor, disponibilidad), búsqueda por título con debounce, ordenamiento por múltiples campos y paginación en el servidor.
- Alta, edición y eliminación lógica (soft delete) de libros.
- Carga de una imagen de portada por libro.
- Vista de detalle de un libro.
- Exportación del listado a CSV, respetando los filtros activos.
- Auditoría de operaciones de creación, edición y eliminación de libros, y de inicios de sesión (exitosos y fallidos).

## Fuera de alcance (documentar como mejora futura)
- Registro público de usuarios y roles (RBAC).
- Gestión de stock por unidades y ventas.
- Almacenamiento de imágenes en la nube (S3/MinIO).
- Internacionalización.

## Supuestos
- Un usuario administrador creado por seed es suficiente para operar la tienda.
- Las imágenes se guardan en un volumen local de Docker.
- Los autores, editoriales y géneros se crean al registrar un libro (si no existen) y se consultan por endpoints de solo lectura; no hay pantalla de administración de catálogos.
- Cada libro tiene un único autor y la disponibilidad es un indicador sí/no, no una cantidad de stock.
