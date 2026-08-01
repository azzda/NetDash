import type { GraphSnapshotPayload } from "@netdash/shared";
import type { GraphProvider } from "../types";
import { PrometheusClient } from "./client";
import { enrichSnapshot, type LiveState } from "./enrich";

export interface LiveStateProviderOptions {
  /** The provider supplying structure (NetBox). */
  base: GraphProvider;
  prometheusUrl: string;
  /** How much probe history to chart, in minutes. */
  historyMinutes?: number;
}

/**
 * Decorates a topology provider with live state from Prometheus.
 *
 * The split is the whole point: NetBox knows what exists and how it is wired,
 * Prometheus knows what is actually answering. Composing them keeps each source
 * authoritative for what it is genuinely good at, and means a Prometheus outage
 * degrades to "topology without live state" rather than to nothing.
 */
export function createLiveStateProvider(options: LiveStateProviderOptions): GraphProvider {
  const client = new PrometheusClient({ url: options.prometheusUrl });
  const historyMinutes = options.historyMinutes ?? 60;

  return {
    name: `${options.base.name}+prometheus`,
    synthetic: options.base.synthetic,

    async getSnapshot(): Promise<GraphSnapshotPayload> {
      const snapshot = await options.base.getSnapshot();

      try {
        const end = Date.now();
        const start = end - historyMinutes * 60_000;
        const [reachability, latency] = await Promise.all([
          client.query("probe_success"),
          client.queryRange("probe_duration_seconds", start, end, 60),
        ]);

        return enrichSnapshot(snapshot, { reachability, latency } satisfies LiveState, end);
      } catch (error) {
        // Monitoring is an enrichment, not a dependency. Losing Prometheus
        // costs live status; it must not cost the topology.
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[prometheus] live state unavailable, serving topology only: ${message}`);
        return snapshot;
      }
    },
  };
}

export { PrometheusClient } from "./client";
export { enrichSnapshot } from "./enrich";
