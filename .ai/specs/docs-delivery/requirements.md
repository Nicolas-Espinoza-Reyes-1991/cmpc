# Spec docs-delivery: Requisitos

Cubre los IDs del enunciado: **DOC-1**, **DOC-2**, **DOC-3**, **DOC-4**, **GEN-1** (supuestos), **GEN-3** (cómo se implementaría lo no completado). Relacionados: GEN-2 (preparado para producción: dependencias sin hallazgos conocidos), OPS-1.
Depende de todas las specs anteriores: documenta lo que existe y lo comprueba.

Formato: CUANDO <evento>, EL SISTEMA DEBERÁ <respuesta>. Cada criterio es verificable.

> **Nota sobre el proceso.** Esta spec se redactó y se implementó sin la pausa de aprobación que pide `CLAUDE.md`, por indicación expresa del usuario (trabajo autónomo durante la noche). Las decisiones que habrían ido a aprobación están en `design.md` §1 para su revisión.

## Fuera de alcance
- Manual de usuario con capturas de pantalla y vídeos.
- Documentación generada automáticamente del código (TypeDoc, Compodoc).
- Publicar la documentación en un sitio (GitHub Pages).

## D1. README (DOC-1)
- D1.1 EL SISTEMA DEBERÁ tener un `README.md` en la raíz, en español, que explique qué es el proyecto y qué entrega, con una tabla del estado de cada requisito del enunciado.
- D1.2 EL README DEBERÁ explicar la **instalación** de dos maneras, con los comandos exactos y los prerrequisitos y versiones: Docker Compose (camino principal) y desarrollo local (base en Docker, backend y frontend con Node). Incluye la creación del `.env` desde `.env.example` y qué variables hay que cambiar.
- D1.3 EL README DEBERÁ incluir una **guía de uso**: iniciar sesión, listar, filtrar, ordenar, buscar, crear, editar, subir portada, ver detalle, eliminar y exportar CSV; y cómo llamar a la API con `curl`.
- D1.4 EL README DEBERÁ describir la **arquitectura** (módulos, flujo de una petición, transacciones y auditoría, frontend) y enlazar `docs/architecture.md` y `docs/erd.dbml`.
- D1.5 EL README DEBERÁ explicar las **decisiones técnicas** y sus motivos (stack, Prisma, auditoría en la misma transacción, flujo CSV, etc.), enlazando cada `design.md` para el detalle.
- D1.6 EL README DEBERÁ explicar cómo **ejecutar las pruebas y la cobertura** en ambas aplicaciones, con los resultados reales de la última medición.
- D1.7 EL README DEBERÁ describir la **seguridad y la puesta en producción**: qué configurar (secretos, CORS, HTTPS delante, volúmenes, copias de seguridad) y qué protecciones hay.
- D1.8 Todos los comandos y enlaces del README DEBERÁN comprobarse ejecutándolos o abriéndolos (D5).

## D2. Documentación de la API (DOC-2)
- D2.1 EL SISTEMA DEBERÁ servir Swagger UI en `/api/docs` y el JSON de OpenAPI, y mostrar **todas** las rutas de la API salvo las deliberadamente públicas de ficheros (`/api/uploads`), con resumen, parámetros, cuerpos y respuestas (éxito y errores).
- D2.2 La autenticación DEBERÁ poder probarse desde Swagger UI (botón *Authorize* con el token de `/api/auth/login`).
- D2.3 Una prueba automática DEBERÁ fallar si una operación de la API no tiene resumen o no declara su respuesta de éxito (que la documentación no se quede atrás).

## D3. Diagrama de arquitectura (DOC-3)
- D3.1 EL SISTEMA DEBERÁ tener `docs/architecture.md` con diagramas Mermaid (que GitHub renderiza): contexto y despliegue Docker, módulos del backend y sus dependencias, flujo de una escritura con su transacción y su auditoría, y flujo de la exportación CSV.
- D3.2 Los diagramas DEBERÁN corresponder al código real (se comprueban contra los módulos y rutas existentes).

## D4. Modelo relacional (DOC-4)
- D4.1 EL SISTEMA DEBERÁ tener `docs/erd.dbml` (importable en dbdiagram.io) con todas las tablas, columnas, tipos, claves, relaciones e índices, incluidos los que Prisma no puede expresar (GIN `pg_trgm` y el índice único parcial).
- D4.2 EL SISTEMA DEBERÁ tener una imagen exportada (`docs/erd.svg`) y la misma información en el README o en `docs/`.
- D4.3 El DBML DEBERÁ coincidir con la base real (se comprueba tabla por tabla contra `information_schema` y `pg_indexes`).

## D5. Supuestos, pendientes y verificación (GEN-1, GEN-3)
- D5.1 EL README DEBERÁ listar los **supuestos** con su fundamento (usuario inicial por seed, imágenes en volumen local, un autor por libro, disponibilidad sí/no, catálogos creados al registrar, etc.).
- D5.2 EL README DEBERÁ listar lo **no completado o fuera de alcance** y, para cada punto, **cómo se implementaría** (enfoque, piezas afectadas y esfuerzo relativo).
- D5.3 EL SISTEMA DEBERÁ seguir las instrucciones del README desde un clon limpio del repositorio, con Docker, y llegar a una aplicación funcionando (login y listado).
- D5.4 `npm audit --omit=dev` DEBERÁ quedar sin hallazgos en ambas aplicaciones, o cada hallazgo restante DEBERÁ estar evaluado y justificado en el README.
- D5.5 `CLAUDE.md` DEBERÁ tener los comandos confirmados (la nota «se confirman cuando exista cada `package.json`» se retira).
