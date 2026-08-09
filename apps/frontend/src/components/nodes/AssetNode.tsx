import { Handle, Position, type NodeProps } from "reactflow";
import type { AssetType, NetDashNodeData, NodeStatus } from "@netdash/shared";

/**
 * A single connection point on a node side. Multiple handles let several cables
 * to the same device fan out to distinct points instead of stacking on one, and
 * each maps to a physical interface where we know it.
 */
export interface NodeHandleDescriptor {
  /** Unique within the node; edges reference it via source/targetHandle. */
  id: string;
  /** Vertical position along the side, 0..1 (top..bottom). */
  top: number;
  /** Interface/port label for the tooltip, when known. */
  label?: string;
}

export interface NodeHandles {
  left: NodeHandleDescriptor[];
  right: NodeHandleDescriptor[];
}

export type AssetNodeData = NetDashNodeData & { handles?: NodeHandles };

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

function EdgeHandles({ handles }: { handles?: NodeHandles }) {
  // Without per-interface handles, keep the original single pair so edges still
  // attach at the middle of each side.
  if (!handles || (handles.left.length === 0 && handles.right.length === 0)) {
    return (
      <>
        <Handle type="target" position={Position.Left} className="!bg-slate-400" />
        <Handle type="source" position={Position.Right} className="!bg-slate-400" />
      </>
    );
  }

  return (
    <>
      {handles.left.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type="target"
          position={Position.Left}
          isConnectable={false}
          title={handle.label}
          style={{ top: `${(handle.top * 100).toFixed(2)}%` }}
          className="!h-2 !w-2 !bg-slate-400"
        />
      ))}
      {handles.right.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type="source"
          position={Position.Right}
          isConnectable={false}
          title={handle.label}
          style={{ top: `${(handle.top * 100).toFixed(2)}%` }}
          className="!h-2 !w-2 !bg-slate-400"
        />
      ))}
    </>
  );
}

function AssetNodeCard({ data, forcedType }: NodeProps<AssetNodeData> & { forcedType: AssetType }) {
  const status = statusPresentation[data.status] ?? statusPresentation.down;
  const type = forcedType;

  return (
    <article className={`asset-node-card w-60 rounded-xl border-l-4 p-2.5 ${accentByType[type]}`}>
      <EdgeHandles handles={data.handles} />
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
    </article>
  );
}

export function HardwareNode(props: NodeProps<AssetNodeData>) {
  return <AssetNodeCard {...props} forcedType="hardware" />;
}

export function HostNode(props: NodeProps<AssetNodeData>) {
  return <AssetNodeCard {...props} forcedType="host" />;
}

export function ServiceNode(props: NodeProps<AssetNodeData>) {
  return <AssetNodeCard {...props} forcedType="service" />;
}
