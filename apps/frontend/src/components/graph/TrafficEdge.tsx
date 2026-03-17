import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  type EdgeProps,
} from "reactflow";
import type { TrafficMode } from "@netdash/shared";

interface TrafficEdgeData {
  trafficMode: TrafficMode;
  trafficMbps?: number;
  packetsPerSec?: number;
  trafficOutMbps?: number;
  trafficInMbps?: number;
}

function createLaneGeometry(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  lane: 1 | -1,
) {
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  const deltaX = targetX - sourceX;
  const deltaY = targetY - sourceY;
  const length = Math.max(Math.hypot(deltaX, deltaY), 1);
  const angleWeight = Math.abs(deltaX) / length;
  const laneOffset = 22 + angleWeight * 10;
  const normalX = (-deltaY / length) * laneOffset * lane;
  const normalY = (deltaX / length) * laneOffset * lane;
  const controlX = midX + normalX;
  const controlY = midY + normalY;

  return {
    drawPath: `M ${sourceX},${sourceY} Q ${controlX},${controlY} ${targetX},${targetY}`,
    reversePath: `M ${targetX},${targetY} Q ${controlX},${controlY} ${sourceX},${sourceY}`,
    labelX: midX + normalX * 0.55,
    labelY: midY + normalY * 0.55,
  };
}

function animationDuration(metric: number | undefined) {
  const safeMetric = Math.max(metric ?? 0, 1);
  const seconds = Math.max(0.9, 4.5 - Math.min(safeMetric / 40, 3.2));
  return `${seconds.toFixed(2)}s`;
}

export function TrafficEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
  data,
}: EdgeProps<TrafficEdgeData>) {
  const [basePath, centerX, centerY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });
  const [straightPath, straightCenterX, straightCenterY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const mode = data?.trafficMode ?? "combined";
  const combinedLabel = data?.trafficMbps !== undefined ? `${data.trafficMbps.toFixed(1)} Mbps` : undefined;
  const bidirectionalOutLabel = data?.trafficOutMbps !== undefined ? `${data.trafficOutMbps.toFixed(1)} Mbps` : undefined;
  const bidirectionalInLabel = data?.trafficInMbps !== undefined ? `${data.trafficInMbps.toFixed(1)} Mbps` : undefined;
  const stroke = selected ? "#38bdf8" : "var(--edge-stroke)";
  const mutedStroke = "var(--edge-stroke-muted)";

  if (mode === "off") {
    return <BaseEdge id={id} path={straightPath} style={{ stroke, strokeWidth: 2 }} />;
  }

  if (mode === "combined") {
    return (
      <>
        <BaseEdge id={id} path={straightPath} style={{ stroke, strokeWidth: 2.4 }} />
        <circle r="4" fill="var(--edge-activity)">
          <animateMotion dur={animationDuration(data?.trafficMbps)} path={straightPath} repeatCount="indefinite" />
        </circle>
        {combinedLabel ? (
          <EdgeLabelRenderer>
            <div
              className="nodrag nopan pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{
                left: `${straightCenterX}px`,
                top: `${straightCenterY - 12}px`,
                background: "var(--label-bg)",
                color: "var(--label-text)",
                opacity: 0.85,
              }}
            >
              {combinedLabel}
            </div>
          </EdgeLabelRenderer>
        ) : null}
      </>
    );
  }

  const forwardLane = createLaneGeometry(sourceX, sourceY, targetX, targetY, 1);
  const reverseLane = createLaneGeometry(sourceX, sourceY, targetX, targetY, -1);

  return (
    <>
      <path d={forwardLane.drawPath} fill="none" stroke={stroke} strokeWidth="2.2" />
      <path d={reverseLane.drawPath} fill="none" stroke={mutedStroke} strokeWidth="2.2" />
      <circle r="3.7" fill="var(--edge-activity)">
        <animateMotion dur={animationDuration(data?.trafficOutMbps)} path={forwardLane.drawPath} repeatCount="indefinite" />
      </circle>
      <circle r="3.7" fill="var(--edge-activity-secondary)">
        <animateMotion dur={animationDuration(data?.trafficInMbps)} path={reverseLane.reversePath} repeatCount="indefinite" />
      </circle>
      <EdgeLabelRenderer>
        {bidirectionalOutLabel ? (
          <div
            className="nodrag nopan pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              left: `${forwardLane.labelX}px`,
              top: `${forwardLane.labelY}px`,
              background: "var(--label-bg)",
              color: "var(--label-text)",
              opacity: 0.85,
            }}
          >
            {bidirectionalOutLabel}
          </div>
        ) : null}
        {bidirectionalInLabel ? (
          <div
            className="nodrag nopan pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              left: `${reverseLane.labelX}px`,
              top: `${reverseLane.labelY}px`,
              background: "var(--label-bg)",
              color: "var(--label-text)",
              opacity: 0.85,
            }}
          >
            {bidirectionalInLabel}
          </div>
        ) : null}
      </EdgeLabelRenderer>
    </>
  );
}
