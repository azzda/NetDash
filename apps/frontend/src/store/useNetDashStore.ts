import { create } from "zustand";
import type { NetDashEdge, NetDashNode, NetDashWsMessage } from "@netdash/shared";

interface SequenceState {
  node: Record<string, number>;
  edge: Record<string, number>;
}

interface NetDashStore {
  nodes: NetDashNode[];
  edges: NetDashEdge[];
  selectedNodeId?: string;
  selectedEdgeId?: string;
  sequences: SequenceState;
  applyMessage: (message: NetDashWsMessage) => void;
  setSelectedNode: (nodeId?: string) => void;
  setSelectedEdge: (edgeId?: string) => void;
  clearSelection: () => void;
}

export const useNetDashStore = create<NetDashStore>((set) => ({
  nodes: [],
  edges: [],
  sequences: { node: {}, edge: {} },
  selectedNodeId: undefined,
  selectedEdgeId: undefined,
  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId, selectedEdgeId: undefined }),
  setSelectedEdge: (edgeId) => set({ selectedEdgeId: edgeId, selectedNodeId: undefined }),
  clearSelection: () => set({ selectedNodeId: undefined, selectedEdgeId: undefined }),
  applyMessage: (message) => {
    set((state) => {
      if (message.type === "graph.snapshot") {
        const nextNodeSeq: Record<string, number> = {};
        const nextEdgeSeq: Record<string, number> = {};

        for (const node of message.payload.nodes) {
          nextNodeSeq[node.identity.id] = message.payload.sequence;
        }

        for (const edge of message.payload.edges) {
          nextEdgeSeq[edge.id] = message.payload.sequence;
        }

        return {
          nodes: message.payload.nodes,
          edges: message.payload.edges,
          selectedNodeId: state.selectedNodeId,
          selectedEdgeId: state.selectedEdgeId,
          sequences: { node: nextNodeSeq, edge: nextEdgeSeq },
        };
      }

      if (message.type === "node.status.update") {
        const prev = state.sequences.node[message.payload.nodeId] ?? 0;
        if (message.payload.sequence <= prev) {
          return state;
        }

        return {
          nodes: state.nodes.map((node) =>
            node.identity.id === message.payload.nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    status: message.payload.status,
                    ip: message.payload.ip ?? node.data.ip,
                    name: message.payload.name ?? node.data.name,
                  },
                }
              : node,
          ),
          sequences: {
            ...state.sequences,
            node: {
              ...state.sequences.node,
              [message.payload.nodeId]: message.payload.sequence,
            },
          },
        };
      }

      if (message.type === "flow.metric.update") {
        const prev = state.sequences.edge[message.payload.edgeId] ?? 0;
        if (message.payload.sequence <= prev) {
          return state;
        }

        return {
          edges: state.edges.map((edge) =>
            edge.id === message.payload.edgeId
              ? {
                  ...edge,
                  data: {
                    ...edge.data,
                    animated: message.payload.animated,
                    trafficMbps: message.payload.trafficMbps,
                    packetsPerSec: message.payload.packetsPerSec,
                    trafficOutMbps: message.payload.trafficOutMbps,
                    trafficInMbps: message.payload.trafficInMbps,
                    packetsOutPerSec: message.payload.packetsOutPerSec,
                    packetsInPerSec: message.payload.packetsInPerSec,
                    lastUpdated: message.payload.ts,
                  },
                }
              : edge,
          ),
          sequences: {
            ...state.sequences,
            edge: {
              ...state.sequences.edge,
              [message.payload.edgeId]: message.payload.sequence,
            },
          },
        };
      }

      if (message.type === "node.details.update") {
        const prev = state.sequences.node[message.payload.nodeId] ?? 0;
        if (message.payload.sequence <= prev) {
          return state;
        }

        return {
          nodes: state.nodes.map((node) =>
            node.identity.id === message.payload.nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    details: {
                      ...node.data.details,
                      ...message.payload.details,
                    },
                  },
                }
              : node,
          ),
          sequences: {
            ...state.sequences,
            node: {
              ...state.sequences.node,
              [message.payload.nodeId]: message.payload.sequence,
            },
          },
        };
      }

      return state;
    });
  },
}));
