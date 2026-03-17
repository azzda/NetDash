import { appManifest } from "virtual:netdash-manifest";

interface StatusRow {
  label: string;
  state: string;
}

interface AppInfoDrawerProps {
  open: boolean;
  onClose: () => void;
  statusRows: StatusRow[];
}

export function AppInfoDrawer({ open, onClose, statusRows }: AppInfoDrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[33] flex bg-black/20" onClick={onClose}>
      <aside className="settings-drawer h-full w-full max-w-md overflow-y-auto border-r px-4 py-4 sm:px-5" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">NetDash Workspace</h2>
            <p className="text-xs text-dimmed">Application status, versions, and open-source stack inventory.</p>
          </div>
          <button type="button" onClick={onClose} className="button-subtle px-2 py-1 text-xs">Close</button>
        </div>

        <section className="surface-card space-y-3 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <article className="surface-subtle rounded-xl p-3">
              <p className="text-[11px] text-dimmed">Workspace Version</p>
              <p className="mt-1 text-sm font-semibold text-primary">netdash {appManifest.workspaceVersion}</p>
            </article>
            <article className="surface-subtle rounded-xl p-3">
              <p className="text-[11px] text-dimmed">Manifest Generated</p>
              <p className="mt-1 text-sm font-semibold text-primary">{new Date(appManifest.generatedAt).toLocaleTimeString()}</p>
            </article>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-2 text-sm text-primary">
            {appManifest.packages.map((pkg) => `${pkg.name} ${pkg.version}`).join(" · ")}
          </div>
        </section>

        <section className="surface-card mt-4 space-y-3 p-3">
          <div>
            <h3 className="text-sm font-semibold">Core Status</h3>
            <p className="mt-1 text-xs text-dimmed">These placeholders are specific to NetDash itself, not user-managed infrastructure.</p>
          </div>
          <div className="space-y-2">
            {statusRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm">
                <span className="text-primary">{row.label}</span>
                <span className="text-dimmed">{row.state}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card mt-4 space-y-3 p-3">
          <div>
            <h3 className="text-sm font-semibold">Dependencies</h3>
            <p className="mt-1 text-xs text-dimmed">Generated from the workspace package manifests and refreshed during development when those files change.</p>
          </div>
          <div className="space-y-3">
            {appManifest.dependencyGroups.map((group) => (
              <div key={group.name}>
                <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-dimmed">{group.name}</h4>
                <ul className="mt-2 space-y-2 text-sm">
                  {group.items.map((item) => (
                    <li key={item} className="rounded-xl bg-white/5 px-3 py-2 text-primary">{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </aside>
      <div className="flex-1" />
    </div>
  );
}