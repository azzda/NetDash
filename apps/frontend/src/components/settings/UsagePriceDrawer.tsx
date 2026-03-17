import { useMemo, useState } from "react";
import type { CurrencyPreference, UserProfile } from "../../lib/uiPreferences";
import { formatCurrency } from "../../lib/uiPreferences";

interface UsagePoint {
  ts: number;
  powerWatts: number;
  cost: number;
}

interface UsagePriceDrawerProps {
  open: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  usageSeries: UsagePoint[];
  currencyPreference: CurrencyPreference;
}

export function UsagePriceDrawer({
  open,
  onClose,
  userProfile,
  usageSeries,
  currencyPreference,
}: UsagePriceDrawerProps) {
  const [expanded, setExpanded] = useState(false);

  const totalCost = useMemo(
    () => usageSeries.reduce((sum, point) => sum + point.cost, 0),
    [usageSeries],
  );
  const avgPower = useMemo(
    () => usageSeries.reduce((sum, point) => sum + point.powerWatts, 0) / Math.max(usageSeries.length, 1),
    [usageSeries],
  );

  if (!open) {
    return null;
  }

  const width = 320;
  const height = 120;
  const inset = 12;
  const maxCost = Math.max(...usageSeries.map((point) => point.cost), 1);
  const points = usageSeries.map((point, index) => {
    const x = inset + (index / Math.max(usageSeries.length - 1, 1)) * (width - inset * 2);
    const y = height - inset - (point.cost / maxCost) * (height - inset * 2);
    return { ...point, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");

  return (
    <div className="fixed inset-0 z-[34] flex justify-end bg-black/30" onClick={onClose}>
      <aside className="settings-drawer h-full w-full max-w-md overflow-y-auto border-l px-4 py-4 sm:px-5" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Usage & Pricing</h2>
            <p className="text-xs text-dimmed">Power and cost placeholders for {userProfile.displayName}.</p>
          </div>
          <button type="button" onClick={onClose} className="button-subtle px-2 py-1 text-xs">Close</button>
        </div>

        <section className="surface-card space-y-3 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-dimmed">Current user</p>
              <p className="text-sm font-semibold text-primary">{userProfile.displayName}</p>
            </div>
            <button type="button" onClick={() => setExpanded((value) => !value)} className="button-subtle px-2 py-1 text-xs">
              {expanded ? "Simple" : "Expanded"}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <article className="surface-subtle rounded-xl p-3">
              <p className="text-[11px] text-dimmed">Estimated monthly cost</p>
              <p className="mt-1 text-xl font-semibold text-primary">{formatCurrency(totalCost, currencyPreference)}</p>
            </article>
            <article className="surface-subtle rounded-xl p-3">
              <p className="text-[11px] text-dimmed">Average draw</p>
              <p className="mt-1 text-xl font-semibold text-primary">{avgPower.toFixed(1)} W</p>
            </article>
          </div>

          <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full overflow-visible">
            <path d={path} fill="none" stroke="var(--edge-activity)" strokeWidth="2.5" strokeLinecap="round" />
            {points.map((point) => (
              <circle key={point.ts} cx={point.x} cy={point.y} r="3.6" fill="var(--edge-activity-secondary)">
                <title>{`${new Date(point.ts).toLocaleDateString()} · ${point.powerWatts.toFixed(1)} W · ${formatCurrency(point.cost, currencyPreference)}`}</title>
              </circle>
            ))}
          </svg>
        </section>

        {expanded ? (
          <section className="surface-card mt-4 space-y-3 p-3">
            <div>
              <h3 className="text-sm font-semibold">Expanded Breakdown</h3>
              <p className="mt-1 text-xs text-dimmed">Simple placeholder calculations for service allocation and trend tracking.</p>
            </div>

            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-dimmed">
                  <tr>
                    <th className="px-3 py-2 font-medium">Bucket</th>
                    <th className="px-3 py-2 font-medium">Power</th>
                    <th className="px-3 py-2 font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-2 text-primary">Core routing & switching</td>
                    <td className="px-3 py-2 text-primary">42%</td>
                    <td className="px-3 py-2 text-primary">{formatCurrency(totalCost * 0.42, currencyPreference)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-primary">Compute & storage</td>
                    <td className="px-3 py-2 text-primary">38%</td>
                    <td className="px-3 py-2 text-primary">{formatCurrency(totalCost * 0.38, currencyPreference)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-primary">Service delivery</td>
                    <td className="px-3 py-2 text-primary">20%</td>
                    <td className="px-3 py-2 text-primary">{formatCurrency(totalCost * 0.2, currencyPreference)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </aside>
    </div>
  );
}