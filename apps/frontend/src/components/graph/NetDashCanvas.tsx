import dagre from "dagre";
import ReactFlow, {
  Background,
  type EdgeMouseHandler,
  Panel,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type OnEdgesChange,
  type OnNodesChange,
} from "reactflow";
import type { NetDashEdge, NetDashNode, NetDashNodeData, TrafficMode } from "@netdash/shared";
import { HardwareNode, HostNode, ServiceNode } from "../nodes/AssetNode";
import { TrafficEdge } from "./TrafficEdge";
import "reactflow/dist/style.css";

const nodeTypes = {
  hardwareNode: HardwareNode,
  hostNode: HostNode,
  serviceNode: ServiceNode,
};

const edgeTypes = {
  trafficEdge: TrafficEdge,
};

interface GraphToolbarProps {
  trafficMode: TrafficMode;
  onTrafficModeChange: (mode: TrafficMode) => void;
}

function GraphToolbar({ trafficMode, onTrafficModeChange }: GraphToolbarProps) {
  const reactFlow = useReactFlow();

  return (
    <Panel position="bottom-left" className="!m-3">
      <div className="graph-toolbar flex items-center gap-1 rounded-xl p-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void reactFlow.zoomOut({ duration: 180 })}
            className="graph-toolbar__button"
            title="Zoom out"
          >
            -
          </button>
          <button
            type="button"
            onClick={() => void reactFlow.zoomIn({ duration: 180 })}
            className="graph-toolbar__button"
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => void reactFlow.fitView({ duration: 220, padding: 0.2 })}
            className="graph-toolbar__button"
            title="Fit view"
          >
            Fit
          </button>
        </div>

        <span className="graph-toolbar__divider" />

        <div className="flex items-center gap-1">
          {trafficModes.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onTrafficModeChange(mode)}
              className="graph-toolbar__button capitalize"
              data-active={trafficMode === mode}
            >
              {mode === "bidirectional" ? "Bidirectional" : mode}
            </button>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function layoutDAG(nodes: Node<NetDashNodeData>[], edges: Edge[]): Node<NetDashNodeData>[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 30, ranksep: 120, marginx: 24, marginy: 24 });

  for (const node of nodes) {
    g.setNode(node.id, { width: 240, height: 120 });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const position = g.node(node.id);
    return {
      ...node,
      position: {
        x: position.x - 120,
        y: position.y - 60,
      },
      draggable: false,
      selectable: true,
    };
  });
}

interface NetDashCanvasProps {
  nodes: NetDashNode[];
  edges: NetDashEdge[];
  selectedEdgeId?: string;
  trafficMode: TrafficMode;
  onTrafficModeChange: (mode: TrafficMode) => void;
  densityPreference: "compact" | "comfortable";
  effectiveTheme: "dark" | "light";
  onNodeClick: (nodeId: string) => void;
  onEdgeClick: (edgeId: string) => void;
  onPaneClick: () => void;
}

const trafficModes: TrafficMode[] = ["off", "combined", "bidirectional"];

export function NetDashCanvas({
  nodes,
  edges,
  selectedEdgeId,
  trafficMode,
  onTrafficModeChange,
  densityPreference,
  effectiveTheme,
  onNodeClick,
  onEdgeClick,
  onPaneClick,
}: NetDashCanvasProps) {
  const toFlowType = (assetType: NetDashNode["type"]): "hardwareNode" | "hostNode" | "serviceNode" => {
    if (assetType === "hardware") {
      return "hardwareNode";
    }
    if (assetType === "host") {
      return "hostNode";
    }
    return "serviceNode";
  };

  const flowNodes: Node<NetDashNodeData>[] = nodes.map((node) => ({
    id: node.identity.id,
    type: toFlowType(node.type),
    data: node.data,
    position: node.position,
  }));

  const flowEdges: Edge[] = edges.map((edge) => {
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "trafficEdge",
      animated: false,
      selected: edge.id === selectedEdgeId,
      data: {
        trafficMode,
        connectorUuid: edge.data?.connectorUuid,
        displayName: edge.data?.displayName,
        trafficMbps: edge.data?.trafficMbps,
        packetsPerSec: edge.data?.packetsPerSec,
        trafficOutMbps: edge.data?.trafficOutMbps,
        trafficInMbps: edge.data?.trafficInMbps,
      },
      style: {
        strokeWidth: 2,
      },
    };
  });

  const dagNodes = layoutDAG(flowNodes, flowEdges);

  const onNodesChange: OnNodesChange = () => undefined;
  const onEdgesChange: OnEdgesChange = () => undefined;

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    onNodeClick(node.id);
  };

  const handleEdgeClick: EdgeMouseHandler = (_event, edge) => {
    onEdgeClick(edge.id);
  };

  return (
    <div className="surface-canvas relative h-full rounded-xl">
      <ReactFlow
        nodes={dagNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
      >
        <Background
          gap={densityPreference === "compact" ? 18 : 22}
          size={1}
          color={effectiveTheme === "dark" ? "#25314a" : "#cbd5e1"}
        />
        <GraphToolbar trafficMode={trafficMode} onTrafficModeChange={onTrafficModeChange} />
      </ReactFlow>
    </div>
  );
}
