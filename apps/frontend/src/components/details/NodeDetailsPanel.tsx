import type { NetDashNode } from "@netdash/shared";
import { useEffect, useState } from "react";

interface NodeDetailsPanelProps {
  node?: NetDashNode;
  open: boolean;
  onClose: () => void;
  densityPreference: "compact" | "comfortable";
}

export function NodeDetailsPanel({
  node,
  open,
  onClose,
  densityPreference,
}: NodeDetailsPanelProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(open));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  if (!open && !mounted) {
    return null;
  }

  const paddingClass = densityPreference === "compact" ? "p-2.5" : "p-3";

  const animClass = mounted && open ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0";

  if (!node) {
    return (
      <aside
        className={`surface-card w-full min-w-0 rounded-xl ${paddingClass} transition-all duration-200 ease-out ${animClass}`}
      >
        <h3 className="text-sm font-semibold text-primary">Asset Inspector</h3>
        <p className="mt-1 text-xs text-dimmed">
          Select a node to inspect DNS, cert, VPN, and other operational details.
        </p>
      </aside>
    );
  }

  const details = node.data.details;

  return (
    <aside
      className={`surface-card w-full min-w-0 rounded-xl ${paddingClass} transition-all duration-200 ease-out ${animClass}`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-primary">{node.data.name}</h3>
          <p className="truncate text-xs text-dimmed">{node.identity.key}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="button-subtle shrink-0 px-2 py-1 text-xs"
        >
          Close
        </button>
      </div>

      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-dimmed">IP</dt>
          <dd className="break-words font-medium text-primary">{node.data.ip}</dd>
        </div>
        <div>
          <dt className="text-dimmed">Local DNS</dt>
          <dd className="break-words font-medium text-primary">{details?.localDns ?? "unknown"}</dd>
        </div>
        <div>
          <dt className="text-dimmed">Public DNS</dt>
          <dd className="break-words font-medium text-primary">
            {details?.publicDns ?? "unknown"}
          </dd>
        </div>
        <div>
          <dt className="text-dimmed">Cert Status</dt>
          <dd className="font-medium text-primary">{details?.certStatus ?? "unknown"}</dd>
        </div>
        <div>
          <dt className="text-dimmed">VPN Status</dt>
          <dd className="font-medium text-primary">{details?.vpnStatus ?? "unknown"}</dd>
        </div>
      </dl>
    </aside>
  );
}
