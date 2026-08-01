# Authentication & RBAC

NetDash authenticates against Keycloak with OpenID Connect and refuses anyone
without an explicit grant.

```env
NETDASH_AUTH=oidc
NETDASH_OIDC_ISSUER=https://auth.azzda.cloud/realms/homelab
NETDASH_OIDC_CLIENT_ID=netdash
NETDASH_OIDC_CLIENT_SECRET=…          # from the SOPS secret
NETDASH_PUBLIC_URL=https://netdash-test.lab.azzda.cloud
NETDASH_SESSION_SECRET=…              # 32+ chars, from the SOPS secret
NETDASH_ALLOWED_GROUPS=app-netdash    # grants viewer
NETDASH_ADMIN_GROUPS=homelab-admins   # grants admin
```

> `NETDASH_AUTH` defaults to **`disabled`**, which treats every caller as an
> anonymous admin so a fresh checkout runs with no identity provider. That is
> only ever appropriate on a laptop. The backend logs a loud warning at startup
> when it starts that way.

## The flow

```
browser → /auth/login → Keycloak (auth code + PKCE) → /auth/callback
                                                          ↓
                                          verify id_token against JWKS
                                                          ↓
                                          map groups → role (default deny)
                                                          ↓
                                          signed session cookie → /
```

**PKCE is used even though this is a confidential client.** It costs nothing and
removes the authorization-code interception class of attack entirely.

**The `id_token` signature is verified** against the issuer's published keys,
with the issuer and audience checked. Without that, the flow would accept any
token a caller invented.

## Two independent gates

| Gate | Where | What it does |
|---|---|---|
| 1 | Keycloak | the `netdash` client is bound to a `netdash-access-browser` flow that denies login to anyone without the `netdashUser` realm role |
| 2 | NetDash | maps group membership to a role and refuses if there is none |

`netdashUser` is granted by the **`app-netdash`** group, so in normal operation
they agree. They are deliberately independent: if the realm is ever mis-edited
and gate 1 stops working, gate 2 still refuses.

This was verified rather than assumed. Granting `netdashUser` *directly* to a
user who was **not** in `app-netdash` made Keycloak issue a valid authorization
code — and NetDash still returned 403.

| User | Keycloak | NetDash |
|---|---|---|
| no role, no group | ❌ `Access denied` | — |
| role granted directly, no group | ✅ code issued | ❌ 403 |
| in `app-netdash` | ✅ | ✅ `viewer` |
| in `homelab-admins` | ✅ | ✅ `admin` |

## Sessions

Stateless, **HMAC-SHA256 signed** cookies — no server-side session store, so
prod can run multiple replicas without a shared store to run and back up.

- `httpOnly`, `sameSite=lax`, and `secure` whenever the public URL is `https`
- **Signed, not encrypted.** The cookie carries only the identity the user
  already knows about themselves. Never put a secret in it.
- Rotating `NETDASH_SESSION_SECRET` invalidates every cookie — that is the
  intended way to sign everyone out at once.

## What is guarded

| Path | Guarded | Why |
|---|---|---|
| `/health`, `/healthz`, `/readyz` | ❌ | kubelet probes carry no session |
| `/auth/*` | ❌ | you cannot log in through the login gate |
| the SPA and `/api/*` | ✅ | browsers get redirected, API callers get 401 |
| **the WebSocket `/ws`** | ✅ | **it streams the whole topology** |

The WebSocket guard matters most. It carries the entire graph, so leaving the
upgrade unauthenticated would have been a hole straight past the login page.
Verified: an upgrade without a session is refused with `401`.

## Granting access

Two steps, deliberately:

1. add the user to **`app-netdash`** in Keycloak — this lets them *log in*
2. `homelab-admins` additionally makes them an **admin**

A brand-new Keycloak account can therefore authenticate and still see nothing,
which is the default-deny posture the rest of the platform uses.

## Audit

Auth decisions are logged as structured JSON so Loki can filter on them:

```json
{"level":"info","event":"auth.login","username":"azzda","role":"admin","ts":"…"}
{"level":"info","event":"auth.denied","username":"ndgate","groups":[],"ts":"…"}
{"level":"info","event":"auth.logout","username":"azzda","ts":"…"}
```

`auth.callback_rejected` covers a state mismatch, which is the CSRF signal and
is treated as hostile rather than as a glitch to retry.

## Roles today

| Role | Granted by | Can |
|---|---|---|
| `admin` | `homelab-admins` | everything NetDash currently does |
| `viewer` | `app-netdash` | everything NetDash currently does |

They are distinguished in the session and shown in the UI, but NetDash is
read-only so far, so nothing yet differs between them. The split exists now so
that write actions (P6) and the per-site federation permissions (P4) have
somewhere to attach.
