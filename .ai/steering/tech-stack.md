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
- NestJS 11 generado con `@nestjs/cli@11`: la versión 12 del CLI genera Vitest, oxlint y ESM, lo que contradice el stack definido aquí (Jest y ESLint). El backend compila a CommonJS (`module: commonjs`, `isolatedModules: false`) porque así los metadatos de inyección no añaden ramas artificiales a la cobertura y ts-jest no emite avisos. Por `strict: true`, las propiedades de los DTO se declaran con `!`.
- Idioma: identificadores, código, mensajes de commit y respuestas de la API en inglés; documentación (README, specs, steering) y textos de la interfaz en español.
