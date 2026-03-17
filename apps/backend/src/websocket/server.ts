import { WebSocketServer } from "ws";
import {
  NETDASH_PROTOCOL_VERSION,
  wsMessageSchema,
  type FlowMetricUpdatePayload,
  type NetDashWsMessage,
  type NodeDetailsUpdatePayload,
  type NodeStatusUpdatePayload,
} from "@netdash/shared";
import { createSeededSnapshot } from "../mock/seededGraph";

interface Sequences {
  node: Record<string, number>;
  edge: Record<string, number>;
}

export function attachWebSocketServer(port: number): WebSocketServer {
  const snapshot = createSeededSnapshot(42);
  const sequences: Sequences = { node: {}, edge: {} };

  for (const node of snapshot.nodes) {
    sequences.node[node.identity.id] = snapshot.sequence;
  }

  for (const edge of snapshot.edges) {
    sequences.edge[edge.id] = snapshot.sequence;
  }

  const wss = new WebSocketServer({ port });

  wss.on("connection", (socket) => {
    const bootstrap: NetDashWsMessage = {
      protocolVersion: NETDASH_PROTOCOL_VERSION,
      type: "graph.snapshot",
      payload: snapshot,
      ts: Date.now(),
    };

    socket.send(JSON.stringify(bootstrap));

    const timer = setInterval(() => {
      const randomNode = snapshot.nodes[Math.floor(Math.random() * snapshot.nodes.length)];
      const randomEdge = snapshot.edges[Math.floor(Math.random() * snapshot.edges.length)];

      sequences.node[randomNode.identity.id] += 1;
      sequences.edge[randomEdge.id] += 1;
      const nodeStatusSequence = sequences.node[randomNode.identity.id];
      const edgeSequence = sequences.edge[randomEdge.id];

      const nodeUpdate: NetDashWsMessage = {
        protocolVersion: NETDASH_PROTOCOL_VERSION,
        type: "node.status.update",
        payload: {
          nodeId: randomNode.identity.id,
          sequence: nodeStatusSequence,
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
          sequence: edgeSequence,
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
      const nodeDetailsSequence = sequences.node[randomNode.identity.id];

      const detailUpdate: NetDashWsMessage = {
        protocolVersion: NETDASH_PROTOCOL_VERSION,
        type: "node.details.update",
        payload: {
          nodeId: randomNode.identity.id,
          sequence: nodeDetailsSequence,
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
        if (parse.success) {
          socket.send(JSON.stringify(event));
        }
      }
    }, 1600);

    socket.on("close", () => {
      clearInterval(timer);
    });
  });

  return wss;
}
