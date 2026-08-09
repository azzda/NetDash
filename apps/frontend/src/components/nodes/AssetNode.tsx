import { Handle, Position, type NodeProps } from "reactflow";
import type { AssetType, NetDashNodeData, NodeStatus } from "@netdash/shared";

const badgeByType: Record<AssetType, string> = {
  hardware: "bg-sky-100 text-sky-700",
  host: "bg-emerald-100 text-emerald-700",
  service: "bg-amber-100 text-amber-700",
};

// A colored left rail groups nodes by role at a glance without a separate legend.
const accentByType: Record<AssetType, string> = {
  hardware: "border-l-sky-400",
  host: "border-l-emerald-400",
  service: "border-l-amber-400",
};

const statusPresentation: Record<NodeStatus, { dot: string; label: string }> = {
  up: { dot: "bg-emerald-500", label: "Healthy" },
  down: { dot: "bg-rose-500", label: "Offline" },
  // Unmanaged devices have no management plane to probe, so they are neither
  // healthy nor offline - just present. A slate dot keeps them visually calm.
  unmanaged: { dot: "bg-slate-400", label: "Unmanaged" },
};

function AssetNodeCard({
  data,
  forcedType,
}: NodeProps<NetDashNodeData> & { forcedType: AssetType }) {
  const status = statusPresentation[data.status] ?? statusPresentation.down;
  const type = forcedType;

  return (
    <article className={`asset-node-card w-60 rounded-xl border-l-4 p-2.5 ${accentByType[type]}`}>
      <Handle type="target" position={Position.Left} className="!bg-slate-400" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-primary">{data.name}</h4>
          <p className="truncate text-[11px] text-dimmed">{data.ip || "no address"}</p>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badgeByType[type]}`}
        >
          {type}
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-2 text-xs text-dimmed">
        <span className={`h-2.5 w-2.5 rounded-full ${status.dot}`} />
        <span>{status.label}</span>
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
