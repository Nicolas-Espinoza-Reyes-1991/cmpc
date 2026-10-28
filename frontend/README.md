# Frontend: CMPC Libros

React 19 + TypeScript (estricto) con Vite, Tailwind CSS y Vitest.

```bash
npm install
npm run dev        # http://localhost:5173 (proxy de /api hacia http://localhost:3000)
npm run build      # tsc -b && vite build
npm run lint       # ESLint (any prohibido) + Prettier
npm run test:cov   # Vitest con umbral de cobertura del 80%
```

El proxy apunta a `API_PROXY_TARGET` (por defecto `http://localhost:3000`).
La guía completa de instalación y uso está en el README de la raíz del repositorio.
