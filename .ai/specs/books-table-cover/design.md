# Spec books-table-cover: Diseño

Implementa `requirements.md`. Los códigos M# remiten a ese archivo.

## 1. Decisiones (a aprobar)

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| La miniatura es la **primera columna** y la descarga la **última** | Todo en una sola columna; o una columna «Acciones» con ver/editar/eliminar | La portada identifica el libro de un vistazo antes del título; la descarga es una acción y va al final, donde se esperan las acciones. No se añaden otras acciones (no se pidieron) |
| Miniatura de **48 × 72 px** (2:3) en la tabla | 64 × 96 px; o igual a la de la ficha | Con 48 × 72 la fila mide ~88 px: legible sin que 10 libros ocupen dos pantallas. A 64 × 96 la página de 10 filas llegaría a ~1.100 px |
| Se **reutilizan** `CoverPreview` y `CoverDownload` de `book-detail-cover`, añadiéndoles una variante de tamaño (`size="row"`), sin duplicar el diálogo ni la lógica de error | Componentes nuevos para la tabla | Un solo diálogo accesible y un solo `coverFileName`; la ficha no cambia (M4.3) porque su variante es la actual por defecto |
| Cada fila lleva su propia miniatura con su `<dialog>`; la imagen grande solo existe mientras el diálogo está abierto | Un único diálogo en la página | Es lo que ya hace `CoverPreview`: no hay estado compartido que sincronizar. Los diálogos cerrados no cuestan nada (la imagen grande no se renderiza) |
| La celda de portada tiene su propio estado «imagen rota» por URL | Estado en la tabla | Una portada rota en una fila no afecta a las demás ni se pierde al paginar |
| La celda de descarga queda **vacía** sin portada o con imagen rota | Botón desactivado | Un botón desactivado repetido en cada fila es ruido y no informa más que el marcador de la miniatura (M2.3) |
| Descarga con `<a download>` hacia `/api/uploads/...` | Petición con `axios` y `Blob` | La ruta es pública: el navegador la baja directamente, sin token (igual que en la ficha) |
| Las dos columnas nuevas **no se ordenan** | Ordenar por «tiene portada» | La API no ordena por eso y el enunciado no lo pide |
| Encabezado de la columna de descarga solo para lectores de pantalla (`sr-only`) | Texto visible «Descargar» | El botón ya dice «Descargar»; repetirlo en el encabezado ocupa ancho sin aportar |
| Sin cambios en la API ni el backend | Incluir `thumbnailUrl` | Fuera de alcance; ver riesgo en §3 |

## 2. Cambios

```
frontend/src/
├── components/
│   ├── CoverPreview.tsx        # + prop `size: 'detail' | 'row'` (por defecto 'detail')
│   ├── CoverDownload.tsx       # + prop `size`, y `label` accesible con el título
│   ├── BookCoverCell.tsx       # NUEVO: miniatura + estado «imagen rota» (celda 1)
│   ├── BookDownloadCell.tsx    # NUEVO: botón «Descargar» o nada (última celda)
│   └── BookTable.tsx           # + columna de portada al inicio y de descarga al final
└── (pruebas de cada uno)
```

- **`BookCoverCell({ book })`**: si `imageUrl` y no está rota, `CoverPreview size="row"`; si no, el marcador «Sin portada» de 48 × 72 con `role="img"` y la etiqueta correspondiente («Este libro todavía no tiene portada» o «La portada no se pudo cargar»).
- **`BookDownloadCell({ book })`**: `CoverDownload size="row"` solo si hay portada; la imagen rota la comunica la celda de portada (ver abajo).
- **Imagen rota:** la tabla guarda en un estado el conjunto de URLs rotas y se lo pasa a ambas celdas (así la de descarga también se vacía); se reintenta si cambia la URL del libro.
- **`BookTable`**: `COLUMNS` pasa a describir las columnas de datos; las dos columnas nuevas se pintan aparte (sin `SortHeader`). El `<th>` de descarga lleva `<span class="sr-only">Descargar portada</span>`.
- **Estilos:** miniatura `h-[72px] w-12` con `object-cover` y borde fino; botón de descarga compacto (`px-3 py-1.5 text-sm`) con alto táctil mínimo de 44 px solo por debajo de `sm`.

## 3. Rendimiento (riesgo conocido)
- La miniatura es la **imagen original** reducida con CSS: una portada puede pesar hasta 2 MB. Con la página de 10 libros por defecto son, como máximo, 10 imágenes y solo las visibles (`loading="lazy"`); con 50 por página podrían bajarse muchas MB. Se mitiga con la caché de un año de `/api/uploads` (la segunda vez no cuesta) y con `decoding="async"`.
- La solución real es generar miniaturas en el servidor (por ejemplo 96 × 144 en WebP al subir la imagen), que requiere una librería de imágenes y una migración de las portadas existentes: **mejora futura** (`product.md`, README §10), no parte de esta spec.

## 4. Seguridad
| Amenaza | Mitigación |
|---|---|
| Nombre de archivo malicioso en la descarga | `coverFileName` ya genera un nombre ASCII a partir del título y la extensión del archivo guardado (nunca el nombre del servidor) |
| Imágenes de otro origen | `imageUrl` siempre apunta a `/api/uploads` (política de seguridad `img-src 'self'`) |
| XSS por el título en el texto alternativo | React escapa el texto; no se usa HTML en línea |

## 5. Pruebas
- **`BookCoverCell`:** con portada (imagen con `alt` y botón «Ampliar portada de…»), sin portada, imagen rota, y ampliar/cerrar con retorno del foco.
- **`BookDownloadCell`:** enlace con `download` y `href`, nombre accesible único, y vacío sin portada o con imagen rota.
- **`CoverPreview` / `CoverDownload`:** la variante `row` y que la `detail` sigue igual (clases y comportamiento).
- **`BookTable`:** la miniatura es la primera columna y la descarga la última, ni una ni otra se ordenan, `aria-sort` de las demás no cambia, una imagen rota solo afecta a su fila, y la tabla ocupada (`busy`) sigue igual.
- **`BooksPage`:** el listado muestra las portadas y un libro sin portada no ofrece descarga.
- **Navegador real (Docker):** libros con y sin portada, imagen rota, ampliar, descargar (nombre esperado), teclado, 360 px y escritorio, consola limpia.

## 6. Mejoras futuras
- Miniaturas generadas en el servidor (más livianas).
- Descargar todas las portadas de la página en un `.zip`.
- Cambiar o quitar la portada desde el listado.
