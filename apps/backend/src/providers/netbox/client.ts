import type { NetBoxDataset } from "./types";

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  results: T[];
}

export interface NetBoxClientOptions {
  url: string;
  token: string;
  /** Restrict the topology to one NetBox site slug. Empty means "everything". */
  site?: string;
  timeoutMs?: number;
}

const PAGE_SIZE = 200;

export class NetBoxClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly site?: string;
  private readonly timeoutMs: number;

  constructor(options: NetBoxClientOptions) {
    this.baseUrl = options.url.replace(/\/+$/, "");
    this.token = options.token;
    this.site = options.site || undefined;
    this.timeoutMs = options.timeoutMs ?? 20_000;
  }

  /**
   * NetBox 4.6 uses hashed "v2" tokens; the value must be sent whole, in the
   * form `nbt_<key>.<secret>`. A bare 40-character value is treated as a legacy
   * v1 token and rejected with "Invalid v1 token".
   */
  private get headers(): Record<string, string> {
    return {
      Authorization: `Token ${this.token}`,
      Accept: "application/json",
    };
  }

  private async fetchAll<T>(endpoint: string, params: Record<string, string> = {}): Promise<T[]> {
    const results: T[] = [];
    const query = new URLSearchParams({ ...params, limit: String(PAGE_SIZE) });
    let url: string | null = `${this.baseUrl}/api/${endpoint}/?${query.toString()}`;

    while (url) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(url, { headers: this.headers, signal: controller.signal });
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          throw new Error(
            `NetBox ${endpoint} returned HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
          );
        }
        const page = (await response.json()) as PaginatedResponse<T>;
        results.push(...page.results);
        url = page.next;
      } finally {
        clearTimeout(timer);
      }
    }

    return results;
  }

  async ping(): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/api/status/`, {
        headers: this.headers,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`NetBox status returned HTTP ${response.status}`);
      }
      const status = (await response.json()) as Record<string, unknown>;
      return String(status["netbox-version"] ?? "unknown");
    } finally {
      clearTimeout(timer);
    }
  }

  async fetchDataset(): Promise<NetBoxDataset> {
    const siteFilter: Record<string, string> = this.site ? { site: this.site } : {};

    // Fetched in parallel: these are independent reads and the round trips
    // dominate the refresh time.
    const [devices, virtualMachines, clusters, interfaces, cables, ipAddresses] = await Promise.all(
      [
        this.fetchAll<NetBoxDataset["devices"][number]>("dcim/devices", siteFilter),
        this.fetchAll<NetBoxDataset["virtualMachines"][number]>(
          "virtualization/virtual-machines",
          siteFilter,
        ),
        this.fetchAll<NetBoxDataset["clusters"][number]>("virtualization/clusters"),
        this.fetchAll<NetBoxDataset["interfaces"][number]>("dcim/interfaces", siteFilter),
        this.fetchAll<NetBoxDataset["cables"][number]>("dcim/cables"),
        this.fetchAll<NetBoxDataset["ipAddresses"][number]>("ipam/ip-addresses"),
      ],
    );

    return { devices, virtualMachines, clusters, interfaces, cables, ipAddresses };
  }
}
