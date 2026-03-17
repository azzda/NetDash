import { Handle, Position, type NodeProps } from "reactflow";
import type { AssetType, NetDashNodeData } from "@netdash/shared";

const badgeByType: Record<AssetType, string> = {
  hardware: "bg-sky-100 text-sky-700",
  host: "bg-emerald-100 text-emerald-700",
  service: "bg-amber-100 text-amber-700",
};

function AssetNodeCard({ data, forcedType }: NodeProps<NetDashNodeData> & { forcedType: AssetType }) {
  const statusClass = data.status === "up" ? "bg-emerald-500" : "bg-rose-500";
  const type = forcedType;

  return (
    <article className="asset-node-card min-w-52 rounded-xl p-2.5">
      <Handle type="target" position={Position.Left} className="!bg-slate-400" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-primary">{data.name}</h4>
          <p className="text-[11px] text-dimmed">{data.ip}</p>
        </div>
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badgeByType[type]}`}>
          {type}
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-2 text-xs text-dimmed">
        <span className={`h-2.5 w-2.5 rounded-full ${statusClass}`} />
        <span>{data.status === "up" ? "Healthy" : "Offline"}</span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-slate-400" />
    </article>
  );
}

export function HardwareNode(props: NodeProps<NetDashNodeData>) {
  return <AssetNodeCard {...props} forcedType="hardware" />;
}

export function HostNode(props: NodeProps<NetDashNodeData>) {
  return <AssetNodeCard {...props} forcedType="host" />;
}

export function ServiceNode(props: NodeProps<NetDashNodeData>) {
  return <AssetNodeCard {...props} forcedType="service" />;
}
