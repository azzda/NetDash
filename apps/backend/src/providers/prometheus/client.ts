export interface PrometheusClientOptions {
  url: string;
  timeoutMs?: number;
}

export interface InstantSample {
  labels: Record<string, string>;
  value: number;
}

export interface RangeSeries {
  labels: Record<string, string>;
  points: { ts: number; value: number }[];
}

interface PromResponse<T> {
  status: string;
  data: { resultType: string; result: T[] };
  error?: string;
}

interface PromVector {
  metric: Record<string, string>;
  value: [number, string];
}

interface PromMatrix {
  metric: Record<string, string>;
  values: [number, string][];
}

/**
 * Minimal Prometheus query client - only the two endpoints NetDash needs.
 *
 * Kept dependency-free and defensive: live state is an enrichment on top of the
 * topology, so a Prometheus that is slow or down must never take the dashboard
 * down with it.
 */
export class PrometheusClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: PrometheusClientOptions) {
    this.baseUrl = options.url.replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  private async request<T>(path: string, params: URLSearchParams): Promise<T[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}?${params.toString()}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`Prometheus returned HTTP ${response.status}`);
      }
      const body = (await response.json()) as PromResponse<T>;
      if (body.status !== "success") {
        throw new Error(`Prometheus query failed: ${body.error ?? "unknown error"}`);
      }
      return body.data.result;
    } catch (error) {
      // Name the source, so a failure is attributable at a glance rather than
      // surfacing as an anonymous "operation was aborted".
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Prometheus ${path} timed out after ${this.timeoutMs}ms`, { cause: error });
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async query(promql: string): Promise<InstantSample[]> {
    const result = await this.request<PromVector>(
      "/api/v1/query",
      new URLSearchParams({ query: promql }),
    );
    return result.map((item) => ({
      labels: item.metric,
      value: Number(item.value[1]),
    }));
  }

  async queryRange(
    promql: string,
    startMs: number,
    endMs: number,
    stepSec: number,
  ): Promise<RangeSeries[]> {
    const params = new URLSearchParams({
      query: promql,
      start: String(Math.floor(startMs / 1000)),
      end: String(Math.floor(endMs / 1000)),
      step: String(stepSec),
    });
    const result = await this.request<PromMatrix>("/api/v1/query_range", params);
    return result.map((item) => ({
      labels: item.metric,
      points: item.values.map(([ts, value]) => ({ ts: ts * 1000, value: Number(value) })),
    }));
  }
}
