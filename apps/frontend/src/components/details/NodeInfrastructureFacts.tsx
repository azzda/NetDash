import type { NodeDetails } from "@netdash/shared";
import { deriveNodeFacts } from "./nodeFacts";

/**
 * Renders the raw NetBox/Prometheus facts carried in `details.extensions`.
 * The distilling logic lives in `nodeFacts.ts` (pure + unit-tested); this is
 * only the presentation.
 */
export function NodeInfrastructureFacts({ details }: { details?: NodeDetails }) {
  const { facts, statusLabel, latencyLabel, monitoring, description, isEmpty } =
    deriveNodeFacts(details);

  if (isEmpty) {
    return null;
  }

  return (
    <section className="mt-4 border-t border-white/10 pt-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dimmed">
        Infrastructure
      </h4>

      {statusLabel || latencyLabel || monitoring ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {statusLabel ? <span className="status-pill capitalize">{statusLabel}</span> : null}
          {latencyLabel ? <span className="status-pill">{latencyLabel}</span> : null}
          {monitoring ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-1 text-[11px] text-dimmed"
              title={monitoring.hint}
            >
              <span className={`h-2 w-2 rounded-full ${monitoring.dotClass}`} />
              {monitoring.label}
            </span>
          ) : null}
        </div>
      ) : null}

      {facts.length > 0 ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-[11px] uppercase tracking-[0.12em] text-dimmed">{fact.label}</dt>
              <dd className="break-words font-medium text-primary">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {description ? <p className="mt-3 break-words text-xs text-dimmed">{description}</p> : null}
    </section>
  );
}
