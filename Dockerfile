# ─── Stage 1: Install & Build ────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/

RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

COPY tsconfig.base.json ./
COPY packages/ packages/
COPY apps/ apps/

# Build frontend static assets
RUN pnpm --filter @netdash/frontend build

# Build backend
RUN pnpm --filter @netdash/backend build

# ─── Stage 2: Production Image ──────────────────────────────────────────────
FROM node:22-alpine AS production

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

WORKDIR /app

# Copy only what's needed at runtime
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/packages/shared/src packages/shared/src/
COPY --from=builder /app/apps/backend/package.json apps/backend/
COPY --from=builder /app/apps/backend/dist apps/backend/dist/
COPY --from=builder /app/apps/frontend/dist apps/frontend/dist/
COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/packages/shared/node_modules packages/shared/node_modules/ 
COPY --from=builder /app/apps/backend/node_modules apps/backend/node_modules/

ENV NODE_ENV=production
ENV NETDASH_HTTP_PORT=4000
ENV NETDASH_WS_PORT=4001
ENV NETDASH_ALLOWED_ORIGIN=*

EXPOSE 4000 4001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "apps/backend/dist/index.js"]
