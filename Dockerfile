# ─── Stage 1: Install & Build ────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/

RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/ packages/
COPY apps/ apps/

# Build frontend static assets
RUN pnpm --filter @netdash/frontend build

# Build backend
RUN pnpm --filter @netdash/backend build

# ─── Stage 2: Production Image ──────────────────────────────────────────────
FROM node:22-alpine AS production

ARG NETDASH_VERSION=dev
ARG NETDASH_COMMIT=unknown
ARG NETDASH_BUILD_TIME=unknown

LABEL org.opencontainers.image.title="NetDash" \
      org.opencontainers.image.source="https://github.com/azzda/NetDash" \
      org.opencontainers.image.version="${NETDASH_VERSION}" \
      org.opencontainers.image.revision="${NETDASH_COMMIT}" \
      org.opencontainers.image.created="${NETDASH_BUILD_TIME}"

WORKDIR /app

# Copy only what's needed at runtime: the bundled backend (shared code is inlined
# by esbuild), the built SPA, and the three runtime deps kept external.
COPY --from=builder /app/package.json ./
COPY --from=builder /app/apps/backend/package.json apps/backend/
COPY --from=builder /app/apps/backend/dist apps/backend/dist/
COPY --from=builder /app/apps/frontend/dist apps/frontend/dist/
COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/apps/backend/node_modules apps/backend/node_modules/

ENV NODE_ENV=production \
    NETDASH_HTTP_PORT=4000 \
    NETDASH_WS_PATH=/ws \
    NETDASH_WS_PORT=0 \
    NETDASH_ALLOWED_ORIGIN=* \
    NETDASH_VERSION=${NETDASH_VERSION} \
    NETDASH_COMMIT=${NETDASH_COMMIT} \
    NETDASH_BUILD_TIME=${NETDASH_BUILD_TIME}

# HTTP + same-origin WebSocket (/ws) are both served on this one port.
EXPOSE 4000

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "apps/backend/dist/index.js"]
