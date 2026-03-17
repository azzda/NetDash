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

Frontend: `http://localhost:5173` · Backend WS: `ws://localhost:4001`

## Scripts

| Command | Description |
|---|---|
| `pnpm dev:frontend` | Vite dev server with HMR |
| `pnpm dev:backend` | tsx watch backend |
| `pnpm build` | Full production build (all packages) |
| `pnpm typecheck` | TypeScript check only |
| `pnpm lint` | ESLint across workspace |
| `pnpm lint:fix` | ESLint auto-fix |
| `pnpm format` | Prettier write |
| `pnpm format:check` | Prettier check (CI-safe) |
| `pnpm docs:serve` | Browse docs locally at http://localhost:3000 |

## Current features

- React Flow canvas with automatic Dagre DAG layout (LR)
- Three node types: Hardware, Host, Service
- Three traffic modes: Off, Combined, Bidirectional
- Click-to-select nodes and connectors — mutual exclusivity enforced in Zustand store
- **Scroll-driven observability expansion** — graph compacts to a strip, bottom pane expands to full-screen on scroll
- Right inspector panel: compact node identity or connector Side A / Side B comparison card
- Bottom observability pane: mini charts + searchable logs; severity filter and extended limits when expanded
- Live-updating usage/pricing drawer (simple + expanded views, 4 s updates)
- App info drawer with generated build-time dependency manifest
- Settings drawer: profile, theme, density, traffic mode — all persisted to localStorage
- WebSocket status indicator (connected / reconnecting / disconnected) in title bar
- Ping/pong keepalive on backend (30 s interval, stale connections terminated)
- ESLint flat config + Prettier across workspace

## Tooling prerequisites

- Node.js 20+
- pnpm 10+

On Arch / CachyOS:

```bash
sudo pacman -S nodejs npm
sudo npm install -g pnpm
```

