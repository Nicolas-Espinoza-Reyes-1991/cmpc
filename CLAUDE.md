# CMPC Libros

Aplicación full stack para digitalizar el inventario de la tienda CMPC-libros.
Stack: NestJS + Prisma + PostgreSQL (backend), React + TypeScript (frontend), Docker Compose.

@.ai/steering/enunciado.md
@.ai/steering/product.md
@.ai/steering/tech-stack.md
@.ai/steering/architecture.md
@.ai/steering/conventions.md

## Flujo obligatorio (Spec-Driven Development)
1. Antes de programar una funcionalidad, leer su carpeta en `.ai/specs/<feature>/`.
2. Si la carpeta no existe o no tiene `requirements.md`, `design.md` y `tasks.md`, crearlos y pedir aprobación antes de escribir código.
3. Implementar solo las tareas de `tasks.md`, en orden.
4. Marcar una tarea como hecha solo cuando su prueba pasa.
5. No ampliar el alcance: lo que no esté en `requirements.md` se documenta como mejora futura, no se implementa.
6. Cada `requirements.md` indica los IDs de `enunciado.md` que cubre; ningún ID del enunciado queda sin spec.
7. Orden de las specs: `platform`, `auth`, `books-crud`, `books-listing`, `book-image-upload`, `books-export-csv`, `audit-log`, `docs-delivery`.

## Flujo de Git y pull requests
1. `main` es la rama estable y solo recibe cambios mediante un pull request (PR); nunca se commitea directamente en ella.
2. Cada spec se desarrolla en su rama `feat/<spec>` (o `fix/<tema>`, `docs/<tema>`), creada desde `main` actualizado.
3. Un commit por tarea de `tasks.md`, con su prueba pasando, en formato convencional y en inglés.
4. Al terminar la spec (incluida su verificación) se abre un PR hacia `main` con: resumen, requisitos del enunciado que cubre, decisiones relevantes, evidencia de verificación (pruebas, cobertura, pruebas con base de datos y navegador reales) y pendientes conocidos.
5. El PR se fusiona con un commit de fusión (`Create a merge commit`), no con squash, para conservar un commit por tarea en el historial.
6. Antes de subir código a un repositorio público se revisan los archivos y el historial en busca de secretos; `.env` nunca se versiona.

## Reglas de código
- TypeScript estricto. Prohibido `any`. Usar `as` solo con comentario que lo justifique.
- Los controladores no usan Prisma directamente; llaman a servicios.
- Comentar las decisiones técnicas no obvias, en una o dos líneas.
- No añadir dependencias fuera de `tech-stack.md` sin preguntar antes.
- Commits en formato convencional (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), uno por tarea, en inglés. La documentación va en español (ver `conventions.md`).

## Comandos
- Backend: `npm run test`, `npm run test:cov`, `npm run lint`
- Frontend: `npm run test`, `npm run lint`
- Base de datos: `npx prisma migrate dev`, `npx prisma db seed`
- Stack completo: `docker compose up --build`

(Los comandos se confirman cuando exista cada `package.json`; actualizar esta sección si cambian.)
