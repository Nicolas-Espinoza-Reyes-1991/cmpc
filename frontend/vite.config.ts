import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// In development Vite proxies /api to the backend, so the browser talks to a
// single origin, exactly like nginx does in Docker. CORS is not involved.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': { target: apiTarget, changeOrigin: true } },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Several tests wait for real timers (the typing pause) and render whole
    // screens; the default 5 s is too tight when the machine is busy.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      // Only bootstrap and declarative code is excluded (platform spec R8.4).
      exclude: [
        'src/main.tsx',
        'src/types/**',
        'src/test/**',
        '**/*.d.ts',
        '**/*.spec.{ts,tsx}',
      ],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
