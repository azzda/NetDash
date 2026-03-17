# Configuration

## Environment variables

### Frontend (`apps/frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_NETDASH_WS_URL` | `ws://localhost:4001` | WebSocket server URL |

Create `apps/frontend/.env.local` to override locally without committing:

```env
VITE_NETDASH_WS_URL=ws://192.168.1.10:4001
```

### Backend (`apps/backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `NETDASH_HTTP_PORT` | `4000` | HTTP port for the Express server (`/health`) |
| `NETDASH_WS_PORT` | `4001` | WebSocket server port |

Create `apps/backend/.env` to customise:

```env
NETDASH_HTTP_PORT=4000
NETDASH_WS_PORT=4001
```

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
