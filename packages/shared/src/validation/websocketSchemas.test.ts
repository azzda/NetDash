import { describe, it, expect } from "vitest";
import {
  wsMessageSchema,
  graphSnapshotMessageSchema,
  nodeStatusUpdateMessageSchema,
  flowMetricUpdateMessageSchema,
  nodeDetailsUpdateMessageSchema,
  errorMessageSchema,
} from "./websocketSchemas";
import { NETDASH_PROTOCOL_VERSION } from "../config/protocol";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeNode(overrides: Record<string, unknown> = {}) {
  return {
    identity: { id: "node-1", key: "node-1" },
    type: "hardware",
    data: { name: "Router", ip: "192.168.1.1", status: "up", assetType: "hardware" },
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

function makeEdge(overrides: Record<string, unknown> = {}) {
  return {
    id: "edge-1",
    source: "node-1",
    target: "node-2",
    data: { trafficMbps: 10, packetsPerSec: 1000 },
    ...overrides,
  };
}

function envelope(type: string, payload: unknown) {
  return {
    protocolVersion: NETDASH_PROTOCOL_VERSION,
    type,
    payload,
    ts: Date.now(),
  };
}

// ─── graph.snapshot ─────────────────────────────────────────────────────────

describe("graphSnapshotMessageSchema", () => {
  it("accepts a valid snapshot", () => {
    const msg = envelope("graph.snapshot", {
      nodes: [makeNode()],
      edges: [makeEdge()],
      sequence: 1,
      ts: Date.now(),
    });
    expect(graphSnapshotMessageSchema.safeParse(msg).success).toBe(true);
  });

  it("rejects wrong protocol version", () => {
    const msg = {
      protocolVersion: "99.0.0",
      type: "graph.snapshot",
      payload: { nodes: [], edges: [], sequence: 0, ts: 1 },
      ts: 1,
    };
    expect(graphSnapshotMessageSchema.safeParse(msg).success).toBe(false);
  });

  it("rejects negative sequence", () => {
    const msg = envelope("graph.snapshot", {
      nodes: [],
      edges: [],
      sequence: -1,
      ts: 1,
    });
    expect(graphSnapshotMessageSchema.safeParse(msg).success).toBe(false);
  });

  it("rejects missing nodes array", () => {
    const msg = envelope("graph.snapshot", {
      edges: [],
      sequence: 0,
      ts: 1,
    });
    expect(graphSnapshotMessageSchema.safeParse(msg).success).toBe(false);
  });
});

// ─── node.status.update ─────────────────────────────────────────────────────

describe("nodeStatusUpdateMessageSchema", () => {
  it("accepts a valid status update", () => {
    const msg = envelope("node.status.update", {
      nodeId: "node-1",
      sequence: 2,
      status: "down",
      ts: Date.now(),
    });
    expect(nodeStatusUpdateMessageSchema.safeParse(msg).success).toBe(true);
  });

  it("accepts optional ip and name", () => {
    const msg = envelope("node.status.update", {
      nodeId: "node-1",
      sequence: 2,
      status: "up",
      ip: "10.0.0.5",
      name: "new-name",
      ts: Date.now(),
    });
    expect(nodeStatusUpdateMessageSchema.safeParse(msg).success).toBe(true);
  });

  it("rejects invalid status value", () => {
    const msg = envelope("node.status.update", {
      nodeId: "node-1",
      sequence: 2,
      status: "degraded",
      ts: Date.now(),
    });
    expect(nodeStatusUpdateMessageSchema.safeParse(msg).success).toBe(false);
  });
});

// ─── flow.metric.update ─────────────────────────────────────────────────────

describe("flowMetricUpdateMessageSchema", () => {
  it("accepts a valid flow metric update", () => {
    const msg = envelope("flow.metric.update", {
      edgeId: "edge-1",
      sequence: 3,
      trafficMbps: 12.5,
      packetsPerSec: 3200,
      trafficOutMbps: 7.1,
      trafficInMbps: 5.4,
      packetsOutPerSec: 1800,
      packetsInPerSec: 1400,
      animated: true,
      ts: Date.now(),
    });
    expect(flowMetricUpdateMessageSchema.safeParse(msg).success).toBe(true);
  });

  it("rejects missing required metric fields", () => {
    const msg = envelope("flow.metric.update", {
      edgeId: "edge-1",
      sequence: 3,
      trafficMbps: 12.5,
      // missing other required fields
      ts: Date.now(),
    });
    expect(flowMetricUpdateMessageSchema.safeParse(msg).success).toBe(false);
  });
});

// ─── node.details.update ────────────────────────────────────────────────────

describe("nodeDetailsUpdateMessageSchema", () => {
  it("accepts a valid details update with all optional fields", () => {
    const msg = envelope("node.details.update", {
      nodeId: "node-1",
      sequence: 4,
      details: {
        localDns: "router.local",
        publicDns: "router.example.com",
        certStatus: "valid",
        vpnStatus: "connected",
        metrics: [
          {
            id: "cpu",
            label: "CPU %",
            unit: "%",
            color: "#ff0000",
            points: [{ ts: 1, value: 45 }],
          },
        ],
        logs: [
          { id: "l1", ts: 1, severity: "info", source: "sys", message: "boot" },
        ],
      },
      ts: Date.now(),
    });
    expect(nodeDetailsUpdateMessageSchema.safeParse(msg).success).toBe(true);
  });

  it("accepts minimal details (all fields optional)", () => {
    const msg = envelope("node.details.update", {
      nodeId: "node-1",
      sequence: 4,
      details: {},
      ts: Date.now(),
    });
    expect(nodeDetailsUpdateMessageSchema.safeParse(msg).success).toBe(true);
  });

  it("rejects invalid cert status", () => {
    const msg = envelope("node.details.update", {
      nodeId: "node-1",
      sequence: 4,
      details: { certStatus: "revoked" },
      ts: Date.now(),
    });
    expect(nodeDetailsUpdateMessageSchema.safeParse(msg).success).toBe(false);
  });
});

// ─── error ──────────────────────────────────────────────────────────────────

describe("errorMessageSchema", () => {
  it("accepts a valid error message", () => {
    const msg = envelope("error", {
      message: "Something went wrong",
      code: "E001",
      recoverable: true,
    });
    expect(errorMessageSchema.safeParse(msg).success).toBe(true);
  });

  it("accepts error with only required fields", () => {
    const msg = envelope("error", { message: "fail" });
    expect(errorMessageSchema.safeParse(msg).success).toBe(true);
  });
});

// ─── Discriminated union ────────────────────────────────────────────────────

describe("wsMessageSchema (discriminated union)", () => {
  it("routes to correct sub-schema based on type", () => {
    const snapshot = envelope("graph.snapshot", {
      nodes: [],
      edges: [],
      sequence: 0,
      ts: 1,
    });
    const result = wsMessageSchema.safeParse(snapshot);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("graph.snapshot");
    }
  });

  it("rejects unknown event type", () => {
    const msg = envelope("node.delete", { nodeId: "n1" });
    expect(wsMessageSchema.safeParse(msg).success).toBe(false);
  });

  it("validates edge data with full connector metadata", () => {
    const msg = envelope("graph.snapshot", {
      nodes: [makeNode()],
      edges: [
        makeEdge({
          data: {
            connectorUuid: "uuid-123",
            displayName: "WAN Link",
            protocol: "TCP",
            vlan: "100",
            sideA: {
              nodeId: "node-1",
              label: "Port 1",
              interfaceLabel: "eth0",
              ipAddresses: ["10.0.0.1"],
            },
            sideB: {
              nodeId: "node-2",
              label: "Port 2",
            },
            policyReferences: [
              { id: "p1", type: "firewall", label: "Allow HTTP" },
            ],
            trafficMbps: 50,
            packetsPerSec: 5000,
          },
        }),
      ],
      sequence: 1,
      ts: Date.now(),
    });
    expect(wsMessageSchema.safeParse(msg).success).toBe(true);
  });
});
