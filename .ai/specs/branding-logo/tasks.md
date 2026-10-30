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
- [ ] **B-04 Verificación en navegador real** (B3.2, B4.3, B5.2)
  - Docker y navegador: login y cabecera en escritorio y móvil (360 px), clic en el logo, favicon, foco con teclado, consola sin errores de CSP, sin desbordes; anotar cada escenario.
  - Commit: `docs(branding-logo): record the browser verification`

- [ ] **B-05 Verificación de la spec**
  - Recorrer B1 a B5 con evidencia nueva (lint, tipos, build, cobertura ≥ 80 % y fallando por debajo, `npm audit`) y registrar el resultado.
  - Commit: `docs(branding-logo): record the spec verification`

## Registro de verificación
(Se completa al terminar B-04 y B-05.)
