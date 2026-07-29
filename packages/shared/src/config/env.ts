import { z } from "zod";

export const frontendEnvSchema = z.object({
  /**
   * Optional absolute override (e.g. `ws://10.0.30.200:4000/ws`).
   * When unset the client derives a same-origin URL from `window.location`
   * plus `VITE_NETDASH_WS_PATH` — which is what production (single Ingress
   * host) and dev (Vite proxy) both rely on.
   */
  VITE_NETDASH_WS_URL: z.string().url().optional(),
  VITE_NETDASH_WS_PATH: z.string().startsWith("/").default("/ws"),
});

export const backendEnvSchema = z.object({
  NETDASH_HTTP_PORT: z.coerce.number().int().positive().default(4000),
  /** WebSocket endpoint served on the SAME port/origin as the HTTP server. */
  NETDASH_WS_PATH: z.string().startsWith("/").default("/ws"),
  /** Legacy standalone WebSocket listener. `0` (default) disables it. */
  NETDASH_WS_PORT: z.coerce.number().int().nonnegative().default(0),
  /** `*` or a comma-separated origin allowlist. Applies to CORS *and* WS upgrades. */
  NETDASH_ALLOWED_ORIGIN: z.string().default("http://localhost:5173"),

  /** Where the topology comes from. `mock` keeps a fresh checkout dependency-free. */
  NETDASH_SOURCE: z.enum(["mock", "netbox"]).default("mock"),
  /** How often a real source is re-read, in milliseconds. */
  NETDASH_REFRESH_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),

  NETBOX_URL: z.string().url().optional(),
  /** NetBox 4.6 v2 token, i.e. `nbt_<key>.<secret>`. */
  NETBOX_TOKEN: z.string().optional(),
  /** Optional NetBox site slug to restrict the topology to. */
  NETBOX_SITE: z.string().optional(),

  /**
   * `disabled` (default) treats every caller as an anonymous admin, which is
   * only ever appropriate on a laptop. Any deployment reachable by anyone else
   * must set `oidc`.
   */
  NETDASH_AUTH: z.enum(["disabled", "oidc"]).default("disabled"),
  /** Keycloak realm URL, e.g. https://auth.example.com/realms/homelab */
  NETDASH_OIDC_ISSUER: z.string().url().optional(),
  NETDASH_OIDC_CLIENT_ID: z.string().optional(),
  NETDASH_OIDC_CLIENT_SECRET: z.string().optional(),
  /** Public base URL of this instance; the OIDC redirect URI is derived from it. */
  NETDASH_PUBLIC_URL: z.string().url().optional(),
  /** HMAC key for the session cookie. Rotating it signs everyone out. */
  NETDASH_SESSION_SECRET: z.string().min(32).optional(),
  NETDASH_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(28_800),
  /** Comma-separated groups granting admin. */
  NETDASH_ADMIN_GROUPS: z.string().optional(),
  /** Comma-separated groups granting any access at all. */
  NETDASH_ALLOWED_GROUPS: z.string().optional(),

  NETDASH_VERSION: z.string().default("dev"),
  NETDASH_COMMIT: z.string().default("unknown"),
  NETDASH_BUILD_TIME: z.string().default("unknown"),
});

export type FrontendEnv = z.infer<typeof frontendEnvSchema>;
export type BackendEnv = z.infer<typeof backendEnvSchema>;

/** Split a `NETDASH_ALLOWED_ORIGIN` value into a usable allowlist. `*` means "any". */
export function parseAllowedOrigins(value: string): string[] | "*" {
  const trimmed = value.trim();
  if (trimmed === "*" || trimmed === "") {
    return "*";
  }

  return trimmed
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
