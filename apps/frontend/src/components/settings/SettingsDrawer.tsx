import type { TrafficMode } from "@netdash/shared";
import { type ChangeEvent, useEffect, useState } from "react";
import type {
  CurrencyPreference,
  CustomPalette,
  DensityPreference,
  ThemePreference,
  UserProfile,
} from "../../lib/uiPreferences";

interface SettingsDrawerProps {
  open: boolean;
  themePreference: ThemePreference;
  densityPreference: DensityPreference;
  currencyPreference: CurrencyPreference;
  customPalette: CustomPalette;
  trafficMode: TrafficMode;
  effectiveTheme: ThemePreference;
  userProfile: UserProfile;
  onClose: () => void;
  onThemeChange: (value: ThemePreference) => void;
  onDensityChange: (value: DensityPreference) => void;
  onCurrencyChange: (value: CurrencyPreference) => void;
  onCustomPaletteChange: (value: CustomPalette) => void;
  onTrafficModeChange: (value: TrafficMode) => void;
  onUserProfileChange: (value: UserProfile) => void;
}

export function SettingsDrawer({
  open,
  themePreference,
  densityPreference,
  currencyPreference,
  customPalette,
  trafficMode,
  effectiveTheme,
  userProfile,
  onClose,
  onThemeChange,
  onDensityChange,
  onCurrencyChange,
  onCustomPaletteChange,
  onTrafficModeChange,
  onUserProfileChange,
}: SettingsDrawerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(open));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  if (!open && !visible) {
    return null;
  }

  const handleTheme = (event: ChangeEvent<HTMLSelectElement>) => {
    onThemeChange(event.target.value as ThemePreference);
  };

  const handleDensity = (event: ChangeEvent<HTMLSelectElement>) => {
    onDensityChange(event.target.value as DensityPreference);
  };

  const handleTrafficMode = (event: ChangeEvent<HTMLSelectElement>) => {
    onTrafficModeChange(event.target.value as TrafficMode);
  };

  const handleCurrency = (event: ChangeEvent<HTMLSelectElement>) => {
    onCurrencyChange(event.target.value as CurrencyPreference);
  };

  const handlePaletteField =
    (field: keyof CustomPalette) => (event: ChangeEvent<HTMLInputElement>) => {
      onCustomPaletteChange({
        ...customPalette,
        [field]: event.target.value,
      });
    };

  const handleProfileField =
    (field: "displayName" | "email") => (event: ChangeEvent<HTMLInputElement>) => {
      onUserProfileChange({
        ...userProfile,
        [field]: event.target.value,
      });
    };

  return (
    <div
      className={`fixed inset-0 z-30 flex justify-end transition-colors duration-200 ${
        visible && open ? "bg-black/30" : "bg-transparent pointer-events-none"
      }`}
      onClick={onClose}
    >
      <aside
        className={`settings-drawer pointer-events-auto h-full w-full max-w-md overflow-y-auto border-l px-4 py-4 transition-transform duration-200 ease-out sm:px-5 ${
          visible && open ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Settings</h2>
            <p className="text-xs text-dimmed">
              Global display and traffic preferences for the topology view.
            </p>
          </div>
          <button type="button" onClick={onClose} className="button-subtle px-2 py-1 text-xs">
            Close
          </button>
        </div>

        <section className="surface-card space-y-3 p-3">
          <div className="flex items-start gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600 text-lg font-bold text-white">
              {userProfile.displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-primary">{userProfile.displayName}</h3>
              <p className="mt-1 text-xs text-dimmed">{userProfile.email}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-dimmed">
                <span className="rounded-full bg-white/5 px-2 py-1">ID {userProfile.userId}</span>
                <span className="rounded-full bg-white/5 px-2 py-1">Role {userProfile.role}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <label className="block text-xs font-medium text-dimmed">
              Display name
              <input
                value={userProfile.displayName}
                onChange={handleProfileField("displayName")}
                className="input-control mt-1 w-full px-3 py-2"
              />
            </label>
            <label className="block text-xs font-medium text-dimmed">
              Email
              <input
                value={userProfile.email}
                onChange={handleProfileField("email")}
                className="input-control mt-1 w-full px-3 py-2"
              />
            </label>
          </div>
        </section>

        <section className="surface-card mt-4 space-y-3 p-3">
          <div>
            <h3 className="text-sm font-semibold">Appearance</h3>
            <p className="mt-1 text-xs text-dimmed">
              The current effective theme is {effectiveTheme}.
            </p>
          </div>
          <label className="block text-xs font-medium text-dimmed">
            Theme
            <select
              value={themePreference}
              onChange={handleTheme}
              className="input-control mt-1 w-full"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-dimmed">
            Density
            <select
              value={densityPreference}
              onChange={handleDensity}
              className="input-control mt-1 w-full"
            >
              <option value="compact">Compact</option>
              <option value="comfortable">Comfortable</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-dimmed">
            Currency
            <select
              value={currencyPreference}
              onChange={handleCurrency}
              className="input-control mt-1 w-full"
            >
              <option value="eur">EUR (€)</option>
              <option value="usd">USD ($)</option>
              <option value="jpy">JPY (¥)</option>
            </select>
          </label>
        </section>

        <section className="surface-card mt-4 space-y-3 p-3">
          <div>
            <h3 className="text-sm font-semibold">Custom Palette</h3>
            <p className="mt-1 text-xs text-dimmed">
              Three editable tokens keep the theme small enough to control while still changing the
              app mood.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs font-medium text-dimmed">
              Accent
              <input
                type="color"
                value={customPalette.accent}
                onChange={handlePaletteField("accent")}
                className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-transparent"
              />
            </label>
            <label className="block text-xs font-medium text-dimmed">
              Surface
              <input
                type="color"
                value={customPalette.surface}
                onChange={handlePaletteField("surface")}
                className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-transparent"
              />
            </label>
            <label className="block text-xs font-medium text-dimmed">
              Text
              <input
                type="color"
                value={customPalette.text}
                onChange={handlePaletteField("text")}
                className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-transparent"
              />
            </label>
          </div>
          <div
            className="rounded-xl border border-white/10 p-3"
            style={{ background: customPalette.surface, color: customPalette.text }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] opacity-70">Preview</p>
                <p className="mt-1 text-sm font-semibold">Custom NetDash surface</p>
              </div>
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: customPalette.accent, color: "#0b1320" }}
              >
                Accent
              </span>
            </div>
          </div>
        </section>

        <section className="surface-card mt-4 space-y-3 p-3">
          <div>
            <h3 className="text-sm font-semibold">Traffic Visualization</h3>
            <p className="mt-1 text-xs text-dimmed">
              Replace the old animation toggle with an explicit traffic rendering mode.
            </p>
          </div>
          <label className="block text-xs font-medium text-dimmed">
            Traffic mode
            <select
              value={trafficMode}
              onChange={handleTrafficMode}
              className="input-control mt-1 w-full"
            >
              <option value="off">Off</option>
              <option value="combined">Combined</option>
              <option value="bidirectional">Bidirectional</option>
            </select>
          </label>
          <ul className="space-y-2 text-xs text-dimmed">
            <li>Off: topology only, no animated traffic cues.</li>
            <li>Combined: one aggregate link label and one activity indicator.</li>
            <li>Bidirectional: separate in and out paths with directional activity.</li>
          </ul>
        </section>

        <section className="surface-card mt-4 space-y-2 p-3 text-xs text-dimmed">
          <h3 className="text-sm font-semibold text-primary">Asset Management Direction</h3>
          <p>
            NetDash should treat graph nodes as visual projections of richer asset records. The next
            data layer should focus on inventory, tags, ownership, lifecycle, and relationships.
          </p>
        </section>
      </aside>
    </div>
  );
}
