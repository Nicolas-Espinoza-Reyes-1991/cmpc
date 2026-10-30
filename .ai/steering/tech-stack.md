# Tech Stack

## Backend
- Runtime: Node.js LTS
- Framework: NestJS, TypeScript estricto
- ORM: Prisma (schema declarativo, migraciones, cliente tipado)
- Base de datos: PostgreSQL 16
- Autenticación: JWT con `@nestjs/passport` y `passport-jwt`; contraseñas con `argon2`
- Validación de DTOs: `class-validator` y `class-transformer`
- Subida de archivos: `multer` (vía `@nestjs/platform-express`)
- Documentación: `@nestjs/swagger`
- Configuración: `@nestjs/config` con validación de variables de entorno (`joi`)
- Seguridad: `helmet` y `@nestjs/throttler`
- Exportación CSV: `fast-csv` (streaming)
- Exportación Excel (`.xlsx`): `write-excel-file` 4.1.1 (versión exacta)
- Testing: Jest con `@nestjs/testing`; umbral de cobertura 80%

## Frontend
- Build y dev server: Vite
- Framework: React con TypeScript estricto
- Routing: React Router
- Datos remotos: TanStack Query
- HTTP: Axios
- Formularios: React Hook Form + Zod (con `@hookform/resolvers`)
- Estilos: Tailwind CSS
- Testing: Vitest + React Testing Library (un único runner)

## DevOps
- Docker y Docker Compose con tres servicios: `db`, `backend` y `frontend`, más `pgadmin` opcional (solo con el perfil `tools`).
- Dockerfiles multi-etapa y usuario sin privilegios en las imágenes finales.

## Versiones
Las versiones exactas se fijan en cada `package.json` al crearlo. No usar `latest` en Docker.

## Decisiones cerradas
- Frontend con Vitest, no Jest, para no mantener dos runners.
- Tailwind sin librería de componentes, para mantener el código propio y pequeño.
- Prisma en lugar de Drizzle (el enunciado admite ambos): esquema declarativo en `schema.prisma`, migraciones versionadas y cliente tipado generado, lo que reduce código manual y errores de tipos. El SQL específico (índice `pg_trgm`) se añade como migración manual.
- Prisma fijado en la 6.19.3 (cliente y CLI en la misma versión exacta). La etiqueta `latest` de npm apunta a una 8.0.0 candidata (rc) y la línea 7 exige driver adapters y `prisma.config.ts`; la 6.x estable mantiene `url` en el esquema y el `PrismaClient` directo, que es lo que usa este diseño. Actualizar de mayor queda como mejora futura.
- NestJS 11 generado con `@nestjs/cli@11`: la versión 12 del CLI genera Vitest, oxlint y ESM, lo que contradice el stack definido aquí (Jest y ESLint). El backend compila a CommonJS (`module: commonjs`, `isolatedModules: false`) porque así los metadatos de inyección no añaden ramas artificiales a la cobertura y ts-jest no emite avisos. Por `strict: true`, las propiedades de los DTO se declaran con `!`.
- Dependencias de Nest con línea CommonJS: `@nestjs/config` 4.x, no 12.x. La 12 es solo ESM y Jest (CommonJS) no puede cargarla. Lo mismo con `@nestjs/swagger` (11.4.x), `@nestjs/jwt` (11.x) y `@nestjs/passport` (11.x): sus versiones 12 son solo ESM. `@nestjs/throttler` 6.x sí es CommonJS y declara soporte para Nest 11. Al añadir paquetes `@nestjs/*`, comprobar que su versión sea compatible con Nest 11 y con CommonJS.
- Frontend generado con `create-vite` 9 (Vite 8, React 19), con dos cambios sobre lo que genera: `typescript` fijado en la 5.9 (el generador trae la 7, pero `typescript-eslint` declara soporte solo para versiones menores de 6.1, y es la misma versión del backend) y ESLint 9 en lugar de `oxlint`, para tener las mismas reglas que el backend (`no-explicit-any`, reglas con tipos, Prettier). Vitest 5 y `@tailwindcss/vite` declaran compatibilidad con Vite 8. Prettier usa la misma configuración en ambas aplicaciones.
- ESLint 9 sigue en ambos proyectos (npm avisa de que ya no tiene soporte). Subir backend y frontend a ESLint 10 queda como mejora futura; los plugins instalados ya lo declaran compatible.
- Excel con `write-excel-file` 4.1.1 y no `exceljs` ni SheetJS: una sola dependencia transitiva (`fflate`), 1,8 MB, 0 hallazgos de `npm audit`, publicada en 2026 y con compilación CommonJS (`require` en su `exports`), que es la que usa el backend. `exceljs` trae 194 paquetes, 22 MB y hallazgos de `npm audit`, sin versión desde 2024; el `xlsx` de npm está desactualizado y vulnerable. La librería arma el libro en memoria, por eso la API limita el Excel a 20.000 filas (el CSV, en flujo, no tiene tope). Detalle en `.ai/specs/books-export-xlsx/design.md`.
- Idioma: identificadores, código, mensajes de commit y respuestas de la API en inglés; documentación (README, specs, steering) y textos de la interfaz en español.
