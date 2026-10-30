# Spec branding-logo: Diseño

Implementa `requirements.md`. Los códigos B# remiten a ese archivo.

## 1. Decisiones (a revisar)

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| El SVG se guarda **sin modificar** en `frontend/src/assets/logo-cmpc.svg` y se importa desde un componente `Logo` | Pegar el SVG dentro del componente (en línea) | Vite lo publica como archivo con *hash* (`/assets/logo-cmpc-<hash>.svg`): se cachea un año igual que el resto de los estáticos, el componente queda pequeño y el logo original no se toca |
| Se muestra con `<img>` | SVG en línea con `<svg>` | El logo no necesita estilos dinámicos; `<img>` funciona con la política `default-src 'self'` sin cambios y el navegador lo cachea |
| Un único componente `Logo` con la altura como parámetro | Dos imágenes sueltas en cabecera y login | Un solo lugar fija la proporción, el texto alternativo y la clase; se prueba una vez |
| La altura la fija CSS y el ancho es automático (`h-8 w-auto`, `h-14 w-auto`) | Fijar ancho y alto | La proporción 191,961 × 76,608 se conserva siempre; los atributos `width`/`height` del `<img>` evitan el salto de maquetación al cargar |
| El favicon es un **SVG propio con solo las tres hojas**, hecho a partir de los trazados del logo (`public/favicon.svg`) | Usar el logo completo como favicon | El logo completo es 2,5 veces más ancho que alto y a 16 px el texto no se lee; el isotipo sí. Se deriva del mismo archivo, sin inventar un diseño |
| El texto «CMPC Libros» sale de la cabecera, pero se conserva en el `alt` y en `<title>` | Mantener logo y texto juntos | El logo ya dice «cmpc»; «Libros» lo da el título de cada pantalla. Menos ruido visual |
| El logo en la cabecera es un enlace a `/books` | Solo imagen | Es la costumbre y mejora la navegación; ya existe la ruta |
| Sin modo oscuro | Variante blanca | La aplicación solo tiene tema claro; queda como mejora futura |

## 2. Cambios

```
frontend/
├── public/favicon.svg                 # reemplazado: isotipo (tres hojas)
└── src/
    ├── assets/logo-cmpc.svg           # el logo entregado, sin modificar
    ├── components/Logo.tsx            # <img> con proporción y alt fijos
    ├── components/Logo.spec.tsx
    ├── components/AppLayout.tsx       # logo (enlace a /books) en vez del texto
    └── pages/LoginPage.tsx            # logo centrado sobre el título
```

- **`Logo`**: `<img src={logoUrl} alt="CMPC Libros" width={192} height={77} className={…}>`; la altura visual la decide quien lo usa con una clase de Tailwind; nunca recibe un ancho.
- **`AppLayout`**: `<Link to="/books" aria-label="CMPC Libros, ir al listado"><Logo className="h-8" /></Link>` con el mismo foco visible que los demás controles.
- **`LoginPage`**: `<Logo className="mx-auto h-14" />` encima del título «Iniciar sesión».
- **Favicon**: se extraen del logo las tres hojas (`Trazado_12024` a `Trazado_12026`, con sus colores `#398336`, `#559d33` y `#8ab525`), se recorta el `viewBox` a su caja y se guarda como `public/favicon.svg`.
- `index.html` no cambia (ya apunta a `/favicon.svg`); el título sigue siendo «CMPC Libros».

## 3. Seguridad y rendimiento
- Un `<img>` con SVG **no ejecuta scripts** (a diferencia de abrirlo como documento o en línea). Aun así se revisa que el archivo recibido no tenga `<script>`, `onload` ni referencias externas: es solo trazados y colores.
- Peso del logo: ~7 KB (se sirve comprimido y en caché); no añade ninguna petición bloqueante apreciable.
- La política `default-src 'self'; img-src 'self' data: blob:` ya lo permite: no se toca nginx.

## 4. Pruebas
- **`Logo`:** muestra la imagen con el `alt` correcto, conserva `width`/`height` y aplica la clase recibida.
- **`AppLayout`:** el enlace del logo apunta a `/books` y tiene nombre accesible; el correo y «Cerrar sesión» siguen (la prueba actual que busca el texto «CMPC Libros» pasa a buscar el logo por su `alt`).
- **`LoginPage`:** muestra el logo sobre el título.
- **Navegador real (Docker):** escritorio y móvil (360 px), favicon, clic en el logo, consola sin errores de CSP, sin desbordes.

## 5. Mejoras futuras
- Variante del logo para modo oscuro.
- Paleta y tipografía de marca (siguientes mejoras gráficas).
- Imagen para compartir el enlace (Open Graph).
