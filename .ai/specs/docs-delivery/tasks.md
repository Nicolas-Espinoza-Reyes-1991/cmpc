# Spec docs-delivery: Tareas

Reglas: seguir el orden; una tarea está hecha solo cuando su criterio se cumple y sus pruebas pasan. Un commit por tarea (formato convencional, en inglés).
Antes de cada tarea se leen `requirements.md` y `design.md`; cada cambio de decisión se refleja en `design.md`.
Marcar con `[x]` al terminar.

- [x] **D-01 Dependencias sin hallazgos** (D5.4)
  - `overrides` de `js-yaml` (Swagger) y `deepmerge-ts` (Prisma) a las versiones corregidas; comprobar que Prisma CLI y Swagger siguen funcionando.
  - Hecho cuando: `npm audit --omit=dev` da 0 en ambas apps, y `prisma validate`, `migrate status`, `generate`, build, pruebas y e2e pasan.
  - Commit: `fix(deps): override the vulnerable transitive dependencies of Prisma and Swagger`

- [x] **D-02 Documentación de la API** (D2.1 a D2.3)
  - Revisar el documento OpenAPI real; completar lo que falte (resúmenes, respuestas, esquemas, seguridad); añadir `openapi.spec`, la prueba que exige resumen y respuesta de éxito en cada operación.
  - Hecho cuando: la prueba pasa y falla si se quita un resumen (mutación), y Swagger UI muestra todo en el navegador con *Authorize*.
  - Commit: `docs(api): complete the OpenAPI document and guard it with a test`

- [x] **D-03 Diagramas de arquitectura** (D3.1, D3.2)
  - `docs/architecture.md` con los cuatro diagramas Mermaid, contrastados con los módulos y rutas reales.
  - Hecho cuando: cada nodo y flecha existe en el código y los diagramas se renderizan.
  - Commit: `docs: add the architecture diagrams`

- [x] **D-04 Modelo relacional** (D4.1 a D4.3)
  - `docs/erd.dbml`, `docs/erd.md`, `docs/tools/dbml-to-svg.py` y `docs/erd.svg`.
  - Hecho cuando: el DBML coincide tabla por tabla, columna por columna e índice por índice con una base migrada, y el SVG se ve bien.
  - Commit: `docs: add the relational model (DBML, Mermaid and SVG)`

- [x] **D-05 README** (D1.1 a D1.7, D5.1, D5.2)
  - Instalación, uso, arquitectura, decisiones, pruebas, seguridad y producción, supuestos, y pendientes con cómo se implementarían.
  - Commit: `docs: add the README`

- [ ] **D-06 Verificación del README y de CLAUDE.md** (D1.8, D5.3, D5.5)
  - Clon limpio en una carpeta temporal; seguir el README al pie de la letra (Docker y desarrollo local); comprobar enlaces; confirmar los comandos de `CLAUDE.md`.
  - Hecho cuando: cada comando y enlace queda anotado en el registro.
  - Commit: `docs: record the README verification and confirm the commands`

## Integración y cierre
- [ ] **D-07 Verificación de la spec**
  - Recorrer D1 a D5 con evidencia nueva y registrar el resultado.
  - Commit: `docs(docs-delivery): record the spec verification`

## Registro de verificación
(Se completa al terminar D-06 y D-07.)
