# Data sources

NetDash draws whatever a **provider** gives it. A provider is deliberately tiny:

```ts
interface GraphProvider {
  readonly name: string;
  readonly synthetic: boolean;
  getSnapshot(): Promise<GraphSnapshotPayload>;
}
```

Adding Loki or Hubble later means adding providers (or decorating this one) —
not touching the WebSocket layer or the UI. The Prometheus provider below is
exactly this pattern: a **decorator** that wraps a base provider.

Select the base source with `NETDASH_SOURCE`:

| Value | Source | Notes |
|---|---|---|
| `mock` *(default)* | deterministic seeded graph | a fresh checkout runs with no dependencies |
| `netbox` | live NetBox instance | the real lab |

Then, independently, set `NETDASH_PROMETHEUS_URL` to overlay **live state** on
whatever base source is selected (see [Prometheus live-state provider](#prometheus-live-state-provider)).

## The refresh loop

The snapshot is fetched **once, centrally**, and broadcast to every connected
client on `NETDASH_REFRESH_INTERVAL_MS` (default 60 s). Ten open browsers do not
mean ten times the load on NetBox.

If a refresh fails, the **last good snapshot keeps being served** and an
`error` message goes out on the socket. A blip upstream shouldn't blank the
dashboard.

## NetBox adapter

```env
NETDASH_SOURCE=netbox
NETBOX_URL=http://netbox.netbox.svc.cluster.local
NETBOX_TOKEN=nbt_<key>.<secret>
NETBOX_SITE=azzda-hq          # optional, restricts to one site
```

> **Token format:** NetBox 4.6 replaced 40-character "v1" tokens with hashed
> **v2** tokens. Send the whole `nbt_<key>.<secret>` string — a bare
> 40-character value is rejected with `Invalid v1 token`. The token should be
> **read-only** (`write_enabled=false`); NetDash never writes.

### What it maps

| NetBox | NetDash | Notes |
|---|---|---|
| `dcim.device` | node | `hardware`, or `host` for hypervisor/workstation/storage roles |
| `virtualization.virtualmachine` | node (`host`) | linked to the device backing its cluster, so VMs aren't orphans |
| `dcim.cable` | edge | interface-to-interface only; power/console cables aren't topology |
| interface + IPs | `sideA` / `sideB` | port name, addresses, DNS names, media type |
| VLANs | `vlan` on the edge | untagged name, or a count of tagged VLANs |
| device/VM status | node `status` | see below |

### Two deliberate decisions

**No invented metrics.** The adapter emits no metrics and no logs, and the
random traffic ticker only runs for `synthetic` providers. NetBox knows
*structure*, not *state* — painting made-up load onto real hardware would make
the dashboard actively misleading. Real numbers arrive via the
[Prometheus live-state provider](#prometheus-live-state-provider), layered on top.

**Planned cabling stays visible.** NetBox models a cable that is designed but
not yet run. Those edges are kept and carry `status: "planned"`, and never
animate. The graph shows what exists *and* what's coming, which is most of the
point of having a source of truth. On the canvas, planned links render dashed
and muted with no traffic dot; `decommissioning` and `unknown` links get their
own dashed treatment, and the connector overview strip shows the lifecycle
state as a pill.

### Status, and why `extensions` matters

NetDash's node status is `up`, `down`, or `unmanaged`. "Offline" (powered down)
and "planned" (doesn't exist yet) are very different kinds of down, and an
**unmanaged** device (an unmanaged switch, a dumb PDU) has no management plane to
probe at all — it is neither up nor down, just present. A device is marked
`unmanaged` when NetBox carries the tag slug `unmanaged`; the live layer then
never contradicts it with reachability. The raw NetBox facts travel in
`details.extensions`:

```json
{
  "source": "netbox",
  "objectType": "dcim.device",
  "objectId": 3,
  "status": "offline",
  "statusLabel": "Offline",
  "unmanaged": true,
  "role": "Hypervisor",
  "model": "PowerEdge R640",
  "manufacturer": "Dell",
  "serial": "…",
  "site": "azzda HQ",
  "rack": "rack-01",
  "tenant": "Platform"
}
```

The node inspector surfaces these facts under an **Infrastructure** section:
role/model/manufacturer/serial/site/rack/tenant (and, for VMs, the cluster and
compute shape), the NetBox status label, probe latency, and a monitoring
affordance that distinguishes "not monitored" from "probe reachable/unreachable"
so a disagreement between intent and reality is legible at a glance.

### Object identity

Node and edge ids are derived from NetBox primary keys (`netbox:device:3`,
`netbox:cable:900`, `netbox:vm:7`) so they are **stable across refreshes**.
Selection therefore survives a refresh, and future per-object state can key off
them safely.

## Prometheus live-state provider

NetBox says what *should* exist; Prometheus says what's *actually reachable* right
now. The Prometheus provider is a **decorator**, not a source: it wraps the base
provider (usually `netbox`), takes its topology unchanged, and overlays live
reachability and latency onto the nodes.

```env
NETDASH_SOURCE=netbox
NETDASH_PROMETHEUS_URL=http://kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090
NETDASH_METRICS_HISTORY_MINUTES=60   # optional, range window for the latency series
```

If `NETDASH_PROMETHEUS_URL` is unset, the base provider is used as-is — the
decorator is purely additive and opt-in. The reported `source` becomes
`netbox+prometheus` when active.

### The join is by IP, never by name

Each node's status is matched to a blackbox `probe_success` series **by its
`primary_ip4`**, not its hostname. NetBox owns the address, the ICMP probe list
targets that same address, so the two can't drift on naming. (The infra repo's
`netbox-validate.py` cross-checks the probe list against `lab.yaml` in both
directions to keep them in lockstep.)

### Enrichment rules (the important part)

The overlay is a pure function; the precedence is deliberately conservative:

| Situation | Result |
|---|---|
| Node **is probed**, `probe_success=1` | status `up` — reality confirms it's reachable |
| Node **is probed**, `probe_success=0` | status `down` — reality overrides NetBox intent |
| Node **has no probe** | **left untouched** — NetBox intent is kept |

> **Absence of evidence is not evidence of absence.** A device with no probe is
> *never* marked down just because Prometheus has nothing on it — an unmonitored
> host is not a dead host. Only a *watched* device can have its NetBox intent
> contradicted, and only then does live reality win.

When live state and NetBox intent disagree, the original NetBox status is
preserved in `extensions.netboxStatus` so the UI can explain the disagreement
rather than silently pick a side.

### What lands on the node

- `extensions.monitored` — whether a probe exists for this node
- `extensions.reachable` — the live `probe_success` result (only when monitored)
- `extensions.latencyMs` — most recent probe RTT
- a **probe-latency metric series** over `NETDASH_METRICS_HISTORY_MINUTES`, so the
  inspector can graph it (a down host reads at the blackbox timeout, ~5000 ms)

### Degrades, never blanks

If Prometheus is unreachable, the decorator returns the base topology untouched
rather than failing the whole snapshot — you lose the live overlay, not the map.
Client-facing errors name their source (`"Prometheus query timed out after …"`)
with the original error attached as `cause`, so a NetBox problem and a Prometheus
problem are never confused.
