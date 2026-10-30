# Spec branding-logo: Tareas

Reglas: seguir el orden; una tarea está hecha solo cuando su criterio se cumple y sus pruebas pasan. Un commit por tarea (formato convencional, en inglés).
Antes de cada tarea se leen `requirements.md` y `design.md`; cada cambio de decisión se refleja en `design.md`.
Marcar con `[x]` al terminar.

- [x] **B-01 Logo y componente** (B1.3, B3.1, B4.1, B4.2, B5.1)
  - Copiar `logo-cmpc.svg` sin modificar a `frontend/src/assets/` y crear el componente `Logo` con su prueba.
  - Hecho cuando: `lint`, `tsc`, build y pruebas pasan; el build publica el logo con *hash*.
  - Commit: `feat(frontend): add the CMPC logo component`

- [x] **B-02 Cabecera y login** (B1.1, B1.2, B3.1, B3.3, B5.1)
  - Usar el logo en `AppLayout` (enlace a `/books`) y en `LoginPage`; actualizar sus pruebas.
  - Commit: `feat(frontend): show the CMPC logo in the header and the login`

- [x] **B-03 Favicon** (B2.1, B2.2)
  - Reemplazar `public/favicon.svg` por el isotipo de las tres hojas, derivado del logo.
  - Hecho cuando: el favicon se ve nítido en la pestaña y a 16 px.
  - Commit: `feat(frontend): use the CMPC leaves as the favicon`

## Integración y cierre
- [x] **B-04 Verificación en navegador real** (B3.2, B4.3, B5.2)
  - Docker y navegador: login y cabecera en escritorio y móvil (360 px), clic en el logo, favicon, foco con teclado, consola sin errores de CSP, sin desbordes; anotar cada escenario.
  - Commit: `docs(branding-logo): record the browser verification`

- [x] **B-05 Verificación de la spec**
  - Recorrer B1 a B5 con evidencia nueva (lint, tipos, build, cobertura ≥ 80 % y fallando por debajo, `npm audit`) y registrar el resultado.
  - Commit: `docs(branding-logo): record the spec verification`

## Registro de verificación

### B-04: verificación en navegador real con Docker (2026-10-30)
Entorno: `docker compose up --build` de la rama en su propio proyecto, puertos e imágenes (`:18083`), sin tocar el sistema del usuario; navegador integrado en 1280 y 360 px.

| Escenario | Resultado |
|---|---|
| Login | Logo centrado sobre «Iniciar sesión»: 140 × 56 px, proporción 2,506 (la del archivo original, 2,506), imagen cargada con el texto alternativo «CMPC Libros» |
| Cabecera | Logo de 80 × 32 px (proporción 2,505) a la izquierda, con el correo y «Cerrar sesión» a la derecha |
| Clic en el logo | Desde `/books/new` lleva a `/books`; el enlace se llama «CMPC Libros, ir al listado» |
| Teclado | El enlace del logo muestra anillo de foco (`outline` sólido) |
| Favicon | `/favicon.svg` es el de las tres hojas (`#398336`, `#8ab525`) y ya no el morado de Vite; el título sigue siendo «CMPC Libros» |
| Caché | El logo se sirve como `/assets/logo-cmpc-<hash>.svg` con `Cache-Control: public, max-age=31536000, immutable` |
| Móvil (360 px) | Logo, correo y «Cerrar sesión» caben sin desbordar: la página mide 360 px |
| Consola | Solo el aviso `script-src` que escribe el propio panel del navegador en todas las páginas; ninguna violación de la política de seguridad de la aplicación (no cambió nginx) |

Observación: el SVG recibido no tiene `<script>`, `onload` ni referencias externas (se comprobó antes de usarlo), y se muestra con `<img>`, que no ejecuta código.

### B-05: verificación de la spec (2026-10-30)
Evidencia nueva: frontend `lint`, `tsc -b` y build limpios, `test:cov` (**46 archivos, 687 pruebas, 100 %** en sentencias, ramas, funciones y líneas; con el umbral forzado a 101 % falla) y `npm audit --omit=dev`: **0**. Sin cambios en el backend, las rutas ni nginx (B4.3).

| Criterio | Evidencia |
|---|---|
| B1.1, B1.2, B1.3 | `Logo.spec`, `AppLayout.spec` (logo y enlace a `/books`) y B-04: proporción exacta, centrado y enlace |
| B2.1, B2.2 | B-04: favicon de las hojas y título «CMPC Libros» |
| B3.1 a B3.3 | Texto alternativo y nombre accesible comprobados en pruebas y en navegador; 360 px sin desborde; foco visible |
| B4.1 a B4.3 | Sin dependencias nuevas; el logo se sirve del mismo origen con caché de un año; ninguna ruta ni comportamiento cambia |
| B5.1, B5.2 | Suites citadas y B-04 |

Resultado: sin criterios pendientes. La cifra de pruebas del README se actualizará al reunir todos los PR pendientes.
