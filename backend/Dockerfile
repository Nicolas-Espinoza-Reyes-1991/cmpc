# syntax=docker/dockerfile:1

# Multi-stage build (R7.5). Debian (not Alpine) so argon2 and the Prisma engine
# use their prebuilt glibc binaries instead of being compiled.

FROM node:22-bookworm-slim AS base
# Prisma's engines need OpenSSL, which the slim image does not ship.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# --- all dependencies + generated Prisma client, used to compile ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN ./node_modules/.bin/prisma generate

# --- compile TypeScript to dist/ ---
FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# --- production dependencies only (includes the prisma CLI used for migrations) ---
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev \
  && ./node_modules/.bin/prisma generate \
  && npm cache clean --force

# --- final image: no compiler, no test tooling, no root ---
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    UPLOAD_DIR=/app/uploads \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    CHECKPOINT_DISABLE=1

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY prisma ./prisma
COPY docker-entrypoint.sh ./

# Strip CRs in case the script was checked out with Windows line endings.
RUN sed -i 's/\r$//' docker-entrypoint.sh \
  && chmod +x docker-entrypoint.sh \
  && mkdir -p /app/uploads \
  && chown -R node:node /app

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
