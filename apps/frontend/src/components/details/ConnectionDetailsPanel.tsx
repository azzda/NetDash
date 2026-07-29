import type { ConnectorEndpointDetails, NetDashEdge } from "@netdash/shared";
import { useEffect, useState } from "react";

interface ConnectionDetailsPanelProps {
  edge?: NetDashEdge;
  open: boolean;
  onClose: () => void;
  densityPreference: "compact" | "comfortable";
}

function EndpointColumn({
  title,
  endpoint,
}: {
  title: string;
  endpoint?: ConnectorEndpointDetails;
}) {
  const ipSummary = endpoint?.ipAddresses?.join(", ") ?? "unknown";
  const dnsSummary = endpoint?.dnsNames?.join(", ") ?? "unknown";

  return (
    <article className="surface-subtle rounded-xl p-3">
      <div className="mb-3">
        <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-dimmed">{title}</h4>
        <p className="mt-1 text-sm font-semibold text-primary">
          {endpoint?.label ?? "unmapped endpoint"}
        </p>
      </div>

      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-dimmed">Interface</dt>
          <dd className="font-medium text-primary">{endpoint?.interfaceLabel ?? "unknown"}</dd>
        </div>
        <div>
          <dt className="text-dimmed">IPs</dt>
          <dd className="font-medium text-primary">{ipSummary}</dd>
        </div>
        <div>
          <dt className="text-dimmed">DNS</dt>
          <dd className="font-medium text-primary">{dnsSummary}</dd>
        </div>
        <div>
          <dt className="text-dimmed">Physical Port</dt>
          <dd className="font-medium text-primary">{endpoint?.physicalPort ?? "not specified"}</dd>
        </div>
        <div>
          <dt className="text-dimmed">Logical Port</dt>
          <dd className="font-medium text-primary">{endpoint?.logicalPort ?? "not specified"}</dd>
        </div>
      </dl>
    </article>
  );
}

export function ConnectionDetailsPanel({
  edge,
  open,
  onClose,
  densityPreference,
}: ConnectionDetailsPanelProps) {
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
  const data = edge?.data;

  if (!edge) {
    return (
      <aside
        className={`surface-card w-full max-w-sm rounded-xl ${paddingClass} lg:w-80 transition-all duration-200 ease-out ${animClass}`}
      >
        <h3 className="text-sm font-semibold text-primary">Connection Inspector</h3>
        <p className="mt-1 text-xs text-dimmed">
          Select a connector to inspect side A and side B metadata, interface details, and policy
          references.
        </p>
      </aside>
    );
  }

  return (
    <aside
      className={`surface-card w-full max-w-sm rounded-xl ${paddingClass} lg:w-80 transition-all duration-200 ease-out ${animClass}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-primary">
            {data?.displayName ?? "Connection"}
          </h3>
          <p className="text-xs text-dimmed">UUID {data?.connectorUuid ?? edge.id}</p>
        </div>
        <button type="button" onClick={onClose} className="button-subtle px-2 py-1 text-xs">
          Close
        </button>
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <div className="surface-subtle rounded-xl p-3">
          <p className="text-[11px] text-dimmed">Protocol</p>
          <p className="mt-1 text-sm font-semibold text-primary">{data?.protocol ?? "mixed"}</p>
        </div>
        <div className="surface-subtle rounded-xl p-3">
          <p className="text-[11px] text-dimmed">VLAN / Segment</p>
          <p className="mt-1 text-sm font-semibold text-primary">{data?.vlan ?? "shared fabric"}</p>
        </div>
      </div>

      <div className="grid gap-3">
        <EndpointColumn title="Side A" endpoint={data?.sideA} />
        <EndpointColumn title="Side B" endpoint={data?.sideB} />
      </div>

      <section className="mt-3 surface-subtle rounded-xl p-3">
        <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-dimmed">
          Policy References
        </h4>
        <div className="mt-2 flex flex-wrap gap-2">
          {(data?.policyReferences ?? []).length > 0 ? (
            data?.policyReferences?.map((reference) => (
              <span
                key={reference.id}
                className="rounded-full bg-white/5 px-2 py-1 text-[11px] font-medium text-primary"
              >
                {reference.type}: {reference.label}
              </span>
            ))
          ) : (
            <p className="text-xs text-dimmed">No policy references attached yet.</p>
          )}
        </div>
      </section>
    </aside>
  );
}
