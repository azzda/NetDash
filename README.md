# NetDash

Homelab network topology dashboard — live graph, traffic visualization, and observability.

> Full documentation: [docs/README.md](docs/README.md) (or run `pnpm docs:serve` for the browsable site)

## Packages

- `apps/frontend` — React 18 + TypeScript + Vite + Tailwind + Zustand
- `apps/backend` — Express + WebSocket mock server
- `packages/shared` — Shared models, Zod validation schemas, constants

## Quick start

```bash
pnpm install
pnpm dev:backend   # terminal 1
pnpm dev:frontend  # terminal 2
```

Frontend: `http://localhost:5173` · Backend + WebSocket: `http://localhost:4000` (`/ws`, proxied in dev)

Container: `docker compose up --build` → `http://localhost:4000`

## Scripts

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| `pnpm dev:frontend` | Vite dev server with HMR                     |
| `pnpm dev:backend`  | tsx watch backend                            |
| `pnpm build`        | Full production build (all packages)         |
| `pnpm typecheck`    | TypeScript check only                        |
| `pnpm lint`         | ESLint across workspace                      |
| `pnpm lint:fix`     | ESLint auto-fix                              |
| `pnpm format`       | Prettier write                               |
| `pnpm format:check` | Prettier check (CI-safe)                     |
| `pnpm docs:serve`   | Browse docs locally at http://localhost:3000 |

## Current features

- React Flow canvas with automatic Dagre DAG layout (LR)
- Three node types: Hardware, Host, Service
- Three traffic modes: Off, Combined, Bidirectional
- Click-to-select nodes and connectors — mutual exclusivity enforced in Zustand store
- **Scroll-driven observability expansion** — graph compacts to a strip and the bottom workspace expands as you move down the page
- Adaptive title bar overview with integrated topology counts, current price, and average price snapshot
- Right inspector panel is node-focused; selected connector details are shown in a dedicated graphical strip below the canvas
- Bottom observability workspace: Graphs / Logs tabs, resizable horizontal graph panels (max 3), split log boxes (max 2), searchable ANSI-capable text log streams, and hover tooltips on charts
- Live-updating usage/pricing drawer with selectable currency symbol (EUR default, USD, JPY)
- App info drawer with generated build-time dependency manifest
- Settings drawer: profile, theme mode, density, traffic mode, currency, and a custom 3-token palette — all persisted to localStorage
- Animated NetDash title status badge with healthy/warning/issue visual states
- WebSocket status indicator (connected / reconnecting / disconnected) in title bar
- Ping/pong keepalive on backend (30 s interval, stale connections terminated)
- ESLint flat config + Prettier across workspace
- Single-origin HTTP + WebSocket (`/ws`) — one port, one Ingress host
- Multi-stage non-root container image, GHCR publish, kustomize test/prod overlays for Argo CD (see [docs/deployment.md](docs/deployment.md))

## Tooling prerequisites

- Node.js 20+
- pnpm 10+

On Arch / CachyOS:

```bash
sudo pacman -S nodejs npm
sudo npm install -g pnpm
```
