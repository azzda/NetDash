import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AnsiUp } from "ansi_up";
import type { NodeDetails, NodeLogEntry, NodeMetricPoint, NodeMetricSeries } from "@netdash/shared";
import { readStoredJson, readStoredPreference } from "../../lib/uiPreferences";

type TimeRange = "15m" | "1h" | "6h" | "24h";
type ObservabilityTab = "graphs" | "logs";

const timeRangeMs: Record<TimeRange, number> = {
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
};

const timeRanges: TimeRange[] = ["15m", "1h", "6h", "24h"];
const observabilityTabs = [
  { id: "graphs", label: "Graphs" },
  { id: "logs", label: "Logs" },
] as const;
const observabilityStorage = {
  tab: "netdash:observability-tab",
  graphPanels: "netdash:observability-graph-panels",
  logPanels: "netdash:observability-log-panels",
  graphRatios: "netdash:observability-graph-ratios",
  logRatios: "netdash:observability-log-ratios",
  severity: "netdash:observability-severity",
} as const;
const ansi = new AnsiUp();

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

function normalizeRatios(count: number, ratios: number[], min = 0.18) {
  const seeded = Array.from({ length: count }, (_, index) => ratios[index] ?? 1 / count).map((value) =>
    Math.max(min, value),
  );
  const total = seeded.reduce((sum, value) => sum + value, 0);
  return seeded.map((value) => value / total);
}

function splitIntoColumns<T>(items: T[], count: number) {
  const safeCount = Math.max(1, count);
  const columns = Array.from({ length: safeCount }, () => [] as T[]);

  items.forEach((item, index) => {
    columns[index % safeCount].push(item);
  });

  return columns;
}

function syncMetricSelections(current: string[], metrics: NodeMetricSeries[]) {
  if (metrics.length === 0) {
    return [];
  }

  return Array.from({ length: 3 }, (_, index) => {
    const existing = current[index];
    if (existing && metrics.some((series) => series.id === existing)) {
      return existing;
    }
    return metrics[index % metrics.length].id;
  });
}

function severityTone(severity: NodeLogEntry["severity"]) {
  if (severity === "error") {
    return "border-rose-400/40 text-rose-200";
  }
  if (severity === "warn") {
    return "border-amber-400/40 text-amber-200";
  }
  return "border-sky-400/40 text-sky-200";
}

interface ResizablePaneLayoutProps {
  count: number;
  ratios: number[];
  onRatiosChange: (ratios: number[]) => void;
  children: ReactNode[];
}

function ResizablePaneLayout({ count, ratios, onRatiosChange, children }: ResizablePaneLayoutProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const normalizedRatios = normalizeRatios(count, ratios);
  const panels = children.slice(0, count);

  const beginResize = (index: number) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) {
      return;
    }

    event.preventDefault();
    const startX = event.clientX;
    const startRatios = [...normalizedRatios];
    const width = containerRef.current.getBoundingClientRect().width;

    const handleMove = (moveEvent: PointerEvent) => {
      const delta = width === 0 ? 0 : (moveEvent.clientX - startX) / width;
      const next = [...startRatios];
      const min = 0.16;
      let left = startRatios[index] + delta;
      let right = startRatios[index + 1] - delta;

      if (left < min) {
        right -= min - left;
        left = min;
      }

      if (right < min) {
        left -= min - right;
        right = min;
      }

      next[index] = left;
      next[index + 1] = right;
      onRatiosChange(normalizeRatios(count, next, min));
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-3 md:flex-row md:gap-0">
      {panels.map((panel, index) => (
        <Fragment key={`pane-group-${index}`}>
          <div
            className="min-w-0 md:min-h-[320px]"
            style={{ flexBasis: `${normalizedRatios[index] * 100}%`, flexGrow: 0, flexShrink: 0 }}
          >
            {panel}
          </div>
          {index < panels.length - 1 ? (
            <div
              className="resize-handle hidden md:flex"
              onPointerDown={beginResize(index)}
              role="separator"
              aria-orientation="vertical"
              aria-label={`Resize panel ${index + 1}`}
            >
              <span className="resize-handle__grip" />
            </div>
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}

interface MiniMetricChartProps {
  series: NodeMetricSeries;
  range: TimeRange;
  expanded?: boolean;
}

function MiniMetricChart({ series, range, expanded = false }: MiniMetricChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<(NodeMetricPoint & { x: number; y: number }) | null>(null);
  const filteredPoints = useMemo(() => filterSeries(series.points, range), [range, series.points]);

  if (filteredPoints.length === 0) {
    return null;
  }

  const width = 360;
  const height = expanded ? 164 : 124;
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

  const activePoint = hoveredPoint ?? chartPoints[chartPoints.length - 1];
  const latestValue = chartPoints[chartPoints.length - 1].value;

  return (
    <article className="surface-subtle relative overflow-hidden rounded-xl p-3">
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

      {hoveredPoint ? (
        <div
          className="metric-tooltip"
          style={{
            left: `${Math.min(Math.max(hoveredPoint.x, 72), width - 72)}px`,
            top: `${Math.max(hoveredPoint.y - 10, 18)}px`,
          }}
        >
          <p className="metric-tooltip__value">
            {hoveredPoint.value.toFixed(1)} {series.unit}
          </p>
          <p className="metric-tooltip__time">{formatRange(hoveredPoint.ts)}</p>
        </div>
      ) : null}

      <svg viewBox={`0 0 ${width} ${height}`} className={`mt-3 w-full overflow-visible ${expanded ? "h-44" : "h-32"}`}>
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
  const [activeTab, setActiveTab] = useState<ObservabilityTab>(() =>
    readStoredPreference(observabilityStorage.tab, "graphs"),
  );
  const [graphPanelCount, setGraphPanelCount] = useState<1 | 2 | 3>(() => {
    const stored = readStoredJson<number>(observabilityStorage.graphPanels, 2);
    return stored === 1 || stored === 3 ? stored : 2;
  });
  const [logPanelCount, setLogPanelCount] = useState<1 | 2>(() => {
    const stored = readStoredJson<number>(observabilityStorage.logPanels, 1);
    return stored === 2 ? 2 : 1;
  });
  const [graphRatios, setGraphRatios] = useState<number[]>(() =>
    readStoredJson<number[]>(observabilityStorage.graphRatios, [0.5, 0.5, 0.34]),
  );
  const [logRatios, setLogRatios] = useState<number[]>(() =>
    readStoredJson<number[]>(observabilityStorage.logRatios, [1, 0.5]),
  );
  const [metricSelections, setMetricSelections] = useState<string[]>([]);
  const [severityFilter, setSeverityFilter] = useState<"all" | "error" | "warn" | "info">(() =>
    readStoredPreference(observabilityStorage.severity, "all"),
  );

  const metrics = useMemo(() => details?.metrics ?? [], [details]);
  const logs = useMemo(() => details?.logs ?? [], [details]);

  useEffect(() => {
    window.localStorage.setItem(observabilityStorage.tab, activeTab);
  }, [activeTab]);

  useEffect(() => {
    window.localStorage.setItem(observabilityStorage.graphPanels, JSON.stringify(graphPanelCount));
  }, [graphPanelCount]);

  useEffect(() => {
    window.localStorage.setItem(observabilityStorage.logPanels, JSON.stringify(logPanelCount));
  }, [logPanelCount]);

  useEffect(() => {
    window.localStorage.setItem(observabilityStorage.graphRatios, JSON.stringify(graphRatios));
  }, [graphRatios]);

  useEffect(() => {
    window.localStorage.setItem(observabilityStorage.logRatios, JSON.stringify(logRatios));
  }, [logRatios]);

  useEffect(() => {
    window.localStorage.setItem(observabilityStorage.severity, severityFilter);
  }, [severityFilter]);

  const resolvedMetricSelections = useMemo(
    () => syncMetricSelections(metricSelections, metrics),
    [metricSelections, metrics],
  );

  const filteredLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let sorted = [...logs].sort((left, right) => right.ts - left.ts);

    if (severityFilter !== "all") {
      sorted = sorted.filter((entry) => entry.severity === severityFilter);
    }

    if (!normalizedQuery) {
      return sorted;
    }

    return sorted.filter((entry) => {
      const haystack = `${entry.source} ${entry.message} ${entry.severity}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [logs, query, severityFilter]);

  const graphPanels = Array.from({ length: graphPanelCount }, (_, index) => {
    const selectedId = resolvedMetricSelections[index];
    const selectedSeries = metrics.find((series) => series.id === selectedId) ?? metrics[index] ?? metrics[0];

    return (
      <article key={`graph-panel-${index}`} className="surface-subtle flex h-full flex-col rounded-xl p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-dimmed">Graph {index + 1}</p>
            <p className="mt-1 text-xs text-dimmed">Resize handles let you compact this row without losing context.</p>
          </div>
          <select
            value={selectedSeries?.id ?? ""}
            onChange={(event) => {
              const next = [...resolvedMetricSelections];
              next[index] = event.target.value;
              setMetricSelections(next);
            }}
            className="input-control max-w-[180px] px-2 py-1 text-xs"
          >
            {metrics.map((series) => (
              <option key={series.id} value={series.id}>
                {series.label}
              </option>
            ))}
          </select>
        </div>

        {selectedSeries ? (
          <MiniMetricChart series={selectedSeries} range={range} expanded={expanded} />
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-8 text-xs text-dimmed">
            No metric series available for this selection yet.
          </div>
        )}
      </article>
    );
  });

  const visibleLogs = filteredLogs.slice(0, expanded ? 80 : 36);
  const logColumns = splitIntoColumns(visibleLogs, logPanelCount);

  return (
    <section className="mt-4 space-y-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-primary">{title}</h3>
          <p className="mt-1 text-xs text-dimmed">{description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-white/5 p-0.5">
            {observabilityTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="observability-tab"
                data-active={activeTab === tab.id}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-lg bg-white/5 p-0.5">
            {timeRanges.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRange(option)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  range === option ? "bg-sky-600 text-white" : "text-dimmed hover:text-primary"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === "graphs" ? (
        <article className="surface-subtle rounded-xl p-3">
          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h4 className="text-xs font-semibold text-primary">Metric Graph Workspace</h4>
              <p className="mt-1 text-[11px] text-dimmed">Up to three horizontally resizable graph panes.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.16em] text-dimmed">Panels</span>
              <div className="flex gap-1 rounded-lg bg-white/5 p-0.5">
                {[1, 2, 3].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => {
                      setGraphPanelCount(count as 1 | 2 | 3);
                      setGraphRatios((current) => normalizeRatios(count, current));
                    }}
                    className="panel-count-button"
                    data-active={graphPanelCount === count}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {metrics.length > 0 ? (
            <ResizablePaneLayout count={graphPanelCount} ratios={graphRatios} onRatiosChange={setGraphRatios}>
              {graphPanels}
            </ResizablePaneLayout>
          ) : (
            <article className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-dimmed">
              No metric placeholders available for this selection yet.
            </article>
          )}
        </article>
      ) : (
        <article className="surface-subtle rounded-xl p-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h4 className="text-xs font-semibold text-primary">Log Workspace</h4>
              <p className="mt-1 text-[11px] text-dimmed">Text-first stream view with ANSI color rendering and compact filters.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.16em] text-dimmed">Columns</span>
              <div className="flex gap-1 rounded-lg bg-white/5 p-0.5">
                {[1, 2].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => {
                      setLogPanelCount(count as 1 | 2);
                      setLogRatios((current) => normalizeRatios(count, current, 0.24));
                    }}
                    className="panel-count-button"
                    data-active={logPanelCount === count}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 lg:flex-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="input-control w-full px-3 py-2 text-xs lg:flex-1"
              placeholder="Search logs, source, or severity"
            />
            <div className="flex items-center gap-2 lg:w-auto">
              <label className="text-[11px] uppercase tracking-[0.16em] text-dimmed">Severity</label>
              <select
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value as "all" | "error" | "warn" | "info")}
                className="input-control px-2 py-2 text-xs"
              >
                {(["all", "error", "warn", "info"] as const).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3">
            <ResizablePaneLayout count={logPanelCount} ratios={logRatios} onRatiosChange={setLogRatios}>
              {logColumns.map((column, index) => (
                <article key={`log-panel-${index}`} className="rounded-xl border border-white/10 bg-[#020617]/20 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-dimmed">Log Box {index + 1}</p>
                      <p className="mt-1 text-[11px] text-dimmed">{column.length} entries visible</p>
                    </div>
                    <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-dimmed">
                      {Math.min(visibleLogs.length, expanded ? 80 : 36)} / {logs.length}
                    </span>
                  </div>

                  <div className={`space-y-2 overflow-y-auto pr-1 ${expanded ? "max-h-[34rem]" : "max-h-[24rem]"}`}>
                    {column.length > 0 ? (
                      column.map((entry) => (
                        <div key={entry.id} className={`log-stream-row ${severityTone(entry.severity)}`}>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-dimmed">
                            <span>{formatRange(entry.ts)}</span>
                            <span className="font-semibold uppercase tracking-[0.16em]">{entry.severity}</span>
                            <span>{entry.source}</span>
                          </div>
                          <div
                            className="log-stream-row__message"
                            dangerouslySetInnerHTML={{ __html: ansi.ansi_to_html(entry.message) }}
                          />
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl bg-white/5 px-3 py-4 text-xs text-dimmed">
                        No log entries match this search.
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </ResizablePaneLayout>
          </div>
        </article>
      )}
    </section>
  );
}