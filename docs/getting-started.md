# Quick Start

## Prerequisites

| Tool | Minimum version |
|---|---|
| Node.js | 20 |
| pnpm | 10 |

On Arch / CachyOS:

```bash
sudo pacman -S nodejs npm
sudo npm install -g pnpm
```

## Install

```bash
# from the repo root
pnpm install
```

This installs dependencies for all three workspace packages (`apps/frontend`, `apps/backend`, `packages/shared`) in a single pass via pnpm workspaces.

## Development

Open **two terminals** from the repo root:

```bash
# Terminal 1 — backend WebSocket server
pnpm dev:backend

# Terminal 2 — frontend dev server with HMR
pnpm dev:frontend
```

The frontend defaults to `http://localhost:5173` and connects to the WebSocket server at `ws://localhost:4001`. Both addresses are configurable via environment variables — see [Configuration](configuration.md).

## Build

```bash
# Full production build for all packages
pnpm build

# Type-check only (no emit)
pnpm typecheck
```

Build output lands in `apps/frontend/dist/` (static files) and `apps/backend/dist/` (compiled JS).

## Lint & format

```bash
pnpm lint          # run ESLint across the workspace
pnpm lint:fix      # auto-fix where possible
pnpm format        # Prettier write
pnpm format:check  # Prettier check (CI-safe)
```

## Docs (local preview)

```bash
pnpm docs:serve
```

Opens the docsify documentation site at `http://localhost:3000` using `npx docsify-cli` — no install required.
