import type {
  ConnectorEndpointDetails,
  ConnectorPolicyReference,
  GraphSnapshotPayload,
  NetDashEdge,
  NetDashNode,
  NodeDetails,
  NodeLogEntry,
  NodeMetricSeries,
} from "@netdash/shared";

function lcg(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function createSeededSnapshot(seed = 42): GraphSnapshotPayload {
  const rand = lcg(seed);
  const now = Date.now();

  function buildMetrics(
    labelPrefix: string,
    profile: "hardware" | "host" | "service",
  ): NodeMetricSeries[] {
    const cpuBase = profile === "hardware" ? 38 : profile === "host" ? 54 : 32;
    const trafficBase = profile === "hardware" ? 420 : profile === "host" ? 180 : 70;

    return [
      {
        id: `${labelPrefix}:cpu`,
        label: profile === "service" ? "Request Load" : "CPU Load",
        unit: profile === "service" ? "req/s" : "%",
        color: "var(--edge-activity)",
        points: Array.from({ length: 96 }, (_, index) => {
          const ts = now - (95 - index) * 15 * 60 * 1000;
          const wave = Math.sin(index / 6) * (profile === "service" ? 8 : 14);
          const drift = rand() * (profile === "service" ? 7 : 10);
          const value = profile === "service" ? trafficBase + wave + drift : cpuBase + wave + drift;
          return {
            ts,
            value: Number(value.toFixed(1)),
            note: `${labelPrefix} ${profile === "service" ? "request pressure" : "compute load"}`,
          };
        }),
      },
      {
        id: `${labelPrefix}:network`,
        label: profile === "hardware" ? "Port Throughput" : "Network Throughput",
        unit: "Mbps",
        color: "var(--edge-activity-secondary)",
        points: Array.from({ length: 96 }, (_, index) => {
          const ts = now - (95 - index) * 15 * 60 * 1000;
          const wave = Math.cos(index / 7) * (profile === "hardware" ? 90 : 45);
          const drift = rand() * (profile === "hardware" ? 75 : 28);
          return {
            ts,
            value: Number(Math.max(8, trafficBase + wave + drift).toFixed(1)),
            note: `${labelPrefix} ${profile === "hardware" ? "fabric activity" : "service traffic"}`,
          };
        }),
      },
    ];
  }

  function buildLogs(source: string, lines: string[]): NodeLogEntry[] {
    return lines.map((message, index) => ({
      id: `${source}:log:${index}`,
      ts: now - index * 17 * 60 * 1000,
      severity: index === 0 ? "info" : index === 1 ? "warn" : index === 2 ? "error" : "info",
      source,
      message,
    }));
  }

  function buildEdgeMetrics(labelPrefix: string): NodeMetricSeries[] {
    return [
      {
        id: `${labelPrefix}:throughput`,
        label: "Combined Throughput",
        unit: "Mbps",
        color: "var(--edge-activity)",
        points: Array.from({ length: 72 }, (_, index) => ({
          ts: now - (71 - index) * 20 * 60 * 1000,
          value: Number((18 + Math.sin(index / 5) * 9 + rand() * 11).toFixed(1)),
          note: `${labelPrefix} combined ingress and egress estimate`,
        })),
      },
      {
        id: `${labelPrefix}:pps`,
        label: "Packet Rate",
        unit: "pps",
        color: "var(--edge-activity-secondary)",
        points: Array.from({ length: 72 }, (_, index) => ({
          ts: now - (71 - index) * 20 * 60 * 1000,
          value: Number((400 + Math.cos(index / 6) * 140 + rand() * 120).toFixed(0)),
          note: `${labelPrefix} packet density estimate`,
        })),
      },
    ];
  }

  function buildEdgeLogs(source: string, lines: string[]): NodeLogEntry[] {
    return lines.map((message, index) => ({
      id: `${source}:edge-log:${index}`,
      ts: now - index * 23 * 60 * 1000,
      severity: index === 0 ? "info" : index === 1 ? "warn" : index === 2 ? "error" : "info",
      source,
      message,
    }));
  }

  function endpoint(details: ConnectorEndpointDetails): ConnectorEndpointDetails {
    return details;
  }

  function policy(
    id: string,
    type: ConnectorPolicyReference["type"],
    label: string,
  ): ConnectorPolicyReference {
    return { id, type, label };
  }

  function detailsFor(
    localDns: string,
    publicDns: string | undefined,
    certStatus: NodeDetails["certStatus"],
    vpnStatus: NodeDetails["vpnStatus"],
    profile: "hardware" | "host" | "service",
    logLines: string[],
    extensions?: NodeDetails["extensions"],
  ): NodeDetails {
    return {
      localDns,
      publicDns,
      certStatus,
      vpnStatus,
      metrics: buildMetrics(localDns, profile),
      logs: buildLogs(localDns, logLines),
      ...(extensions ? { extensions } : {}),
    };
  }

  const nodes: NetDashNode[] = [
    {
      identity: { id: "0f33ea8a-04b2-4b58-b021-01b0f22f1001", key: "hardware:mono-gateway-router" },
      type: "hardware",
      data: {
        name: "Mono Gateway Router",
        ip: "192.168.10.1",
        status: "up",
        assetType: "hardware",
        details: detailsFor("gateway.lan", undefined, "unknown", "connected", "hardware", [
          "WireGuard peer sync completed for remote admin access.",
          "WAN latency rose above baseline for 2 minutes.",
          "Packet drop detected on uplink during ISP re-negotiation.",
          "DHCP lease table refreshed for core VLANs.",
        ]),
      },
      position: { x: 120, y: 140 },
    },
    {
      identity: { id: "1d7f27ad-c4e5-44ef-9dc9-a5d356a6d002", key: "hardware:mikrotik-crs309" },
      type: "hardware",
      data: {
        name: "Mikrotik CRS309 Core",
        ip: "192.168.10.2",
        status: "up",
        assetType: "hardware",
        details: detailsFor("crs309.core.lan", undefined, "unknown", "unknown", "hardware", [
          "Port 7 reached 10G burst during NAS backup window.",
          "LLDP neighbor table updated for proxmox-dell and am5-nas.",
          "SFP+ temperature exceeded preferred threshold briefly.",
          "Bridge hardware offload remains enabled on all active trunks.",
        ]),
      },
      position: { x: 380, y: 100 },
    },
    {
      identity: { id: "e9bd4a7c-aec4-4f24-beb6-3f93ec086003", key: "hardware:mikrotik-crs310" },
      type: "hardware",
      data: {
        name: "Mikrotik CRS310",
        ip: "192.168.10.3",
        status: "up",
        assetType: "hardware",
        details: detailsFor("crs310.fabric.lan", undefined, "unknown", "unknown", "hardware", [
          "10G uplink remains clean with no CRC errors.",
          "Proxmox Dell trunk flapped once and recovered in 3 seconds.",
          "MAC table pressure rose during backup traffic fan-out.",
          "RSTP topology remains stable for downstream hosts.",
        ]),
      },
      position: { x: 640, y: 180 },
    },
    {
      identity: { id: "6f2f7bc1-1480-4bc2-a381-52fd3d750004", key: "hardware:zyxel-poe-switch" },
      type: "hardware",
      data: {
        name: "Zyxel 2.5G PoE Switch",
        ip: "192.168.10.4",
        status: rand() > 0.04 ? "up" : "down",
        assetType: "hardware",
        details: detailsFor("zyxel-poe.lan", undefined, "unknown", "unknown", "hardware", [
          "PoE budget at 42% with WiFi 7 AP as primary draw.",
          "Guest SSID VLAN tagging validated on trunk uplink.",
          "One copper port renegotiated to 1G after cable reseat.",
          "AP roaming burst caused short multicast spike.",
        ]),
      },
      position: { x: 720, y: 260 },
    },
    {
      identity: { id: "f6d5556f-2a90-4e11-9db5-91f0f9bf0005", key: "hardware:zyxel-wifi7-ap" },
      type: "hardware",
      data: {
        name: "Zyxel WiFi 7 AP",
        ip: "192.168.10.5",
        status: "up",
        assetType: "hardware",
        details: detailsFor("wifi7-ap.lan", undefined, "unknown", "unknown", "hardware", [
          "Client count peaked at 18 across primary and guest SSIDs.",
          "6 GHz radio channel remained clear during last scan window.",
          "Fast roaming handoff failed once for a mobile client.",
          "PoE negotiation steady after overnight firmware update.",
        ]),
      },
      position: { x: 860, y: 310 },
    },
    {
      identity: { id: "ef9109a2-b0fe-49e9-a6e4-1dbf3a360006", key: "host:proxmox-dell-server" },
      type: "host",
      data: {
        name: "Proxmox Dell Server",
        ip: "192.168.20.10",
        status: rand() > 0.1 ? "up" : "down",
        assetType: "host",
        details: detailsFor("pve-dell.lan", "pve-dell.example.net", "valid", "connected", "host", [
          "VM backup job for Nginx Proxy Manager completed in 4m 12s.",
          "Storage latency warning triggered on local SSD datastore.",
          "Kernel module update requires reboot window review.",
          "QEMU guest agent heartbeat restored for rustdesk instance.",
        ]),
      },
      position: { x: 520, y: 320 },
    },
    {
      identity: { id: "ab34e1d9-8707-4e29-b3ac-3d2abf4c0007", key: "host:proxmox-am5-nas" },
      type: "host",
      data: {
        name: "Proxmox AM5 NAS",
        ip: "192.168.20.20",
        status: "up",
        assetType: "host",
        details: detailsFor("am5-nas.lan", "nas.example.net", "valid", "connected", "host", [
          "ZFS scrub progress at 68% with no checksum errors.",
          "Replication task to offsite target queued for 02:00.",
          "SMB share auth retries increased for media workspace.",
          "NAS cache hit rate steady above 92% during backup burst.",
        ]),
      },
      position: { x: 520, y: 80 },
    },
    {
      identity: { id: "4d0e3425-bf4a-4c52-a2fe-f291b2b50008", key: "service:pihole" },
      type: "service",
      data: {
        name: "Pi-hole",
        ip: "192.168.30.5",
        status: "up",
        assetType: "service",
        details: detailsFor("pihole.internal", undefined, "unknown", "unknown", "service", [
          "Gravity update completed and 184 domains were added to blocklists.",
          "DNS latency exceeded 35 ms for a short interval.",
          "Upstream resolver timeout occurred on secondary path.",
          "DoH fallback remained healthy after timeout recovery.",
        ]),
      },
      position: { x: 820, y: 120 },
    },
    {
      identity: { id: "8ce8a3d9-0dd4-4619-aeb1-e40966190009", key: "service:nginx-proxy-manager" },
      type: "service",
      data: {
        name: "Nginx Proxy Manager",
        ip: "192.168.30.10",
        status: "up",
        assetType: "service",
        details: detailsFor(
          "npm.internal",
          "proxy.example.net",
          "expiring",
          "connected",
          "service",
          [
            "Certificate renewal queued for rustdesk.example.net.",
            "Proxy host 502 detected for pelican panel upstream.",
            "Access log burst suggests recent remote maintenance session.",
            "Fallback host health check returned to normal.",
          ],
        ),
      },
      position: { x: 860, y: 200 },
    },
    {
      identity: { id: "4442d50f-9ef3-4a14-8fa5-d5f919ea0010", key: "service:homeassistant" },
      type: "service",
      data: {
        name: "Home Assistant",
        ip: "192.168.30.20",
        status: "up",
        assetType: "service",
        details: detailsFor("homeassistant.internal", undefined, "unknown", "unknown", "service", [
          "Zigbee coordinator latency spiked during scene import.",
          "Automation queue drained after power-monitor event burst.",
          "Recorder database purge exceeded preferred runtime.",
          "MQTT bridge heartbeat restored after broker reconnect.",
        ]),
      },
      position: { x: 860, y: 40 },
    },
    {
      identity: { id: "e16cc63d-2081-4e38-8ec8-8f6beab10011", key: "service:rustdesk" },
      type: "service",
      data: {
        name: "RustDesk",
        ip: "192.168.30.30",
        status: rand() > 0.08 ? "up" : "down",
        assetType: "service",
        details: detailsFor(
          "rustdesk.internal",
          "rustdesk.example.net",
          "valid",
          "connected",
          "service",
          [
            "Relay session count peaked during evening support window.",
            "Direct NAT traversal failed for one remote peer.",
            "Broker reconnect succeeded after container restart.",
            "TLS handshake duration improved after cipher pruning.",
          ],
        ),
      },
      position: { x: 980, y: 200 },
    },
    {
      // An unmanaged switch: it forwards the management VLAN but has no CPU or
      // IP to probe, so it lives in the third status (`unmanaged`) - present,
      // but neither up nor down in the monitored sense.
      identity: { id: "b2a9f4c7-6d1e-4c8a-9f2b-7c0e1a5d0012", key: "hardware:dlink-dgs108" },
      type: "hardware",
      data: {
        name: "D-Link DGS-108",
        ip: "",
        status: "unmanaged",
        assetType: "hardware",
        details: detailsFor(
          "dgs108.mgmt.lan",
          undefined,
          "unknown",
          "unknown",
          "hardware",
          [
            "Passive management-VLAN switch; no telemetry available.",
            "Uplinks the core switch to several management interfaces.",
          ],
          {
            source: "mock",
            objectType: "dcim.device",
            unmanaged: true,
            role: "Access Switch",
            model: "DGS-108",
            manufacturer: "D-Link",
            description: "8-port unmanaged gigabit switch carrying the management VLAN.",
          },
        ),
      },
      position: { x: 520, y: 40 },
    },
  ];

  const edges: NetDashEdge[] = [
    {
      id: "edge:gateway-router->crs309",
      source: nodes[0].identity.id,
      target: nodes[1].identity.id,
      data: {
        animated: true,
        connectorUuid: "7200d0b8-8e1b-4a26-a1d7-31fd0a430101",
        displayName: "Gateway uplink to CRS309",
        protocol: "Layer3 / Trunk",
        vlan: "core-transit",
        sideA: endpoint({
          nodeId: nodes[0].identity.id,
          label: nodes[0].data.name,
          interfaceLabel: "bond0",
          ipAddresses: ["192.168.10.1/24"],
          dnsNames: ["gateway.lan"],
          physicalPort: "SFP+ 1",
          logicalPort: "transit.core",
        }),
        sideB: endpoint({
          nodeId: nodes[1].identity.id,
          label: nodes[1].data.name,
          interfaceLabel: "ether7",
          ipAddresses: ["192.168.10.2/24"],
          dnsNames: ["crs309.core.lan"],
          physicalPort: "SFP+ 7",
          logicalPort: "bridge-core",
        }),
        policyReferences: [
          policy("fw-core-allow-01", "firewall", "Core transit allowlist"),
          policy("route-core-default", "routing", "Default edge route"),
        ],
        trafficOutMbps: Number((10 + rand() * 80).toFixed(2)),
        trafficInMbps: Number((10 + rand() * 60).toFixed(2)),
        packetsOutPerSec: Number((400 + rand() * 1600).toFixed(0)),
        packetsInPerSec: Number((500 + rand() * 1400).toFixed(0)),
        metrics: buildEdgeMetrics("gateway-crs309"),
        logs: buildEdgeLogs("gateway-crs309", [
          "Transit policy synchronized after router config reload.",
          "Short burst detected on core uplink during nightly backups.",
          "Ingress shaping rule triggered for maintenance traffic.",
          "Link remained stable after WAN failover test.",
        ]),
        trafficMbps: 0,
        packetsPerSec: 0,
        lastUpdated: Date.now(),
      },
    },
    {
      id: "edge:crs309->crs310",
      source: nodes[1].identity.id,
      target: nodes[2].identity.id,
      data: {
        animated: true,
        connectorUuid: "9ac5b8fb-a8f3-4a7d-8088-98ac2d3f0102",
        displayName: "CRS309 fabric uplink to CRS310",
        protocol: "Switch Fabric",
        vlan: "mgmt,trunk,service",
        sideA: endpoint({
          nodeId: nodes[1].identity.id,
          label: nodes[1].data.name,
          interfaceLabel: "sfp-sfpplus2",
          ipAddresses: ["192.168.10.2/24"],
          dnsNames: ["crs309.core.lan"],
          physicalPort: "SFP+ 2",
          logicalPort: "fabric-trunk-a",
        }),
        sideB: endpoint({
          nodeId: nodes[2].identity.id,
          label: nodes[2].data.name,
          interfaceLabel: "sfp-sfpplus1",
          ipAddresses: ["192.168.10.3/24"],
          dnsNames: ["crs310.fabric.lan"],
          physicalPort: "SFP+ 1",
          logicalPort: "fabric-trunk-b",
        }),
        policyReferences: [policy("acl-fabric-02", "acl", "Fabric management ACL")],
        trafficOutMbps: Number((12 + rand() * 32).toFixed(2)),
        trafficInMbps: Number((10 + rand() * 28).toFixed(2)),
        packetsOutPerSec: Number((250 + rand() * 950).toFixed(0)),
        packetsInPerSec: Number((220 + rand() * 850).toFixed(0)),
        metrics: buildEdgeMetrics("crs309-crs310"),
        logs: buildEdgeLogs("crs309-crs310", [
          "Inter-switch trunk remained healthy during topology rebalance.",
          "MAC churn briefly increased during service migration.",
          "Packet pacing rule engaged for large replication flow.",
        ]),
        trafficMbps: 0,
        packetsPerSec: 0,
        lastUpdated: Date.now(),
      },
    },
    {
      id: "edge:crs309->zyxel-poe",
      source: nodes[1].identity.id,
      target: nodes[3].identity.id,
      data: {
        animated: true,
        connectorUuid: "ee08efb6-d8fb-4979-a41d-d64554890103",
        displayName: "CRS309 downlink to Zyxel PoE",
        protocol: "Switch Trunk",
        vlan: "core,guest,wireless",
        sideA: endpoint({
          nodeId: nodes[1].identity.id,
          label: nodes[1].data.name,
          interfaceLabel: "ether9",
          ipAddresses: ["192.168.10.2/24"],
          dnsNames: ["crs309.core.lan"],
          physicalPort: "RJ45 9",
          logicalPort: "wireless-trunk-a",
        }),
        sideB: endpoint({
          nodeId: nodes[3].identity.id,
          label: nodes[3].data.name,
          interfaceLabel: "uplink1",
          ipAddresses: ["192.168.10.4/24"],
          dnsNames: ["zyxel-poe.lan"],
          physicalPort: "2.5G Port 1",
          logicalPort: "poe-fabric",
        }),
        policyReferences: [policy("fw-wireless-01", "firewall", "Wireless VLAN allowlist")],
        trafficOutMbps: Number((6 + rand() * 18).toFixed(2)),
        trafficInMbps: Number((4 + rand() * 12).toFixed(2)),
        packetsOutPerSec: Number((170 + rand() * 650).toFixed(0)),
        packetsInPerSec: Number((150 + rand() * 520).toFixed(0)),
        metrics: buildEdgeMetrics("crs309-zyxel-poe"),
        logs: buildEdgeLogs("crs309-zyxel-poe", [
          "Trunk permits guest and primary SSID VLANs.",
          "Short broadcast burst observed during AP adoption refresh.",
          "PoE switch uplink remained stable through configuration push.",
        ]),
        trafficMbps: 0,
        packetsPerSec: 0,
        lastUpdated: Date.now(),
      },
    },
    {
      id: "edge:zyxel-poe->wifi7-ap",
      source: nodes[3].identity.id,
      target: nodes[4].identity.id,
      data: {
        animated: true,
        connectorUuid: "b8f0e95a-9de2-46d7-9b72-88c23dfa0104",
        displayName: "PoE uplink to WiFi 7 AP",
        protocol: "Access + Mgmt",
        vlan: "wireless-mgmt,guest,primary",
        sideA: endpoint({
          nodeId: nodes[3].identity.id,
          label: nodes[3].data.name,
          interfaceLabel: "poe7",
          ipAddresses: ["192.168.10.4/24"],
          dnsNames: ["zyxel-poe.lan"],
          physicalPort: "PoE 7",
          logicalPort: "ap-edge",
        }),
        sideB: endpoint({
          nodeId: nodes[4].identity.id,
          label: nodes[4].data.name,
          interfaceLabel: "eth0",
          ipAddresses: ["192.168.10.5/24"],
          dnsNames: ["wifi7-ap.lan"],
          physicalPort: "2.5G Ethernet",
          logicalPort: "wireless-uplink",
        }),
        policyReferences: [policy("acl-ap-guest-07", "acl", "Guest SSID isolation policy")],
        trafficOutMbps: Number((2 + rand() * 8).toFixed(2)),
        trafficInMbps: Number((3 + rand() * 10).toFixed(2)),
        packetsOutPerSec: Number((120 + rand() * 360).toFixed(0)),
        packetsInPerSec: Number((180 + rand() * 440).toFixed(0)),
        trafficMbps: 0,
        packetsPerSec: 0,
        lastUpdated: Date.now(),
      },
    },
    {
      id: "edge:crs310->pve-dell",
      source: nodes[2].identity.id,
      target: nodes[5].identity.id,
      data: {
        animated: true,
        trafficOutMbps: Number((22 + rand() * 70).toFixed(2)),
        trafficInMbps: Number((18 + rand() * 55).toFixed(2)),
        packetsOutPerSec: Number((550 + rand() * 1800).toFixed(0)),
        packetsInPerSec: Number((420 + rand() * 1400).toFixed(0)),
        trafficMbps: 0,
        packetsPerSec: 0,
        lastUpdated: Date.now(),
      },
    },
    {
      id: "edge:crs309->am5-nas",
      source: nodes[1].identity.id,
      target: nodes[6].identity.id,
      data: {
        animated: true,
        trafficOutMbps: Number((34 + rand() * 95).toFixed(2)),
        trafficInMbps: Number((28 + rand() * 84).toFixed(2)),
        packetsOutPerSec: Number((760 + rand() * 2200).toFixed(0)),
        packetsInPerSec: Number((690 + rand() * 2100).toFixed(0)),
        trafficMbps: 0,
        packetsPerSec: 0,
        lastUpdated: Date.now(),
      },
    },
    {
      id: "edge:pve-dell->pihole",
      source: nodes[5].identity.id,
      target: nodes[7].identity.id,
      data: {
        animated: true,
        trafficOutMbps: Number((3 + rand() * 9).toFixed(2)),
        trafficInMbps: Number((2 + rand() * 7).toFixed(2)),
        packetsOutPerSec: Number((90 + rand() * 260).toFixed(0)),
        packetsInPerSec: Number((80 + rand() * 230).toFixed(0)),
        trafficMbps: 0,
        packetsPerSec: 0,
        lastUpdated: Date.now(),
      },
    },
    {
      id: "edge:pve-dell->nginx-proxy-manager",
      source: nodes[5].identity.id,
      target: nodes[8].identity.id,
      data: {
        animated: true,
        trafficOutMbps: Number((8 + rand() * 20).toFixed(2)),
        trafficInMbps: Number((6 + rand() * 16).toFixed(2)),
        packetsOutPerSec: Number((210 + rand() * 600).toFixed(0)),
        packetsInPerSec: Number((180 + rand() * 520).toFixed(0)),
        trafficMbps: 0,
        packetsPerSec: 0,
        lastUpdated: Date.now(),
      },
    },
    {
      id: "edge:am5-nas->homeassistant",
      source: nodes[6].identity.id,
      target: nodes[9].identity.id,
      data: {
        animated: true,
        trafficOutMbps: Number((4 + rand() * 11).toFixed(2)),
        trafficInMbps: Number((3 + rand() * 10).toFixed(2)),
        packetsOutPerSec: Number((140 + rand() * 340).toFixed(0)),
        packetsInPerSec: Number((120 + rand() * 280).toFixed(0)),
        trafficMbps: 0,
        packetsPerSec: 0,
        lastUpdated: Date.now(),
      },
    },
    {
      id: "edge:nginx-proxy-manager->rustdesk",
      source: nodes[8].identity.id,
      target: nodes[10].identity.id,
      data: {
        animated: true,
        trafficOutMbps: Number((6 + rand() * 16).toFixed(2)),
        trafficInMbps: Number((5 + rand() * 15).toFixed(2)),
        packetsOutPerSec: Number((160 + rand() * 440).toFixed(0)),
        packetsInPerSec: Number((150 + rand() * 420).toFixed(0)),
        trafficMbps: 0,
        packetsPerSec: 0,
        lastUpdated: Date.now(),
      },
    },
    {
      // Planned 10G storage uplink that has not been cabled yet: modelled so the
      // topology can show what is coming, drawn dashed with no traffic.
      id: "edge:crs310->am5-nas-planned",
      source: nodes[2].identity.id,
      target: nodes[6].identity.id,
      data: {
        animated: false,
        status: "planned",
        connectorUuid: "planned-000-0000-0000-000000000210",
        displayName: "Planned 10G storage uplink (CRS310 to AM5 NAS)",
        protocol: "Layer2 / Access",
        vlan: "storage",
        sideA: endpoint({
          nodeId: nodes[2].identity.id,
          label: nodes[2].data.name,
          interfaceLabel: "sfp-sfpplus4",
          physicalPort: "SFP+ 4",
          logicalPort: "storage-access",
        }),
        sideB: endpoint({
          nodeId: nodes[6].identity.id,
          label: nodes[6].data.name,
          interfaceLabel: "enp2s0",
          physicalPort: "SFP+ 1",
          logicalPort: "storage-access",
        }),
        lastUpdated: Date.now(),
      },
    },
    {
      // Management-VLAN uplink to the unmanaged switch. It carries traffic, but
      // the switch itself can't be monitored - the node, not the link, is what
      // shows the `unmanaged` state.
      id: "edge:crs309->dgs108",
      source: nodes[1].identity.id,
      target: nodes[11].identity.id,
      data: {
        animated: true,
        connectorUuid: "7200d0b8-8e1b-4a26-a1d7-31fd0a430011",
        displayName: "CRS309 management uplink to DGS-108",
        protocol: "Layer2 / Access",
        vlan: "mgmt",
        status: "connected",
        sideA: endpoint({
          nodeId: nodes[1].identity.id,
          label: nodes[1].data.name,
          interfaceLabel: "ether8",
          physicalPort: "Ether 8",
          logicalPort: "mgmt-access",
        }),
        sideB: endpoint({
          nodeId: nodes[11].identity.id,
          label: nodes[11].data.name,
          interfaceLabel: "port1",
          physicalPort: "Port 1",
          logicalPort: "mgmt-access",
        }),
        trafficOutMbps: Number((1 + rand() * 4).toFixed(2)),
        trafficInMbps: Number((1 + rand() * 3).toFixed(2)),
        packetsOutPerSec: Number((40 + rand() * 120).toFixed(0)),
        packetsInPerSec: Number((30 + rand() * 100).toFixed(0)),
        trafficMbps: 0,
        packetsPerSec: 0,
        lastUpdated: Date.now(),
      },
    },
    {
      // Logical layer: a service dependency, not a cable. Home Assistant resolves
      // names via Pi-hole. Drawn on the logical view, never carries bandwidth.
      id: "edge:homeassistant->pihole-dns",
      source: nodes[9].identity.id,
      target: nodes[7].identity.id,
      data: {
        layer: "logical",
        status: "connected",
        connectorUuid: "logical-dns-ha-pihole",
        displayName: "Home Assistant resolves DNS via Pi-hole",
        protocol: "DNS",
        lastUpdated: Date.now(),
      },
    },
    {
      // Logical layer: reverse-proxy publication.
      id: "edge:nginx-proxy-manager->homeassistant-proxy",
      source: nodes[8].identity.id,
      target: nodes[9].identity.id,
      data: {
        layer: "logical",
        status: "connected",
        connectorUuid: "logical-proxy-npm-ha",
        displayName: "Nginx Proxy Manager publishes Home Assistant",
        protocol: "reverse-proxy",
        lastUpdated: Date.now(),
      },
    },
    {
      // Logical layer: a workload running on a host (the "runs on" relationship
      // NetBox models for VMs).
      id: "edge:proxmox-dell->pihole-runs",
      source: nodes[5].identity.id,
      target: nodes[7].identity.id,
      data: {
        layer: "logical",
        status: "connected",
        connectorUuid: "logical-runs-pve-pihole",
        displayName: "Proxmox Dell Server runs Pi-hole",
        protocol: "virtualization",
        lastUpdated: Date.now(),
      },
    },
  ];

  for (const edge of edges) {
    if (!edge.data) {
      continue;
    }
    edge.data.trafficMbps = Number(
      ((edge.data.trafficOutMbps ?? 0) + (edge.data.trafficInMbps ?? 0)).toFixed(2),
    );
    edge.data.packetsPerSec = Number(
      ((edge.data.packetsOutPerSec ?? 0) + (edge.data.packetsInPerSec ?? 0)).toFixed(0),
    );
  }

  return {
    nodes,
    edges,
    sequence: 1,
    ts: Date.now(),
  };
}
