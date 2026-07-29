import type { GraphSnapshotPayload } from "@netdash/shared";

/**
 * A source of topology for NetDash.
 *
 * Everything the UI draws comes from one of these. Keeping it this narrow is
 * deliberate: adding Prometheus/Loki/Hubble later means adding providers (or
 * decorating this one), not touching the WebSocket layer or the UI.
 */
export interface GraphProvider {
  /** Shown in logs and on `/health` so it is obvious which source is live. */
  readonly name: string;

  /**
   * Whether this provider invents data. The mock ticker that randomises traffic
   * must only ever run against fabricated topology - putting made-up numbers on
   * real hardware would be worse than showing none.
   */
  readonly synthetic: boolean;

  getSnapshot(): Promise<GraphSnapshotPayload>;
}
