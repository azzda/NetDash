import type {
  AssetType,
  ConnectorEndpointDetails,
  GraphSnapshotPayload,
  NetDashEdge,
  NetDashEdgeData,
  NetDashNode,
  NodeStatus,
} from "@netdash/shared";
import type {
  NetBoxCable,
  NetBoxDataset,
  NetBoxDevice,
  NetBoxInterface,
  NetBoxIpAddress,
} from "./types";

/**
 * Device roles that represent compute rather than network fabric. Everything
 * else (switches, routers, firewalls, APs) is drawn as hardware.
 */
const HOST_ROLES = new Set(["hypervisor", "workstation", "storage", "nas", "server"]);

/** NetBox statuses that mean "this is carrying traffic right now". */
const LIVE_STATUSES = new Set(["active", "connected"]);

export function nodeIdForDevice(id: number): string {
  return `netbox:device:${id}`;
}

export function nodeIdForVirtualMachine(id: number): string {
  return `netbox:vm:${id}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function statusOf(value: string | undefined): NodeStatus {
  return value && LIVE_STATUSES.has(value) ? "up" : "down";
}

function stripMask(address: string | undefined | null): string {
  return address ? address.split("/")[0] : "";
}

function assetTypeForDevice(device: NetBoxDevice): AssetType {
  const role = device.role?.slug ?? "";
  return HOST_ROLES.has(role) ? "host" : "hardware";
}

function vlanLabel(iface: NetBoxInterface | undefined): string | undefined {
  if (!iface) {
    return undefined;
  }
  const untagged = iface.untagged_vlan;
  const tagged = iface.tagged_vlans ?? [];
  if (untagged && tagged.length) {
    return `${untagged.name ?? untagged.vid} + ${tagged.length} tagged`;
  }
  if (untagged) {
    return String(untagged.name ?? untagged.vid ?? "");
  }
  if (tagged.length) {
    return `${tagged.length} tagged`;
  }
  return undefined;
}

/**
 * Turn a NetBox dataset into a NetDash graph.
 *
 * Pure by design: no clock beyond the timestamp passed in, no network. That is
 * what makes the mapping testable against recorded payloads.
 *
 * Note what is deliberately absent: metrics and logs. NetBox knows structure,
 * not state - traffic and health come from Prometheus/Loki later. Fabricating
 * numbers here would put invented load on real hardware.
 */
export function mapDatasetToSnapshot(
  dataset: NetBoxDataset,
  now = Date.now(),
): GraphSnapshotPayload {
  const { devices, virtualMachines, clusters, interfaces, cables, ipAddresses } = dataset;

  const interfacesById = new Map<number, NetBoxInterface>(interfaces.map((i) => [i.id, i]));

  // IPs are attached to interfaces; index them so an endpoint can list its own.
  const ipsByInterfaceId = new Map<number, NetBoxIpAddress[]>();
  for (const ip of ipAddresses) {
    if (ip.assigned_object_type !== "dcim.interface" || !ip.assigned_object_id) {
      continue;
    }
    const list = ipsByInterfaceId.get(ip.assigned_object_id) ?? [];
    list.push(ip);
    ipsByInterfaceId.set(ip.assigned_object_id, list);
  }

  const nodes: NetDashNode[] = [];
  const deviceNodeIds = new Map<number, string>();

  for (const device of devices) {
    const name = device.name ?? device.display ?? `device-${device.id}`;
    const assetType = assetTypeForDevice(device);
    const id = nodeIdForDevice(device.id);
    deviceNodeIds.set(device.id, id);

    // A device tagged `unmanaged` has no management plane to probe (an unmanaged
    // switch, a dumb PDU). It is not up/down in the monitored sense - it just
    // exists. Marking it as such stops the live layer from ever calling it dead.
    const unmanaged = (device.tags ?? []).some((tag) => tag.slug === "unmanaged");

    nodes.push({
      identity: { id, key: `${assetType}:${slugify(name)}` },
      type: assetType,
      data: {
        name,
        ip: stripMask(device.primary_ip4?.address),
        status: unmanaged ? "unmanaged" : statusOf(device.status?.value),
        assetType,
        details: {
          certStatus: "unknown",
          vpnStatus: "unknown",
          // The raw NetBox facts. `status` matters: NetDash only models up/down,
          // but "planned" and "offline" are very different kinds of "down".
          extensions: {
            source: "netbox",
            objectType: "dcim.device",
            objectId: device.id,
            status: device.status?.value,
            statusLabel: device.status?.label,
            unmanaged: unmanaged || undefined,
            role: device.role?.name,
            model: device.device_type?.model ?? device.device_type?.display,
            manufacturer: device.device_type?.manufacturer?.name,
            serial: device.serial || undefined,
            site: device.site?.name,
            rack: device.rack?.name,
            tenant: device.tenant?.name,
            description: device.description || undefined,
          },
        },
      },
      // Positions are recomputed client-side by the Dagre layout.
      position: { x: 0, y: 0 },
    });
  }

  // A VM is drawn on the hypervisor that runs its cluster, so it is not an
  // orphan in the graph.
  const clusterToDeviceId = new Map<number, number>();
  for (const device of devices) {
    if (device.cluster?.id != null) {
      clusterToDeviceId.set(device.cluster.id, device.id);
    }
  }
  const clusterNames = new Map(clusters.map((c) => [c.id, c.name]));

  for (const vm of virtualMachines) {
    const id = nodeIdForVirtualMachine(vm.id);
    nodes.push({
      identity: { id, key: `host:${slugify(vm.name)}` },
      type: "host",
      data: {
        name: vm.name,
        ip: stripMask(vm.primary_ip4?.address),
        status: statusOf(vm.status?.value),
        assetType: "host",
        details: {
          certStatus: "unknown",
          vpnStatus: "unknown",
          extensions: {
            source: "netbox",
            objectType: "virtualization.virtualmachine",
            objectId: vm.id,
            status: vm.status?.value,
            statusLabel: vm.status?.label,
            cluster: vm.cluster ? clusterNames.get(vm.cluster.id) : undefined,
            vcpus: vm.vcpus ?? undefined,
            memoryMiB: vm.memory ?? undefined,
            diskGiB: vm.disk ?? undefined,
            tenant: vm.tenant?.name,
            description: vm.description || undefined,
          },
        },
      },
      position: { x: 0, y: 0 },
    });
  }

  const knownNodeIds = new Set(nodes.map((n) => n.identity.id));
  const nodeNames = new Map(nodes.map((n) => [n.identity.id, n.data.name]));

  const edges: NetDashEdge[] = [];

  for (const cable of cables) {
    const edge = mapCable(cable, {
      interfacesById,
      ipsByInterfaceId,
      deviceNodeIds,
      nodeNames,
      now,
    });
    if (edge && knownNodeIds.has(edge.source) && knownNodeIds.has(edge.target)) {
      edges.push(edge);
    }
  }

  // "runs on" links: VM -> the hypervisor device backing its cluster.
  for (const vm of virtualMachines) {
    const hostDeviceId = vm.cluster ? clusterToDeviceId.get(vm.cluster.id) : undefined;
    if (hostDeviceId == null) {
      continue;
    }
    const source = deviceNodeIds.get(hostDeviceId);
    const target = nodeIdForVirtualMachine(vm.id);
    if (!source || !knownNodeIds.has(source)) {
      continue;
    }
    edges.push({
      id: `netbox:vm-host:${vm.id}`,
      source,
      target,
      data: {
        animated: false,
        connectorUuid: `vm-${vm.id}`,
        displayName: `${nodeNames.get(source) ?? "host"} runs ${vm.name}`,
        protocol: "virtualization",
        status: "connected",
        layer: "logical",
        lastUpdated: now,
      },
    });
  }

  return { nodes, edges, sequence: 1, ts: now };
}

interface CableContext {
  interfacesById: Map<number, NetBoxInterface>;
  ipsByInterfaceId: Map<number, NetBoxIpAddress[]>;
  deviceNodeIds: Map<number, string>;
  nodeNames: Map<string, string>;
  now: number;
}

function mapCable(cable: NetBoxCable, ctx: CableContext): NetDashEdge | null {
  const a = terminationInterface(cable.a_terminations, ctx);
  const b = terminationInterface(cable.b_terminations, ctx);
  if (!a || !b) {
    // Cables to non-interface terminations (power, console) are not topology.
    return null;
  }

  const sideA = endpointFor(a, ctx);
  const sideB = endpointFor(b, ctx);
  if (!sideA || !sideB) {
    return null;
  }

  const status = cable.status?.value ?? "connected";
  const label = cable.label || `cable-${cable.id}`;

  const data: NetDashEdgeData = {
    // Only a live link should animate; a planned run has no traffic to show.
    animated: LIVE_STATUSES.has(status),
    connectorUuid: label,
    displayName: `${sideA.label}:${sideA.interfaceLabel} - ${sideB.label}:${sideB.interfaceLabel}`,
    protocol: cable.type ?? undefined,
    vlan: vlanLabel(a.iface) ?? vlanLabel(b.iface),
    status: status === "connected" ? "connected" : status === "planned" ? "planned" : "unknown",
    layer: "physical",
    sideA,
    sideB,
    lastUpdated: ctx.now,
  };

  return {
    id: `netbox:cable:${cable.id}`,
    source: sideA.nodeId,
    target: sideB.nodeId,
    data,
  };
}

function terminationInterface(
  terminations: NetBoxCable["a_terminations"],
  ctx: CableContext,
): { iface: NetBoxInterface; deviceId: number } | null {
  for (const termination of terminations) {
    if (termination.object_type !== "dcim.interface") {
      continue;
    }
    const iface =
      ctx.interfacesById.get(termination.object_id) ??
      (termination.object
        ? ({
            id: termination.object.id,
            name: termination.object.name ?? "",
            device: termination.object.device ?? { id: 0 },
          } as NetBoxInterface)
        : undefined);
    if (iface?.device?.id) {
      return { iface, deviceId: iface.device.id };
    }
  }
  return null;
}

function endpointFor(
  side: { iface: NetBoxInterface; deviceId: number },
  ctx: CableContext,
): (ConnectorEndpointDetails & { interfaceLabel: string }) | null {
  const nodeId = ctx.deviceNodeIds.get(side.deviceId);
  if (!nodeId) {
    return null;
  }

  const ips = ctx.ipsByInterfaceId.get(side.iface.id) ?? [];
  return {
    nodeId,
    label: ctx.nodeNames.get(nodeId) ?? side.iface.device?.name ?? "unknown",
    interfaceLabel: side.iface.name,
    ipAddresses: ips.map((ip) => ip.address),
    dnsNames: ips.map((ip) => ip.dns_name).filter((name): name is string => Boolean(name)),
    physicalPort: side.iface.type?.label,
    logicalPort: side.iface.untagged_vlan?.name ?? undefined,
  };
}
