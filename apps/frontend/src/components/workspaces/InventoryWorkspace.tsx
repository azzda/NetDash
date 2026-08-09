import { useDeferredValue, useMemo, useState } from "react";
import type { NetDashEdge, NetDashNode } from "@netdash/shared";

type InventoryTab = "assets" | "connectors";

const statusPillClass: Record<string, string> = {
  up: "bg-emerald-500/15 text-emerald-200",
  down: "bg-rose-500/15 text-rose-200",
  unmanaged: "bg-slate-500/20 text-slate-200",
};

interface InventoryWorkspaceProps {
  nodes: NetDashNode[];
  edges: NetDashEdge[];
  selectedNodeId?: string;
  selectedEdgeId?: string;
  onSelectNode: (nodeId?: string) => void;
  onSelectEdge: (edgeId?: string) => void;
  onOpenTopology: () => void;
}

function buildNodeSearchText(node: NetDashNode) {
  return [
    node.data.name,
    node.data.ip,
    node.type,
    node.data.status,
    node.identity.id,
    node.identity.key,
    node.data.details?.localDns,
    node.data.details?.publicDns,
    node.data.details?.certStatus,
    node.data.details?.vpnStatus,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildEdgeSearchText(edge: NetDashEdge) {
  return [
    edge.data?.displayName,
    edge.id,
    edge.data?.connectorUuid,
    edge.data?.protocol,
    edge.data?.vlan,
    edge.data?.layer,
    edge.data?.sideA?.label,
    edge.data?.sideB?.label,
    edge.data?.sideA?.interfaceLabel,
    edge.data?.sideB?.interfaceLabel,
    ...(edge.data?.policyReferences?.map((reference) => `${reference.type} ${reference.label}`) ??
      []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function InventoryWorkspace({
  nodes,
  edges,
  selectedNodeId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  onOpenTopology,
}: InventoryWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<InventoryTab>("assets");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const filteredNodes = useMemo(() => {
    if (!deferredQuery) {
      return nodes;
    }

    return nodes.filter((node) => buildNodeSearchText(node).includes(deferredQuery));
  }, [deferredQuery, nodes]);

  const filteredEdges = useMemo(() => {
    if (!deferredQuery) {
      return edges;
    }

    return edges.filter((edge) => buildEdgeSearchText(edge).includes(deferredQuery));
  }, [deferredQuery, edges]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.identity.id === selectedNodeId),
    [nodes, selectedNodeId],
  );
  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId),
    [edges, selectedEdgeId],
  );

  const activeRecord = activeTab === "assets" ? selectedNode : selectedEdge;

  return (
    <section className="space-y-3">
      <section className="surface-card rounded-xl p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-dimmed">
              Inventory Workspace
            </p>
            <h2 className="mt-1 text-lg font-semibold text-primary">
              Metadata-ready asset and connector table
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-dimmed">
              This is the first implementation step for bulk metadata workflows. Use it to browse,
              filter, and jump into topology context without forcing heavy edits into the graph
              itself.
            </p>
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <article className="surface-subtle rounded-xl px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-dimmed">Assets</p>
              <p className="mt-1 text-base font-semibold text-primary">{nodes.length}</p>
            </article>
            <article className="surface-subtle rounded-xl px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-dimmed">Connectors</p>
              <p className="mt-1 text-base font-semibold text-primary">{edges.length}</p>
            </article>
            <article className="surface-subtle rounded-xl px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-dimmed">Matches</p>
              <p className="mt-1 text-base font-semibold text-primary">
                {activeTab === "assets" ? filteredNodes.length : filteredEdges.length}
              </p>
            </article>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 rounded-lg bg-white/5 p-0.5">
            {(["assets", "connectors"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className="observability-tab capitalize"
                data-active={activeTab === tab}
              >
                {tab}
              </button>
            ))}
          </div>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="input-control w-full px-3 py-2 text-sm lg:max-w-md"
            placeholder={
              activeTab === "assets"
                ? "Search assets, IPs, DNS, VPN, cert status"
                : "Search connectors, UUIDs, protocol, VLAN, policies"
            }
          />
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="surface-card overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            {activeTab === "assets" ? (
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead className="bg-white/5 text-left text-[11px] uppercase tracking-[0.16em] text-dimmed">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">IP</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Local DNS</th>
                    <th className="px-3 py-2 font-medium">VPN</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNodes.map((node) => {
                    const isActive = node.identity.id === selectedNodeId;
                    return (
                      <tr
                        key={node.identity.id}
                        onClick={() => onSelectNode(node.identity.id)}
                        className={`cursor-pointer border-t border-white/10 transition-colors ${
                          isActive ? "bg-sky-500/10" : "hover:bg-white/5"
                        }`}
                      >
                        <td className="px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-primary">{node.data.name}</p>
                            <p className="truncate text-xs text-dimmed">{node.identity.key}</p>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-primary">{node.data.ip}</td>
                        <td className="px-3 py-2 text-dimmed">{node.type}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusPillClass[node.data.status] ?? statusPillClass.down}`}
                          >
                            {node.data.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-dimmed">
                          {node.data.details?.localDns ?? "unknown"}
                        </td>
                        <td className="px-3 py-2 text-dimmed">
                          {node.data.details?.vpnStatus ?? "unknown"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[920px] border-collapse text-sm">
                <thead className="bg-white/5 text-left text-[11px] uppercase tracking-[0.16em] text-dimmed">
                  <tr>
                    <th className="px-3 py-2 font-medium">Connector</th>
                    <th className="px-3 py-2 font-medium">Layer</th>
                    <th className="px-3 py-2 font-medium">Protocol</th>
                    <th className="px-3 py-2 font-medium">VLAN</th>
                    <th className="px-3 py-2 font-medium">Bandwidth</th>
                    <th className="px-3 py-2 font-medium">Endpoints</th>
                    <th className="px-3 py-2 font-medium">Policies</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEdges.map((edge) => {
                    const isActive = edge.id === selectedEdgeId;
                    return (
                      <tr
                        key={edge.id}
                        onClick={() => onSelectEdge(edge.id)}
                        className={`cursor-pointer border-t border-white/10 transition-colors ${
                          isActive ? "bg-sky-500/10" : "hover:bg-white/5"
                        }`}
                      >
                        <td className="px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-primary">
                              {edge.data?.displayName ?? "Connection"}
                            </p>
                            <p className="truncate text-xs text-dimmed">
                              {edge.data?.connectorUuid ?? edge.id}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-dimmed capitalize">
                          {edge.data?.layer ?? "physical"}
                        </td>
                        <td className="px-3 py-2 text-dimmed">{edge.data?.protocol ?? "mixed"}</td>
                        <td className="px-3 py-2 text-dimmed">
                          {edge.data?.vlan ?? "shared fabric"}
                        </td>
                        <td className="px-3 py-2 text-primary">
                          {edge.data?.trafficMbps?.toFixed(1) ?? "0.0"} Mbps
                        </td>
                        <td className="px-3 py-2 text-dimmed">
                          {edge.data?.sideA?.label ?? "Side A"} →{" "}
                          {edge.data?.sideB?.label ?? "Side B"}
                        </td>
                        <td className="px-3 py-2 text-dimmed">
                          {edge.data?.policyReferences?.length ?? 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {(activeTab === "assets" ? filteredNodes.length : filteredEdges.length) === 0 ? (
            <div className="border-t border-white/10 px-4 py-6 text-sm text-dimmed">
              No inventory records match the current query.
            </div>
          ) : null}
        </section>

        <aside className="surface-card rounded-xl p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-dimmed">
                Selected Record
              </p>
              <h3 className="mt-1 truncate text-base font-semibold text-primary">
                {activeTab === "assets"
                  ? (selectedNode?.data.name ?? "No asset selected")
                  : (selectedEdge?.data?.displayName ?? "No connector selected")}
              </h3>
            </div>
            {activeRecord ? (
              <button
                type="button"
                onClick={onOpenTopology}
                className="button-subtle shrink-0 px-2 py-1 text-xs"
              >
                Open in topology
              </button>
            ) : null}
          </div>

          {activeTab === "assets" ? (
            selectedNode ? (
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-dimmed">Key</dt>
                  <dd className="break-all font-medium text-primary">
                    {selectedNode.identity.key}
                  </dd>
                </div>
                <div>
                  <dt className="text-dimmed">IP</dt>
                  <dd className="font-medium text-primary">{selectedNode.data.ip}</dd>
                </div>
                <div>
                  <dt className="text-dimmed">Local DNS</dt>
                  <dd className="break-words font-medium text-primary">
                    {selectedNode.data.details?.localDns ?? "unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="text-dimmed">Public DNS</dt>
                  <dd className="break-words font-medium text-primary">
                    {selectedNode.data.details?.publicDns ?? "unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="text-dimmed">Certificate</dt>
                  <dd className="font-medium text-primary">
                    {selectedNode.data.details?.certStatus ?? "unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="text-dimmed">VPN</dt>
                  <dd className="font-medium text-primary">
                    {selectedNode.data.details?.vpnStatus ?? "unknown"}
                  </dd>
                </div>
              </dl>
            ) : (
              <div className="surface-subtle mt-4 rounded-xl p-4 text-sm text-dimmed">
                Select an asset row to inspect metadata here before wiring in bulk edit actions.
              </div>
            )
          ) : selectedEdge ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-dimmed">Connector UUID</dt>
                <dd className="break-all font-medium text-primary">
                  {selectedEdge.data?.connectorUuid ?? selectedEdge.id}
                </dd>
              </div>
              <div>
                <dt className="text-dimmed">Protocol</dt>
                <dd className="font-medium text-primary">
                  {selectedEdge.data?.protocol ?? "mixed"}
                </dd>
              </div>
              <div>
                <dt className="text-dimmed">VLAN</dt>
                <dd className="font-medium text-primary">
                  {selectedEdge.data?.vlan ?? "shared fabric"}
                </dd>
              </div>
              <div>
                <dt className="text-dimmed">Endpoints</dt>
                <dd className="break-words font-medium text-primary">
                  {selectedEdge.data?.sideA?.label ?? "Side A"} →{" "}
                  {selectedEdge.data?.sideB?.label ?? "Side B"}
                </dd>
              </div>
              <div>
                <dt className="text-dimmed">Bandwidth</dt>
                <dd className="font-medium text-primary">
                  {selectedEdge.data?.trafficMbps?.toFixed(1) ?? "0.0"} Mbps
                </dd>
              </div>
              <div>
                <dt className="text-dimmed">Policy References</dt>
                <dd className="font-medium text-primary">
                  {selectedEdge.data?.policyReferences?.length ?? 0}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="surface-subtle mt-4 rounded-xl p-4 text-sm text-dimmed">
              Select a connector row to inspect metadata here before bulk edit and policy summary
              actions land.
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
