import type { BackendEnv } from "@netdash/shared";
import { createMockProvider } from "./mock";
import { createNetBoxProvider } from "./netbox";
import type { GraphProvider } from "./types";

export type { GraphProvider } from "./types";
export { createMockProvider } from "./mock";
export { createNetBoxProvider } from "./netbox";

/**
 * Pick the topology source from configuration.
 *
 * `mock` stays the default so a fresh checkout runs with no dependencies; the
 * homelab deployment sets `NETDASH_SOURCE=netbox`.
 */
export function createProvider(env: BackendEnv): GraphProvider {
  if (env.NETDASH_SOURCE === "netbox") {
    if (!env.NETBOX_URL || !env.NETBOX_TOKEN) {
      throw new Error(
        "NETDASH_SOURCE=netbox requires NETBOX_URL and NETBOX_TOKEN (a v2 token, nbt_<key>.<secret>)",
      );
    }
    return createNetBoxProvider({
      url: env.NETBOX_URL,
      token: env.NETBOX_TOKEN,
      site: env.NETBOX_SITE,
    });
  }

  return createMockProvider();
}
