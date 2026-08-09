import { useEffect, useMemo } from "react";
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
import type {
  NetDashEdge,
  NetDashNode,
  NetDashNodeData,
  TopologyLayer,
  TrafficMode,
} from "@netdash/shared";
import type { LayerView } from "../../lib/uiPreferences";
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

const layerViews: LayerView[] = ["all", "physical", "logical"];

// Edges with no explicit layer are physical (the default for cable-derived links).
function layerOf(edge: NetDashEdge): TopologyLayer {
  return edge.data?.layer ?? "physical";
}

function edgeVisibleInLayer(edge: NetDashEdge, view: LayerView): boolean {
  return view === "all" || layerOf(edge) === view;
}

interface GraphToolbarProps {
  trafficMode: TrafficMode;
  onTrafficModeChange: (mode: TrafficMode) => void;
  layerView: LayerView;
  onLayerViewChange: (view: LayerView) => void;
}

function GraphToolbar({
  trafficMode,
  onTrafficModeChange,
  layerView,
  onLayerViewChange,
}: GraphToolbarProps) {
  const reactFlow = useReactFlow();

  return (
    <Panel position="bottom-left" className="!m-3">
      <div className="graph-toolbar flex flex-wrap items-center gap-1 rounded-xl p-1">
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
          {layerViews.map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => onLayerViewChange(view)}
              className="graph-toolbar__button capitalize"
              data-active={layerView === view}
              title={
                view === "physical"
                  ? "Physical cabling only"
                  : view === "logical"
                    ? "Logical relationships only"
                    : "Physical + logical"
              }
            >
              {view}
            </button>
          ))}
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

interface SelectionFocusSyncProps {
  nodes: Node<NetDashNodeData>[];
  edges: Edge[];
  selectedNodeId?: string;
  selectedEdgeId?: string;
}

function SelectionFocusSync({
  nodes,
  edges,
  selectedNodeId,
  selectedEdgeId,
}: SelectionFocusSyncProps) {
  const reactFlow = useReactFlow();

  useEffect(() => {
    if (selectedNodeId) {
      const targetNode = nodes.find((node) => node.id === selectedNodeId);
      if (!targetNode) {
        return;
      }

      void reactFlow.setCenter(targetNode.position.x + 120, targetNode.position.y + 60, {
        duration: 220,
        zoom: Math.max(reactFlow.getZoom(), 0.95),
      });
      return;
    }

    if (selectedEdgeId) {
      const targetEdge = edges.find((edge) => edge.id === selectedEdgeId);
      if (!targetEdge) {
        return;
      }

      const source = nodes.find((node) => node.id === targetEdge.source);
      const target = nodes.find((node) => node.id === targetEdge.target);
      if (!source || !target) {
        return;
      }

      const bounds = {
        x: Math.min(source.position.x, target.position.x),
        y: Math.min(source.position.y, target.position.y),
        width: Math.abs(source.position.x - target.position.x) + 240,
        height: Math.abs(source.position.y - target.position.y) + 120,
      };

      void reactFlow.fitBounds(bounds, { duration: 240, padding: 0.3 });
    }
  }, [edges, nodes, reactFlow, selectedEdgeId, selectedNodeId]);

  return null;
}

// Uniform node footprint so dagre's spacing matches what is actually drawn.
// The card is `w-60` (240px); the height covers title + address + status row.
const NODE_WIDTH = 240;
const NODE_HEIGHT = 104;

// Bias same-role nodes to sit together within a rank.
const TYPE_ORDER: Record<NetDashNode["type"], number> = { hardware: 0, host: 1, service: 2 };

/**
 * Compute left-to-right positions for the graph. Orthogonal-friendly spacing
 * (wider ranksep, real nodesep) plus role-ordered insertion keeps real-world
 * data from turning into a hairball. Returns a map so the caller can keep live
 * node data separate from geometry.
 */
function computeLayout(
  nodes: NetDashNode[],
  edges: NetDashEdge[],
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "LR",
    nodesep: 48,
    ranksep: 160,
    edgesep: 24,
    marginx: 32,
    marginy: 32,
    ranker: "network-simplex",
  });

  const ordered = [...nodes].sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type]);
  const ids = new Set(ordered.map((node) => node.identity.id));
  for (const node of ordered) {
    g.setNode(node.identity.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    if (ids.has(edge.source) && ids.has(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    const laid = g.node(node.identity.id);
    if (laid) {
      positions.set(node.identity.id, {
        x: laid.x - NODE_WIDTH / 2,
        y: laid.y - NODE_HEIGHT / 2,
      });
    }
  }
  return positions;
}

interface NetDashCanvasProps {
  nodes: NetDashNode[];
  edges: NetDashEdge[];
  selectedNodeId?: string;
  selectedEdgeId?: string;
  trafficMode: TrafficMode;
  onTrafficModeChange: (mode: TrafficMode) => void;
  layerView: LayerView;
  onLayerViewChange: (view: LayerView) => void;
  densityPreference: "compact" | "comfortable";
  effectiveTheme: "dark" | "light" | "custom";
  onNodeClick: (nodeId: string) => void;
  onEdgeClick: (edgeId: string) => void;
  onPaneClick: () => void;
}

const trafficModes: TrafficMode[] = ["off", "combined", "bidirectional"];

export function NetDashCanvas({
  nodes,
  edges,
  selectedNodeId,
  selectedEdgeId,
  trafficMode,
  onTrafficModeChange,
  layerView,
  onLayerViewChange,
  densityPreference,
  effectiveTheme,
  onNodeClick,
  onEdgeClick,
  onPaneClick,
}: NetDashCanvasProps) {
  const toFlowType = (
    assetType: NetDashNode["type"],
  ): "hardwareNode" | "hostNode" | "serviceNode" => {
    if (assetType === "hardware") {
      return "hardwareNode";
    }
    if (assetType === "host") {
      return "hostNode";
    }
    return "serviceNode";
  };

  // Filtering to a single layer both answers "show me only cabling / only
  // relationships" and cuts edge crossings by drawing fewer lines at once.
  const visibleEdges = useMemo(
    () => edges.filter((edge) => edgeVisibleInLayer(edge, layerView)),
    [edges, layerView],
  );

  // Only the graph's structure (which nodes exist and how the *visible* edges
  // connect) drives layout - not the per-tick status/metric churn. Memoising on
  // that signature keeps positions stable and stops the whole graph
  // re-laying-out every refresh, while still re-flowing when the layer changes.
  const structureKey = useMemo(
    () =>
      `${layerView}::${nodes.map((node) => node.identity.id).join("|")}::${visibleEdges
        .map((edge) => `${edge.id}>${edge.source}>${edge.target}`)
        .join("|")}`,
    [layerView, nodes, visibleEdges],
  );

  const positions = useMemo(
    () => computeLayout(nodes, visibleEdges),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [structureKey],
  );

  const dagNodes: Node<NetDashNodeData>[] = nodes.map((node) => ({
    id: node.identity.id,
    type: toFlowType(node.type),
    data: node.data,
    position: positions.get(node.identity.id) ?? { x: 0, y: 0 },
    selected: node.identity.id === selectedNodeId,
    draggable: false,
    selectable: true,
  }));

  const flowEdges: Edge[] = visibleEdges.map((edge) => {
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
        status: edge.data?.status,
        layer: layerOf(edge),
        live: edge.data?.animated ?? edge.data?.status === "connected",
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
        <SelectionFocusSync
          nodes={dagNodes}
          edges={flowEdges}
          selectedNodeId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
        />
        <GraphToolbar
          trafficMode={trafficMode}
          onTrafficModeChange={onTrafficModeChange}
          layerView={layerView}
          onLayerViewChange={onLayerViewChange}
        />
      </ReactFlow>
    </div>
  );
}
