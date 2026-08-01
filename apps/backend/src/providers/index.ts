import type { BackendEnv } from "@netdash/shared";
import { createMockProvider } from "./mock";
import { createNetBoxProvider } from "./netbox";
import { createLiveStateProvider } from "./prometheus";
import type { GraphProvider } from "./types";

export type { GraphProvider } from "./types";
export { createMockProvider } from "./mock";
export { createNetBoxProvider } from "./netbox";
export { createLiveStateProvider } from "./prometheus";

/**
 * Pick the topology source from configuration.
 *
 * `mock` stays the default so a fresh checkout runs with no dependencies; the
 * homelab deployment sets `NETDASH_SOURCE=netbox`.
 *
 * When `NETDASH_PROMETHEUS_URL` is set, the chosen source is wrapped so live
 * state is overlaid on the structure it provides.
 */
export function createProvider(env: BackendEnv): GraphProvider {
  const base = createBaseProvider(env);

  if (env.NETDASH_PROMETHEUS_URL) {
    return createLiveStateProvider({
      base,
      prometheusUrl: env.NETDASH_PROMETHEUS_URL,
      historyMinutes: env.NETDASH_METRICS_HISTORY_MINUTES,
    });
  }

  return base;
}

function createBaseProvider(env: BackendEnv): GraphProvider {
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
