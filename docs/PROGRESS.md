# NetDash — Feature Progress

> Living checklist of features and milestones.  
> Check items off as they ship. GitHub renders a progress bar for each section.  
> Add your own `- [ ]` items under any category.

---

## Core Topology View

- [x] DAG layout (Dagre, left-to-right)
- [x] Orthogonal (elbow) edge routing + uniform nodes + role-grouped layout (ArgoCD-style, Tier 1)
- [x] Three traffic modes (off / combined / bidirectional)
- [x] Node cards with name, IP, status badge
- [x] Three-state node status (`up` / `down` / `unmanaged`) for devices with no management plane
- [x] Selection-aware right panel
- [x] Scroll-driven compaction (graph shrinks, observability expands)
- [x] Memoize layout (recompute only when graph structure changes, not on every refresh)
- [ ] Error boundary around canvas
- [ ] Support >50 nodes (virtualization / clustering)
- [ ] Physical vs. logical edge layers + view modes (ArgoCD-style, Tier 2)

## Observability

- [x] Metric charts (multi-series, time range)
- [x] Log stream with ANSI rendering
- [x] Severity filter (expanded mode)
- [x] Resizable panels with localStorage persistence
- [ ] Real metric data from device/agent
- [ ] Alerting thresholds
- [ ] Log search / regex filter

## Connection Inspector

- [x] Edge overview strip (below canvas)
- [x] Side A / Side B endpoint columns
- [x] Policy reference tags
- [x] Connector UUID display
- [ ] Wire up full ConnectionDetailsPanel or remove dead code
- [ ] Link policies to actual firewall rules

## Settings & Preferences

- [x] Theme switching (dark / light / custom palette)
- [x] Density (compact / comfortable)
- [x] Traffic mode selector
- [x] Profile editing
- [x] localStorage persistence
- [ ] Export/import settings
- [ ] System theme auto-detect

## Inventory Workspace

- [x] Tabbed asset/connector tables
- [x] Search across fields
- [x] Detail panel with "Open in topology"
- [ ] Bulk edit actions
- [ ] Sorting / column reorder

## Data & Integration

- [x] Provider interface (pluggable data sources, mock behind `NETDASH_SOURCE`)
- [x] **NetBox adapter** — devices, VMs, interfaces, cables, VLANs, IPs (**live**: 13 nodes, 19 edges from the real lab)
- [x] **Prometheus adapter** — real up/down + probe latency, overlaid on the NetBox topology
- [ ] Loki adapter — real log panes
- [ ] Hubble adapter — real flows on edges
- [ ] Argo CD adapter — app health / sync state
- [ ] Proxmox + TrueNAS adapters — capacity, power state, pools
- [ ] Physical vs. service topology view split
- [x] Surface NetBox `extensions` (role, model, serial, site, tenant, real status) in the inspector
- [x] Render planned vs. connected links differently on the canvas
- [ ] Persistent storage (SQLite / Postgres) for NetDash's own state
- [ ] Historical data retention

## Federation & Self-service

- [ ] Site registry (per-site standalone instances)
- [ ] Connector workflow — approve/revoke access to a remote workspace
- [ ] Read-only remote agent + site-to-site transport (VLAN 80)
- [ ] Cross-site object references
- [ ] Storage quota self-service
- [ ] Compute requests against the standby Proxmox node
- [ ] General request/approval workflow

## Deployment & Ops

- [x] pnpm monorepo
- [x] Vitest test harness (53 tests)
- [x] Dockerfile (multi-stage build, non-root, build metadata)
- [x] docker-compose for homelab
- [x] GitHub Actions CI (verify → image → GitOps promote)
- [x] Image smoke test in CI (`/health`, SPA, `/ws` upgrade)
- [x] Container registry publish (GHCR)
- [x] Health check probes (`/health`, `/readyz`)
- [x] Graceful shutdown
- [x] Single-origin HTTP + WebSocket (`/ws`) — one Ingress host
- [x] Kustomize base + test/prod overlays
- [x] Argo CD Application manifests (`deploy/argocd/`)
- [x] **test environment live** — `netdash-test.lab.azzda.cloud`, internal only
- [ ] Prod environment (gated on real data + OIDC)
- [ ] Renovate/Dependabot for dependency + image bumps

## Auth & Multi-user

- [x] Keycloak OIDC login (auth code + PKCE, JWKS-verified id_token)
- [x] Per-user RBAC — `app-netdash` → viewer, `homelab-admins` → admin, default deny
- [x] Authenticated WebSocket (the upgrade is guarded, not just the pages)
- [x] Audit log (structured JSON: login / logout / denied / rejected)
- [x] Signed stateless sessions (multi-replica safe, no session store)
- [x] Account self-service — Settings links out to the IdP Account Console (profile / password / MFA) + sign out
- [ ] Differentiate what `viewer` vs `admin` may actually do (needs write actions first)
- [ ] Multi-user WebSocket sync

---

*Add items freely. Check them off when done. Last updated: 2026-08-09*
