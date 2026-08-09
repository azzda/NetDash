import type { IncomingMessage, Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  NETDASH_PROTOCOL_VERSION,
  parseAllowedOrigins,
  wsMessageSchema,
  type FlowMetricUpdatePayload,
  type GraphSnapshotPayload,
  type NetDashWsMessage,
  type NodeDetailsUpdatePayload,
  type NodeStatusUpdatePayload,
} from "@netdash/shared";
import type { GraphProvider } from "../providers";

interface Sequences {
  node: Record<string, number>;
  edge: Record<string, number>;
}

export interface WebSocketServerOptions {
  /** Attach to an existing HTTP server (single-origin mode - preferred). */
  server?: HttpServer;
  /** Path the WebSocket is served on when attached to an HTTP server. */
  path?: string;
  /** Standalone listener port (legacy / dev convenience). */
  port?: number;
  /** `*` or a comma-separated origin allowlist enforced on upgrade. */
  allowedOrigin?: string;
  /** Where the topology comes from. */
  provider: GraphProvider;
  /** How often the provider is re-read. */
  refreshIntervalMs?: number;
  /**
   * Authorises the upgrade. The socket streams the entire topology, so it needs
   * the same gate as the HTTP side - an unauthenticated WebSocket would be a
   * hole straight past the login page.
   */
  authorizeRequest?: (req: IncomingMessage) => unknown | null;
}

/**
 * Rejects browser upgrades from origins outside the allowlist, and any upgrade
 * without an authorised session.
 *
 * Requests without an `Origin` header are not browser-initiated; they still
 * have to pass the session check.
 */
function createUpgradeGuard(
  allowedOrigin: string | undefined,
  authorizeRequest: WebSocketServerOptions["authorizeRequest"],
) {
  const allowlist = parseAllowedOrigins(allowedOrigin ?? "*");

  if (allowlist === "*" && !authorizeRequest) {
    return undefined;
  }

  return (info: { origin: string; req: IncomingMessage }) => {
    if (allowlist !== "*" && info.origin && !allowlist.includes(info.origin)) {
      return false;
    }
    if (authorizeRequest && !authorizeRequest(info.req)) {
      return false;
    }
    return true;
  };
}

function envelope(message: NetDashWsMessage): string {
  return JSON.stringify(message);
}

export function attachWebSocketServer(options: WebSocketServerOptions): WebSocketServer {
  const { provider } = options;
  const refreshIntervalMs = options.refreshIntervalMs ?? 60_000;

  // One shared snapshot, refreshed centrally, so N browsers do not mean N times
  // the load on the upstream source.
  let snapshot: GraphSnapshotPayload = { nodes: [], edges: [], sequence: 0, ts: Date.now() };
  let lastError: string | null = null;
  let consecutiveFailures = 0;
  const sequences: Sequences = { node: {}, edge: {} };

  /**
   * How many refreshes must fail before users are told.
   *
   * Real-world data from the homelab: NetBox was restarting every few hours, so
   * roughly 0.4% of refreshes failed and every one recovered on the next tick.
   * Alerting on the first failure meant a scary banner for a dashboard whose
   * data was at most 60 seconds stale - noise that trains people to ignore
   * warnings. Only speak up once the data is genuinely going stale.
   */
  const FAILURES_BEFORE_ALERTING = 3;

  const verifyClient = createUpgradeGuard(options.allowedOrigin, options.authorizeRequest);
  const wss = options.server
    ? new WebSocketServer({ server: options.server, path: options.path ?? "/ws", verifyClient })
    : new WebSocketServer({ port: options.port, verifyClient });

  function broadcast(message: NetDashWsMessage) {
    const payload = envelope(message);
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) {
        client.send(payload);
      }
    }
  }

  async function refresh(initial = false): Promise<void> {
    try {
      const next = await provider.getSnapshot();
      next.sequence = snapshot.sequence + 1;
      // Stamp provenance so the UI can flag demo/mock data at a glance.
      next.synthetic = provider.synthetic;
      next.source = provider.name;
      snapshot = next;

      for (const node of snapshot.nodes) {
        sequences.node[node.identity.id] = snapshot.sequence;
      }
      for (const edge of snapshot.edges) {
        sequences.edge[edge.id] = snapshot.sequence;
      }

      if (lastError) {
        console.log(`[${provider.name}] recovered after ${consecutiveFailures} failed refresh(es)`);
        lastError = null;
      }
      consecutiveFailures = 0;
      if (initial) {
        console.log(
          `[${provider.name}] loaded ${snapshot.nodes.length} nodes, ${snapshot.edges.length} edges`,
        );
      } else {
        broadcast({
          protocolVersion: NETDASH_PROTOCOL_VERSION,
          type: "graph.snapshot",
          payload: snapshot,
          ts: Date.now(),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      consecutiveFailures += 1;

      // Keep serving the last good snapshot: a blip upstream should not blank
      // the dashboard.
      if (message !== lastError) {
        console.error(`[${provider.name}] refresh failed (${consecutiveFailures}): ${message}`);
        lastError = message;
      }

      // Stay quiet through a transient blip, but only while there is still a
      // good snapshot on screen. If the first load never succeeded there is
      // nothing to look at, so say so immediately rather than leaving an
      // unexplained empty graph.
      const haveUsableSnapshot = snapshot.nodes.length > 0;
      if (haveUsableSnapshot && consecutiveFailures < FAILURES_BEFORE_ALERTING) {
        return;
      }

      const staleForMs = Date.now() - snapshot.ts;
      const staleForMin = Math.round(staleForMs / 60_000);
      broadcast({
        protocolVersion: NETDASH_PROTOCOL_VERSION,
        type: "error",
        payload: {
          message: haveUsableSnapshot
            ? `Topology data is ${staleForMin} min stale - ${consecutiveFailures} failed ` +
              `refreshes from ${provider.name}: ${message}`
            : `Could not load topology from ${provider.name}: ${message}`,
          recoverable: true,
        },
        ts: Date.now(),
      });
    }
  }

  const ready = refresh(true);
  const refreshTimer = setInterval(() => void refresh(), refreshIntervalMs);
  refreshTimer.unref?.();

  function emitMockUpdates(socket: WebSocket) {
    if (!snapshot.nodes.length || !snapshot.edges.length) {
      return;
    }

    const randomNode = snapshot.nodes[Math.floor(Math.random() * snapshot.nodes.length)];
    const randomEdge = snapshot.edges[Math.floor(Math.random() * snapshot.edges.length)];

    sequences.node[randomNode.identity.id] = (sequences.node[randomNode.identity.id] ?? 0) + 1;
    sequences.edge[randomEdge.id] = (sequences.edge[randomEdge.id] ?? 0) + 1;

    const nodeUpdate: NetDashWsMessage = {
      protocolVersion: NETDASH_PROTOCOL_VERSION,
      type: "node.status.update",
      payload: {
        nodeId: randomNode.identity.id,
        sequence: sequences.node[randomNode.identity.id],
        status: Math.random() > 0.1 ? "up" : "down",
        ts: Date.now(),
      } satisfies NodeStatusUpdatePayload,
      ts: Date.now(),
    };

    const flowUpdate: NetDashWsMessage = {
      protocolVersion: NETDASH_PROTOCOL_VERSION,
      type: "flow.metric.update",
      payload: {
        edgeId: randomEdge.id,
        sequence: sequences.edge[randomEdge.id],
        trafficOutMbps: Number((Math.random() * 110).toFixed(2)),
        trafficInMbps: Number((Math.random() * 90).toFixed(2)),
        packetsOutPerSec: Number((Math.random() * 2200).toFixed(0)),
        packetsInPerSec: Number((Math.random() * 1800).toFixed(0)),
        trafficMbps: 0,
        packetsPerSec: 0,
        animated: true,
        ts: Date.now(),
      } satisfies FlowMetricUpdatePayload,
      ts: Date.now(),
    };

    flowUpdate.payload.trafficMbps = Number(
      (flowUpdate.payload.trafficOutMbps + flowUpdate.payload.trafficInMbps).toFixed(2),
    );
    flowUpdate.payload.packetsPerSec =
      flowUpdate.payload.packetsOutPerSec + flowUpdate.payload.packetsInPerSec;

    sequences.node[randomNode.identity.id] += 1;

    const detailUpdate: NetDashWsMessage = {
      protocolVersion: NETDASH_PROTOCOL_VERSION,
      type: "node.details.update",
      payload: {
        nodeId: randomNode.identity.id,
        sequence: sequences.node[randomNode.identity.id],
        details: {
          ...randomNode.data.details,
          certStatus: Math.random() > 0.8 ? "expiring" : "valid",
          vpnStatus: Math.random() > 0.2 ? "connected" : "disconnected",
        },
        ts: Date.now(),
      } satisfies NodeDetailsUpdatePayload,
      ts: Date.now(),
    };

    for (const event of [nodeUpdate, flowUpdate, detailUpdate]) {
      const parse = wsMessageSchema.safeParse(event);
      if (parse.success && socket.readyState === socket.OPEN) {
        socket.send(envelope(event));
      }
    }
  }

  wss.on("connection", (socket: WebSocket) => {
    let isAlive = true;
    socket.on("pong", () => {
      isAlive = true;
    });

    void ready.then(() => {
      if (socket.readyState === socket.OPEN) {
        socket.send(
          envelope({
            protocolVersion: NETDASH_PROTOCOL_VERSION,
            type: "graph.snapshot",
            payload: snapshot,
            ts: Date.now(),
          }),
        );
      }
    });

    // Only a synthetic provider gets the demo ticker that randomises traffic and
    // status. Inventing load on real hardware would make the dashboard actively
    // misleading; live metrics arrive with the Prometheus provider.
    const timer = provider.synthetic ? setInterval(() => emitMockUpdates(socket), 1600) : undefined;

    const pingTimer = setInterval(() => {
      if (!isAlive) {
        socket.terminate();
        return;
      }
      isAlive = false;
      socket.ping();
    }, 30_000);

    socket.on("close", () => {
      if (timer) {
        clearInterval(timer);
      }
      clearInterval(pingTimer);
    });
  });

  wss.on("close", () => clearInterval(refreshTimer));

  return wss;
}
