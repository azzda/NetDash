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
