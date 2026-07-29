import type { GraphSnapshotPayload } from "@netdash/shared";
import { createSeededSnapshot } from "../mock/seededGraph";
import type { GraphProvider } from "./types";

/**
 * Deterministic fake lab. Kept as a first-class provider so the UI can be
 * developed, demoed and tested without a NetBox instance.
 */
export function createMockProvider(seed = 42): GraphProvider {
  return {
    name: "mock",
    synthetic: true,
    async getSnapshot(): Promise<GraphSnapshotPayload> {
      return createSeededSnapshot(seed);
    },
  };
}
