import { describe, it, expect } from "vitest";
import { deriveNodeFacts } from "./nodeFacts";

describe("deriveNodeFacts", () => {
  it("is empty when there are no extensions", () => {
    expect(deriveNodeFacts(undefined).isEmpty).toBe(true);
    expect(deriveNodeFacts({}).isEmpty).toBe(true);
  });

  it("labels NetBox device facts and drops unknown keys", () => {
    const { facts, statusLabel, isEmpty } = deriveNodeFacts({
      extensions: {
        source: "netbox",
        objectType: "dcim.device",
        objectId: 3,
        status: "active",
        statusLabel: "Active",
        role: "Hypervisor",
        model: "PowerEdge R640",
        manufacturer: "Dell",
        serial: "ABC123",
        site: "azzda HQ",
        rack: "rack-01",
        tenant: "Platform",
      },
    });

    expect(isEmpty).toBe(false);
    expect(statusLabel).toBe("Active");
    const map = new Map(facts.map((f) => [f.label, f.value]));
    expect(map.get("Role")).toBe("Hypervisor");
    expect(map.get("Model")).toBe("PowerEdge R640");
    expect(map.get("Serial")).toBe("ABC123");
    // Raw plumbing keys are never surfaced.
    expect(facts.some((f) => /source|objectType|objectId/i.test(f.label))).toBe(false);
  });

  it("renders VM compute shape with unit conversion", () => {
    const { facts } = deriveNodeFacts({
      extensions: {
        objectType: "virtualization.virtualmachine",
        cluster: "talos",
        vcpus: 8,
        memoryMiB: 16384,
        diskGiB: 200,
      },
    });

    const map = new Map(facts.map((f) => [f.label, f.value]));
    expect(map.get("Cluster")).toBe("talos");
    expect(map.get("vCPUs")).toBe("8");
    expect(map.get("Memory")).toBe("16.0 GiB");
    expect(map.get("Disk")).toBe("200 GiB");
  });

  it("distinguishes not-monitored from probe reachable/unreachable", () => {
    expect(deriveNodeFacts({ extensions: { monitored: false } }).monitoring?.label).toBe(
      "Not monitored",
    );

    expect(
      deriveNodeFacts({ extensions: { monitored: true, reachable: true } }).monitoring?.label,
    ).toBe("Probe: reachable");

    const contradiction = deriveNodeFacts({
      extensions: { monitored: true, reachable: false, netboxStatus: "active" },
    }).monitoring;
    expect(contradiction?.label).toBe("Probe: unreachable");
    expect(contradiction?.hint).toMatch(/active/i);
  });

  it("surfaces an unmanaged device as its own monitoring state", () => {
    // Even if a stray monitored flag rides along, unmanaged wins.
    const monitoring = deriveNodeFacts({
      extensions: { unmanaged: true, monitored: false },
    }).monitoring;
    expect(monitoring?.label).toBe("Unmanaged");
  });

  it("formats probe latency", () => {
    expect(deriveNodeFacts({ extensions: { latencyMs: 1.8 } }).latencyLabel).toBe("1.8 ms");
  });

  it("passes through a description", () => {
    expect(deriveNodeFacts({ extensions: { description: "core router" } }).description).toBe(
      "core router",
    );
  });
});
