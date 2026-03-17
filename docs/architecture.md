# Architecture

## Monorepo layout

```
NetDash/
├── apps/
│   ├── frontend/          React + Vite SPA
│   └── backend/           Express + WebSocket server
├── packages/
│   └── shared/            Shared TypeScript models, Zod schemas, constants
├── docs/                  docsify documentation (this site)
└── pnpm-workspace.yaml
```

## Package responsibilities

### `@netdash/shared`

The contract layer. Nothing else imports from `frontend` or `backend` directly — all cross-cutting types and validation schemas live here.

- `src/models/graph.ts` — `NetDashNode`, `NetDashEdge`, `NetDashEdgeData`, `ConnectorEndpointDetails`, `ConnectorPolicyReference`
- `src/validation/websocketSchemas.ts` — Zod schemas for every WebSocket message type
- `src/constants.ts` — protocol version, default feature flags
- `src/env.ts` — frontend env schema (validated at startup via `frontendEnvSchema`)

### `@netdash/backend`

A minimal Express + `ws` server that seeds a deterministic mock graph and broadcasts live updates.

- `src/index.ts` — HTTP server, `/health` endpoint, attaches WebSocket server
- `src/websocket/server.ts` — WebSocket server, connection handling, ping/pong keepalive, mock update loop (1600 ms)
- `src/mock/seededGraph.ts` — deterministic LCG RNG, 11 nodes, 10 fully-enriched edges

### `@netdash/frontend`

React 18 SPA. All UI state is coordinated through two layers: the Zustand store (domain state) and local React state in `App.tsx` (UI-only state).

Key source directories:

```
src/
├── App.tsx                       Main shell — layout, drawers, scroll compaction
├── store/
│   └── useNetDashStore.ts        Zustand store — nodes, edges, selection
├── services/
│   └── wsClient.ts               WebSocket client with reconnect + status callbacks
├── components/
│   ├── graph/
│   │   ├── NetDashCanvas.tsx     React Flow canvas, DAG layout, toolbar
│   │   └── TrafficEdge.tsx       Custom edge renderer (straight / bidirectional lanes)
│   ├── nodes/
│   │   └── AssetNode.tsx         Hardware, Host, Service node cards
│   ├── details/
│   │   ├── NodeDetailsPanel.tsx        Right-side node identity inspector
│   │   ├── ConnectionDetailsPanel.tsx  Right-side connector inspector (Side A / Side B)
│   │   ├── SelectionObservabilityPane.tsx  Bottom observability wrapper
│   │   └── NodeObservabilitySection.tsx    Charts + logs widget (reused for nodes + edges)
│   ├── settings/
│   │   ├── SettingsDrawer.tsx    Right-side settings (profile, theme, density, traffic mode)
│   │   └── UsagePriceDrawer.tsx  Right-side usage/cost drawer with live SVG chart
│   └── shell/
│       └── AppInfoDrawer.tsx     Left-side app info + generated dependency manifest
└── vite-env.d.ts                 Type declarations for virtual:netdash-manifest
```

## Data flow

```
Backend (mock seeder)
  └─► WebSocket broadcast (1600ms)
        └─► wsClient.ts (validates via Zod, fires onMessage / onStatusChange)
              └─► useNetDashStore.applyMessage()
                    ├─► nodes[] / edges[] updated
                    └─► React renders NetDashCanvas + detail panels
```

### Message types

| Type | Direction | Purpose |
|---|---|---|
| `graph.snapshot` | server → client | Full graph on connection |
| `node.status.update` | server → client | Node status / IP changes |
| `flow.metric.update` | server → client | Edge traffic metrics |
| `node.details.update` | server → client | Node cert / VPN / detailed metrics |

## State ownership

| State | Owner | Why |
|---|---|---|
| `nodes`, `edges`, `selectedNodeId`, `selectedEdgeId` | Zustand store | Domain state shared across components |
| `trafficMode`, `densityPreference`, `themePreference` | App.tsx + localStorage | UI preferences, persisted |
| `graphCompact` | App.tsx | Derived from scroll position, purely UI |
| `wsStatus` | App.tsx | UI-only indicator, not needed by store consumers |
| `usageSeries` | App.tsx | Live-ticking usage data, UI-only |

## Build-time manifest

`vite.config.ts` includes a custom `netdash-manifest-plugin`. At build time it reads all four `package.json` files, resolves dependency versions, and exposes the result as the virtual module `virtual:netdash-manifest`. In dev mode it watches `package.json` files and triggers HMR on changes.

## Selection model

Selection is mutually exclusive — only a node **or** an edge can be selected at one time. `setSelectedNode()` clears `selectedEdgeId` and vice versa. `clearSelection()` clears both.

When an entity is selected:
- **Right panel** — switches between `NodeDetailsPanel` and `ConnectionDetailsPanel`
- **Bottom pane** — `SelectionObservabilityPane` renders context-aware charts and logs
- **Scroll down** — `graphCompact` activates, expanding the observability pane to full-screen mode
