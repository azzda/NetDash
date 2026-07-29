export type AssetType = "hardware" | "host" | "service";

export type TrafficMode = "off" | "combined" | "bidirectional";

export type NodeStatus = "up" | "down";

export type CertStatus = "valid" | "expiring" | "expired" | "unknown";

export type VpnStatus = "connected" | "disconnected" | "unknown";

export type LogSeverity = "info" | "warn" | "error";

export interface NodeIdentity {
  id: string;
  key: string;
}

export interface NodeMetricPoint {
  ts: number;
  value: number;
  note?: string;
}

export interface NodeMetricSeries {
  id: string;
  label: string;
  unit: string;
  color?: string;
  points: NodeMetricPoint[];
}

export interface NodeLogEntry {
  id: string;
  ts: number;
  severity: LogSeverity;
  source: string;
  message: string;
}

export interface ConnectorEndpointDetails {
  nodeId: string;
  label: string;
  interfaceLabel?: string;
  ipAddresses?: string[];
  dnsNames?: string[];
  physicalPort?: string;
  logicalPort?: string;
}

export interface ConnectorPolicyReference {
  id: string;
  type: "firewall" | "nat" | "routing" | "acl";
  label: string;
}

export interface NodeDetails {
  localDns?: string;
  publicDns?: string;
  certStatus?: CertStatus;
  vpnStatus?: VpnStatus;
  metrics?: NodeMetricSeries[];
  logs?: NodeLogEntry[];
  // Future integration fields (ntopng/auth/reverse proxy)
  extensions?: Record<string, unknown>;
}

export interface NetDashNodeData {
  name: string;
  ip: string;
  status: NodeStatus;
  assetType: AssetType;
  details?: NodeDetails;
}

export interface NetDashNode {
  identity: NodeIdentity;
  type: AssetType;
  data: NetDashNodeData;
  position: {
    x: number;
    y: number;
  };
}

export type ConnectorStatus = "connected" | "planned" | "decommissioning" | "unknown";

export interface NetDashEdgeData {
  animated?: boolean;
  connectorUuid?: string;
  displayName?: string;
  protocol?: string;
  vlan?: string;
  /**
   * Whether the link physically exists. A source of truth like NetBox models
   * planned cabling alongside live cabling, and the difference matters: the
   * graph should be able to show what is coming, not just what is.
   */
  status?: ConnectorStatus;
  sideA?: ConnectorEndpointDetails;
  sideB?: ConnectorEndpointDetails;
  policyReferences?: ConnectorPolicyReference[];
  trafficMbps?: number;
  packetsPerSec?: number;
  trafficOutMbps?: number;
  trafficInMbps?: number;
  packetsOutPerSec?: number;
  packetsInPerSec?: number;
  metrics?: NodeMetricSeries[];
  logs?: NodeLogEntry[];
  lastUpdated?: number;
}

export interface NetDashEdge {
  id: string;
  source: string;
  target: string;
  data?: NetDashEdgeData;
}
