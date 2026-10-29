# Spec docs-delivery: Diseño

Implementa los requisitos de `requirements.md`. Los códigos D# remiten a ese archivo.

## 1. Decisiones (a revisar: esta spec se implementó sin la pausa de aprobación)

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| README único, largo pero con índice, en vez de varios documentos | Un README corto que remita a una carpeta de manuales | El evaluador abre el repositorio y lee el README; todo lo que se pide (instalación, uso, arquitectura, decisiones, supuestos) debe estar a un clic. El detalle técnico vive en cada `design.md`, enlazado |
| Diagramas en **Mermaid** dentro de `docs/architecture.md` | Imágenes PNG exportadas de una herramienta | GitHub los renderiza y viven como texto en Git (se revisan en un PR y no se desactualizan en silencio) |
| Modelo relacional en **DBML** + SVG + Mermaid `erDiagram` en `docs/erd.md` | Solo una imagen | El DBML es lo que pide `architecture.md` (dbdiagram.io); el SVG es la imagen exportada; el Mermaid se ve directamente en GitHub. Los tres se generan o comprueban a partir de la misma fuente real |
| El SVG del modelo se **genera con un script** a partir del DBML | Dibujarlo a mano o exportarlo de dbdiagram.io | dbdiagram.io no se puede automatizar sin cuenta; un script reproducible (`docs/tools/`) hace que la imagen se pueda regenerar cuando cambie el modelo |
| El DBML se **verifica contra la base real** con una consulta a `information_schema` | Confiar en que coincide | Una documentación del modelo que no coincide con la base es peor que ninguna |
| Una prueba (`openapi.spec`) exige resumen y respuesta de éxito en cada operación | Revisión manual | Es la forma de que Swagger no se quede atrás de los controladores |
| Hallazgos de `npm audit` restantes: se resuelven con `overrides` verificados cuando la versión corregida es compatible, y si no se evalúan y se documentan | `npm audit fix --force` (sube Prisma y Swagger de mayor) | `--force` cambia de versión mayor y rompe la decisión cerrada de `tech-stack.md`; un `override` a un parche de la misma línea es mínimo y se prueba. Ver §3 |
| El README se verifica **ejecutándolo** desde un clon limpio en una carpeta temporal | Leerlo y confiar | Es el único modo de saber que un evaluador llegará a una aplicación funcionando |

## 2. Estructura de entrega

```
README.md                  # Instalación, uso, arquitectura, decisiones, supuestos y pendientes
docs/
├── architecture.md        # Diagramas Mermaid (despliegue, módulos, escritura transaccional, CSV)
├── erd.dbml               # Modelo relacional para dbdiagram.io
├── erd.md                 # El mismo modelo en Mermaid + tabla de índices
├── erd.svg                # Imagen exportada del modelo
└── tools/
    └── dbml-to-svg.py     # Genera erd.svg desde erd.dbml
```

## 3. Hallazgos de `npm audit` (evaluación)

| Paquete | Procede de | Qué es | ¿Alcanzable desde una petición? | Decisión |
|---|---|---|---|---|
| `deepmerge-ts` < 8 (alto) | `prisma` → `@prisma/config` | Agotamiento de pila al fusionar grafos recursivos; lo usa la CLI de Prisma para fusionar su configuración | No: solo corre al ejecutar `prisma migrate`/`generate`, con archivos del propio repositorio. No está en el camino de ninguna petición | `override` de `@prisma/config` → `deepmerge-ts@8.0.2` (la API de `deepmerge` no cambió). Verificado: `prisma validate`, `migrate status`, `generate`, `migrate deploy` en Docker |
| `js-yaml` 5.0–5.4 (moderado) | `@nestjs/swagger` | `maxTotalMergeKeys` no limita la CPU con orígenes de fusión vacíos al **analizar** YAML | No: Swagger solo **escribe** YAML del documento propio y la aplicación no sirve la variante YAML; no analiza YAML recibido | `override` de `@nestjs/swagger` → `js-yaml@5.5.0` (misma línea). Verificado: Swagger UI y las pruebas de OpenAPI |

Los `overrides` se retirarán cuando Prisma y Swagger publiquen versiones con la dependencia corregida (se anota en las mejoras futuras).

## 4. Cómo se verifica

- **D1/D5:** clon limpio en una carpeta temporal → `.env` desde `.env.example` → `docker compose up --build` → login y listado por `curl` y navegador; los comandos de desarrollo local (`npm ci`, `prisma migrate dev`, `seed`, `start:dev`, `test:cov`) se ejecutan tal como están escritos; los enlaces internos se resuelven con un script.
- **D2:** `openapi.spec` (prueba automática) y revisión de `/api/docs` en el navegador (botón *Authorize*, probar `login` y una ruta protegida).
- **D3:** cada nodo del diagrama se contrasta con `app.module.ts` y los controladores (un script lista módulos y rutas reales).
- **D4:** consulta de `information_schema.columns`, `pg_indexes` y claves foráneas contra el DBML.
- **D5.4:** `npm audit --omit=dev` en ambas apps.

## 5. Mejoras futuras
- Publicar la documentación en GitHub Pages y generar el SVG del modelo en CI.
- Retirar los `overrides` al actualizar Prisma y Swagger de mayor.
- Manual de usuario con capturas.
