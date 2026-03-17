import type { NetDashNode } from "@netdash/shared";
import { NodeObservabilitySection } from "./NodeObservabilitySection";

interface NodeDetailsModalProps {
  node?: NetDashNode;
  open: boolean;
  onClose: () => void;
  densityPreference: "compact" | "comfortable";
}

export function NodeDetailsModal({ node, open, onClose, densityPreference }: NodeDetailsModalProps) {
  if (!open || !node) {
    return null;
  }

  const details = node.data.details;
  const paddingClass = densityPreference === "compact" ? "p-3" : "p-4";

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
      <section className={`surface-card w-full max-w-lg rounded-xl ${paddingClass}`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-primary">{node.data.name} Details</h3>
          <button
            type="button"
            onClick={onClose}
            className="button-subtle px-2 py-1 text-xs"
          >
            Close
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <article className="surface-subtle rounded-xl p-3">
            <h4 className="text-xs font-medium text-dimmed">Local DNS</h4>
            <p className="mt-1 text-sm font-medium text-primary">{details?.localDns ?? "unknown"}</p>
          </article>
          <article className="surface-subtle rounded-xl p-3">
            <h4 className="text-xs font-medium text-dimmed">Public DNS</h4>
            <p className="mt-1 text-sm font-medium text-primary">{details?.publicDns ?? "unknown"}</p>
          </article>
          <article className="surface-subtle rounded-xl p-3">
            <h4 className="text-xs font-medium text-dimmed">Cert Status</h4>
            <p className="mt-1 text-sm font-medium text-primary">{details?.certStatus ?? "unknown"}</p>
          </article>
          <article className="surface-subtle rounded-xl p-3">
            <h4 className="text-xs font-medium text-dimmed">VPN Status</h4>
            <p className="mt-1 text-sm font-medium text-primary">{details?.vpnStatus ?? "unknown"}</p>
          </article>
        </div>

        <NodeObservabilitySection details={details} />
      </section>
    </div>
  );
}
