import type { NetDashEdge, NetDashNode } from "@netdash/shared";
import { NodeObservabilitySection } from "./NodeObservabilitySection";

interface SelectionObservabilityPaneProps {
  node?: NetDashNode;
  edge?: NetDashEdge;
  expanded?: boolean;
}

export function SelectionObservabilityPane({ node, edge, expanded = false }: SelectionObservabilityPaneProps) {
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
      ? "Aggregated connector telemetry, event stream, and link diagnostics with flexible graph and log workspaces."
      : "Select a node or connector to inspect its metrics, traffic history, and recent events.";

  const details = node?.data.details ?? edge?.data;

  return (
    <section className="surface-card min-w-0 overflow-hidden rounded-xl p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-primary">{activeTitle}</h3>
          <p className="mt-1 text-xs text-dimmed">{activeDescription}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {edge ? (
            <div className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-medium text-dimmed">
              {edge.data?.trafficMbps?.toFixed(1) ?? "0.0"} Mbps total
            </div>
          ) : null}
          <div className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-medium text-dimmed">
            Graphs + Logs
          </div>
        </div>
      </div>

      {node || edge ? (
        <NodeObservabilitySection
          details={details}
          title={node ? "Live Node Context" : "Live Connection Context"}
          description={activeDescription}
          expanded={expanded}
        />
      ) : (
        <div className="surface-subtle rounded-xl p-4 text-sm text-dimmed">
          Observability widgets will appear here once you select a node or connection in the topology.
        </div>
      )}
    </section>
  );
}