# NetDash

> Homelab network topology dashboard — live graph, traffic visualization, and observability in one place.

NetDash is a React + TypeScript single-page application backed by a lightweight WebSocket server. It renders your network topology as an interactive DAG, shows live traffic flows between nodes, and lets you inspect any node or connector in detail — all in a dark-mode UI designed for homelab operators.

## Highlights

- **Interactive topology graph** powered by React Flow with automatic Dagre layout
- **Three traffic modes** — Off, Combined, Bidirectional — switchable at runtime
- **Selection-aware layout** — click a node or connector to populate the right inspector and bottom observability pane
- **Scroll-driven observability expansion** — scroll down to compact the graph and reveal full-screen metrics and logs
- **Connection inspector** — side-by-side endpoint metadata with connector UUID, interface IPs, ports, DNS, and policy references
- **Live usage/pricing drawer** — estimated cost and power draw, updated every 4 s
- **App info drawer** — generated build-time dependency manifest with core status indicators
- **Settings drawer** — profile, theme, density, and traffic mode preferences persisted to localStorage

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript 5 + Vite 6 |
| Graph | React Flow 11 + Dagre |
| State | Zustand 5 |
| Validation | Zod 3 |
| Backend | Express 4 + ws 8 |
| Styling | Tailwind CSS 3 |
| Monorepo | pnpm 10 workspaces |

## Quick navigation

- [Quick Start](getting-started.md) — install, run, build
- [Features](features.md) — full feature reference
- [Architecture](architecture.md) — codebase structure and data flow
- [Configuration](configuration.md) — environment variables and ports
