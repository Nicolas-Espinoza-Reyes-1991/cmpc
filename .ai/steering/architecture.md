# Arquitectura

## Visión general
```
React (Vite) ──HTTP/JSON──> NestJS API ──Prisma──> PostgreSQL
                              │
                              └── Volumen local (imágenes)
```

## Backend: módulos
- `AuthModule`: login, emisión de JWT, estrategia Passport y guard global.
- `BooksModule`: CRUD, filtros, paginación, exportación CSV y subida de imagen.
- `CatalogModule`: lectura de autores, editoriales y géneros (para filtros y autocompletado).
- `AuditModule`: `AuditService`, único punto de escritura en `AuditLog`.
- `PrismaModule`: cliente Prisma compartido.
- `HealthModule`: endpoint `/api/health` con verificación de base de datos.
- `common/`: filtros de excepción, interceptores, decoradores y utilidades transversales.

Un controlador solo conoce su servicio; un servicio no conoce controladores. Cada módulo tiene sus DTOs, servicio, controlador y pruebas.

## Principios SOLID aplicados
- **S:** cada servicio tiene una responsabilidad. `BooksService` no escribe en `AuditLog` directamente; llama a `AuditService`.
- **O:** los filtros del listado se construyen en una función pura `buildBookWhere(query)`, que se extiende sin tocar el resto del servicio.
- **I:** DTOs separados por caso de uso (`CreateBookDto`, `UpdateBookDto`, `ListBooksQueryDto`).
- **D:** los servicios reciben `PrismaService` y `AuditService` por inyección, lo que permite sustituirlos en las pruebas.
- No se añade capa de repositorios sobre Prisma: Prisma ya es la capa de acceso a datos y otra capa solo añadiría código sin beneficio.

## Modelo de datos (normalizado)
| Modelo | Campos principales | Notas |
|---|---|---|
| `User` | `id`, `email` (único), `passwordHash`, `createdAt` | Sin roles. |
| `Author` | `id`, `name` (único), `createdAt` | Catálogo. |
| `Publisher` | `id`, `name` (único), `createdAt` | Catálogo. |
| `Genre` | `id`, `name` (único), `createdAt` | Catálogo. |
| `Book` | `id`, `title`, `price` (`Decimal(10,2)`), `availability` (`Boolean`), `imageUrl?`, `authorId`, `publisherId`, `genreId`, `createdAt`, `updatedAt`, `deletedAt?` | Un autor por libro; N:M queda como mejora futura. Solo `Book` tiene soft delete. |
| `AuditLog` | `id`, `action` (enum), `entity`, `entityId?`, `before?` (Json), `after?` (Json), `userId?`, `ip?`, `createdAt` | `action`: `CREATE`, `UPDATE`, `DELETE`, `LOGIN_SUCCESS`, `LOGIN_FAILED`. |

Relaciones: `Book` N:1 con `Author`, `Publisher` y `Genre`; `AuditLog` N:1 con `User` (opcional, para logins fallidos).

Índices:
- `Book`: `authorId`, `publisherId`, `genreId`, `availability`, `(deletedAt, createdAt)` y un índice GIN con `pg_trgm` sobre `title` (migración SQL manual) para la búsqueda parcial.
- `AuditLog`: `(entity, entityId)`, `userId` y `createdAt`.

Decisiones:
- `availability` es booleano (disponible o no). Gestión de stock queda fuera de alcance.
- Al crear o editar un libro, la API recibe nombres de autor, editorial y género; el servicio los resuelve con `connectOrCreate` dentro de la misma transacción. Los endpoints de catálogo son de solo lectura.

## Transacciones
Toda escritura sobre `Book` (crear, editar, eliminar) usa `prisma.$transaction` e incluye, en la misma transacción:
1. la resolución o creación de los catálogos (`connectOrCreate`),
2. la escritura del libro,
3. el registro en `AuditLog` mediante `auditService.log(tx, entry)`.
Si cualquiera falla, no se guarda nada.

## Transversales
- **Errores:** `HttpExceptionFilter` global con formato único `{ statusCode, message, errors?, path, timestamp }`.
- **Respuestas:** `TransformInterceptor` envuelve las respuestas exitosas en `{ data, meta? }`. Los servicios de listado devuelven `{ items, meta }` y el interceptor lo transforma en `{ data: items, meta }`.
- **Logging HTTP:** `LoggingInterceptor` registra método, ruta, estado, duración y usuario con el `Logger` de NestJS.
- **Auditoría de negocio:** se escribe explícitamente desde el servicio, dentro de la transacción (ver arriba). El login registra `LOGIN_SUCCESS` y `LOGIN_FAILED` desde `AuthService`.
- **Soft delete:** extensión del cliente Prisma que añade `deletedAt: null` a las consultas de lectura de `Book`, para no depender de que cada servicio se acuerde del filtro.

## Requisitos de ambiente productivo
- Configuración con `@nestjs/config` y validación del esquema de variables de entorno al arrancar; la aplicación no inicia si faltan.
- `helmet`, CORS restringido por variable de entorno y límite de tamaño de cuerpo.
- Límite de intentos en el login con `@nestjs/throttler`.
- `enableShutdownHooks` para cierre ordenado.
- Endpoint `/api/health` y `healthcheck` en Docker Compose para `db`, `backend` y `frontend`.
- Dockerfiles multi-etapa, ejecución con usuario sin privilegios y sin dependencias de desarrollo en la imagen final.
- Migraciones aplicadas con `prisma migrate deploy` al iniciar el contenedor del backend; seed solo en entorno de desarrollo o con comando explícito.
- Volumen persistente para la base de datos y para las imágenes; las imágenes se sirven con cabeceras de caché.
- Sin secretos en el repositorio: `.env.example` documenta cada variable.

## Frontend: estructura
```
src/
├── components/   # UI reutilizable sin lógica de negocio
├── pages/        # Pantallas enrutadas
├── services/     # Llamadas HTTP (Axios), una por recurso
├── hooks/        # useDebounce, useBooks, useAuth
├── types/        # Tipos del contrato de la API
└── lib/          # Cliente Axios, QueryClient, utilidades
```
Manejo de errores: un interceptor de Axios traduce el formato único de error del backend; la UI muestra mensajes por campo en formularios y un aviso global para errores de red o 401 (que cierra la sesión).

## Contrato de API
- Prefijo `/api`; documentación Swagger en `/api/docs`.
- Listado paginado: `{ data: Book[], meta: { page, limit, total } }`.
- Errores: formato único de `HttpExceptionFilter`.

## Entregables de documentación
```
README.md              # Instalación, uso, arquitectura, decisiones y supuestos
docs/architecture.md   # Diagrama de arquitectura (Mermaid)
docs/erd.dbml          # Modelo relacional (dbdiagram.io) + imagen exportada
```
Swagger se genera desde los decoradores del código.
