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

- [x] **D-06 Verificación del README y de CLAUDE.md** (D1.8, D5.3, D5.5)
  - Clon limpio en una carpeta temporal; seguir el README al pie de la letra (Docker y desarrollo local); comprobar enlaces; confirmar los comandos de `CLAUDE.md`.
  - Hecho cuando: cada comando y enlace queda anotado en el registro.
  - Commit: `docs: record the README verification and confirm the commands`

## Integración y cierre
- [x] **D-07 Verificación de la spec**
  - Recorrer D1 a D5 con evidencia nueva y registrar el resultado.
  - Commit: `docs(docs-delivery): record the spec verification`

## Registro de verificación

### D-06: el README y los comandos, ejecutados desde un clon limpio (2026-10-28)
Método: `git clone` de la rama en una carpeta temporal **vacía** (sin `node_modules`, sin `.env`), y se siguió el README al pie de la letra: `cp .env.example .env`, reemplazar los `change-me` por valores aleatorios (`openssl rand`), y después las dos rutas. Al terminar se eliminaron el stack con sus volúmenes y la carpeta.

| Comprobación | Resultado |
|---|---|
| `docker compose up --build` desde el clon | `db`, `backend` y `frontend` **sanos** (~35 s tras el *build*); las 4 migraciones se aplican y el administrador se crea |
| `http://localhost:8080` | Sirve la aplicación (`<title>CMPC Libros</title>`) |
| `/api/health` y `/api/docs` | `{"status":"ok"}` (200) y Swagger UI (200) |
| Ejemplos de `curl` de la guía de uso, copiados tal cual | Token de 188 caracteres, alta de «Dune» (201), listado con `search`, `availability` y `sort` (devuelve el libro) y exportación a `libros.csv` (BOM, encabezado y la fila) |
| `docker compose --profile tools config --services` | Lista `db backend frontend pgadmin` (no se levantó pgAdmin: descargaría una imagen de ~400 MB sin aportar a la comprobación) |
| **Desarrollo local**: `docker compose up -d db`, `npm ci`, migraciones, `npm run seed`, `npm run start:dev`, `npm ci` y `npm run dev` del frontend | **Falló la primera vez** (ver hallazgo); tras la corrección: las 4 migraciones se aplican, el administrador se crea, el backend responde en `:3000/api/health`, Vite sirve en `:5173` y `/api/health` y el login (200) funcionan **a través del proxy de Vite** |
| Comandos de la tabla del README en el clon | Backend: `lint`, `build`, `test:cov` (**825 pruebas, 49 suites, 100 %**) y `test:e2e` (**15**); frontend: `lint`, `build` y `test:cov` (**646 pruebas, 42 archivos, 100 %**): coinciden con las cifras del README |
| Enlaces | 56 enlaces relativos de `README.md` y `docs/*.md` (archivos y anclas de los títulos) **resueltos**, con un script |
| Diagramas | Los 6 diagramas Mermaid (5 de `architecture.md` y 1 de `erd.md`) se analizan y se dibujan con Mermaid 11 en el navegador, sin errores |
| `CLAUDE.md` | Sección «Comandos» confirmada y reescrita (la nota «se confirman cuando exista cada `package.json`» se retira) |

**Hallazgo (corregido).** La ruta de desarrollo local **no funcionaba tal como estaba escrita**: `npx prisma migrate dev` falló con «Environment variable not found: DATABASE_URL» porque la CLI de Prisma solo lee `backend/.env`, mientras que la aplicación y el seed leen también el `.env` de la raíz (que es el que el README manda crear). Sin las migraciones tampoco se generaba el cliente, y el seed fallaba con «@prisma/client did not initialize yet». Se corrigió con `fix(backend): let the Prisma scripts read the repository .env` (los *scripts* `prisma:migrate` y `prisma:deploy` cargan `../.env`), y el README y `CLAUDE.md` usan esos *scripts*. Es el tipo de defecto que solo aparece al seguir las instrucciones desde cero.

Observaciones:
- El `npm ci` del backend tardó ~3 min y el del frontend ~1 min en esta máquina; el README no promete tiempos.
- Al pegar el `curl` con acentos desde Git Bash en Windows, el género quedó como «ficci�n» (la consola envía otra codificación; la API guardó lo recibido). Se añadió una nota a la guía de uso.
- El proyecto de Compose se llama `cmpc-libros` (campo `name:`), igual que el del repositorio de trabajo: antes de la prueba se había eliminado el stack anterior con `docker compose down -v` para que no hubiera datos ni puertos en uso.

### D-07: verificación de la spec (2026-10-28)
Evidencia nueva de esta sesión: backend `lint`, `tsc` y build limpios, `test:cov` (**49 suites, 825 pruebas, 100 %**; con el umbral forzado a 101 % falla: "does not meet global threshold") y e2e (**15**); frontend `lint`, `tsc -b` y build limpios, `test:cov` (**42 archivos, 646 pruebas, 100 %**; el umbral forzado a 101 % también falla); `npm audit --omit=dev`: **0 hallazgos en ambas apps**; más los registros D-06 y las comprobaciones de D-02 y D-04.

| Criterio | Evidencia |
|---|---|
| D1.1, D1.4–D1.7 | `README.md`: tabla de estado de cada requisito, arquitectura, decisiones con su motivo, pruebas y cobertura con las cifras reales (coinciden con las del clon limpio), seguridad y puesta en producción |
| D1.2, D1.3 | D-06: la instalación con Docker y la de desarrollo local se siguieron desde un clon vacío; los `curl` de la guía de uso se ejecutaron tal cual |
| D1.8 | D-06: comandos ejecutados, 56 enlaces y anclas resueltos y los 6 diagramas Mermaid dibujados |
| D2.1 | `openapi.e2e-spec` lista las 14 operaciones y exige que la documentación coincida; Swagger UI en el navegador muestra las 14 |
| D2.2 | Swagger UI: *Authorize* con el token y `GET /api/auth/me` devuelve `{ data: { id, email } }` |
| D2.3 | `openapi.e2e-spec` falla sin resumen, etiqueta, respuesta de éxito descrita, seguridad o 401 (comprobado vaciando un resumen) |
| D3.1, D3.2 | `docs/architecture.md`: 5 diagramas que se dibujan; cada módulo, ruta, servicio de Compose y cabecera se contrastó con `app.module.ts`, los controladores, `docker-compose.yml` y `nginx` |
| D4.1, D4.2 | `docs/erd.dbml` (con los índices GIN y único parcial) y `docs/erd.svg` generado por `docs/tools/dbml-to-svg.py` y revisado en el navegador |
| D4.3 | 6 tablas, 33 columnas, 20 índices, 4 claves foráneas y el enum comparados con la base migrada: 0 diferencias; la comparación falla al alterar el DBML |
| D5.1, D5.2 | README §9 (12 supuestos con su fundamento) y §10 (16 pendientes con enfoque y esfuerzo) |
| D5.3 | D-06 |
| D5.4 | `npm audit --omit=dev` en 0 en ambas apps con dos `overrides` evaluados y verificados (`design.md` §3) |
| D5.5 | `CLAUDE.md` con los comandos confirmados |

Resultado: sin criterios pendientes.

Hallazgos de la verificación (corregidos): la documentación de la API mostraba las respuestas sin el envoltorio `{ data }` y casi ninguna tenía descripción (D-02); la ruta de desarrollo local del README fallaba porque la CLI de Prisma no leía el `.env` de la raíz (D-06).

Pendientes (no son de esta spec): los de la sección 10 del README, por decisión de alcance.
