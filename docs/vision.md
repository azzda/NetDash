# Vision & architecture

> This is the durable statement of what NetDash is for. Read it before making
> architectural decisions; update it when the direction actually changes.

## What NetDash is

**An observability interface first, a management suite second.** Both matter,
but when the two conflict, seeing clearly wins over acting quickly.

It exists to give a homelab owner — and the friends they share the lab with — a
real overview of:

- the **services** hosted, and the **hardware** they run on (two views of the
  same lab, not one crowded diagram),
- the lab's **connections to the outside** (WAN, tunnels, public hostnames),
- and its **connections to other homelabs**.

The end state is a group of friends each running their own homelab, able to see
and — where permitted — use each other's, without any of them having to trust a
central operator.

## Build vs. embed

The trap is rebuilding Grafana in React. The rule:

| Situation | Approach |
|---|---|
| A mature tool already solves it well | **Embed / deep-link** (Grafana panels, Argo CD, Proxmox consoles) |
| The tool's own UI is far bigger than the question being asked | **Build a narrow view** on its API |
| It is cross-cutting or bespoke | **Build it** (live cost counter, cross-site references, request workflows) |
| It is hosted elsewhere but has an API | **Build a view** and attach to the API |

Corollary: NetDash owns no primary data store for anything that already has a
home. **NetBox is the asset/IPAM database** — a proven, API-first system that
removes any need to invent a schema for the physical side of the lab.

## Data sources

```
NetDash ── provider interface ──┬── NetBox       inventory, IPAM, VLANs, cables, tenants  → the GRAPH
                                ├── Prometheus   node/service metrics                     → the CHARTS
                                ├── Loki         logs                                     → the LOG PANES
                                ├── Hubble       real flows between workloads             → traffic on EDGES
                                ├── Argo CD      app health / sync state
                                ├── Proxmox      hypervisor + VM capacity, power state
                                ├── TrueNAS      pools, datasets, quotas
                                ├── Keycloak     identity, groups → RBAC
                                └── Pelican      friends' game servers
```

Structure comes from NetBox; state comes from Prometheus/k8s/Hubble. A device is
drawn because NetBox says it exists, and it is green because Prometheus says it
answers. Never write live state back into NetBox.

## Topology: two views

The graph must be able to render **either** layer without forcing both at once:

- **Physical** — sites, racks, devices, interfaces, cables, VLANs. Comes almost
  entirely from NetBox and changes rarely.
- **Service** — namespaces, workloads, ingress hostnames, dependencies. Comes
  from Kubernetes/Argo/Hubble and changes constantly.

They join at the host: a service runs on a VM, which runs on a hypervisor, which
is a device with cables. Drilling from a slow Immich upload down to the NIC it
crosses is the payoff.

## Federation: per-site first, connectors second

**Every homelab runs its own standalone NetDash stack. There is no central hub.**

A NetDash instance can then be granted access to another instance's *workspace*:

1. Owner A wants to see/use lab B.
2. B's admin approves a **connector** — an explicit, revocable grant, scoped to
   an identity from A.
3. A's UI gains lab B as an additional workspace, showing exactly what B's RBAC
   allows and nothing more.
4. With a connector live, objects in B (an address, a host, a VPN endpoint, an
   interface) can be **referenced** from A when building something — provided the
   connector is active *and* the acting user has permission for that object.

Design consequences that must hold:

- **Each site stays authoritative for its own data.** A connector federates
  *queries*, never bulk-copies B's inventory into A's database.
- **Transport** is a site-to-site tunnel over the CLOUD VLAN (80), which exists
  for exactly this. Mesh technology is deliberately undecided — likely
  self-hosted and simple. Nothing in the design should assume a specific one.
- **A compromised peer must not become a compromised lab.** Default posture is
  read-only; writes are separately granted and audited.
- **Revocation is instant and unilateral.** B can cut A off without A's cooperation.

## RBAC

Backed by Keycloak groups (the same pattern as `app-cloud` / `app-git` /
`app-photos` gating in the platform).

- Permissions are **per user**, not just per site — including for sub-features
  like a status page or a service page.
- A connector can grant a remote user **extended access**: not a blanket
  read/write, but a defined slice of what that lab exposes, plus NetDash-level
  permissions on that workspace.
- Default deny, everywhere. A new account can log in and see nothing until it is
  granted something.

## Self-service

NetDash is also where friends serve themselves instead of messaging the admin:

- **Storage quotas** — see usage against the per-user cap, request more.
- **Compute** — order/schedule resources on the standby Proxmox node.
- **Requests** — a general workflow for anything a user lacks permission to do
  directly, including asking another lab (via its owner) for a connection or a
  reference to one of its objects.

Every request is an auditable record with an approver, not a chat message.

## Roadmap

| Phase | Content |
|---|---|
| **P0 ✅** | CI/CD, container, kustomize overlays, test env in-cluster |
| **P1** | Provider interface + NetBox adapter (real topology), Prometheus adapter (real status); mock behind a flag |
| **P2** | Keycloak OIDC login + RBAC + audit log — prerequisite for any exposure beyond the LAN |
| **P3** | Loki logs, Hubble flows, Argo CD health, Proxmox/TrueNAS capacity; physical/service view split |
| **P4** | Connector federation: site registry, read-only remote agent, per-site RBAC, cross-site references |
| **P5** | Self-service: quotas, compute requests, request workflow |
| **P6** | Audited write actions |

## Current status

NetDash still serves a **deterministic mock graph** — no real data source, no
authentication. It is deployed internally only (`netdash-test.lab.azzda.cloud`),
never through the public tunnel, until P2 lands.
