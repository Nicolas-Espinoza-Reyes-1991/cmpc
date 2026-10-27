# Spec platform: Requisitos

Cubre los IDs del enunciado: **BE-1, DB-0, ADD-1, ADD-2, OPS-1, T-3, GEN-2**.
Sienta la base técnica que usan todas las demás specs. No incluye funcionalidades de negocio.

Formato: CUANDO <evento>, EL SISTEMA DEBERÁ <respuesta>. Cada criterio es verificable.

## R1. Estructura del proyecto (BE-1)
- R1.1 El repositorio DEBERÁ contener dos aplicaciones independientes, `backend/` y `frontend/`, un `docker-compose.yml` y un `.env.example` en la raíz.
- R1.2 El backend DEBERÁ organizarse en módulos NestJS (`PrismaModule`, `HealthModule`, `common/`) según `architecture.md`.
- R1.3 Un controlador NO DEBERÁ importar `PrismaService`; el acceso a datos pasa por servicios.

## R2. Configuración (GEN-2)
- R2.1 CUANDO el backend arranque y falte una variable obligatoria o tenga un valor inválido, EL SISTEMA DEBERÁ terminar con un mensaje que nombre la variable.
- R2.2 El repositorio NO DEBERÁ contener secretos; `.env` DEBERÁ estar en `.gitignore` y `.env.example` DEBERÁ documentar cada variable.
- R2.3 CUANDO `NODE_ENV=production`, EL SISTEMA DEBERÁ rechazar un `JWT_SECRET` de menos de 32 caracteres.

## R3. Base de datos y Prisma (DB-0)
- R3.1 El esquema DEBERÁ vivir en `backend/prisma/schema.prisma` y todo cambio DEBERÁ ir en una migración versionada.
- R3.2 El acceso a datos DEBERÁ usar el cliente Prisma tipado generado; NO DEBERÁ haber SQL en crudo salvo la migración manual de `pg_trgm` y la consulta `SELECT 1` del endpoint de salud.
- R3.3 CUANDO se ejecute `prisma migrate deploy` sobre una base vacía, EL SISTEMA DEBERÁ aplicar sin error todas las migraciones existentes. Esta spec aporta la migración inicial con el modelo `User` (necesario para el seed); cada spec posterior añade los modelos que define (`books-crud`: catálogos y `Book`; `audit-log`: `AuditLog`).
- R3.4 El `PrismaService` DEBERÁ conectar al iniciar y desconectar al cerrar la aplicación.

## R4. Manejo de errores (ADD-1)
- R4.1 CUANDO cualquier endpoint falle, EL SISTEMA DEBERÁ responder con el formato `{ statusCode, message, errors?, path, timestamp }`.
- R4.2 CUANDO un DTO no supere la validación, EL SISTEMA DEBERÁ responder 400 con `errors` listando campo y mensaje por cada fallo.
- R4.3 CUANDO ocurra un error no controlado, EL SISTEMA DEBERÁ responder 500 con un mensaje genérico, sin stack trace ni detalles internos, y registrar el detalle en el log.
- R4.4 CUANDO el cliente envíe propiedades no declaradas en un DTO, EL SISTEMA DEBERÁ rechazarlas con 400.
- R4.5 CUANDO Prisma lance un error conocido (registro no encontrado, violación de unicidad), EL SISTEMA DEBERÁ traducirlo a 404 o 409 respectivamente.
- R4.6 CUANDO el frontend reciba un error de la API, EL SISTEMA DEBERÁ normalizarlo a un objeto tipado único y mostrar un mensaje comprensible; ante error de red DEBERÁ mostrar un aviso de conexión.
- R4.7 CUANDO el frontend reciba un 401, EL SISTEMA DEBERÁ cerrar la sesión y redirigir al login.

## R5. Interceptores (ADD-2)
- R5.1 CUANDO un endpoint responda con éxito, EL SISTEMA DEBERÁ devolver `{ data }`, o `{ data, meta }` cuando el servicio devuelva `{ items, meta }`.
- R5.2 EL SISTEMA DEBERÁ registrar cada petición con método, ruta, estado, duración en milisegundos y usuario (si existe), sin registrar cuerpos, contraseñas ni tokens.
- R5.3 Las respuestas de descarga de archivos (CSV, imágenes) NO DEBERÁN ser envueltas por el interceptor de transformación.

## R6. Seguridad y operación (GEN-2)
- R6.1 EL SISTEMA DEBERÁ aplicar `helmet` y aceptar peticiones solo del origen definido en `CORS_ORIGIN`.
- R6.2 EL SISTEMA DEBERÁ limitar el tamaño del cuerpo JSON a 100 KB.
- R6.3 CUANDO se haga `GET /api/health`, EL SISTEMA DEBERÁ responder 200 si la base de datos responde y 503 si no.
- R6.4 CUANDO el proceso reciba SIGTERM, EL SISTEMA DEBERÁ cerrar conexiones y terminar de forma ordenada.
- R6.5 El prefijo global DEBERÁ ser `/api` y Swagger DEBERÁ estar disponible en `/api/docs`.

## R7. Docker (OPS-1)
- R7.1 CUANDO se ejecute `docker compose up --build` en una máquina con Docker y un `.env` copiado de `.env.example`, EL SISTEMA DEBERÁ levantar `db`, `backend` y `frontend` sin pasos manuales adicionales.
- R7.2 `backend` DEBERÁ esperar a que `db` esté sana (`depends_on` con `service_healthy`) y aplicar las migraciones antes de aceptar peticiones.
- R7.3 CUANDO la variable `SEED_ON_START=true`, EL SISTEMA DEBERÁ ejecutar el seed (usuario administrador inicial); con `false` NO DEBERÁ ejecutarlo.
- R7.4 Los datos de PostgreSQL y las imágenes subidas DEBERÁN persistir en volúmenes nombrados entre reinicios.
- R7.5 Las imágenes finales DEBERÁN construirse en varias etapas, no contener dependencias de desarrollo y ejecutarse con un usuario sin privilegios.
- R7.6 Cada servicio DEBERÁ tener un `healthcheck`.
- R7.7 `pgadmin` DEBERÁ iniciarse solo con el perfil `tools`.
- R7.8 Los puertos y credenciales DEBERÁN venir de variables de entorno, sin valores fijos en `docker-compose.yml`.

## R8. Pruebas y cobertura (T-3)
- R8.1 CUANDO se ejecute `npm run test:cov` en `backend/`, EL SISTEMA DEBERÁ fallar si la cobertura de líneas, ramas, funciones o sentencias es menor a 80%.
- R8.2 CUANDO se ejecute `npm run test:cov` en `frontend/`, EL SISTEMA DEBERÁ fallar bajo el mismo umbral.
- R8.3 Las pruebas unitarias NO DEBERÁN requerir base de datos ni red.
- R8.4 La cobertura DEBERÁ excluir solo código declarativo o de arranque (`main.ts`, `run-seed.ts`, `*.module.ts`, DTOs, tipos, cliente Prisma generado); la lista DEBERÁ estar documentada en `design.md`.

## R9. Calidad estática
- R9.1 `tsconfig` DEBERÁ tener `strict: true` en backend y frontend.
- R9.2 ESLint DEBERÁ prohibir `any` explícito; `npm run lint` DEBERÁ terminar sin errores.
- R9.3 Prettier DEBERÁ estar configurado con las mismas reglas en ambas aplicaciones.

## Fuera de alcance de esta spec
Autenticación, libros, auditoría, subida de imágenes y exportación (specs propias).
