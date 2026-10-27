# Convenciones

## Idioma
- Código, identificadores, mensajes de commit y respuestas de la API: inglés.
- Documentación (README, specs, steering, comentarios largos) y textos visibles en la interfaz: español.

## Nombres
- Archivos backend: `kebab-case` con sufijo de rol (`books.service.ts`, `create-book.dto.ts`).
- Archivos frontend: componentes en `PascalCase.tsx`, hooks y utilidades en `camelCase.ts`.
- Clases e interfaces: `PascalCase`. Variables y funciones: `camelCase`. Constantes globales: `UPPER_SNAKE_CASE`.
- Modelos Prisma en `PascalCase` singular (`Book`), campos en `camelCase`; tablas físicas en `snake_case` plural mediante `@@map` (`books`).

## TypeScript
- `strict: true` en todos los `tsconfig`.
- Prohibido `any`. Usar `unknown` y estrechar el tipo.
- Tipos de API definidos una vez en `types/` del frontend y en DTOs del backend, alineados con Swagger.

## Errores
- El backend lanza excepciones de NestJS (`NotFoundException`, `BadRequestException`, etc.); nunca devuelve errores como objeto en éxito.
- El frontend muestra mensajes de error del formato único; nunca muestra stack traces.

## Logs
- Logger de NestJS (`Logger`) con contexto por clase.
- Nunca registrar contraseñas, tokens ni datos personales completos.

## Seguridad
- Contraseñas con `argon2`; nunca en texto plano ni en respuestas.
- Validación de entrada en DTOs con `whitelist: true` y `forbidNonWhitelisted: true`.
- Subida de imágenes: validar tipo MIME (`image/jpeg`, `image/png`, `image/webp`) y tamaño máximo de 2 MB; no confiar en la extensión.
- CSV: escapar celdas que empiecen con `=`, `+`, `-`, `@` para evitar inyección de fórmulas.
- Secretos solo en variables de entorno; `.env` fuera de Git y `.env.example` versionado.

## Pruebas
- Nombres: `*.spec.ts` (backend y frontend).
- Cada servicio y controlador del backend tiene pruebas unitarias; en el frontend, los componentes, los servicios HTTP y los hooks críticos.
- Mocks de Prisma y Axios; ninguna prueba unitaria toca la base de datos real.
- Cobertura mínima 80%, verificada con `npm run test:cov`.

## Git
- Ramas: `main` estable; trabajo en `feat/<feature>`, `fix/<tema>` o `docs/<tema>`.
- Commits convencionales, un commit por tarea de `tasks.md`.
- Nunca commitear `node_modules`, `.env`, `dist` ni archivos generados.
