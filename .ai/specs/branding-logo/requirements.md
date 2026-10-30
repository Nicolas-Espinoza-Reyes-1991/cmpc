# Spec branding-logo: Requisitos

Mejora gráfica: identidad visual con el logo de CMPC. **No cubre ningún ID de `enunciado.md`** (el enunciado no pide diseño de marca); aporta a los criterios de evaluación «usabilidad y experiencia de usuario» y a la presentación profesional. Por eso va **fuera del alcance obligatorio** y se desarrolla en su propia rama, sin tocar el comportamiento de la aplicación.

Depende de `auth` (pantalla de login) y `platform` (layout, nginx, CSP). El archivo del logo lo aporta el usuario (`logo-cmpc.svg`).

Formato: CUANDO <evento>, EL SISTEMA DEBERÁ <respuesta>. Cada criterio es verificable.

## Fuera de alcance
- Rediseño de colores, tipografías o componentes (próximas mejoras gráficas, cada una con su spec).
- Modo oscuro y variantes del logo en blanco.
- Modificar el logo original (se usa tal como lo entregó el usuario).

## B1. Logo en la aplicación
- B1.1 EN la cabecera de todas las pantallas protegidas, EL SISTEMA DEBERÁ mostrar el logo de CMPC en lugar del texto «CMPC Libros», y el logo DEBERÁ llevar al listado (`/books`).
- B1.2 EN la pantalla de login, EL SISTEMA DEBERÁ mostrar el logo centrado sobre el título, en lugar del texto «CMPC Libros».
- B1.3 El logo DEBERÁ conservar su proporción original (191,961 × 76,608), nunca estirarse ni recortarse, y verse nítido a cualquier tamaño (es vectorial).

## B2. Identidad del navegador
- B2.1 LA pestaña del navegador DEBERÁ mostrar un favicon con el isotipo de CMPC (las tres hojas verdes) en lugar del icono genérico de Vite.
- B2.2 EL título de la página DEBERÁ seguir siendo «CMPC Libros».

## B3. Accesibilidad y adaptación
- B3.1 EL logo DEBERÁ tener texto alternativo «CMPC Libros» (lo lee un lector de pantalla) y, siendo un enlace, un nombre accesible («CMPC Libros, ir al listado»).
- B3.2 EN pantallas estrechas (360 px) la cabecera DEBERÁ seguir mostrando logo, correo y «Cerrar sesión» sin desbordar horizontalmente.
- B3.3 EL foco del teclado sobre el enlace del logo DEBERÁ ser visible (mismo estilo que el resto de controles).

## B4. Restricciones técnicas
- B4.1 SIN dependencias nuevas.
- B4.2 EL logo DEBERÁ servirse desde el mismo origen (compatible con la política de seguridad `default-src 'self'`), con caché de larga duración por nombre con *hash* (como el resto de los estáticos).
- B4.3 NO DEBERÁ cambiar ninguna ruta, API ni comportamiento.

## B5. Pruebas y verificación
- B5.1 Pruebas unitarias del componente del logo y de los lugares donde se usa; cobertura 100 % (umbral 80 %).
- B5.2 Verificación en navegador real con Docker: login y cabecera en escritorio y móvil, favicon, enlace al listado, política de seguridad sin errores en consola.
