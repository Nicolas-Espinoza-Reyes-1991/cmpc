# Arquitectura de CMPC Libros

Diagramas en [Mermaid](https://mermaid.js.org/): GitHub los dibuja directamente. Cada nodo corresponde a código real (módulos de `backend/src/app.module.ts`, rutas de la API y `docker-compose.yml`). Para el modelo de datos, ver [`erd.md`](erd.md) y [`erd.dbml`](erd.dbml); para las decisiones, el [README](../README.md) y cada `design.md` de `.ai/specs/`.

## 1. Contexto y despliegue (Docker Compose)

```mermaid
flowchart LR
    user(["Usuario<br/>(navegador)"])

    subgraph compose["docker compose"]
        subgraph fe["frontend (nginx, usuario sin privilegios, :8080)"]
            spa["SPA React<br/>(archivos estáticos)"]
            proxy["Proxy inverso<br/>/api → backend"]
        end
        subgraph be["backend (NestJS, :3000 solo en loopback)"]
            api["API REST /api<br/>Swagger en /api/docs"]
            files["Archivos públicos<br/>/api/uploads"]
        end
        db[("db<br/>PostgreSQL 16")]
        pgadmin["pgadmin<br/>(perfil tools, opcional)"]
        uploads[/"volumen uploads"/]
        pgdata[/"volumen pgdata"/]
    end

    user -- "HTTP :8080" --> spa
    user -- "/api/..." --> proxy
    proxy -- "X-Forwarded-For" --> api
    api -- "Prisma (SQL)" --> db
    api -- "escribe portadas" --> uploads
    files -- "lee portadas" --> uploads
    db --- pgdata
    pgadmin -.-> db
```

- El navegador solo habla con nginx (mismo origen): no hace falta CORS en producción y el puerto del backend no se publica hacia fuera.
- nginx añade su `X-Forwarded-For`; el backend confía **solo en un salto** (`trust proxy = 1`), así que la IP que guarda la auditoría y la que usa el límite de intentos no se puede falsificar desde el cliente.
- Cada servicio tiene su `healthcheck` (`pg_isready`, `GET /api/health` y `/healthz`). `backend` espera a que `db` esté sano; `frontend`, a que `backend` lo esté. Al arrancar, el backend aplica las migraciones (`prisma migrate deploy`) y, solo si se pide, el seed.

## 2. Módulos del backend

```mermaid
flowchart TB
    app["AppModule"]
    app --> config["ConfigModule<br/>(variables validadas con Joi)"]
    app --> prisma["PrismaModule (global)<br/>PrismaService + extensión de soft delete"]
    app --> auth["AuthModule<br/>login, JWT, guard global, límite de intentos"]
    app --> health["HealthModule<br/>GET /api/health"]
    app --> catalog["CatalogModule<br/>autores, editoriales, géneros (lectura)"]
    app --> books["BooksModule<br/>CRUD, listado, portada, CSV"]

    auth --> users["UsersModule<br/>UsersService"]
    auth --> audit["AuditModule<br/>AuditService (único escritor de audit_logs)"]
    books --> catalog
    books --> audit

    books -. "usa" .-> prisma
    catalog -. "usa" .-> prisma
    audit -. "usa" .-> prisma
    users -. "usa" .-> prisma
    health -. "usa" .-> prisma

    subgraph common["common/ (transversales)"]
        filter["HttpExceptionFilter<br/>formato único de error"]
        interceptor["TransformInterceptor<br/>{ data, meta }"]
        logger["Middleware de log HTTP"]
        decorators["@Public · @CurrentUser · @Actor · @RawResponse"]
    end
```

- Un controlador solo conoce su servicio; ningún controlador usa Prisma. `BooksService` no escribe en `audit_logs`: llama a `AuditService`.
- `PrismaModule` es global; el resto de módulos declaran solo lo que importan de otros módulos de negocio.
- El guard JWT se registra con `APP_GUARD`: **todo está protegido** salvo lo marcado `@Public()` (`/api/health` y `/api/auth/login`). Un test e2e recorre el documento OpenAPI y exige 401 en cada ruta.

## 3. Una escritura: transacción y auditoría

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant N as nginx
    participant G as Guard JWT + ValidationPipe
    participant C as BooksController
    participant S as BooksService
    participant A as AuditService
    participant DB as PostgreSQL

    U->>N: PATCH /api/books/:id (token + cambios)
    N->>G: reenvía con X-Forwarded-For
    G->>G: verifica el token y valida el cuerpo (whitelist)
    G->>C: petición válida
    C->>S: update(id, dto, actor{userId, ip})
    S->>DB: BEGIN
    S->>DB: SELECT … FOR UPDATE (bloquea el libro)
    S->>DB: lee el libro actual → before
    S->>DB: resuelve o crea autor/editorial/género (upsert)
    S->>DB: UPDATE books
    S->>A: log(tx, UPDATE, before, after, actor)
    A->>DB: INSERT audit_logs (misma transacción)
    S->>DB: COMMIT
    S-->>C: libro actualizado
    C-->>U: 200 { data: libro }
    Note over S,DB: Si cualquier paso falla, ROLLBACK: no queda ni el libro,<br/>ni los catálogos nuevos, ni la entrada de auditoría.
```

- Mismo patrón para crear (sin bloqueo ni `before`), eliminar (borrado lógico) y cambiar o quitar la portada.
- El bloqueo de fila hace que dos ediciones simultáneas del mismo libro hagan cola: cada `before` es el `after` de la entrada anterior.
- Los inicios de sesión se auditan fuera de una transacción de negocio y **con mejor esfuerzo**: un fallo de la tabla de auditoría no impide entrar.

## 4. Exportación a CSV (flujo)

```mermaid
flowchart LR
    req["GET /api/books/export<br/>(mismos filtros y orden que el listado)"] --> ctl["BooksController"]
    ctl --> gen["BooksService.exportRows<br/>generador asíncrono"]
    gen -- "lotes de 500<br/>con cursor sobre id" --> db[("PostgreSQL")]
    gen --> rows["Readable.from(filas)"]
    rows --> csv["fast-csv<br/>escapa fórmulas (= + - @)"]
    csv --> bom["Etapa de BOM UTF-8"]
    bom --> res["Respuesta HTTP<br/>text/csv · attachment"]
    res -. "contrapresión: un cliente lento frena la lectura" .-> gen
    res -. "si el cliente se va, pipeline cierra todo" .-> db
```

- La memoria usada depende del tamaño del lote, no del de la tabla (medido: +24 MB con 305.000 libros).
- Los filtros y el orden se construyen con las mismas funciones puras que el listado (`buildBookWhere`, `buildBookOrderBy`), por lo que el CSV y la tabla no pueden divergir.

### Exportación a Excel

```mermaid
flowchart LR
    req["GET /api/books/export/xlsx<br/>(mismos filtros y orden)"] --> ctl["BooksController"]
    ctl --> all["BooksService.exportAll"]
    all -- "count" --> db[("PostgreSQL")]
    all -- "más de 20.000" --> r422["422: aplica filtros<br/>o usa el CSV"]
    all -- "hasta 20.000: mismos lotes<br/>de exportRows" --> db
    all --> build["buildBooksXlsx<br/>write-excel-file, en memoria"]
    build --> res["Respuesta HTTP<br/>.xlsx · attachment · Content-Length"]
```

- A diferencia del CSV, el archivo se arma completo **antes** de enviar el primer byte (un `.xlsx` es un zip): por eso el tope y cualquier fallo de la base responden con el formato normal de error.
- Una columna por campo, encabezado en negrita y fijo, precio numérico y fechas reales. Los textos van como texto, así que `=…` no se ejecuta como fórmula.

## 5. Frontend

```mermaid
flowchart TB
    router["React Router<br/>/login · /books · /books/new · /books/:id · /books/:id/edit"]
    router --> pages["pages/<br/>LoginPage · BooksPage · BookFormPage · BookDetailPage"]
    pages --> comps["components/<br/>BookTable · BookFilters · Pagination · BookForm · ImageField · ConfirmDialog"]
    pages --> hooks["hooks/<br/>useBooks · useBook · useBookListParams · useExportBooks · useDebounce · useAuth"]
    hooks --> query["TanStack Query<br/>caché, reintentos, keepPreviousData"]
    hooks --> services["services/<br/>auth · books · catalog (una por recurso)"]
    services --> axios["Cliente Axios (lib/api-client)<br/>token, ApiError, 401 → login"]
    axios --> api["/api (nginx → backend)"]
    pages -. "estado de la vista en la URL<br/>(q, filtros, sort, page)" .-> router
```

- Los errores del backend (formato único) los traduce un interceptor de Axios a `ApiError`; la UI muestra mensajes por campo en formularios y un aviso global para errores de red o sesión caducada.
- El estado del listado (búsqueda, filtros, orden, página) vive en la URL: recargar, volver atrás y compartir el enlace conservan la vista.
