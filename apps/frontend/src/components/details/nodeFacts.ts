import type { NodeDetails } from "@netdash/shared";

/**
 * The provider stack rides raw facts in `details.extensions`: NetBox supplies
 * structure (role/model/serial/site/rack/tenant/status) and the Prometheus
 * decorator adds live state (monitored/reachable/latencyMs). These pure helpers
 * turn that untyped bag into labelled, display-ready values; anything
 * unrecognised is intentionally dropped so a schema change never renders
 * `[object Object]`.
 */

export type Extensions = NonNullable<NodeDetails["extensions"]>;

export interface Fact {
  label: string;
  value: string;
}

export interface MonitoringState {
  label: string;
  dotClass: string;
  hint: string;
}

export interface NodeFacts {
  facts: Fact[];
  statusLabel?: string;
  latencyLabel?: string;
  monitoring?: MonitoringState;
  description?: string;
  isEmpty: boolean;
}

function str(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function assetFacts(ext: Extensions): Fact[] {
  const facts: Fact[] = [];
  const push = (label: string, value: string | undefined) => {
    if (value !== undefined) {
      facts.push({ label, value });
    }
  };

  push("Role", str(ext.role));
  push("Model", str(ext.model));
  push("Manufacturer", str(ext.manufacturer));
  push("Serial", str(ext.serial));
  push("Site", str(ext.site));
  push("Rack", str(ext.rack));
  push("Tenant", str(ext.tenant));

  // Virtual machines carry compute shape instead of physical placement.
  push("Cluster", str(ext.cluster));
  const vcpus = num(ext.vcpus);
  push("vCPUs", vcpus !== undefined ? String(vcpus) : undefined);
  const memory = num(ext.memoryMiB);
  push("Memory", memory !== undefined ? `${(memory / 1024).toFixed(1)} GiB` : undefined);
  const disk = num(ext.diskGiB);
  push("Disk", disk !== undefined ? `${disk} GiB` : undefined);

  return facts;
}

function latencyLabel(ext: Extensions): string | undefined {
  const latency = num(ext.latencyMs);
  return latency !== undefined ? `${latency.toFixed(1)} ms` : undefined;
}

/**
 * Reality (a Prometheus probe) can agree with, contradict, or simply not watch
 * what NetBox intends. Those are three different things and the operator needs
 * to tell them apart.
 */
function monitoringState(ext: Extensions): MonitoringState | undefined {
  if (ext.unmanaged === true) {
    return {
      label: "Unmanaged",
      dotClass: "bg-slate-400",
      hint: "No management plane to monitor (e.g. an unmanaged switch) — presence is assumed, not probed.",
    };
  }

  if (ext.monitored === false) {
    return {
      label: "Not monitored",
      dotClass: "bg-slate-400",
      hint: "No reachability probe watches this device — status reflects NetBox intent, not a live check.",
    };
  }

  if (ext.monitored === true) {
    const netboxStatus = str(ext.netboxStatus);
    if (ext.reachable === true) {
      return {
        label: "Probe: reachable",
        dotClass: "bg-emerald-500",
        hint: "A live probe answers.",
      };
    }
    if (ext.reachable === false) {
      const contradicts = netboxStatus === "active";
      return {
        label: "Probe: unreachable",
        dotClass: "bg-rose-500",
        hint: contradicts
          ? "NetBox marks this active but the probe gets no answer."
          : `Probe gets no answer (NetBox: ${netboxStatus ?? "unknown"}).`,
      };
    }
    return {
      label: "Monitored",
      dotClass: "bg-sky-500",
      hint: "A probe is configured for this device.",
    };
  }

  return undefined;
}

/** Distil `details.extensions` into everything the inspector knows how to show. */
export function deriveNodeFacts(details?: NodeDetails): NodeFacts {
  const ext = details?.extensions;
  if (!ext) {
    return { facts: [], isEmpty: true };
  }

  const facts = assetFacts(ext);
  const statusLabel = str(ext.statusLabel) ?? str(ext.status);
  const latency = latencyLabel(ext);
  const monitoring = monitoringState(ext);
  const description = str(ext.description);

  const isEmpty = facts.length === 0 && !statusLabel && !latency && !monitoring && !description;

  return {
    facts,
    statusLabel,
    latencyLabel: latency,
    monitoring,
    description,
    isEmpty,
  };
}
