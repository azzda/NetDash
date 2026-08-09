import { describe, it, expect } from "vitest";
import { createSeededSnapshot } from "./seededGraph";
import { wsMessageSchema } from "@netdash/shared";
import { NETDASH_PROTOCOL_VERSION } from "@netdash/shared";

describe("createSeededSnapshot", () => {
  const snapshot = createSeededSnapshot(42);

  it("returns consistent output for same seed", () => {
    const a = createSeededSnapshot(42);
    const b = createSeededSnapshot(42);
    expect(a.nodes.length).toBe(b.nodes.length);
    expect(a.edges.length).toBe(b.edges.length);
    expect(a.nodes.map((n) => n.identity.id)).toEqual(b.nodes.map((n) => n.identity.id));
  });

  it("produces different output for different seeds", () => {
    const a = createSeededSnapshot(42);
    const b = createSeededSnapshot(99);
    // Node identities are the same (topology is fixed) but metric values differ
    const aFirstPoint = a.nodes[0].data.details?.metrics?.[0]?.points[0]?.value;
    const bFirstPoint = b.nodes[0].data.details?.metrics?.[0]?.points[0]?.value;
    expect(aFirstPoint).not.toBe(bFirstPoint);
  });

  it("generates 12 nodes", () => {
    expect(snapshot.nodes).toHaveLength(12);
  });

  it("generates 15 edges", () => {
    expect(snapshot.edges).toHaveLength(15);
  });

  it("includes both physical and logical edges", () => {
    const logical = snapshot.edges.filter((edge) => edge.data?.layer === "logical");
    const physical = snapshot.edges.filter((edge) => edge.data?.layer !== "logical");
    expect(logical.length).toBeGreaterThan(0);
    expect(physical.length).toBeGreaterThan(0);
    // Logical relationships never carry bandwidth.
    for (const edge of logical) {
      expect(edge.data?.trafficMbps ?? 0).toBe(0);
    }
  });

  it("includes a planned link drawn without live traffic", () => {
    const planned = snapshot.edges.filter((edge) => edge.data?.status === "planned");
    expect(planned.length).toBeGreaterThan(0);
    for (const edge of planned) {
      expect(edge.data?.animated).toBe(false);
    }
  });

  it("includes an unmanaged device flagged in its extensions", () => {
    const unmanaged = snapshot.nodes.filter((node) => node.data.status === "unmanaged");
    expect(unmanaged.length).toBeGreaterThan(0);
    for (const node of unmanaged) {
      expect(node.data.details?.extensions?.unmanaged).toBe(true);
    }
  });

  it("every node has required identity fields", () => {
    for (const node of snapshot.nodes) {
      expect(node.identity.id).toBeTruthy();
      expect(node.identity.key).toBeTruthy();
    }
  });

  it("every node has a valid asset type", () => {
    const valid = ["hardware", "host", "service"];
    for (const node of snapshot.nodes) {
      expect(valid).toContain(node.type);
      expect(node.data.assetType).toBe(node.type);
    }
  });

  it("every node has valid status", () => {
    for (const node of snapshot.nodes) {
      expect(["up", "down", "unmanaged"]).toContain(node.data.status);
    }
  });

  it("every node has metrics with 96 data points", () => {
    for (const node of snapshot.nodes) {
      expect(node.data.details?.metrics).toBeDefined();
      for (const series of node.data.details!.metrics!) {
        expect(series.points).toHaveLength(96);
      }
    }
  });

  it("every node has logs", () => {
    for (const node of snapshot.nodes) {
      expect(node.data.details?.logs).toBeDefined();
      expect(node.data.details!.logs!.length).toBeGreaterThan(0);
    }
  });

  it("all edges reference existing nodes", () => {
    const nodeIds = new Set(snapshot.nodes.map((n) => n.identity.id));
    for (const edge of snapshot.edges) {
      expect(nodeIds.has(edge.source)).toBe(true);
      expect(nodeIds.has(edge.target)).toBe(true);
    }
  });

  it("first 4 edges have full connector metadata", () => {
    for (let i = 0; i < 4; i++) {
      const edge = snapshot.edges[i];
      expect(edge.data?.connectorUuid).toBeTruthy();
      expect(edge.data?.displayName).toBeTruthy();
      expect(edge.data?.protocol).toBeTruthy();
      expect(edge.data?.sideA).toBeDefined();
      expect(edge.data?.sideB).toBeDefined();
      expect(edge.data?.policyReferences?.length).toBeGreaterThan(0);
    }
  });

  it("snapshot passes Zod schema validation as graph.snapshot message", () => {
    const message = {
      protocolVersion: NETDASH_PROTOCOL_VERSION,
      type: "graph.snapshot" as const,
      payload: snapshot,
      ts: Date.now(),
    };
    const result = wsMessageSchema.safeParse(message);
    if (!result.success) {
      console.error(result.error.issues);
    }
    expect(result.success).toBe(true);
  });
});
