# syntax=docker/dockerfile:1.7

# ---------- Stage 1: builder ----------
FROM oven/bun:1.3.11-slim AS builder
WORKDIR /app

COPY package.json bun.lock tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

# Full install (devDeps included — vite, svelte, drizzle-kit needed by build).
RUN bun install --frozen-lockfile --ignore-scripts

# Source for the two workspaces we actually build.
COPY apps/api ./apps/api
COPY apps/web ./apps/web

# Build web first (no dependency on api dist), then api.
RUN bun --filter web build \
 && bun --filter api build

# ---------- Stage 2: runtime ----------
FROM oven/bun:1.3.11-slim AS runtime
WORKDIR /app

COPY --from=builder --chown=bun:bun /app/apps/api/dist    ./apps/api/dist
COPY --from=builder --chown=bun:bun /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=builder --chown=bun:bun /app/apps/web/build   ./apps/web/build

ENV NODE_ENV=production
ENV PORT=8282
EXPOSE 8282

USER bun
CMD ["bun", "run", "apps/api/dist/app.js"]
