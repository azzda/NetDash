import { startTransition, useEffect, useMemo, useState } from "react";
import { defaultFeatureFlags, type TrafficMode } from "@netdash/shared";
import { ConnectionDetailsPanel } from "./components/details/ConnectionDetailsPanel";
import { NodeDetailsModal } from "./components/details/NodeDetailsModal";
import { NodeDetailsPanel } from "./components/details/NodeDetailsPanel";
import { SelectionObservabilityPane } from "./components/details/SelectionObservabilityPane";
import { NetDashCanvas } from "./components/graph/NetDashCanvas";
import { AppInfoDrawer } from "./components/shell/AppInfoDrawer";
import { SettingsDrawer } from "./components/settings/SettingsDrawer";
import { UsagePriceDrawer } from "./components/settings/UsagePriceDrawer";
import { createWsClient } from "./services/wsClient";
import { useNetDashStore } from "./store/useNetDashStore";

type ThemePreference = "system" | "dark" | "light";
type DensityPreference = "compact" | "comfortable";

const storageKeys = {
  theme: "netdash:theme",
  trafficMode: "netdash:traffic-mode",
  density: "netdash:density",
  detailsSurface: "netdash:details-surface",
};

function readStoredPreference<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }
  return (window.localStorage.getItem(key) as T | null) ?? fallback;
}

function readStoredJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const value = window.localStorage.getItem(key);
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [lastError, setLastError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [appInfoOpen, setAppInfoOpen] = useState(false);
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    readStoredPreference(storageKeys.theme, "system"),
  );
  const [densityPreference, setDensityPreference] = useState<DensityPreference>(() =>
    readStoredPreference(storageKeys.density, "compact"),
  );
  const [trafficMode, setTrafficMode] = useState<TrafficMode>(() =>
    readStoredPreference(storageKeys.trafficMode, "bidirectional"),
  );
  const [systemPrefersDark, setSystemPrefersDark] = useState(true);
  const [defaultSurface, setDefaultSurface] = useState<"panel" | "modal">(() =>
    readStoredPreference(storageKeys.detailsSurface, defaultFeatureFlags.defaultDetailsSurface),
  );
  const [userProfile, setUserProfile] = useState(() =>
    readStoredJson("netdash:user-profile", {
      displayName: "Admin",
      email: "admin@netdash.local",
      userId: "usr-00017",
      role: "Owner",
    }),
  );
  const {
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
    setSelectedNode,
    setSelectedEdge,
    clearSelection,
    applyMessage,
  } = useNetDashStore();

  useEffect(() => {
    const ws = createWsClient({
      onMessage: (message) => {
        applyMessage(message);
        setLastError(null);
      },
      onError: (error) => setLastError(error),
    });

    return () => ws.close();
  }, [applyMessage]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemPrefersDark(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const effectiveTheme =
    themePreference === "system" ? (systemPrefersDark ? "dark" : "light") : themePreference;

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
  }, [effectiveTheme]);

  useEffect(() => {
    window.localStorage.setItem(storageKeys.theme, themePreference);
  }, [themePreference]);

  useEffect(() => {
    window.localStorage.setItem(storageKeys.trafficMode, trafficMode);
  }, [trafficMode]);

  useEffect(() => {
    window.localStorage.setItem(storageKeys.density, densityPreference);
  }, [densityPreference]);

  useEffect(() => {
    window.localStorage.setItem(storageKeys.detailsSurface, defaultSurface);
  }, [defaultSurface]);

  useEffect(() => {
    window.localStorage.setItem("netdash:user-profile", JSON.stringify(userProfile));
  }, [userProfile]);

  const upNodes = useMemo(
    () => nodes.filter((node) => node.data.status === "up").length,
    [nodes],
  );

  const selectedNode = useMemo(
    () => nodes.find((node) => node.identity.id === selectedNodeId),
    [nodes, selectedNodeId],
  );
  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId),
    [edges, selectedEdgeId],
  );

  const shellPadding = densityPreference === "compact" ? "p-2" : "p-3";
  const cardPadding = densityPreference === "compact" ? "p-2.5" : "p-3";
  const [usageSeries, setUsageSeries] = useState(() =>
    Array.from({ length: 12 }, (_, index) => ({
      ts: Date.now() - (11 - index) * 24 * 60 * 60 * 1000,
      powerWatts: 86 + Math.sin(index / 2) * 12 + index,
      cost: 1.1 + Math.cos(index / 3) * 0.18 + index * 0.05,
    })),
  );
  const latestUsageCost = usageSeries[usageSeries.length - 1]?.cost ?? 0;
  const appStatusRows = useMemo(
    () => [
      { label: "Primary API", state: "healthy" },
      { label: "WebSocket broadcaster", state: lastError ? "degraded" : "healthy" },
      { label: "Primary database", state: "placeholder" },
      { label: "Companion automations", state: selectedNode || selectedEdge ? "active context" : "standby" },
    ],
    [lastError, selectedEdge, selectedNode],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      startTransition(() => {
        setUsageSeries((current) => {
          const lastPoint = current[current.length - 1] ?? {
            ts: Date.now(),
            powerWatts: 92,
            cost: 1.3,
          };
          const nextPower = Math.max(58, lastPoint.powerWatts + (Math.random() - 0.45) * 8);
          const nextCost = Math.max(0.7, lastPoint.cost + (Math.random() - 0.42) * 0.09);
          const nextPoint = {
            ts: Date.now(),
            powerWatts: Number(nextPower.toFixed(1)),
            cost: Number(nextCost.toFixed(2)),
          };
          return [...current.slice(-23), nextPoint];
        });
      });
    }, 4000);

    return () => window.clearInterval(timer);
  }, []);

  const handleQuickThemeToggle = () => {
    setThemePreference((current) => {
      const base = current === "system" ? effectiveTheme : current;
      return base === "dark" ? "light" : "dark";
    });
  };

  return (
    <main className={`app-shell min-h-screen ${shellPadding}`}>
      <section className="mx-auto max-w-7xl">
        <header className="surface-shell flex items-center justify-between rounded-xl px-4 py-2">
          <button
            type="button"
            onClick={() => {
              setAppInfoOpen(true);
              setSettingsOpen(false);
              setUsageOpen(false);
            }}
            className="text-left text-base font-semibold tracking-tight text-primary"
          >
            NetDash
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setUsageOpen(true);
                setSettingsOpen(false);
                setAppInfoOpen(false);
              }}
              className="button-subtle px-2 py-1 text-xs"
              title="Usage and pricing"
            >
              ${latestUsageCost.toFixed(2)}
            </button>
            <div className="flex items-center gap-2 rounded-lg px-2 py-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">
                {userProfile.displayName.slice(0, 1).toUpperCase()}
              </div>
              <span className="hidden text-sm font-medium sm:inline">{userProfile.displayName}</span>
            </div>
            <button
              type="button"
              onClick={handleQuickThemeToggle}
              className="button-subtle px-2 py-1 text-xs"
              title={`Theme: ${effectiveTheme}`}
            >
              {effectiveTheme === "dark" ? "☀" : "🌙"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(true);
                setUsageOpen(false);
                setAppInfoOpen(false);
              }}
              className="button-subtle px-2 py-1 text-xs"
              title="Settings"
            >
              ⚙
            </button>
          </div>
        </header>

        <section className="mt-3 grid gap-3 xl:grid-cols-[1fr_320px]">
          <NetDashCanvas
            nodes={nodes}
            edges={edges}
            selectedEdgeId={selectedEdgeId}
            trafficMode={trafficMode}
            onTrafficModeChange={setTrafficMode}
            densityPreference={densityPreference}
            effectiveTheme={effectiveTheme}
            onNodeClick={(nodeId) => setSelectedNode(nodeId)}
            onEdgeClick={(edgeId) => setSelectedEdge(edgeId)}
            onPaneClick={clearSelection}
          />

          <div className="space-y-3">
            <section className={`surface-card rounded-xl ${cardPadding}`}>
              <div className="flex items-baseline justify-between">
                <h3 className="text-xs font-semibold">Overview</h3>
              </div>
              <div className="mt-1.5 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="text-lg font-semibold">{nodes.length}</p>
                  <p className="text-dimmed">Nodes</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-emerald-500">{upNodes}</p>
                  <p className="text-dimmed">Up</p>
                </div>
                <div>
                  <p className="text-lg font-semibold">{edges.length}</p>
                  <p className="text-dimmed">Edges</p>
                </div>
              </div>
            </section>
            {selectedEdge ? (
              <ConnectionDetailsPanel
                open
                edge={selectedEdge}
                onClose={clearSelection}
                densityPreference={densityPreference}
              />
            ) : (
              <NodeDetailsPanel
                open
                node={selectedNode}
                onClose={clearSelection}
                densityPreference={densityPreference}
              />
            )}
          </div>

          <div className="xl:col-span-2">
            <SelectionObservabilityPane node={selectedNode} edge={selectedEdge} />
          </div>
        </section>

        {lastError ? (
          <section className="mt-4 rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-rose-300">
            <strong>Stream warning:</strong> {lastError}
          </section>
        ) : null}
      </section>

      <NodeDetailsModal
        open={defaultSurface === "modal" && Boolean(selectedNode)}
        node={selectedNode}
        onClose={clearSelection}
        densityPreference={densityPreference}
      />

      <SettingsDrawer
        open={settingsOpen}
        themePreference={themePreference}
        densityPreference={densityPreference}
        detailsSurface={defaultSurface}
        trafficMode={trafficMode}
        effectiveTheme={effectiveTheme}
        userProfile={userProfile}
        onClose={() => setSettingsOpen(false)}
        onThemeChange={setThemePreference}
        onDensityChange={setDensityPreference}
        onDetailsSurfaceChange={setDefaultSurface}
        onTrafficModeChange={setTrafficMode}
        onUserProfileChange={setUserProfile}
      />

      <UsagePriceDrawer open={usageOpen} onClose={() => setUsageOpen(false)} userProfile={userProfile} usageSeries={usageSeries} />
      <AppInfoDrawer open={appInfoOpen} onClose={() => setAppInfoOpen(false)} statusRows={appStatusRows} />
    </main>
  );
}
