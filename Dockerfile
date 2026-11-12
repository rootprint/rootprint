# syntax=docker/dockerfile:1.7

# ---------- Stage 1: builder ----------
FROM --platform=$BUILDPLATFORM oven/bun:1.4.4-slim AS builder
WORKDIR /app

COPY package.json bun.lock tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

# Full install (devDeps included — vite, svelte, drizzle-kit needed by build).
RUN bun install --frozen-lockfile --ignore-scripts

# Source for the two workspaces we actually build.
COPY apps/api ./apps/api
COPY apps/web ./apps/web
# The web build reads the running version's release highlights from it.
COPY CHANGELOG.md ./

# Star count shown in the sidebar, fetched by the release workflow. Declared here so
# a changed count doesn't bust the install layer above.
ARG VITE_GITHUB_STARS

# Build web first (no dependency on api dist), then api.
RUN bun --filter web build \
 && bun --filter api build

# ---------- Stage 2: runtime ----------
FROM oven/bun:1.4.4-slim AS runtime
WORKDIR /app

COPY --from=builder --chown=bun:bun /app/apps/api/dist    ./apps/api/dist
COPY --from=builder --chown=bun:bun /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=builder --chown=bun:bun /app/apps/web/build   ./apps/web/build

ENV NODE_ENV=production
ENV PORT=8282
EXPOSE 8282

USER bun
CMD ["bun", "run", "apps/api/dist/app.js"]

# ---------- All-in-one: Postgres + Quickwit + Rootprint (build with --target aio) ----------
# Keep in step with docker-compose.yml. A bump also upgrades all-in-one users' on-disk data, so
# note it in CHANGELOG.md.
FROM quickwit/quickwit:v0.9.1 AS quickwit

FROM runtime AS aio
USER root

# The postgres UID is pinned because apt assigns whatever system UID is free, and Postgres refuses
# a data dir owned by another UID after an image upgrade. Debian's package would otherwise also
# create a default cluster that nothing uses.
RUN groupadd --system --gid 999 postgres \
 && useradd --system --uid 999 --gid postgres --home-dir /var/lib/postgresql postgres \
 && mkdir -p /etc/postgresql-common/createcluster.d \
 && echo 'create_main_cluster = false' > /etc/postgresql-common/createcluster.d/aio.conf \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-17 \
 && rm -rf /var/lib/apt/lists/*

COPY --from=quickwit /usr/local/bin/quickwit /usr/local/bin/quickwit
COPY --from=quickwit /quickwit/config/quickwit.yaml /quickwit/config/quickwit.yaml
COPY docker/entrypoint.aio.sh /usr/local/bin/entrypoint.aio.sh

# QW_NODE_ID is pinned because Quickwit defaults it to the hostname, which changes per container.
ENV DATABASE_URL=postgres://rootprint@127.0.0.1:5432/postgres \
    QUICKWIT_URL=http://127.0.0.1:7280 \
    ORIGIN=http://localhost:8282 \
    QW_CONFIG=/quickwit/config/quickwit.yaml \
    QW_DATA_DIR=/data/quickwit \
    QW_LISTEN_ADDRESS=127.0.0.1 \
    QW_NODE_ID=rootprint \
    RUST_LOG=warn

HEALTHCHECK --start-period=60s CMD ["bun", "-e", "fetch('http://127.0.0.1:8282/api/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["entrypoint.aio.sh"]

# A plain `docker build .` builds the last stage, so it stays the production image.
FROM runtime
