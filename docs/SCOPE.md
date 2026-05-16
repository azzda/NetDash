# NetDash — Project Scope Map

> **Purpose:** Single source of truth for project scope, status, and assumptions.  
> Renders visually on GitHub and in VS Code (Mermaid extension).  
> Update this file as scope evolves.

---

## Mindmap

```mermaid
mindmap
  root((NetDash))
    **Frontend**
      Topology Canvas
        DAG layout ✅
        Three traffic modes ✅
        Selection focus sync ✅
        Scroll-driven compaction ✅
        ::icon(fa fa-check-circle)
      Inspectors
        Node details panel ✅
        Edge overview strip ✅
        Connection details panel 🔸 dead code
        Observability pane ✅
      Drawers
        Settings ✅
        Usage/Pricing ✅
        App Info ✅
      Inventory Workspace ✅
      Themes
        Dark ✅
        Light ✅
        Custom palette ✅
      State Management
        Zustand store ✅
        Sequence deduplication ✅
        Immutable updates ✅
    **Backend**
      Express HTTP ✅
      WebSocket server ✅
      Mock data ✅
      Seeded graph 11n/10e ✅
      Graceful shutdown ❌
      Production entrypoint ❌
    **Shared**
      TypeScript models ✅
      Zod schemas ✅
      Protocol version ✅
      Feature flags 🔸 unused
      Env validation ✅
    **Testing**
      Vitest harness ✅
      Schema tests 17 ✅
      Store tests 17 ✅
      Graph tests 12 ✅
      CI pipeline ❌
      Pre-commit hooks ❌
      E2E tests ❌
    **DevOps**
      pnpm workspaces ✅
      ESLint + Prettier ✅
      Docsify docs ✅
      GitHub Actions ❌
      Docker ❌
      Deployment ❌
    **Planned / Unstarted**
      Real data sources
      Auth / RBAC
      ntopng integration
      Multi-user sync
      Bulk edit in inventory
      Error boundaries
```

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Done and working |
| 🔸 | Exists but has issues (dead code, unused, incomplete) |
| ❌ | Not started |

---

## Key Assumptions

| # | Assumption | Confidence |
|---|---|---|
| 1 | The app targets a single homelab operator (no multi-tenancy yet) | High |
| 2 | All data is mock — no real device polling or agent integration exists | High |
| 3 | WebSocket is the only data transport (no REST API for graph data) | High |
| 4 | The topology is static (backend defines it); frontend cannot mutate | High |
| 5 | Node count stays small (<50) — no virtualization or clustering needed yet | Medium |
| 6 | The project will eventually connect to real sources (ntopng, Unifi, Proxmox) | Medium |
| 7 | Feature flags exist to gate future features but nothing consumes them yet | High |
| 8 | No auth is needed during prototype phase | High |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-xx | Zustand over Redux | Simpler API, less boilerplate for this scale |
| 2025-xx | Zod for runtime validation | Shared schemas between FE/BE, discriminated unions |
| 2025-xx | ReactFlow for canvas | Mature, handles pan/zoom/edges, custom nodes |
| 2025-xx | Dagre for layout | Deterministic LR DAG, no manual positioning |
| 2025-xx | pnpm workspaces | Fast, strict, good monorepo support |
| 2026-05-16 | Vitest for testing | Fast ESM-native runner, workspace-level config |

---

## Next Priorities (suggested)

1. Wire tests into CI (GitHub Actions) or pre-commit (husky)
2. Add React error boundary around canvas + observability
3. Memoize DAG layout for performance
4. Remove or wire up `ConnectionDetailsPanel` (currently dead)
5. Add graceful shutdown + production `start` script to backend
6. Decide: real data source integration path (polling vs agent vs plugin)

---

*Last updated: 2026-05-16*
