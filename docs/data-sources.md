# Data sources

NetDash draws whatever a **provider** gives it. A provider is deliberately tiny:

```ts
interface GraphProvider {
  readonly name: string;
  readonly synthetic: boolean;
  getSnapshot(): Promise<GraphSnapshotPayload>;
}
```

Adding Prometheus, Loki or Hubble later means adding providers (or decorating
this one) — not touching the WebSocket layer or the UI.

Select one with `NETDASH_SOURCE`:

| Value | Source | Notes |
|---|---|---|
| `mock` *(default)* | deterministic seeded graph | a fresh checkout runs with no dependencies |
| `netbox` | live NetBox instance | the real lab |

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
the dashboard actively misleading. Real numbers arrive with the Prometheus
provider.

**Planned cabling stays visible.** NetBox models a cable that is designed but
not yet run. Those edges are kept and carry `status: "planned"`, and never
animate. The graph shows what exists *and* what's coming, which is most of the
point of having a source of truth.

### Status, and why `extensions` matters

NetDash's node status is only `up` or `down`, but "offline" (powered down) and
"planned" (doesn't exist yet) are very different kinds of down. The raw NetBox
facts therefore travel in `details.extensions`:

```json
{
  "source": "netbox",
  "objectType": "dcim.device",
  "objectId": 3,
  "status": "offline",
  "statusLabel": "Offline",
  "role": "Hypervisor",
  "model": "PowerEdge R640",
  "manufacturer": "Dell",
  "serial": "…",
  "site": "azzda HQ",
  "rack": "rack-01",
  "tenant": "Platform"
}
```

Surfacing that in the inspector is a UI task that hasn't been done yet — the
data is already on the wire.

### Object identity

Node and edge ids are derived from NetBox primary keys (`netbox:device:3`,
`netbox:cable:900`, `netbox:vm:7`) so they are **stable across refreshes**.
Selection therefore survives a refresh, and future per-object state can key off
them safely.
