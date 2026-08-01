# Configuration

## Environment variables

### Frontend (`apps/frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_NETDASH_WS_PATH` | `/ws` | Same-origin WebSocket path |
| `VITE_NETDASH_WS_URL` | *(unset)* | Absolute override; wins over the derived same-origin URL |

By default the client derives `ws(s)://<current host>/ws`, so nothing needs
configuring: in production the backend serves the SPA and the WebSocket on one
origin, and in dev Vite proxies `/ws` to the backend. Only set an override when
pointing a local UI at a remote backend:

```env
VITE_NETDASH_WS_URL=ws://192.168.1.10:4000/ws
```

### Backend (`apps/backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `NETDASH_HTTP_PORT` | `4000` | HTTP port (SPA, `/health`, `/readyz`, WebSocket) |
| `NETDASH_WS_PATH` | `/ws` | Path the WebSocket is served on, same port as HTTP |
| `NETDASH_WS_PORT` | `0` | Legacy standalone WebSocket listener; `0` disables it |
| `NETDASH_ALLOWED_ORIGIN` | `http://localhost:5173` | `*` or a comma-separated allowlist; enforced for CORS **and** WebSocket upgrades |
| `NETDASH_SOURCE` | `mock` | Topology source: `mock` or `netbox` — see [Data Sources](data-sources.md) |
| `NETDASH_REFRESH_INTERVAL_MS` | `60000` | How often a real source is re-read |
| `NETBOX_URL` | *(unset)* | NetBox base URL (required when `NETDASH_SOURCE=netbox`) |
| `NETBOX_TOKEN` | *(unset)* | Read-only NetBox 4.6 v2 token, `nbt_<key>.<secret>` |
| `NETBOX_SITE` | *(unset)* | Optional NetBox site slug to restrict the topology to |
| `NETDASH_AUTH` | `disabled` | `disabled` or `oidc` — see [Authentication](authentication.md) |
| `NETDASH_OIDC_ISSUER` | *(unset)* | Keycloak realm URL (required when `NETDASH_AUTH=oidc`) |
| `NETDASH_OIDC_CLIENT_ID` | *(unset)* | OIDC client id |
| `NETDASH_OIDC_CLIENT_SECRET` | *(unset)* | OIDC client secret |
| `NETDASH_PUBLIC_URL` | *(unset)* | Public base URL; the redirect URI is derived from it |
| `NETDASH_SESSION_SECRET` | *(unset)* | 32+ character HMAC key for the session cookie |
| `NETDASH_SESSION_TTL_SECONDS` | `28800` | Session lifetime (8 h) |
| `NETDASH_ALLOWED_GROUPS` | `app-netdash` | Comma-separated groups granting access |
| `NETDASH_ADMIN_GROUPS` | `homelab-admins` | Comma-separated groups granting admin |
| `NETDASH_VERSION` | `dev` | Reported by `/health` (set by the Docker build) |
| `NETDASH_COMMIT` | `unknown` | Reported by `/health` (set by the Docker build) |
| `NETDASH_BUILD_TIME` | `unknown` | Reported by `/health` (set by the Docker build) |

```env
NETDASH_HTTP_PORT=4000
NETDASH_WS_PATH=/ws
NETDASH_ALLOWED_ORIGIN=https://netdash.lab.azzda.cloud
```

### Health endpoints

`/health`, `/healthz` and `/readyz` all return the same JSON — status, version,
commit, build time, uptime and the active WebSocket path. Kubernetes probes use
`/readyz` (readiness) and `/health` (liveness).

## Theme CSS variables

Defined in `apps/frontend/src/styles.css`. Dark mode is the default; light mode values are set under `[data-theme="light"]`.

| Variable | Dark default | Description |
|---|---|---|
| `--app-bg` | Radial gradient (navy → near-black) | Page background |
| `--panel-bg` | `rgba(15,23,42,0.82)` | Card / drawer background |
| `--panel-border` | `rgba(148,163,184,0.18)` | Card border |
| `--canvas-bg` | `rgba(9,14,26,0.74)` | Graph canvas background |
| `--edge-stroke` | `#7dd3fc` | Edge line colour |
| `--edge-activity` | `#38bdf8` | Traffic animation colour |
| `--text-primary` | `#e5eefc` | Main text |
| `--text-muted` | `#8ea4c9` | Secondary / dimmed text |

## User preferences (localStorage)

These keys are written and read automatically by the frontend:

| Key | Values | Description |
|---|---|---|
| `netdash:theme` | `system` \| `dark` \| `light` | Theme preference |
| `netdash:traffic-mode` | `off` \| `combined` \| `bidirectional` | Edge rendering mode |
| `netdash:density` | `compact` \| `comfortable` | UI density |
| `netdash:user-profile` | JSON object | Display name, email, userId, role |

## WebSocket protocol

All messages share this envelope:

```ts
{
  protocolVersion: string;  // must match NETDASH_PROTOCOL_VERSION constant
  type: string;
  payload: unknown;
  ts: number;               // Unix timestamp (ms)
}
```

The current version is `"1"`. Messages with a mismatched `protocolVersion` are dropped client-side with an error callback. Full Zod schemas are in `packages/shared/src/validation/websocketSchemas.ts`.
