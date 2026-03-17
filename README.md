# NetDash

Monorepo for NetDash MVP.

## Packages
- apps/frontend: React + TypeScript + Tailwind + Zustand UI
- apps/backend: Mock WebSocket backend for topology and flow updates
- packages/shared: Shared domain models, constants, and zod validation

## Quick start
1. Install deps: `pnpm install`
2. Start backend: `pnpm dev:backend`
3. Start frontend: `pnpm dev:frontend`

## Current MVP features
- React Flow canvas with DAG layout
- Three custom node components: hardware, host, service
- Node cards with name, IP, and status indicator
- Animated edge toggle (global + per-edge override)
- WebSocket-driven live status, flow metrics, and detail updates
- Node details in configurable side panel or modal

## Tooling prereqs
- Node.js 20+
- pnpm 10+

On Arch/CachyOS systems, install with:
1. `sudo pacman -S nodejs npm`
2. `sudo npm install -g pnpm`
