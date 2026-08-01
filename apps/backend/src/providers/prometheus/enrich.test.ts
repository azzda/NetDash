import { describe, expect, it } from "vitest";
import type { GraphSnapshotPayload } from "@netdash/shared";
import { enrichSnapshot } from "./enrich";
import type { LiveState } from "./enrich";

function snapshot(): GraphSnapshotPayload {
  return {
    nodes: [
      node("netbox:device:1", "crs309", "10.0.1.2", "up", "active"),
      node("netbox:device:2", "nukesv", "10.0.1.21", "down", "offline"),
      node("netbox:device:3", "mono", "10.0.1.1", "up", "active"),
      // Modelled but nobody probes it - e.g. an unmanaged switch.
      node("netbox:device:4", "dgs108", "", "down", "planned"),
    ],
    edges: [],
    sequence: 1,
    ts: 1_000,
  };
}

function node(id: string, name: string, ip: string, status: "up" | "down", netboxStatus: string) {
  return {
    identity: { id, key: `hardware:${name}` },
    type: "hardware" as const,
    data: {
      name,
      ip,
      status,
      assetType: "hardware" as const,
      details: { extensions: { source: "netbox", status: netboxStatus } },
    },
    position: { x: 0, y: 0 },
  };
}

function live(overrides: Partial<LiveState> = {}): LiveState {
  return {
    reachability: [
      { labels: { instance: "10.0.1.2" }, value: 1 },
      { labels: { instance: "10.0.1.21" }, value: 0 },
      { labels: { instance: "10.0.1.1" }, value: 1 },
    ],
    latency: [
      {
        labels: { instance: "10.0.1.2" },
        points: [
          { ts: 1_000, value: 0.0012 },
          { ts: 61_000, value: 0.0018 },
        ],
      },
    ],
    ...overrides,
  };
}

describe("enrichSnapshot", () => {
  it("lets reality override NetBox intent", () => {
    const result = enrichSnapshot(snapshot(), {
      reachability: [{ labels: { instance: "10.0.1.1" }, value: 0 }],
      latency: [],
    });

    const mono = result.nodes.find((n) => n.data.name === "mono");
    // NetBox says active; the probe says it does not answer.
    expect(mono?.data.status).toBe("down");
    expect(mono?.data.details?.extensions?.reachable).toBe(false);
    // The intent is preserved so the UI can say WHY they disagree.
    expect(mono?.data.details?.extensions?.netboxStatus).toBe("active");
  });

  it("marks a reachable device up", () => {
    const result = enrichSnapshot(snapshot(), live());
    const crs309 = result.nodes.find((n) => n.data.name === "crs309");

    expect(crs309?.data.status).toBe("up");
    expect(crs309?.data.details?.extensions?.reachable).toBe(true);
    expect(crs309?.data.details?.extensions?.monitored).toBe(true);
  });

  it("keeps a device down when it is genuinely off", () => {
    const result = enrichSnapshot(snapshot(), live());
    const nukesv = result.nodes.find((n) => n.data.name === "nukesv");

    expect(nukesv?.data.status).toBe("down");
    expect(nukesv?.data.details?.extensions?.netboxStatus).toBe("offline");
  });

  it("treats absence of a probe as no evidence, not as down", () => {
    const result = enrichSnapshot(snapshot(), live());
    const dgs108 = result.nodes.find((n) => n.data.name === "dgs108");

    // Unprobed devices must keep NetBox's view rather than being falsely
    // reported as unreachable.
    expect(dgs108?.data.details?.extensions?.monitored).toBe(false);
    expect(dgs108?.data.details?.extensions?.reachable).toBeUndefined();
    expect(dgs108?.data.status).toBe("down"); // unchanged from the input
  });

  it("does not flip an unprobed but active device to down", () => {
    const input = snapshot();
    input.nodes.push(node("netbox:device:9", "speedport", "", "up", "active"));

    const result = enrichSnapshot(input, live());
    const speedport = result.nodes.find((n) => n.data.name === "speedport");

    expect(speedport?.data.status).toBe("up");
    expect(speedport?.data.details?.extensions?.monitored).toBe(false);
  });

  it("converts probe latency to a millisecond series", () => {
    const result = enrichSnapshot(snapshot(), live());
    const crs309 = result.nodes.find((n) => n.data.name === "crs309");
    const series = crs309?.data.details?.metrics?.[0];

    expect(series?.unit).toBe("ms");
    expect(series?.points.map((p) => p.value)).toEqual([1.2, 1.8]);
    expect(crs309?.data.details?.extensions?.latencyMs).toBe(1.8);
  });

  it("gives no metrics to a device with no latency data", () => {
    const result = enrichSnapshot(snapshot(), live());
    const mono = result.nodes.find((n) => n.data.name === "mono");

    expect(mono?.data.details?.metrics).toBeUndefined();
  });

  it("preserves the NetBox extensions it did not set", () => {
    const result = enrichSnapshot(snapshot(), live());
    const crs309 = result.nodes.find((n) => n.data.name === "crs309");

    expect(crs309?.data.details?.extensions?.source).toBe("netbox");
  });

  it("leaves edges and node identity untouched", () => {
    const input = snapshot();
    const result = enrichSnapshot(input, live());

    expect(result.edges).toBe(input.edges);
    expect(result.nodes.map((n) => n.identity.id)).toEqual(input.nodes.map((n) => n.identity.id));
  });

  it("accepts `target` as well as `instance` labelling", () => {
    const result = enrichSnapshot(snapshot(), {
      reachability: [{ labels: { target: "10.0.1.2" }, value: 0 }],
      latency: [],
    });

    expect(result.nodes.find((n) => n.data.name === "crs309")?.data.status).toBe("down");
  });

  it("is a no-op when Prometheus returns nothing", () => {
    const result = enrichSnapshot(snapshot(), { reachability: [], latency: [] });

    expect(result.nodes.map((n) => n.data.status)).toEqual(["up", "down", "up", "down"]);
  });
});
