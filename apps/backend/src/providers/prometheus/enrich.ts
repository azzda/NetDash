import type { GraphSnapshotPayload, NetDashNode, NodeMetricSeries } from "@netdash/shared";
import type { InstantSample, RangeSeries } from "./client";

export interface LiveState {
  /** `probe_success` by target IP. */
  reachability: InstantSample[];
  /** `probe_duration_seconds` over time, by target IP. */
  latency: RangeSeries[];
}

function ipOf(node: NetDashNode): string | undefined {
  return node.data.ip || undefined;
}

/** Prometheus labels the probe target as `instance`. */
function targetOf(labels: Record<string, string>): string | undefined {
  return labels.instance || labels.target;
}

/**
 * Overlay live state from Prometheus onto the NetBox topology.
 *
 * The join is by IP: a probe's `instance` label is matched against the device's
 * primary address, which NetBox already holds. Nothing has to be named twice,
 * so the two sources cannot drift apart the way a duplicated label would.
 *
 * Pure, so the precedence rules below can be tested without a Prometheus.
 */
export function enrichSnapshot(
  snapshot: GraphSnapshotPayload,
  live: LiveState,
  now = Date.now(),
): GraphSnapshotPayload {
  const reachableByIp = new Map<string, number>();
  for (const sample of live.reachability) {
    const target = targetOf(sample.labels);
    if (target) {
      reachableByIp.set(target, sample.value);
    }
  }

  const latencyByIp = new Map<string, RangeSeries>();
  for (const series of live.latency) {
    const target = targetOf(series.labels);
    if (target) {
      latencyByIp.set(target, series);
    }
  }

  const nodes = snapshot.nodes.map((node) => {
    // An unmanaged device has no management plane to probe. Even if some probe
    // happened to match its IP, its status is a deliberate statement ("we don't
    // watch this"), so live reachability must not overwrite it.
    if (node.data.status === "unmanaged") {
      return withExtensions(node, { unmanaged: true, monitored: false });
    }

    const ip = ipOf(node);
    const probe = ip ? reachableByIp.get(ip) : undefined;

    // No probe means no evidence, NOT evidence of absence. A device nobody
    // watches keeps NetBox's intent rather than being falsely marked down.
    if (probe === undefined) {
      return withExtensions(node, { monitored: false });
    }

    const reachable = probe === 1;
    const series = ip ? latencyByIp.get(ip) : undefined;
    const metrics = series ? [latencySeries(series, node.identity.id)] : undefined;

    return {
      ...node,
      data: {
        ...node.data,
        // Reality wins over intent: NetBox says what should exist, the probe
        // says what answers.
        status: reachable ? ("up" as const) : ("down" as const),
        details: {
          ...node.data.details,
          ...(metrics ? { metrics } : {}),
          extensions: {
            ...node.data.details?.extensions,
            monitored: true,
            reachable,
            // Kept so the UI can distinguish "NetBox thought this was active
            // but it does not answer" from an orderly planned/offline device.
            netboxStatus: node.data.details?.extensions?.status,
            lastProbedAt: now,
            ...(series?.points.length
              ? { latencyMs: round(series.points[series.points.length - 1].value * 1000) }
              : {}),
          },
        },
      },
    };
  });

  return { ...snapshot, nodes, ts: now };
}

function withExtensions(node: NetDashNode, extra: Record<string, unknown>): NetDashNode {
  return {
    ...node,
    data: {
      ...node.data,
      details: {
        ...node.data.details,
        extensions: { ...node.data.details?.extensions, ...extra },
      },
    },
  };
}

function latencySeries(series: RangeSeries, nodeId: string): NodeMetricSeries {
  return {
    id: `${nodeId}:latency`,
    label: "Probe latency",
    unit: "ms",
    color: "var(--edge-activity)",
    points: series.points.map((point) => ({
      ts: point.ts,
      value: round(point.value * 1000),
    })),
  };
}

function round(value: number): number {
  return Number(value.toFixed(2));
}
