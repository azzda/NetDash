import type { NetDashEdge, NetDashNode } from "@netdash/shared";
import { NodeObservabilitySection } from "./NodeObservabilitySection";

interface SelectionObservabilityPaneProps {
  node?: NetDashNode;
  edge?: NetDashEdge;
}

export function SelectionObservabilityPane({ node, edge }: SelectionObservabilityPaneProps) {
  const activeTitle = node
    ? `${node.data.name} Observability`
    : edge?.data?.displayName
      ? `${edge.data.displayName} Observability`
      : edge
        ? "Connection Observability"
        : "Selection Observability";

  const activeDescription = node
    ? "Metrics and logs for the selected node."
    : edge
      ? "Aggregated connection telemetry, event trail, and placeholder link diagnostics."
      : "Select a node or connector to inspect its metrics, traffic history, and recent events.";

  const details = node?.data.details ?? edge?.data;

  return (
    <section className="surface-card rounded-xl p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-primary">{activeTitle}</h3>
          <p className="mt-1 text-xs text-dimmed">{activeDescription}</p>
        </div>
        {edge ? (
          <div className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-medium text-dimmed">
            {edge.data?.trafficMbps?.toFixed(1) ?? "0.0"} Mbps total
          </div>
        ) : null}
      </div>

      {node || edge ? (
        <NodeObservabilitySection
          details={details}
          title={node ? "Live Node Context" : "Live Connection Context"}
          description={activeDescription}
        />
      ) : (
        <div className="surface-subtle rounded-xl p-4 text-sm text-dimmed">
          Observability widgets will appear here once you select a node or connection in the topology.
        </div>
      )}
    </section>
  );
}