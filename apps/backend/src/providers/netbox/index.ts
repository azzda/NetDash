import type { GraphSnapshotPayload } from "@netdash/shared";
import type { GraphProvider } from "../types";
import { NetBoxClient, type NetBoxClientOptions } from "./client";
import { mapDatasetToSnapshot } from "./mapper";

/**
 * Reads the lab's structure from NetBox: devices, virtual machines, interfaces,
 * cables, VLANs and IP addresses.
 *
 * Structure only. NetBox is the source of truth for what exists and how it is
 * wired; whether it is healthy and how much traffic it carries comes from
 * Prometheus/Loki/Hubble in a later provider.
 */
export function createNetBoxProvider(options: NetBoxClientOptions): GraphProvider {
  const client = new NetBoxClient(options);

  return {
    name: "netbox",
    synthetic: false,
    async getSnapshot(): Promise<GraphSnapshotPayload> {
      const dataset = await client.fetchDataset();
      return mapDatasetToSnapshot(dataset);
    },
  };
}

export { NetBoxClient } from "./client";
export { mapDatasetToSnapshot } from "./mapper";
