import { z } from "zod";
import { NETDASH_PROTOCOL_VERSION } from "../config/protocol";

const assetTypeSchema = z.enum(["hardware", "host", "service"]);
const nodeStatusSchema = z.enum(["up", "down"]);
const certStatusSchema = z.enum(["valid", "expiring", "expired", "unknown"]);
const vpnStatusSchema = z.enum(["connected", "disconnected", "unknown"]);
const logSeveritySchema = z.enum(["info", "warn", "error"]);

const metricPointSchema = z.object({
  ts: z.number(),
  value: z.number(),
  note: z.string().optional(),
});

const metricSeriesSchema = z.object({
  id: z.string(),
  label: z.string(),
  unit: z.string(),
  color: z.string().optional(),
  points: z.array(metricPointSchema),
});

const logEntrySchema = z.object({
  id: z.string(),
  ts: z.number(),
  severity: logSeveritySchema,
  source: z.string(),
  message: z.string(),
});

const connectorEndpointSchema = z.object({
  nodeId: z.string(),
  label: z.string(),
  interfaceLabel: z.string().optional(),
  ipAddresses: z.array(z.string()).optional(),
  dnsNames: z.array(z.string()).optional(),
  physicalPort: z.string().optional(),
  logicalPort: z.string().optional(),
});

const connectorPolicyReferenceSchema = z.object({
  id: z.string(),
  type: z.enum(["firewall", "nat", "routing", "acl"]),
  label: z.string(),
});

const nodeDetailsSchema = z.object({
  localDns: z.string().optional(),
  publicDns: z.string().optional(),
  certStatus: certStatusSchema.optional(),
  vpnStatus: vpnStatusSchema.optional(),
  metrics: z.array(metricSeriesSchema).optional(),
  logs: z.array(logEntrySchema).optional(),
  extensions: z.record(z.unknown()).optional(),
});

const nodeSchema = z.object({
  identity: z.object({
    id: z.string(),
    key: z.string(),
  }),
  type: assetTypeSchema,
  data: z.object({
    name: z.string(),
    ip: z.string(),
    status: nodeStatusSchema,
    assetType: assetTypeSchema,
    details: nodeDetailsSchema.optional(),
  }),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
});

const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  data: z
    .object({
      animated: z.boolean().optional(),
      connectorUuid: z.string().optional(),
      displayName: z.string().optional(),
      protocol: z.string().optional(),
      vlan: z.string().optional(),
      status: z.enum(["connected", "planned", "decommissioning", "unknown"]).optional(),
      sideA: connectorEndpointSchema.optional(),
      sideB: connectorEndpointSchema.optional(),
      policyReferences: z.array(connectorPolicyReferenceSchema).optional(),
      trafficMbps: z.number().optional(),
      packetsPerSec: z.number().optional(),
      trafficOutMbps: z.number().optional(),
      trafficInMbps: z.number().optional(),
      packetsOutPerSec: z.number().optional(),
      packetsInPerSec: z.number().optional(),
      metrics: z.array(metricSeriesSchema).optional(),
      logs: z.array(logEntrySchema).optional(),
      lastUpdated: z.number().optional(),
    })
    .optional(),
});

const baseEnvelopeSchema = z.object({
  protocolVersion: z.literal(NETDASH_PROTOCOL_VERSION),
  ts: z.number(),
});

export const graphSnapshotMessageSchema = baseEnvelopeSchema.extend({
  type: z.literal("graph.snapshot"),
  payload: z.object({
    nodes: z.array(nodeSchema),
    edges: z.array(edgeSchema),
    sequence: z.number().int().nonnegative(),
    ts: z.number(),
  }),
});

export const nodeStatusUpdateMessageSchema = baseEnvelopeSchema.extend({
  type: z.literal("node.status.update"),
  payload: z.object({
    nodeId: z.string(),
    sequence: z.number().int().nonnegative(),
    status: nodeStatusSchema,
    ip: z.string().optional(),
    name: z.string().optional(),
    ts: z.number(),
  }),
});

export const flowMetricUpdateMessageSchema = baseEnvelopeSchema.extend({
  type: z.literal("flow.metric.update"),
  payload: z.object({
    edgeId: z.string(),
    sequence: z.number().int().nonnegative(),
    trafficMbps: z.number(),
    packetsPerSec: z.number(),
    trafficOutMbps: z.number(),
    trafficInMbps: z.number(),
    packetsOutPerSec: z.number(),
    packetsInPerSec: z.number(),
    animated: z.boolean(),
    ts: z.number(),
  }),
});

export const nodeDetailsUpdateMessageSchema = baseEnvelopeSchema.extend({
  type: z.literal("node.details.update"),
  payload: z.object({
    nodeId: z.string(),
    sequence: z.number().int().nonnegative(),
    details: nodeDetailsSchema,
    ts: z.number(),
  }),
});

export const errorMessageSchema = baseEnvelopeSchema.extend({
  type: z.literal("error"),
  payload: z.object({
    message: z.string(),
    code: z.string().optional(),
    recoverable: z.boolean().optional(),
  }),
});

export const wsMessageSchema = z.discriminatedUnion("type", [
  graphSnapshotMessageSchema,
  nodeStatusUpdateMessageSchema,
  flowMetricUpdateMessageSchema,
  nodeDetailsUpdateMessageSchema,
  errorMessageSchema,
]);

export type WsMessageInput = z.infer<typeof wsMessageSchema>;
