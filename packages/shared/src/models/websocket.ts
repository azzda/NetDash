import type {
  NetDashEdge,
  NetDashNode,
  NodeDetails,
  NodeStatus,
} from "./graph";

export type WsEventType =
  | "graph.snapshot"
  | "node.status.update"
  | "flow.metric.update"
  | "node.details.update"
  | "error";

export interface GraphSnapshotPayload {
  nodes: NetDashNode[];
  edges: NetDashEdge[];
  sequence: number;
  ts: number;
}

export interface NodeStatusUpdatePayload {
  nodeId: string;
  sequence: number;
  status: NodeStatus;
  ip?: string;
  name?: string;
  ts: number;
}

export interface FlowMetricUpdatePayload {
  edgeId: string;
  sequence: number;
  trafficMbps: number;
  packetsPerSec: number;
  trafficOutMbps: number;
  trafficInMbps: number;
  packetsOutPerSec: number;
  packetsInPerSec: number;
  animated: boolean;
  ts: number;
}

export interface NodeDetailsUpdatePayload {
  nodeId: string;
  sequence: number;
  details: NodeDetails;
  ts: number;
}

export interface ErrorPayload {
  message: string;
  code?: string;
  recoverable?: boolean;
}

export interface WsMessageEnvelope<
  TType extends WsEventType,
  TPayload,
  TVersion extends string = string,
> {
  protocolVersion: TVersion;
  type: TType;
  payload: TPayload;
  ts: number;
}

export type NetDashWsMessage =
  | WsMessageEnvelope<"graph.snapshot", GraphSnapshotPayload>
  | WsMessageEnvelope<"node.status.update", NodeStatusUpdatePayload>
  | WsMessageEnvelope<"flow.metric.update", FlowMetricUpdatePayload>
  | WsMessageEnvelope<"node.details.update", NodeDetailsUpdatePayload>
  | WsMessageEnvelope<"error", ErrorPayload>;
