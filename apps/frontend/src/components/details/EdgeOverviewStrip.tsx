import type { ConnectorEndpointDetails, NetDashEdge } from "@netdash/shared";

interface EdgeOverviewStripProps {
  edge: NetDashEdge;
  densityPreference: "compact" | "comfortable";
  onClose: () => void;
}

function EndpointSummaryCard({
  title,
  endpoint,
}: {
  title: string;
  endpoint?: ConnectorEndpointDetails;
}) {
  const ipSummary = endpoint?.ipAddresses?.join(" · ") ?? "No IP mapping";
  const dnsSummary = endpoint?.dnsNames?.join(" · ") ?? "No DNS mapping";

  return (
    <article className="surface-subtle min-w-0 rounded-xl p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-dimmed">
            {title}
          </p>
          <h4 className="mt-1 truncate text-base font-semibold text-primary">
            {endpoint?.label ?? "Unmapped endpoint"}
          </h4>
        </div>
        <span className="max-w-[10rem] truncate rounded-full bg-white/5 px-2 py-1 text-[11px] text-dimmed">
          {endpoint?.interfaceLabel ?? "unknown iface"}
        </span>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[11px] uppercase tracking-[0.16em] text-dimmed">IPs</dt>
          <dd className="mt-1 break-words font-medium text-primary">{ipSummary}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.16em] text-dimmed">DNS</dt>
          <dd className="mt-1 break-words font-medium text-primary">{dnsSummary}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.16em] text-dimmed">Physical Port</dt>
          <dd className="mt-1 break-words font-medium text-primary">
            {endpoint?.physicalPort ?? "Not specified"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.16em] text-dimmed">Logical Port</dt>
          <dd className="mt-1 break-words font-medium text-primary">
            {endpoint?.logicalPort ?? "Not specified"}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function EdgeOverviewStrip({ edge, densityPreference, onClose }: EdgeOverviewStripProps) {
  const paddingClass = densityPreference === "compact" ? "p-3" : "p-4";
  const data = edge.data;
  const trafficTotal = data?.trafficMbps ?? 0;
  const trafficOut = data?.trafficOutMbps ?? trafficTotal / 2;
  const trafficIn = data?.trafficInMbps ?? trafficTotal / 2;
  const packets = data?.packetsPerSec ?? 0;

  return (
    <section className={`surface-card min-w-0 overflow-hidden rounded-xl ${paddingClass}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-dimmed">
            Connector Overview
          </p>
          <h3 className="mt-1 truncate text-lg font-semibold text-primary">
            {data?.displayName ?? "Connection"}
          </h3>
          <p className="mt-1 break-all text-xs text-dimmed">
            UUID {data?.connectorUuid ?? edge.id}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {data?.status && data.status !== "connected" ? (
            <span
              className="status-pill capitalize"
              title="Link lifecycle from the source of truth"
            >
              {data.status}
            </span>
          ) : null}
          <span className="status-pill">{data?.protocol ?? "mixed"}</span>
          <span className="status-pill">{data?.vlan ?? "shared fabric"}</span>
          <button type="button" onClick={onClose} className="button-subtle px-2 py-1 text-xs">
            Clear
          </button>
        </div>
      </div>

      <div className="mt-4 grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_260px_minmax(0,1fr)]">
        <EndpointSummaryCard title="Side A" endpoint={data?.sideA} />

        <article className="surface-subtle connector-flow-card min-w-0 rounded-xl p-3">
          <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.18em] text-dimmed">
            <span>Live link</span>
            <span>{trafficTotal.toFixed(1)} Mbps</span>
          </div>

          <div className="connector-flow-card__line mt-5">
            <span className="connector-flow-card__dot connector-flow-card__dot--left" />
            <span className="connector-flow-card__track" />
            <span className="connector-flow-card__pulse" />
            <span className="connector-flow-card__dot connector-flow-card__dot--right" />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-dimmed">Out</p>
              <p className="mt-1 text-sm font-semibold text-primary">
                {trafficOut.toFixed(1)} Mbps
              </p>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-dimmed">In</p>
              <p className="mt-1 text-sm font-semibold text-primary">{trafficIn.toFixed(1)} Mbps</p>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2 col-span-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-dimmed">Packets / sec</p>
              <p className="mt-1 text-sm font-semibold text-primary">{packets.toFixed(0)}</p>
            </div>
          </div>
        </article>

        <EndpointSummaryCard title="Side B" endpoint={data?.sideB} />
      </div>

      <section className="mt-4 min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-dimmed">
              Policy References
            </h4>
            <p className="mt-1 text-xs text-dimmed">
              Attachment metadata stays here so the right-side inspector can stay node-focused.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(data?.policyReferences ?? []).length > 0 ? (
              data?.policyReferences?.map((reference) => (
                <span
                  key={reference.id}
                  className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-medium text-primary"
                >
                  {reference.type}: {reference.label}
                </span>
              ))
            ) : (
              <span className="text-xs text-dimmed">No policies attached.</span>
            )}
          </div>
        </div>
      </section>
    </section>
  );
}
