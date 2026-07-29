import { describe, expect, it } from "vitest";
import { mapDatasetToSnapshot, nodeIdForDevice, nodeIdForVirtualMachine } from "./mapper";
import type { NetBoxDataset } from "./types";

/**
 * Shaped after the real payloads from NetBox 4.6 in the azzda lab: a core
 * switch trunked to the gateway, a hypervisor whose port is dark because the
 * host is off, a planned run, and a VM on a cluster backed by a device.
 */
function dataset(): NetBoxDataset {
  return {
    devices: [
      {
        id: 1,
        name: "crs309",
        display: "crs309",
        role: { id: 10, name: "Core Switch", slug: "core-switch" },
        device_type: { id: 20, model: "CRS309-1G-8S+", manufacturer: { id: 30, name: "MikroTik" } },
        site: { id: 1, name: "azzda HQ" },
        rack: { id: 1, name: "rack-01" },
        tenant: { id: 1, name: "Platform" },
        cluster: null,
        serial: "HM50B96RDBT",
        status: { value: "active", label: "Active" },
        primary_ip4: { id: 100, address: "10.0.1.2/24" },
      },
      {
        id: 2,
        name: "nukenas",
        display: "nukenas",
        role: { id: 11, name: "Hypervisor", slug: "hypervisor" },
        device_type: { id: 21, model: "Custom AM4 3U" },
        site: { id: 1, name: "azzda HQ" },
        rack: { id: 1, name: "rack-01" },
        tenant: { id: 1, name: "Platform" },
        cluster: { id: 50, name: "nukenas-pve" },
        status: { value: "active", label: "Active" },
        primary_ip4: { id: 101, address: "10.0.1.20/24" },
      },
      {
        id: 3,
        name: "nukesv",
        display: "nukesv",
        role: { id: 11, name: "Hypervisor", slug: "hypervisor" },
        device_type: { id: 22, model: "PowerEdge R640" },
        site: { id: 1, name: "azzda HQ" },
        rack: null,
        tenant: null,
        cluster: null,
        status: { value: "offline", label: "Offline" },
        primary_ip4: { id: 102, address: "10.0.1.21/24" },
      },
    ],
    virtualMachines: [
      {
        id: 7,
        name: "nuk8s-cp-01",
        status: { value: "active", label: "Active" },
        cluster: { id: 50, name: "nukenas-pve" },
        tenant: { id: 1, name: "Platform" },
        vcpus: 8,
        memory: 16384,
        disk: 200,
        primary_ip4: { id: 103, address: "10.0.30.10/24" },
      },
    ],
    clusters: [{ id: 50, name: "nukenas-pve" }],
    interfaces: [
      {
        id: 500,
        name: "sfp-sfpplus7",
        device: { id: 1, name: "crs309" },
        type: { value: "10gbase-x-sfpp", label: "SFP+ (10GE)" },
        untagged_vlan: null,
        tagged_vlans: [
          { id: 1, name: "MGMT", vid: 4094 },
          { id: 2, name: "K8S", vid: 30 },
        ],
      },
      {
        id: 501,
        name: "enp-10g",
        device: { id: 2, name: "nukenas" },
        type: { value: "10gbase-x-sfpp", label: "SFP+ (10GE)" },
        untagged_vlan: null,
        tagged_vlans: [],
      },
      {
        id: 502,
        name: "sfp-sfpplus6",
        device: { id: 1, name: "crs309" },
        type: { value: "10gbase-x-sfpp", label: "SFP+ (10GE)" },
        untagged_vlan: { id: 3, name: "OLD", vid: 11 },
        tagged_vlans: [],
      },
      {
        id: 503,
        name: "enp-10g",
        device: { id: 3, name: "nukesv" },
        type: { value: "10gbase-x-sfpp", label: "SFP+ (10GE)" },
      },
    ],
    cables: [
      {
        id: 900,
        label: "crs309-nukenas",
        status: { value: "connected", label: "Connected" },
        type: "dac-passive",
        a_terminations: [{ object_type: "dcim.interface", object_id: 500 }],
        b_terminations: [{ object_type: "dcim.interface", object_id: 501 }],
      },
      {
        id: 901,
        label: "crs309-nukesv",
        status: { value: "planned", label: "Planned" },
        type: "dac-passive",
        a_terminations: [{ object_type: "dcim.interface", object_id: 502 }],
        b_terminations: [{ object_type: "dcim.interface", object_id: 503 }],
      },
      {
        id: 902,
        label: "power-feed",
        status: { value: "connected", label: "Connected" },
        type: "power",
        a_terminations: [{ object_type: "dcim.powerport", object_id: 1 }],
        b_terminations: [{ object_type: "dcim.poweroutlet", object_id: 2 }],
      },
    ],
    ipAddresses: [
      {
        id: 100,
        address: "10.0.1.2/24",
        dns_name: "crs309.lab.azzda.cloud",
        assigned_object_type: "dcim.interface",
        assigned_object_id: 500,
      },
      {
        id: 200,
        address: "10.0.40.10/24",
        assigned_object_type: "dcim.interface",
        assigned_object_id: 501,
      },
    ],
  };
}

describe("mapDatasetToSnapshot", () => {
  it("maps devices and virtual machines to nodes", () => {
    const snapshot = mapDatasetToSnapshot(dataset(), 1_000);

    expect(snapshot.nodes).toHaveLength(4);
    expect(snapshot.ts).toBe(1_000);

    const crs309 = snapshot.nodes.find((n) => n.identity.id === nodeIdForDevice(1));
    expect(crs309?.data.name).toBe("crs309");
    expect(crs309?.data.ip).toBe("10.0.1.2");
    expect(crs309?.identity.key).toBe("hardware:crs309");
  });

  it("classifies network gear as hardware and compute as host", () => {
    const snapshot = mapDatasetToSnapshot(dataset());

    expect(snapshot.nodes.find((n) => n.data.name === "crs309")?.type).toBe("hardware");
    expect(snapshot.nodes.find((n) => n.data.name === "nukenas")?.type).toBe("host");
    expect(snapshot.nodes.find((n) => n.data.name === "nuk8s-cp-01")?.type).toBe("host");
  });

  it("treats only active NetBox statuses as up, keeping the real status in extensions", () => {
    const snapshot = mapDatasetToSnapshot(dataset());

    const nukesv = snapshot.nodes.find((n) => n.data.name === "nukesv");
    expect(nukesv?.data.status).toBe("down");
    // "offline" and "planned" are both down, but they are not the same thing.
    expect(nukesv?.data.details?.extensions?.status).toBe("offline");
    expect(snapshot.nodes.find((n) => n.data.name === "crs309")?.data.status).toBe("up");
  });

  it("builds edges from cables, with endpoint detail on both sides", () => {
    const snapshot = mapDatasetToSnapshot(dataset());
    const edge = snapshot.edges.find((e) => e.id === "netbox:cable:900");

    expect(edge?.source).toBe(nodeIdForDevice(1));
    expect(edge?.target).toBe(nodeIdForDevice(2));
    expect(edge?.data?.sideA?.interfaceLabel).toBe("sfp-sfpplus7");
    expect(edge?.data?.sideB?.interfaceLabel).toBe("enp-10g");
    expect(edge?.data?.sideA?.ipAddresses).toEqual(["10.0.1.2/24"]);
    expect(edge?.data?.sideA?.dnsNames).toEqual(["crs309.lab.azzda.cloud"]);
    expect(edge?.data?.protocol).toBe("dac-passive");
    expect(edge?.data?.status).toBe("connected");
    expect(edge?.data?.animated).toBe(true);
  });

  it("keeps planned cabling in the graph but never animates it", () => {
    const snapshot = mapDatasetToSnapshot(dataset());
    const planned = snapshot.edges.find((e) => e.id === "netbox:cable:901");

    expect(planned).toBeDefined();
    expect(planned?.data?.status).toBe("planned");
    expect(planned?.data?.animated).toBe(false);
  });

  it("ignores cables that do not connect two interfaces", () => {
    const snapshot = mapDatasetToSnapshot(dataset());

    expect(snapshot.edges.find((e) => e.id === "netbox:cable:902")).toBeUndefined();
  });

  it("summarises VLAN membership on the connector", () => {
    const snapshot = mapDatasetToSnapshot(dataset());

    expect(snapshot.edges.find((e) => e.id === "netbox:cable:900")?.data?.vlan).toBe("2 tagged");
    expect(snapshot.edges.find((e) => e.id === "netbox:cable:901")?.data?.vlan).toBe("OLD");
  });

  it("links a virtual machine to the device backing its cluster", () => {
    const snapshot = mapDatasetToSnapshot(dataset());
    const runsOn = snapshot.edges.find((e) => e.id === "netbox:vm-host:7");

    expect(runsOn?.source).toBe(nodeIdForDevice(2));
    expect(runsOn?.target).toBe(nodeIdForVirtualMachine(7));
    expect(runsOn?.data?.protocol).toBe("virtualization");
  });

  it("never invents metrics or logs for real hardware", () => {
    const snapshot = mapDatasetToSnapshot(dataset());

    for (const node of snapshot.nodes) {
      expect(node.data.details?.metrics).toBeUndefined();
      expect(node.data.details?.logs).toBeUndefined();
    }
    for (const edge of snapshot.edges) {
      expect(edge.data?.trafficMbps).toBeUndefined();
      expect(edge.data?.metrics).toBeUndefined();
    }
  });

  it("produces stable ids across refreshes", () => {
    const first = mapDatasetToSnapshot(dataset(), 1);
    const second = mapDatasetToSnapshot(dataset(), 2);

    expect(first.nodes.map((n) => n.identity.id)).toEqual(second.nodes.map((n) => n.identity.id));
    expect(first.edges.map((e) => e.id)).toEqual(second.edges.map((e) => e.id));
  });

  it("drops edges whose device is outside the fetched set", () => {
    const data = dataset();
    data.devices = data.devices.filter((d) => d.id !== 3);
    const snapshot = mapDatasetToSnapshot(data);

    expect(snapshot.edges.find((e) => e.id === "netbox:cable:901")).toBeUndefined();
  });
});
