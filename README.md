# CMPC Libros

Aplicación full stack para digitalizar el inventario de la tienda **CMPC-libros**: registrar, consultar, editar, eliminar (de forma lógica) y exportar libros, con login, auditoría y portada por libro.

**Stack:** NestJS 11 · Prisma 6 · PostgreSQL 16 · React 19 + TypeScript · Vite · Tailwind · Docker Compose.
**Metodología:** desarrollo guiado por especificaciones (cada funcionalidad tiene su `requirements.md`, `design.md` y `tasks.md` en [`.ai/specs/`](.ai/specs)) y ramas + *pull requests* como en un equipo real (ver [Cómo se trabajó](#cómo-se-trabajó)).

## Para el evaluador: pruébalo en 5 minutos

Solo necesitas **Git** y **Docker** (no hace falta Node.js). Ejecuta estos pasos en orden; los detalles están más abajo.

**1. Clonar el repositorio**

```bash
git clone https://github.com/Nicolas-Espinoza-Reyes-1991/cmpc.git
```

```bash
cd cmpc
```

**2. Crear la configuración** (en PowerShell: `copy .env.example .env`)

```bash
cp .env.example .env
```

Abre `.env` y reemplaza cada `change-me`: `POSTGRES_PASSWORD` (cualquier valor), `JWT_SECRET` (32 caracteres o más), `ADMIN_PASSWORD` (8 o más) y `PGADMIN_PASSWORD`. Deja `SEED_ON_START=true`. (`DATABASE_URL` solo importa para el desarrollo local: Docker la arma con `POSTGRES_*`.)

**3. Levantar todo** (la primera vez tarda unos minutos mientras construye las imágenes)

```bash
docker compose up --build
```

Espera a que `docker compose ps` muestre los tres servicios *healthy*.

**4. Abrir la aplicación:** <http://localhost:8080> e iniciar sesión con `admin@cmpc.local` (o el `ADMIN_EMAIL` que pusiste) y tu `ADMIN_PASSWORD`.

**Qué mirar**
1. **Libros → Nuevo libro:** crea varios (con una portada JPG/PNG/WebP y con un campo vacío para ver la validación).
2. **Listado:** busca escribiendo, filtra por autor, editorial, género y disponibilidad, ordena pulsando dos encabezados y cambia de página.
3. **Exportar Excel** (o **Exportar CSV**): descarga los libros filtrados; el Excel se abre con cada campo en su columna.
4. **Documentación de la API:** <http://localhost:8080/api/docs> (botón *Authorize* con el token del login).
5. **Auditoría:** cada alta, edición, baja y login queda en la tabla `audit_logs`:
   ```bash
   docker compose exec db psql -U cmpc -d cmpc_libros -c "select action, entity, created_at from audit_logs order by created_at desc limit 10"
   ```
6. **Pruebas y cobertura** (opcional, con Node 22): [§7](#7-pruebas-y-cobertura).

Para apagar: `docker compose down` (conserva los datos) o `docker compose down -v` (los borra).

---

## Índice
1. [Qué entrega y su estado](#1-qué-entrega-y-su-estado)
2. [Inicio rápido con Docker](#2-inicio-rápido-con-docker)
3. [Desarrollo local](#3-desarrollo-local)
4. [Guía de uso](#4-guía-de-uso)
5. [Arquitectura](#5-arquitectura)
6. [Decisiones técnicas](#6-decisiones-técnicas)
7. [Pruebas y cobertura](#7-pruebas-y-cobertura)
8. [Seguridad y puesta en producción](#8-seguridad-y-puesta-en-producción)
9. [Supuestos](#9-supuestos)
10. [Lo que no se hizo y cómo se implementaría](#10-lo-que-no-se-hizo-y-cómo-se-implementaría)
11. [Cómo se trabajó](#cómo-se-trabajó)
12. [Estructura del repositorio](#estructura-del-repositorio)

---

## 1. Qué entrega y su estado

Datos de un libro: título, autor, editorial, precio, disponibilidad y género (más una portada opcional). Todos los requisitos de la prueba están cubiertos; la columna *Evidencia* indica dónde se comprueba.

| Requisito de la prueba | Estado | Dónde / evidencia |
|---|---|---|
| **FE** Login de autenticación | Hecho | Pantalla `/login`; spec [`auth`](.ai/specs/auth) |
| **FE** Listado con filtros (género, editorial, autor, disponibilidad), orden por varios campos, paginación en el servidor y búsqueda en tiempo real con *debounce* | Hecho | `/books`; spec [`books-listing`](.ai/specs/books-listing) |
| **FE** Formulario de alta/edición con validación reactiva y carga de una imagen por libro | Hecho | `/books/new`, `/books/:id/edit`; specs [`books-crud`](.ai/specs/books-crud) y [`book-image-upload`](.ai/specs/book-image-upload) |
| **FE** Ver los datos de un libro | Hecho | `/books/:id` |
| **BE** Arquitectura modular y escalable (SOLID) | Hecho | [Arquitectura](#5-arquitectura), [`docs/architecture.md`](docs/architecture.md) |
| **BE** Autenticación JWT | Hecho | spec [`auth`](.ai/specs/auth) |
| **BE** Endpoints REST del CRUD | Hecho | Swagger en `/api/docs` |
| **BE** Exportación a CSV | Hecho | `GET /api/books/export`; spec [`books-export-csv`](.ai/specs/books-export-csv) |
| **BE** Soft delete | Hecho | columna `deleted_at` + extensión de Prisma |
| **BE** Logging para auditoría de operaciones | Hecho | tabla `audit_logs`; spec [`audit-log`](.ai/specs/audit-log) |
| **DB** Prisma: migraciones, esquema declarativo y cliente tipado | Hecho | [`backend/prisma/`](backend/prisma) |
| **DB** Modelo normalizado, relaciones e índices | Hecho | [`docs/erd.md`](docs/erd.md) |
| **DB** Transacciones en operaciones críticas | Hecho | Toda escritura de libros (con su auditoría) es una transacción |
| **Tests** Unitarios en frontend y backend, cobertura ≥ 80 % | Hecho (100 %) | [Pruebas](#7-pruebas-y-cobertura) |
| **Docker** `docker-compose.yml` del stack completo | Hecho | [Inicio rápido](#2-inicio-rápido-con-docker) |
| **Docs** README, Swagger, diagrama de arquitectura, modelo relacional | Hecho | Este archivo, `/api/docs`, [`docs/`](docs) |
| **Adicional** Manejo de errores en frontend y backend, interceptores de NestJS | Hecho | Filtro global de errores y `TransformInterceptor`; interceptor de Axios |
| **General** Supuestos, preparación para producción y lo no completado | Hecho | Secciones [8](#8-seguridad-y-puesta-en-producción), [9](#9-supuestos) y [10](#10-lo-que-no-se-hizo-y-cómo-se-implementaría) |

La trazabilidad completa (cada requisito → su spec) está en [`.ai/steering/enunciado.md`](.ai/steering/enunciado.md).

---

## 2. Inicio rápido con Docker

**Prerrequisitos:** Git, Docker con Compose v2 (probado con Docker 29). No hace falta Node.js.

```bash
git clone https://github.com/Nicolas-Espinoza-Reyes-1991/cmpc.git
cd cmpc
cp .env.example .env
```

Edita `.env` y reemplaza **todos** los valores `change-me`:

| Variable | Qué poner |
|---|---|
| `POSTGRES_PASSWORD` | Contraseña de PostgreSQL (si lleva `@ : / ? #`, codifícala como URL) |
| `JWT_SECRET` | Al menos 32 caracteres aleatorios (p. ej. `openssl rand -base64 48`); el backend no arranca en producción con uno más corto |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | El usuario administrador inicial (la contraseña, de 8 caracteres o más) |
| `SEED_ON_START` | `true` la primera vez para crear ese usuario; `false` después |

Levanta todo:

```bash
docker compose up --build
```

Cuando los tres servicios estén *healthy*:

| Qué | Dirección |
|---|---|
| Aplicación | <http://localhost:8080> |
| Documentación de la API (Swagger) | <http://localhost:8080/api/docs> |
| Estado de la API | <http://localhost:8080/api/health> |

Inicia sesión con el `ADMIN_EMAIL` y `ADMIN_PASSWORD` que pusiste. Al arrancar, el backend aplica las migraciones y (con `SEED_ON_START=true`) crea el administrador sin sobrescribirlo.

Otros comandos útiles:

```bash
docker compose down        # detiene (los datos y las imágenes se conservan en volúmenes)
docker compose down -v     # detiene y BORRA la base de datos y las imágenes
docker compose --profile tools up   # añade pgAdmin en http://localhost:5050
```

---

## 3. Desarrollo local

**Prerrequisitos:** Node.js 22 y Docker (solo para la base de datos).

```bash
cp .env.example .env        # y reemplaza los change-me, como arriba
docker compose up -d db     # PostgreSQL en localhost:5442

# Backend (http://localhost:3000)
cd backend
npm ci
npm run prisma:migrate      # aplica las migraciones y genera el cliente
npm run seed                # crea el administrador de .env
npm run start:dev

# Frontend (http://localhost:5173, en otra terminal)
cd frontend
npm ci
npm run dev                 # Vite reenvía /api al backend
```

El backend, el seed y los *scripts* `prisma:*` leen el `.env` de la raíz (o `backend/.env`); `DATABASE_URL` de `.env.example` ya apunta a la base del paso anterior. Si cambiaste `POSTGRES_PASSWORD`, pon la misma contraseña en `DATABASE_URL`.

| Comando | Backend (`backend/`) | Frontend (`frontend/`) |
|---|---|---|
| Pruebas | `npm run test` | `npm run test` |
| Pruebas con cobertura | `npm run test:cov` | `npm run test:cov` |
| Pruebas e2e | `npm run test:e2e` | — |
| Lint | `npm run lint` | `npm run lint` |
| Build | `npm run build` | `npm run build` |
| Migraciones | `npm run prisma:migrate` (desarrollo) / `npm run prisma:deploy` (producción) | — |

---

## 4. Guía de uso

### En la aplicación
1. **Iniciar sesión** en `/login`. Tras 5 intentos fallidos en un minuto desde la misma IP, el servidor responde «Demasiados intentos».
2. **Listado** (`/books`): la búsqueda por título responde mientras escribes (con una pausa de 300 ms) y se combina con los filtros de **autor**, **editorial**, **género** y **disponibilidad**. Pulsa el encabezado de una columna para ordenar; un segundo clic invierte el sentido y un tercero lo quita. Puedes combinar hasta cuatro columnas (el orden de los clics es el de prioridad). La paginación y el tamaño de página (10, 20 o 50) los resuelve el servidor. **Todo el estado vive en la URL**: recargar, volver atrás o compartir el enlace conserva la vista.
3. **Nuevo libro** (`/books/new`): título, autor, editorial, género, precio y disponibilidad. Autor, editorial y género se escriben (con sugerencias): si no existen, se crean. La **portada** es opcional (JPG, PNG o WebP de hasta 2 MB; el tipo se decide por el contenido del archivo, no por su nombre).
4. **Detalle** (`/books/:id`): todos los datos y la portada, con acciones para editar y eliminar (con confirmación).
5. **Editar**: cambia solo lo que quieras; la portada se puede reemplazar o quitar.
6. **Exportar Excel** y **Exportar CSV**: los botones del listado descargan **todos** los libros que cumplen los filtros y el orden actuales (no solo la página visible).
   - **Excel (`.xlsx`)**: una hoja «Libros» con **cada campo en su columna** (ID, título, autor, editorial, género, precio, disponible y fechas), encabezado en negrita y fijo, precio como número y fechas reales; funciona igual en Excel en cualquier idioma. Admite hasta **20.000 libros**; si hay más, avisa que apliques filtros o uses el CSV.
   - **CSV**: sin tope y en flujo, para otras herramientas. Usa coma como separador: un Excel con la configuración regional en español puede mostrarlo todo en una columna (use «Datos → Desde texto/CSV» o el botón de Excel). Si el valor de una celda empezara como una fórmula (`=`, `+`, `-`, `@`), se escapa para que la hoja de cálculo no la ejecute.

### Con la API
Referencia completa e interactiva en <http://localhost:8080/api/docs> (botón **Authorize**: pega el `accessToken` del login). Los ejemplos son de bash (en Windows, Git Bash o WSL; si un acento sale mal, es la codificación de la consola, no la API).

```bash
BASE=http://localhost:8080/api

# 1. Token
TOKEN=$(curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@cmpc.local","password":"TU_CONTRASEÑA"}' | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')

# 2. Crear un libro (autor, editorial y género se crean si no existen)
curl -s -X POST $BASE/books -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Dune","author":"Frank Herbert","publisher":"Ace","genre":"Ciencia ficción","price":9990.5,"availability":true}'

# 3. Listar: filtros, orden y paginación en el servidor
curl -s "$BASE/books?search=dune&availability=true&sort=price:desc,title:asc&page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# 4. Exportar a CSV con los mismos filtros (sin page ni limit)
curl -s "$BASE/books/export?genre=ciencia" -H "Authorization: Bearer $TOKEN" -o libros.csv
```

Convenciones de la API: prefijo `/api`; las respuestas correctas van en `{ "data": ..., "meta": ... }`; los errores tienen un único formato `{ statusCode, message, errors?, path, timestamp }`.

---

## 5. Arquitectura

```
Navegador ──► nginx (frontend, :8080) ──► API NestJS (/api) ──Prisma──► PostgreSQL 16
                  │                              └──► volumen de imágenes (/api/uploads)
                  └──► archivos estáticos de React
```

Los diagramas detallados (despliegue, módulos, una escritura con su transacción y auditoría, el flujo del CSV y el frontend) están en **[`docs/architecture.md`](docs/architecture.md)**. El modelo de datos, en **[`docs/erd.md`](docs/erd.md)** ([imagen](docs/erd.svg) y [DBML](docs/erd.dbml)).

**Backend** (`backend/src`): módulos `AuthModule` (login, JWT, guard global), `BooksModule` (CRUD, listado, portada, CSV), `CatalogModule` (autores, editoriales y géneros, de solo lectura), `AuditModule` (único escritor de la auditoría), `UsersModule`, `HealthModule` y `PrismaModule`, más `common/` (filtro de errores, interceptor de respuesta, decoradores, middleware de log).

**Principios aplicados** (SOLID):
- *S:* cada servicio tiene una responsabilidad; `BooksService` no escribe en la auditoría, llama a `AuditService`.
- *O:* los filtros y el orden del listado se construyen con funciones puras (`buildBookWhere`, `buildBookOrderBy`) que se extienden sin tocar el resto; el CSV las reutiliza, por lo que tabla y archivo no pueden divergir.
- *I:* un DTO por caso de uso (`CreateBookDto`, `UpdateBookDto`, `ListBooksQueryDto`…).
- *D:* los servicios reciben `PrismaService`, `AuditService` e `ImageStorage` por inyección, así que las pruebas los sustituyen.
- Un controlador solo conoce su servicio y nunca usa Prisma. No hay capa de repositorios sobre Prisma: Prisma ya es la capa de acceso a datos.

**Frontend** (`frontend/src`): `pages/` (pantallas enrutadas), `components/` (UI sin lógica de negocio), `hooks/` (`useBooks`, `useBookListParams`, `useExportBooks`, `useDebounce`…), `services/` (una por recurso, sobre Axios) y `lib/` (cliente HTTP, esquemas Zod, utilidades).

---

## 6. Decisiones técnicas

El detalle y las alternativas descartadas están en el `design.md` de cada spec; estas son las principales.

| Decisión | Motivo |
|---|---|
| **Prisma 6** (no 7) con migraciones versionadas | Esquema declarativo y cliente tipado; la 6.x estable mantiene el cliente directo que usa este diseño. Lo que Prisma no expresa (índice GIN `pg_trgm`, índice único parcial) va en una migración SQL manual |
| **Auditoría en la misma transacción** que la operación | Sin registro no hay operación y viceversa. Detalle: el estado previo se lee con `SELECT … FOR UPDATE`; sin ese bloqueo, ediciones simultáneas del mismo libro dejaban un historial inconsistente (lo encontró la verificación contra PostgreSQL real) |
| **Soft delete mediante una extensión del cliente Prisma** | Añade `deleted_at IS NULL` a toda lectura de libros; una prueba de arquitectura falla si algún servicio lee libros sin pasar por ella |
| **Catálogos por nombre** (`connectOrCreate`/`upsert` dentro de la transacción) | El formulario es simple y no exige administrar catálogos aparte; el `upsert` evita la carrera de dos peticiones que crean el mismo autor |
| **Excel (`.xlsx`) con `write-excel-file`**, hasta 20.000 libros | Al abrir el CSV en un Excel en español todo caía en una sola celda (el separador de lista es `;`). El `.xlsx` no depende de la configuración regional. La librería arma el libro en memoria (1 dependencia, 0 hallazgos de `npm audit`); por eso el tope de 20.000 filas, comprobado antes y durante la lectura, y el CSV queda para volúmenes grandes. Los textos se guardan como texto: un título `=…` no se ejecuta como fórmula |
| **CSV en flujo** (generador asíncrono, lotes de 500 con cursor, `fast-csv`, contrapresión) | Memoria acotada: con 305.000 libros el pico fue +24 MB; primer byte en ~250 ms. El cursor evita el coste cuadrático del `OFFSET` |
| **Imagen decidida por su contenido** (bytes mágicos), nombre `<uuid>.<ext>` generado por el servidor, límite de 2 MB | No se confía en el nombre ni en el tipo que declara el cliente; sin rutas controladas por el usuario |
| **JWT de 1 h** con `passport-jwt`, contraseñas con **argon2** y el mismo coste de respuesta para correo desconocido y contraseña incorrecta | No revela qué correos existen; límite de intentos en el login |
| **Estado del listado en la URL** (no en estado local) | Recargar, volver atrás y compartir enlaces conservan la vista; la caché de TanStack Query conserva la página anterior mientras llega la nueva |
| **Vitest en el frontend** (no Jest) y **Tailwind** sin librería de componentes | Un único *runner* y código propio y pequeño |
| **nginx como único punto de entrada** | Mismo origen (sin CORS en producción), cabeceras de seguridad y caché de estáticos, y el backend solo se publica en `127.0.0.1` |
| **Spec-Driven Development** | Cada decisión queda escrita antes de programar y verificada después; ver [Cómo se trabajó](#cómo-se-trabajó) |

---

## 7. Pruebas y cobertura

```bash
cd backend  && npm run test:cov && npm run test:e2e
cd frontend && npm run test:cov
```

| | Pruebas | Cobertura (sentencias / ramas / funciones / líneas) | Umbral |
|---|---|---|---|
| Backend (Jest) | 873 en 52 suites + 15 e2e | 100 % / 100 % / 100 % / 100 % | 80 % (falla si se baja) |
| Frontend (Vitest + Testing Library) | 665 en 42 archivos | 100 % / 100 % / 100 % / 100 % | 80 % (falla si se baja) |

- Las pruebas unitarias usan *mocks* de Prisma y de Axios: ninguna toca la base de datos real. Las HTTP levantan Nest con el guard JWT, la validación, el filtro y los interceptores reales.
- Una prueba e2e recorre el documento OpenAPI y exige **401** en cada ruta protegida y resumen, respuesta y seguridad documentados en cada operación.
- Más allá de las pruebas automáticas, **cada spec se verificó contra el sistema real** (PostgreSQL, Docker y navegador) y los hallazgos quedaron registrados en su `tasks.md`: p. ej. una carrera al crear catálogos, la inconsistencia del historial de auditoría con ediciones simultáneas, el CSV vacío sin BOM, el límite de 15 s del cliente HTTP frente a exportaciones largas.

---

## 8. Seguridad y puesta en producción

**Qué está resuelto**
- Autenticación JWT en todas las rutas salvo `/api/health` y el login (protección por defecto, comprobada por una prueba e2e); contraseñas con argon2; límite de intentos del login.
- Validación de toda entrada con `whitelist` y `forbidNonWhitelisted`; errores con formato único y sin detalles internos; el frontend nunca muestra trazas.
- `helmet`, CORS restringido por variable, límite de tamaño de cuerpo, `trust proxy` de un solo salto (la IP del auditoría y del límite de intentos no se falsifica), cierre ordenado (`enableShutdownHooks`).
- Subida de imágenes validada por contenido y servida con `nosniff`; CSV protegido contra inyección de fórmulas.
- Contenedores multi-etapa, sin dependencias de desarrollo y con usuario sin privilegios; versiones de imagen fijadas (sin `latest`); *healthchecks* en los tres servicios.
- Sin secretos en el repositorio: `.env` está ignorado y `.env.example` documenta cada variable. El seed crea el administrador solo si no existe y nunca lo sobrescribe.
- `npm audit --omit=dev`: **0 hallazgos** en ambas aplicaciones. Dos dependencias transitivas (`js-yaml` de Swagger y `deepmerge-ts` de la CLI de Prisma) se fijaron con `overrides` a versiones corregidas de la misma línea (evaluación en [`docs-delivery`](.ai/specs/docs-delivery/design.md)); se retirarán al actualizar Prisma y Swagger de versión mayor.

**Qué debes configurar al desplegar**
1. Contraseñas y `JWT_SECRET` reales y únicos; `SEED_ON_START=false` tras crear el administrador.
2. **HTTPS** delante del `frontend` (balanceador, Caddy o Traefik): la aplicación habla HTTP. Si hay un proxy adicional, ajusta `trust proxy` (hoy confía en exactamente un salto).
3. `CORS_ORIGIN` con el origen público real (detrás de nginx no hace falta).
4. **Copias de seguridad** del volumen `pgdata` (p. ej. `pg_dump` programado) y del volumen `uploads`.
5. No publicar los puertos de `db` ni `backend` (por defecto solo escuchan en `127.0.0.1`).

---

## 9. Supuestos

Con su fundamento; si alguno no se cumple, la sección siguiente indica el cambio.

| Supuesto | Fundamento |
|---|---|
| Un único usuario administrador, creado por *seed*, basta para operar la tienda; no hay registro público ni roles | La prueba pide login, no gestión de usuarios; un seed reproducible es más seguro que un registro abierto |
| Cada libro tiene **un solo autor** | Es lo que pide el enunciado («autor»); el modelo N:M añade una tabla y una pantalla de selección múltiple sin aportar a lo evaluado |
| La **disponibilidad** es sí/no, no una cantidad de stock | El enunciado habla de «disponibilidad»; el control de unidades y ventas es otro dominio |
| Autores, editoriales y géneros **se crean al registrar un libro** y se consultan por endpoints de solo lectura; no hay pantalla de administración de catálogos | Evita una pantalla extra y mantiene el flujo de alta en un solo formulario |
| Un libro se identifica por **título + autor + editorial** entre los activos (sin distinguir mayúsculas) | Evita duplicados accidentales; un libro eliminado se puede volver a registrar |
| Las imágenes se guardan en un **volumen local de Docker** | Suficiente para una tienda; el almacenamiento en la nube se ve en la sección siguiente |
| El precio es un importe único en una moneda, con dos decimales | El enunciado no menciona monedas ni impuestos |
| El volumen esperado es de miles de libros; aun así el listado y la exportación están pensados para cientos de miles | Índices, paginación en el servidor y CSV en flujo |
| La zona horaria del servidor es UTC y las fechas se muestran en la del navegador | Determinismo entre entornos |
| El frontend y la API se sirven desde el mismo origen (nginx) | Sin CORS y con cabeceras de seguridad estrictas |
| El «análisis de datos» que menciona el objetivo del enunciado se cubre con la **exportación a Excel y a CSV** con los filtros activos | El enunciado no detalla ninguna funcionalidad de análisis (ni tablero ni gráficos) y la única de datos que lista es la exportación; el CSV permite analizarlos en una hoja de cálculo |
| Los textos de la interfaz están en **español** y los identificadores, mensajes de commit y respuestas de la API en **inglés** | El usuario final habla español; el código sigue la convención habitual |

---

## 10. Lo que no se hizo y cómo se implementaría

Nada del enunciado quedó sin hacer; esto es lo que se dejó **fuera de alcance a propósito** o se identificó como mejora, con el enfoque propuesto.

| Pendiente | Cómo se implementaría | Esfuerzo |
|---|---|---|
| **Roles (RBAC) y registro de usuarios** | Enumeración `role` en `User`; claim en el JWT; decorador `@Roles()` y `RolesGuard` global; pantalla de administración de usuarios. Es el requisito previo de varias filas siguientes | Medio |
| **Consultar la auditoría** | `GET /api/audit` paginado y filtrable por entidad, usuario y fechas, solo para administradores (RBAC); pantalla de solo lectura. Los índices necesarios ya existen | Bajo (tras RBAC) |
| **Auditoría inmodificable** | Rol de base de datos de la aplicación con solo `INSERT`/`SELECT` sobre `audit_logs`, o un *trigger* que rechace `UPDATE`/`DELETE`; partición mensual y política de retención/anonimización de IP | Bajo |
| **Stock por unidades y ventas** | Tablas `stock` y `stock_movements` (libro, cantidad, motivo, usuario) con transacción y bloqueo de fila, como la de la auditoría; `availability` pasaría a derivarse de `stock > 0` | Alto |
| **Imágenes en la nube (S3/MinIO)** | `ImageStorage` ya aísla `save/remove/urlFor/nameFromUrl`: se añade una implementación `S3ImageStorage` seleccionada por variable de entorno, URLs de CDN y un *script* que migre los archivos del volumen | Medio |
| **Varios autores por libro (N:M)** | Tabla `book_authors`, migración de datos desde `author_id`, y selector múltiple en el formulario; el filtro y el CSV se adaptan en `buildBookWhere` y `toCsvRow` | Medio |
| **Exportaciones enormes** (millones de libros) | Hoy una exportación de 305.000 libros tarda de 1 a 5 min en flujo. Pasar a un trabajo en segundo plano (cola con BullMQ/Redis o una tabla de trabajos), archivo en almacenamiento y descarga posterior con aviso | Medio |
| **Excel de más de 20.000 libros y más opciones** | Escritura del `.xlsx` en flujo (librería con *streaming*) o generación en segundo plano, como las exportaciones enormes; selector de separador (`;`) para el CSV; columnas configurables | Bajo a medio |
| **Sesión más robusta** | *Refresh tokens* rotatorios con revocación, o cookie `httpOnly` en lugar de `localStorage`; cierre de sesión que invalide el token | Medio |
| **Internacionalización** | `react-i18next`, extraer los textos de la interfaz a catálogos por idioma | Medio |
| **Integración continua** | Flujo de GitHub Actions: `lint`, pruebas con cobertura, `build`, `npm audit` y construcción de imágenes en cada PR, y bloquear la fusión si falla | Bajo |
| **Pruebas automáticas contra PostgreSQL real y de navegador** | Pruebas de integración con Testcontainers (hoy la verificación contra la base real fue manual y está registrada) y Playwright para los flujos completos | Medio |
| **Observabilidad** | Identificador de petición, logs JSON con `pino`, métricas Prometheus y trazas OpenTelemetry | Medio |
| **Tablero de totales y gráficos** | Endpoints de agregación (`GET /api/stats`: totales, libros por género y editorial, precio medio) con `groupBy` de Prisma, resueltos en el servidor y con índices existentes; una pantalla con tarjetas y gráficos (p. ej. con una librería de gráficos ligera). Encaja tras los roles, porque expone datos del negocio | Medio |
| **Rendimiento del frontend** | El paquete pesa ~570 kB: cargar las rutas con `React.lazy` y dividir el código | Bajo |
| **Actualizaciones mayores** | Prisma 7 (adaptadores y `prisma.config.ts`), ESLint 10 y Nest 12 (ESM); al hacerlo se retiran los `overrides` | Medio |

---

## Cómo se trabajó

- **Spec-Driven Development.** Antes de programar una funcionalidad se escribe su especificación; después se implementa tarea por tarea y una tarea solo se marca hecha cuando su prueba pasa. Las specs, en orden: [`platform`](.ai/specs/platform), [`auth`](.ai/specs/auth), [`books-crud`](.ai/specs/books-crud), [`books-listing`](.ai/specs/books-listing), [`book-image-upload`](.ai/specs/book-image-upload), [`books-export-csv`](.ai/specs/books-export-csv), [`audit-log`](.ai/specs/audit-log) y [`docs-delivery`](.ai/specs/docs-delivery). El contexto del proyecto vive en [`.ai/steering/`](.ai/steering) y las reglas de trabajo en [`CLAUDE.md`](CLAUDE.md).
- **Ramas y *pull requests*.** `main` solo recibe cambios mediante PR (protegida); cada spec vive en su rama `feat/<spec>`, con **un commit convencional por tarea**, y el PR resume lo hecho, la evidencia y los hallazgos. Como las specs se apoyan unas en otras, sus ramas se fueron fusionando en orden (`platform` → `auth` → `books-crud` → … → `docs-delivery`) y `main` conserva un commit de fusión por PR.
- **Verificación real.** Además de las pruebas, cada spec termina con un registro de verificación contra el sistema real (base de datos, Docker y navegador) en su `tasks.md`.

## Estructura del repositorio

```
.ai/
├── steering/        # Contexto del proyecto: enunciado y trazabilidad, producto, stack, arquitectura, convenciones
└── specs/           # Una carpeta por funcionalidad: requirements.md, design.md, tasks.md
backend/             # NestJS + Prisma
├── prisma/          # schema.prisma y migraciones (incluidas las SQL manuales)
├── src/             # auth, books, catalog, audit, users, health, prisma, common, config, seed
└── test/            # Pruebas e2e
frontend/            # React + Vite (servido por nginx en Docker)
├── nginx/           # Plantilla de nginx: SPA, proxy /api y cabeceras
└── src/             # pages, components, hooks, services, lib, types
docs/                # Arquitectura (Mermaid) y modelo relacional (DBML, SVG, Mermaid)
docker-compose.yml   # db, backend, frontend y pgAdmin (opcional)
.env.example         # Todas las variables, documentadas
CLAUDE.md            # Reglas de trabajo del proyecto
```
