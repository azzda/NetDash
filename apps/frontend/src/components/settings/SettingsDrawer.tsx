import type { TrafficMode } from "@netdash/shared";
import { type ChangeEvent, useEffect, useState } from "react";

type ThemePreference = "system" | "dark" | "light";
type DensityPreference = "compact" | "comfortable";

interface SettingsDrawerProps {
  open: boolean;
  themePreference: ThemePreference;
  densityPreference: DensityPreference;
  trafficMode: TrafficMode;
  effectiveTheme: "dark" | "light";
  userProfile: {
    displayName: string;
    email: string;
    userId: string;
    role: string;
  };
  onClose: () => void;
  onThemeChange: (value: ThemePreference) => void;
  onDensityChange: (value: DensityPreference) => void;
  onTrafficModeChange: (value: TrafficMode) => void;
  onUserProfileChange: (value: { displayName: string; email: string; userId: string; role: string }) => void;
}

export function SettingsDrawer({
  open,
  themePreference,
  densityPreference,
  trafficMode,
  effectiveTheme,
  userProfile,
  onClose,
  onThemeChange,
  onDensityChange,
  onTrafficModeChange,
  onUserProfileChange,
}: SettingsDrawerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
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

  const handleProfileField = (field: "displayName" | "email") => (event: ChangeEvent<HTMLInputElement>) => {
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
              <input value={userProfile.displayName} onChange={handleProfileField("displayName")} className="input-control mt-1 w-full px-3 py-2" />
            </label>
            <label className="block text-xs font-medium text-dimmed">
              Email
              <input value={userProfile.email} onChange={handleProfileField("email")} className="input-control mt-1 w-full px-3 py-2" />
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
            <select value={themePreference} onChange={handleTheme} className="input-control mt-1 w-full">
              <option value="system">System</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-dimmed">
            Density
            <select value={densityPreference} onChange={handleDensity} className="input-control mt-1 w-full">
              <option value="compact">Compact</option>
              <option value="comfortable">Comfortable</option>
            </select>
          </label>
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
            <select value={trafficMode} onChange={handleTrafficMode} className="input-control mt-1 w-full">
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
            NetDash should treat graph nodes as visual projections of richer asset records. The next data layer
            should focus on inventory, tags, ownership, lifecycle, and relationships.
          </p>
        </section>
      </aside>
    </div>
  );
}
