# Enunciado de la prueba técnica y matriz de trazabilidad

Fuente de verdad: PDF "Prueba Técnica Full Stack - CMPC Libros". Este archivo recoge sus requisitos con un identificador cada uno y la spec que los cubre. Si un requisito no tiene spec, hay que crearla antes de programar.

## Indicaciones generales del enunciado
- Explicar y fundamentar los supuestos.
- Considerar todo lo necesario para que funcione en un ambiente productivo real.
- No se espera completar todo; se valora arquitectura, calidad del código y decisiones técnicas. Lo que no se complete se documenta con cómo se implementaría.
- Entrega: repositorio Git con el código y la documentación completa.
- Datos de un libro: título, autor, editorial, precio, disponibilidad y género.

## Specs (carpeta `.ai/specs/`)
| Spec | Alcance |
|---|---|
| `platform` | Estructura de proyectos, configuración, Docker, errores, interceptores, seguridad, health, cobertura |
| `auth` | Login JWT en backend y pantalla de login en frontend |
| `books-crud` | Alta, edición, detalle y soft delete (backend y frontend), transacciones |
| `books-listing` | Listado con filtros, orden múltiple, paginación y búsqueda con debounce |
| `book-image-upload` | Carga de imagen por libro |
| `books-export-csv` | Exportación a CSV |
| `books-export-xlsx` | Exportación a Excel (`.xlsx`), complemento del CSV (fuera del enunciado: usabilidad en Excel en español) |
| `audit-log` | Auditoría de operaciones |
| `docs-delivery` | README, Swagger, diagrama de arquitectura y modelo relacional |

## Matriz de trazabilidad
| ID | Requisito del enunciado | Spec |
|---|---|---|
| FE-1 | Login de autenticación | `auth` |
| FE-2a | Filtros por género, editorial, autor y disponibilidad | `books-listing` |
| FE-2b | Ordenamiento dinámico por múltiples campos | `books-listing` |
| FE-2c | Paginación del lado del servidor | `books-listing` |
| FE-2d | Búsqueda en tiempo real con debounce | `books-listing` |
| FE-3a | Formulario de alta/edición con validación reactiva | `books-crud` |
| FE-3b | Carga de una imagen por libro | `book-image-upload` |
| FE-4 | Visualizar los datos de un libro | `books-crud` |
| BE-1 | Arquitectura modular y escalable con SOLID | `platform` |
| BE-2 | Autenticación JWT | `auth` |
| BE-3 | Endpoints REST para el CRUD de libros | `books-crud` |
| BE-4 | Exportación de datos en CSV | `books-export-csv` (y `books-export-xlsx` como complemento) |
| BE-5 | Soft delete | `books-crud` |
| BE-6 | Logging para auditoría de operaciones | `audit-log` |
| DB-0 | Prisma o Drizzle: migraciones, esquema declarativo, cliente tipado | `platform` |
| DB-1 | Modelo normalizado con relaciones e índices | `books-crud` |
| DB-2 | Transacciones en operaciones críticas | `books-crud`, `audit-log` |
| T-1 | Tests unitarios de componentes y servicios del frontend | todas (cada spec incluye sus pruebas) |
| T-2 | Tests unitarios de servicios y controladores de NestJS | todas |
| T-3 | Cobertura de al menos 80% | `platform` |
| OPS-1 | `docker-compose.yml` para el stack local completo | `platform` |
| DOC-1 | README: instalación, guía de uso, arquitectura y decisiones | `docs-delivery` |
| DOC-2 | Documentación de la API con Swagger/OpenAPI | `docs-delivery` |
| DOC-3 | Diagrama de arquitectura | `docs-delivery` |
| DOC-4 | Modelo relacional de la base de datos | `docs-delivery` |
| ADD-1 | Manejo de errores en frontend y backend | `platform` |
| ADD-2 | Interceptores en NestJS para transformar respuestas | `platform` |
| GEN-1 | Supuestos explicados y fundamentados | `docs-delivery` |
| GEN-2 | Preparado para un ambiente productivo real | `platform` |
| GEN-3 | Documentar cómo se implementaría lo no completado | `docs-delivery` |

## Criterios de evaluación (para decidir prioridades)
Calidad y legibilidad del código; arquitectura y escalabilidad; rendimiento y optimización; cobertura y calidad de los tests; usabilidad y experiencia de usuario; documentación y facilidad de despliegue; patrones de diseño y buenas prácticas.
