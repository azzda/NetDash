import { describe, it, expect, beforeEach } from "vitest";
import { useNetDashStore } from "./useNetDashStore";
import type { NetDashWsMessage } from "@netdash/shared";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeSnapshot(
  sequence: number,
  nodes = [makeNode("n1")],
  edges = [makeEdge("e1", "n1", "n2")],
): NetDashWsMessage {
  return {
    protocolVersion: "1.0.0",
    type: "graph.snapshot",
    payload: { nodes, edges, sequence, ts: Date.now() },
    ts: Date.now(),
  };
}

function makeNode(id: string, status: "up" | "down" = "up") {
  return {
    identity: { id, key: id },
    type: "hardware" as const,
    data: { name: id, ip: "10.0.0.1", status, assetType: "hardware" as const },
    position: { x: 0, y: 0 },
  };
}

function makeEdge(id: string, source: string, target: string) {
  return {
    id,
    source,
    target,
    data: { trafficMbps: 5, packetsPerSec: 500 },
  };
}

function statusUpdate(nodeId: string, sequence: number, status: "up" | "down"): NetDashWsMessage {
  return {
    protocolVersion: "1.0.0",
    type: "node.status.update",
    payload: { nodeId, sequence, status, ts: Date.now() },
    ts: Date.now(),
  };
}

function flowUpdate(edgeId: string, sequence: number): NetDashWsMessage {
  return {
    protocolVersion: "1.0.0",
    type: "flow.metric.update",
    payload: {
      edgeId,
      sequence,
      trafficMbps: 20,
      packetsPerSec: 4000,
      trafficOutMbps: 12,
      trafficInMbps: 8,
      packetsOutPerSec: 2200,
      packetsInPerSec: 1800,
      animated: true,
      ts: Date.now(),
    },
    ts: Date.now(),
  };
}

function detailsUpdate(nodeId: string, sequence: number): NetDashWsMessage {
  return {
    protocolVersion: "1.0.0",
    type: "node.details.update",
    payload: {
      nodeId,
      sequence,
      details: {
        localDns: "test.local",
        certStatus: "valid",
        vpnStatus: "connected",
      },
      ts: Date.now(),
    },
    ts: Date.now(),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("useNetDashStore", () => {
  beforeEach(() => {
    // Reset store between tests
    useNetDashStore.setState({
      nodes: [],
      edges: [],
      sequences: { node: {}, edge: {} },
      selectedNodeId: undefined,
      selectedEdgeId: undefined,
    });
  });

  // ── Snapshot ────────────────────────────────────────────────────────────

  describe("graph.snapshot", () => {
    it("populates nodes and edges from snapshot", () => {
      const store = useNetDashStore.getState();
      store.applyMessage(makeSnapshot(1));

      const state = useNetDashStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.edges).toHaveLength(1);
      expect(state.nodes[0].identity.id).toBe("n1");
    });

    it("sets per-entity sequences from snapshot", () => {
      const store = useNetDashStore.getState();
      store.applyMessage(makeSnapshot(5));

      const state = useNetDashStore.getState();
      expect(state.sequences.node["n1"]).toBe(5);
      expect(state.sequences.edge["e1"]).toBe(5);
    });

    it("replaces existing state completely", () => {
      const store = useNetDashStore.getState();
      store.applyMessage(makeSnapshot(1, [makeNode("a"), makeNode("b")], []));
      store.applyMessage(makeSnapshot(2, [makeNode("c")], []));

      const state = useNetDashStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].identity.id).toBe("c");
    });

    it("preserves selection across snapshots", () => {
      const store = useNetDashStore.getState();
      store.applyMessage(makeSnapshot(1));
      store.setSelectedNode("n1");
      store.applyMessage(makeSnapshot(2));

      expect(useNetDashStore.getState().selectedNodeId).toBe("n1");
    });
  });

  // ── Node status update ──────────────────────────────────────────────────

  describe("node.status.update", () => {
    it("updates node status", () => {
      const store = useNetDashStore.getState();
      store.applyMessage(makeSnapshot(1));
      store.applyMessage(statusUpdate("n1", 2, "down"));

      const node = useNetDashStore.getState().nodes[0];
      expect(node.data.status).toBe("down");
    });

    it("updates optional ip and name", () => {
      const store = useNetDashStore.getState();
      store.applyMessage(makeSnapshot(1));

      const msg: NetDashWsMessage = {
        protocolVersion: "1.0.0",
        type: "node.status.update",
        payload: { nodeId: "n1", sequence: 2, status: "up", ip: "10.0.0.99", name: "renamed", ts: Date.now() },
        ts: Date.now(),
      };
      store.applyMessage(msg);

      const node = useNetDashStore.getState().nodes[0];
      expect(node.data.ip).toBe("10.0.0.99");
      expect(node.data.name).toBe("renamed");
    });

    it("drops stale update (sequence <= current)", () => {
      const store = useNetDashStore.getState();
      store.applyMessage(makeSnapshot(5));
      store.applyMessage(statusUpdate("n1", 3, "down")); // stale

      const node = useNetDashStore.getState().nodes[0];
      expect(node.data.status).toBe("up"); // unchanged
    });

    it("drops duplicate sequence", () => {
      const store = useNetDashStore.getState();
      store.applyMessage(makeSnapshot(5));
      store.applyMessage(statusUpdate("n1", 5, "down")); // same seq

      const node = useNetDashStore.getState().nodes[0];
      expect(node.data.status).toBe("up"); // unchanged
    });

    it("applies update with higher sequence", () => {
      const store = useNetDashStore.getState();
      store.applyMessage(makeSnapshot(5));
      store.applyMessage(statusUpdate("n1", 6, "down"));

      expect(useNetDashStore.getState().sequences.node["n1"]).toBe(6);
    });
  });

  // ── Flow metric update ──────────────────────────────────────────────────

  describe("flow.metric.update", () => {
    it("updates edge traffic data", () => {
      const store = useNetDashStore.getState();
      store.applyMessage(makeSnapshot(1));
      store.applyMessage(flowUpdate("e1", 2));

      const edge = useNetDashStore.getState().edges[0];
      expect(edge.data?.trafficMbps).toBe(20);
      expect(edge.data?.animated).toBe(true);
    });

    it("drops stale flow updates", () => {
      const store = useNetDashStore.getState();
      store.applyMessage(makeSnapshot(5));
      store.applyMessage(flowUpdate("e1", 3)); // stale

      const edge = useNetDashStore.getState().edges[0];
      expect(edge.data?.trafficMbps).toBe(5); // original value
    });

    it("updates edge sequence on apply", () => {
      const store = useNetDashStore.getState();
      store.applyMessage(makeSnapshot(1));
      store.applyMessage(flowUpdate("e1", 10));

      expect(useNetDashStore.getState().sequences.edge["e1"]).toBe(10);
    });
  });

  // ── Node details update ─────────────────────────────────────────────────

  describe("node.details.update", () => {
    it("merges details into existing node", () => {
      const store = useNetDashStore.getState();
      store.applyMessage(makeSnapshot(1));
      store.applyMessage(detailsUpdate("n1", 2));

      const node = useNetDashStore.getState().nodes[0];
      expect(node.data.details?.localDns).toBe("test.local");
      expect(node.data.details?.certStatus).toBe("valid");
    });

    it("drops stale details update", () => {
      const store = useNetDashStore.getState();
      store.applyMessage(makeSnapshot(5));
      store.applyMessage(detailsUpdate("n1", 3)); // stale

      const node = useNetDashStore.getState().nodes[0];
      expect(node.data.details?.localDns).toBeUndefined();
    });
  });

  // ── Selection ───────────────────────────────────────────────────────────

  describe("selection", () => {
    it("selects a node and clears edge selection", () => {
      const store = useNetDashStore.getState();
      store.setSelectedEdge("e1");
      store.setSelectedNode("n1");

      const state = useNetDashStore.getState();
      expect(state.selectedNodeId).toBe("n1");
      expect(state.selectedEdgeId).toBeUndefined();
    });

    it("selects an edge and clears node selection", () => {
      const store = useNetDashStore.getState();
      store.setSelectedNode("n1");
      store.setSelectedEdge("e1");

      const state = useNetDashStore.getState();
      expect(state.selectedEdgeId).toBe("e1");
      expect(state.selectedNodeId).toBeUndefined();
    });

    it("clearSelection clears both", () => {
      const store = useNetDashStore.getState();
      store.setSelectedNode("n1");
      store.clearSelection();

      const state = useNetDashStore.getState();
      expect(state.selectedNodeId).toBeUndefined();
      expect(state.selectedEdgeId).toBeUndefined();
    });
  });
});
