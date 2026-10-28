# syntax=docker/dockerfile:1

# Multi-stage build (R7.5): Node compiles the app, nginx only serves static files.

# --- compile with Vite ---
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts ./
COPY public ./public
COPY src ./src
RUN npm run build

# --- serve with nginx as an unprivileged user (uid 101, port 8080) ---
FROM nginxinc/nginx-unprivileged:1.30-alpine AS runtime

ENV BACKEND_UPSTREAM=backend:3000 \
    DNS_RESOLVER=127.0.0.11

# The official entrypoint renders /etc/nginx/templates/*.template into conf.d at start.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
