import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
  type EdgeProps,
} from "reactflow";
import type { ConnectorStatus, TopologyLayer, TrafficMode } from "@netdash/shared";

interface TrafficEdgeData {
  trafficMode: TrafficMode;
  status?: ConnectorStatus;
  layer?: TopologyLayer;
  /** Whether the link is carrying traffic right now (drives the motion dot). */
  live?: boolean;
  trafficMbps?: number;
  packetsPerSec?: number;
  trafficOutMbps?: number;
  trafficInMbps?: number;
}

/**
 * A source of truth like NetBox models planned and decommissioning cabling
 * alongside live cabling. Those are drawn differently so "what is coming" and
 * "what is going away" never look like working links: dashed + muted, and with
 * no traffic animation because nothing flows over them.
 */
function statusStyle(status: ConnectorStatus | undefined) {
  switch (status) {
    case "planned":
      return { dash: "7 6", muted: true, label: "Planned" };
    case "decommissioning":
      return { dash: "2 5", muted: true, label: "Decommissioning" };
    case "unknown":
      return { dash: "1 6", muted: true, label: "Unverified" };
    default:
      return { dash: undefined as string | undefined, muted: false, label: undefined };
  }
}

function animationDuration(metric: number | undefined) {
  const safeMetric = Math.max(metric ?? 0, 1);
  const seconds = Math.max(0.9, 4.5 - Math.min(safeMetric / 40, 3.2));
  return `${seconds.toFixed(2)}s`;
}

function labelChip(text: string, left: number, top: number, strong = false) {
  return (
    <div
      className={
        strong
          ? "nodrag nopan pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[11px] font-medium"
          : "nodrag nopan pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
      }
      style={{
        left: `${left}px`,
        top: `${top}px`,
        background: "var(--label-bg)",
        color: "var(--label-text)",
        opacity: strong ? 0.85 : 0.75,
      }}
    >
      {text}
    </div>
  );
}

export function TrafficEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps<TrafficEdgeData>) {
  // Orthogonal (elbow) routing, the way ArgoCD's resource graph draws edges. It
  // keeps links from cutting diagonally across unrelated nodes, which is most of
  // what makes a real-world topology look like a hairball.
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition: sourcePosition ?? Position.Right,
    targetX,
    targetY,
    targetPosition: targetPosition ?? Position.Left,
    borderRadius: 14,
  });

  const mode = data?.trafficMode ?? "combined";
  const isLogical = data?.layer === "logical";
  const decor = statusStyle(data?.status);
  // Logical links are relationships, not cables: they never carry bandwidth, so
  // no motion dot, and they are drawn dashed in a secondary colour so they read
  // as "rides on top of" rather than "is wired to". Planned/decommissioning/
  // unknown physical links are also dashed and carry no traffic.
  const live = !isLogical && (data?.live ?? true) && !decor.dash;
  const combinedLabel =
    data?.trafficMbps !== undefined ? `${data.trafficMbps.toFixed(1)} Mbps` : undefined;
  const outLabel =
    data?.trafficOutMbps !== undefined
      ? `${data.trafficOutMbps.toFixed(1)} Mbps \u25B8`
      : undefined;
  const inLabel =
    data?.trafficInMbps !== undefined ? `\u25C2 ${data.trafficInMbps.toFixed(1)} Mbps` : undefined;
  const baseStroke = selected
    ? "#38bdf8"
    : isLogical
      ? "var(--edge-activity-secondary)"
      : "var(--edge-stroke)";
  const stroke = decor.muted && !selected ? "var(--edge-stroke-muted)" : baseStroke;
  // Logical layer uses a fine dotted line, distinct from the status dashes.
  const dashArray = isLogical ? "1 5" : decor.dash;
  // In the combined layer view a logical edge still wants a small tag so it is
  // legible next to physical cabling.
  const layerLabel = isLogical ? (decor.label ?? "logical") : decor.label;

  if (mode === "off") {
    return (
      <>
        <BaseEdge
          id={id}
          path={path}
          style={{ stroke, strokeWidth: 2, strokeDasharray: dashArray }}
        />
        {layerLabel ? (
          <EdgeLabelRenderer>{labelChip(layerLabel, labelX, labelY)}</EdgeLabelRenderer>
        ) : null}
      </>
    );
  }

  if (mode === "combined") {
    return (
      <>
        <BaseEdge
          id={id}
          path={path}
          style={{ stroke, strokeWidth: 2.4, strokeDasharray: dashArray }}
        />
        {live ? (
          <circle r="4" fill="var(--edge-activity)">
            <animateMotion
              dur={animationDuration(data?.trafficMbps)}
              path={path}
              repeatCount="indefinite"
            />
          </circle>
        ) : null}
        <EdgeLabelRenderer>
          {layerLabel ? labelChip(layerLabel, labelX, labelY + 12) : null}
          {combinedLabel && live ? labelChip(combinedLabel, labelX, labelY - 12, true) : null}
        </EdgeLabelRenderer>
      </>
    );
  }

  // Bidirectional: one orthogonal path, two directional dots. The "in" dot walks
  // the same path in reverse (keyPoints 1->0), which keeps the routing clean
  // instead of drawing two diagonal lanes that re-introduce the crossing mess.
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{ stroke, strokeWidth: 2.2, strokeDasharray: dashArray }}
      />
      {live ? (
        <>
          <circle r="3.7" fill="var(--edge-activity)">
            <animateMotion
              dur={animationDuration(data?.trafficOutMbps)}
              path={path}
              repeatCount="indefinite"
            />
          </circle>
          <circle r="3.7" fill="var(--edge-activity-secondary)">
            <animateMotion
              dur={animationDuration(data?.trafficInMbps)}
              path={path}
              keyPoints="1;0"
              keyTimes="0;1"
              calcMode="linear"
              repeatCount="indefinite"
            />
          </circle>
        </>
      ) : null}
      <EdgeLabelRenderer>
        {layerLabel ? labelChip(layerLabel, labelX, labelY) : null}
        {outLabel && live ? labelChip(outLabel, labelX, labelY - 12, true) : null}
        {inLabel && live ? labelChip(inLabel, labelX, labelY + 12, true) : null}
      </EdgeLabelRenderer>
    </>
  );
}
