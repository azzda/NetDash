import { startTransition, useEffect, useMemo, useState } from "react";
import { type TrafficMode } from "@netdash/shared";
import { EdgeOverviewStrip } from "./components/details/EdgeOverviewStrip";
import { NodeDetailsPanel } from "./components/details/NodeDetailsPanel";
import { SelectionObservabilityPane } from "./components/details/SelectionObservabilityPane";
import { NetDashCanvas } from "./components/graph/NetDashCanvas";
import { AppInfoDrawer } from "./components/shell/AppInfoDrawer";
import { SettingsDrawer } from "./components/settings/SettingsDrawer";
import { UsagePriceDrawer } from "./components/settings/UsagePriceDrawer";
import {
  type CurrencyPreference,
  type DensityPreference,
  type ThemePreference,
  applyCustomPalette,
  clearCustomPalette,
  defaultCustomPalette,
  formatCurrency,
  readStoredJson,
  readStoredPreference,
  storageKeys,
} from "./lib/uiPreferences";
import { createWsClient } from "./services/wsClient";
import { useNetDashStore } from "./store/useNetDashStore";

export default function App() {
  const [lastError, setLastError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [appInfoOpen, setAppInfoOpen] = useState(false);
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    readStoredPreference(storageKeys.theme, "dark"),
  );
  const [densityPreference, setDensityPreference] = useState<DensityPreference>(() =>
    readStoredPreference(storageKeys.density, "compact"),
  );
  const [currencyPreference, setCurrencyPreference] = useState<CurrencyPreference>(() =>
    readStoredPreference(storageKeys.currency, "eur"),
  );
  const [customPalette, setCustomPalette] = useState(() =>
    readStoredJson(storageKeys.customPalette, defaultCustomPalette),
  );
  const [trafficMode, setTrafficMode] = useState<TrafficMode>(() =>
    readStoredPreference(storageKeys.trafficMode, "bidirectional"),
  );
  const [graphCompact, setGraphCompact] = useState(false);
  const [wsStatus, setWsStatus] = useState<"connected" | "reconnecting" | "disconnected">("reconnecting");
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
      onStatusChange: (status) => {
        setWsStatus(status);
        if (status === "connected") setLastError(null);
      },
    });

    return () => ws.close();
  }, [applyMessage]);

  const effectiveTheme = themePreference;

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
    if (effectiveTheme === "custom") {
      applyCustomPalette(customPalette);
      return;
    }

    clearCustomPalette();
  }, [customPalette, effectiveTheme]);

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
    window.localStorage.setItem(storageKeys.currency, currencyPreference);
  }, [currencyPreference]);

  useEffect(() => {
    window.localStorage.setItem(storageKeys.customPalette, JSON.stringify(customPalette));
  }, [customPalette]);

  useEffect(() => {
    window.localStorage.setItem("netdash:user-profile", JSON.stringify(userProfile));
  }, [userProfile]);

  useEffect(() => {
    let rafId: number | undefined;
    const handleScroll = () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => setGraphCompact(window.scrollY > 400));
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId !== undefined) cancelAnimationFrame(rafId);
    };
  }, []);

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
  const averageUsageCost = useMemo(
    () => usageSeries.reduce((sum, point) => sum + point.cost, 0) / Math.max(usageSeries.length, 1),
    [usageSeries],
  );
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
      return current === "light" ? "dark" : "light";
    });
  };

  const showInspector = !graphCompact && Boolean(selectedNode);
  const appHealth = lastError || wsStatus === "disconnected"
    ? "issue"
    : wsStatus === "reconnecting"
      ? "warning"
      : "healthy";
  const overviewItems = [
    { label: "Nodes", value: nodes.length.toString() },
    { label: "Up", value: upNodes.toString(), tone: "text-emerald-400" },
    { label: "Edges", value: edges.length.toString() },
  ];

  return (
    <main className={`app-shell min-h-screen ${shellPadding}`}>
      <section className="mx-auto max-w-7xl">
        <header className="surface-shell grid gap-3 rounded-xl px-3 py-2 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:px-4">
          <div className="flex items-center gap-2">
            <div className="netdash-title-badge" data-health={appHealth}>
              <button
                type="button"
                onClick={() => {
                  setAppInfoOpen(true);
                  setSettingsOpen(false);
                  setUsageOpen(false);
                }}
                className="flex items-center gap-2 text-left text-base font-semibold tracking-tight text-primary"
              >
                <span>NetDash</span>
                <span
                  title={`WebSocket: ${wsStatus}`}
                  className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                    wsStatus === "connected"
                      ? "bg-emerald-500"
                      : wsStatus === "reconnecting"
                        ? "animate-pulse bg-amber-400"
                        : "bg-rose-500"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="hidden min-w-0 items-center justify-center gap-2 lg:flex">
            {overviewItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setAppInfoOpen(true);
                  setSettingsOpen(false);
                  setUsageOpen(false);
                }}
                className="header-overview-pill"
              >
                <span className="header-overview-pill__label">{item.label}</span>
                <span className={`header-overview-pill__value ${item.tone ?? ""}`}>{item.value}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setAppInfoOpen(true);
                setSettingsOpen(false);
                setUsageOpen(false);
              }}
              className="button-subtle px-2 py-1 text-[11px] lg:hidden"
              title="Overview"
            >
              {nodes.length}N · {upNodes}U · {edges.length}E
            </button>
            <button
              type="button"
              onClick={() => {
                setUsageOpen(true);
                setSettingsOpen(false);
                setAppInfoOpen(false);
              }}
              className="button-subtle flex items-center gap-3 px-3 py-1.5 text-xs"
              title="Usage and pricing"
            >
              <span className="font-semibold text-primary">{formatCurrency(latestUsageCost, currencyPreference)}</span>
              <span className="text-dimmed">∅ {formatCurrency(averageUsageCost, currencyPreference)}</span>
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
              {effectiveTheme === "light" ? "🌙" : "☀"}
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

        <div className="mt-3 space-y-3">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1 space-y-3">
              <div
                className="min-w-0 flex-1 transition-[height] duration-300 ease-in-out"
                style={{ height: graphCompact ? 140 : 560 }}
              >
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
              </div>

              {selectedEdge ? (
                <EdgeOverviewStrip
                  edge={selectedEdge}
                  densityPreference={densityPreference}
                  onClose={clearSelection}
                />
              ) : null}
            </div>

            <div
              className={`flex-none overflow-hidden transition-all duration-300 ease-in-out ${
                showInspector ? "max-w-[280px] opacity-100" : "max-w-0 opacity-0"
              }`}
            >
              <div className="w-[280px] space-y-3">
                <section className={`surface-card rounded-xl ${cardPadding}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-primary">Node Inspector</h3>
                      <p className="mt-1 text-xs text-dimmed">
                        Connector context now lives below the canvas to keep this rail dedicated to selected nodes.
                      </p>
                    </div>
                  </div>
                </section>
                <NodeDetailsPanel
                  open={Boolean(selectedNode)}
                  node={selectedNode}
                  onClose={clearSelection}
                  densityPreference={densityPreference}
                />
              </div>
            </div>
          </div>

          <SelectionObservabilityPane expanded={graphCompact} node={selectedNode} edge={selectedEdge} />
        </div>

        {lastError && wsStatus !== "reconnecting" ? (
          <section className="mt-4 rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-rose-300">
            <strong>Stream warning:</strong> {lastError}
          </section>
        ) : null}
      </section>

      <SettingsDrawer
        open={settingsOpen}
        themePreference={themePreference}
        densityPreference={densityPreference}
        currencyPreference={currencyPreference}
        customPalette={customPalette}
        trafficMode={trafficMode}
        effectiveTheme={effectiveTheme}
        userProfile={userProfile}
        onClose={() => setSettingsOpen(false)}
        onThemeChange={setThemePreference}
        onDensityChange={setDensityPreference}
        onCurrencyChange={setCurrencyPreference}
        onCustomPaletteChange={setCustomPalette}
        onTrafficModeChange={setTrafficMode}
        onUserProfileChange={setUserProfile}
      />

      <UsagePriceDrawer
        open={usageOpen}
        onClose={() => setUsageOpen(false)}
        userProfile={userProfile}
        usageSeries={usageSeries}
        currencyPreference={currencyPreference}
      />
      <AppInfoDrawer open={appInfoOpen} onClose={() => setAppInfoOpen(false)} statusRows={appStatusRows} />
    </main>
  );
}
