import { useMemo, useState } from "react";
import type { NodeDetails, NodeLogEntry, NodeMetricPoint, NodeMetricSeries } from "@netdash/shared";

type TimeRange = "15m" | "1h" | "6h" | "24h";

const timeRangeMs: Record<TimeRange, number> = {
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
};

const timeRanges: TimeRange[] = ["15m", "1h", "6h", "24h"];

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRange(ts: number) {
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function filterSeries(points: NodeMetricPoint[], range: TimeRange) {
  if (points.length === 0) {
    return points;
  }

  const latest = points[points.length - 1].ts;
  return points.filter((point) => point.ts >= latest - timeRangeMs[range]);
}

function severityTone(severity: NodeLogEntry["severity"]) {
  if (severity === "error") {
    return "bg-rose-500/15 text-rose-300";
  }
  if (severity === "warn") {
    return "bg-amber-500/15 text-amber-300";
  }
  return "bg-sky-500/15 text-sky-300";
}

interface MiniMetricChartProps {
  series: NodeMetricSeries;
  range: TimeRange;
  expanded?: boolean;
}

function MiniMetricChart({ series, range, expanded = false }: MiniMetricChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<NodeMetricPoint | null>(null);
  const filteredPoints = useMemo(() => filterSeries(series.points, range), [range, series.points]);

  if (filteredPoints.length === 0) {
    return null;
  }

  const width = 280;
  const height = 96;
  const inset = 12;
  const values = filteredPoints.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);

  const chartPoints = filteredPoints.map((point, index) => {
    const x = inset + (index / Math.max(filteredPoints.length - 1, 1)) * (width - inset * 2);
    const y = height - inset - ((point.value - min) / span) * (height - inset * 2);
    return { ...point, x, y };
  });

  const path = chartPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const activePoint = hoveredPoint ?? filteredPoints[filteredPoints.length - 1];
  const latestValue = filteredPoints[filteredPoints.length - 1].value;

  return (
    <article className="surface-subtle rounded-xl p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold text-primary">{series.label}</h4>
          <p className="mt-1 text-[11px] text-dimmed">
            {activePoint.value.toFixed(1)} {series.unit} at {formatTime(activePoint.ts)}
          </p>
        </div>
        <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] font-medium text-dimmed">
          Now {latestValue.toFixed(1)} {series.unit}
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className={`mt-3 w-full overflow-visible ${expanded ? "h-36" : "h-24"}`}>
        <path
          d={path}
          fill="none"
          stroke={series.color ?? "var(--edge-activity)"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {chartPoints.map((point) => (
          <circle
            key={`${series.id}:${point.ts}`}
            cx={point.x}
            cy={point.y}
            r="4"
            fill={series.color ?? "var(--edge-activity)"}
            stroke="var(--canvas-bg)"
            strokeWidth="2"
            onMouseEnter={() => setHoveredPoint(point)}
            onMouseLeave={() => setHoveredPoint(null)}
          >
            <title>
              {series.label}: {point.value.toFixed(1)} {series.unit} at {formatRange(point.ts)}
            </title>
          </circle>
        ))}
      </svg>

      <p className="mt-2 text-[11px] text-dimmed">
        {activePoint.note ?? `Range ${range} · hover points for exact values`}
      </p>
    </article>
  );
}

interface ObservabilityDetails {
  metrics?: NodeMetricSeries[];
  logs?: NodeLogEntry[];
}

interface NodeObservabilitySectionProps {
  details?: ObservabilityDetails | NodeDetails;
  title?: string;
  description?: string;
  expanded?: boolean;
}

export function NodeObservabilitySection({
  details,
  title = "Node Observability",
  description = "Quick search across recent placeholder telemetry and service events.",
  expanded = false,
}: NodeObservabilitySectionProps) {
  const [range, setRange] = useState<TimeRange>("1h");
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"all" | "error" | "warn" | "info">("all");

  const metrics = details?.metrics ?? [];
  const logs = details?.logs ?? [];

  const filteredLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let sorted = [...logs].sort((left, right) => right.ts - left.ts);

    if (expanded && severityFilter !== "all") {
      sorted = sorted.filter((entry) => entry.severity === severityFilter);
    }

    if (!normalizedQuery) {
      return sorted;
    }

    return sorted.filter((entry) => {
      const haystack = `${entry.source} ${entry.message} ${entry.severity}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [logs, query, expanded, severityFilter]);

  return (
    <section className="mt-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
        <div className="flex gap-1 rounded-lg bg-white/5 p-0.5">
          {timeRanges.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                range === option
                  ? "bg-sky-600 text-white"
                  : "text-dimmed hover:text-primary"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {metrics.length > 0 ? (
          (expanded ? metrics : metrics.slice(0, 2)).map((series) => (
            <MiniMetricChart key={series.id} series={series} range={range} expanded={expanded} />
          ))
        ) : (
          <article className="surface-subtle rounded-xl p-3 text-xs text-dimmed">
            No metric placeholders available for this node yet.
          </article>
        )}
      </div>

      <article className="surface-subtle rounded-xl p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-semibold text-primary">Recent Logs</h4>
            <p className="mt-1 text-[11px] text-dimmed">
              {description}
            </p>
          </div>
          <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] font-medium text-dimmed">
            {expanded ? `${Math.min(filteredLogs.length, 30)} / ${logs.length}` : `${filteredLogs.length} shown`}
          </span>
        </div>

        {expanded && (
          <div className="mt-3 flex gap-1 rounded-lg bg-white/5 p-0.5">
            {(["all", "error", "warn", "info"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverityFilter(s)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors ${
                  severityFilter === s ? "bg-sky-600 text-white" : "text-dimmed hover:text-primary"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="input-control mt-3 w-full px-3 py-2 text-xs"
          placeholder="Search logs, source, or severity"
        />

        <div className={`mt-3 space-y-2 overflow-y-auto pr-1 ${expanded ? "" : "max-h-56"}`}>
          {filteredLogs.length > 0 ? (
            filteredLogs.slice(0, expanded ? 30 : 8).map((entry) => (
              <div key={entry.id} className="rounded-xl bg-white/5 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityTone(entry.severity)}`}>
                      {entry.severity}
                    </span>
                    <span className="text-[11px] text-dimmed">{entry.source}</span>
                  </div>
                  <span className="text-[11px] text-dimmed">{formatTime(entry.ts)}</span>
                </div>
                <p className="mt-1 text-xs text-primary">{entry.message}</p>
              </div>
            ))
          ) : (
            <div className="rounded-xl bg-white/5 px-3 py-4 text-xs text-dimmed">
              No log entries match this search.
            </div>
          )}
        </div>
      </article>
    </section>
  );
}