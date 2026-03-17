import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const manifestModuleId = "virtual:netdash-manifest";
const resolvedManifestModuleId = `\0${manifestModuleId}`;

interface PackageJsonShape {
  name?: string;
  version?: string;
  packageManager?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readPackageJson(filePath: string): PackageJsonShape {
  return JSON.parse(readFileSync(filePath, "utf8")) as PackageJsonShape;
}

function collectDependencyItems(packageJson: PackageJsonShape) {
  return [
    ...Object.entries(packageJson.dependencies ?? {}),
    ...Object.entries(packageJson.devDependencies ?? {}),
  ]
    .filter(([name, version]) => !version.startsWith("workspace:") && !name.startsWith("@netdash/"))
    .sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
    .map(([name, version]) => `${name} ${version.replace(/^\^/, "")}`);
}

function createManifestCode(rootDir: string) {
  const rootPackagePath = path.resolve(rootDir, "package.json");
  const frontendPackagePath = path.resolve(rootDir, "apps/frontend/package.json");
  const backendPackagePath = path.resolve(rootDir, "apps/backend/package.json");
  const sharedPackagePath = path.resolve(rootDir, "packages/shared/package.json");

  const rootPackage = readPackageJson(rootPackagePath);
  const frontendPackage = readPackageJson(frontendPackagePath);
  const backendPackage = readPackageJson(backendPackagePath);
  const sharedPackage = readPackageJson(sharedPackagePath);

  const manifest = {
    generatedAt: new Date().toISOString(),
    workspaceVersion: rootPackage.version ?? "0.0.0",
    packageManager: rootPackage.packageManager ?? "unknown",
    packages: [
      { name: rootPackage.name ?? "netdash", version: rootPackage.version ?? "0.0.0" },
      { name: frontendPackage.name ?? "@netdash/frontend", version: frontendPackage.version ?? "0.0.0" },
      { name: backendPackage.name ?? "@netdash/backend", version: backendPackage.version ?? "0.0.0" },
      { name: sharedPackage.name ?? "@netdash/shared", version: sharedPackage.version ?? "0.0.0" },
    ],
    dependencyGroups: [
      {
        name: "Workspace",
        items: [rootPackage.packageManager ?? "unknown"],
      },
      {
        name: "Frontend",
        items: collectDependencyItems(frontendPackage),
      },
      {
        name: "Backend",
        items: collectDependencyItems(backendPackage),
      },
      {
        name: "Shared",
        items: collectDependencyItems(sharedPackage),
      },
    ],
  };

  return `export const appManifest = ${JSON.stringify(manifest, null, 2)};`;
}

function netdashManifestPlugin() {
  const configDir = fileURLToPath(new URL(".", import.meta.url));
  const workspaceRoot = path.resolve(configDir, "../..");

  return {
    name: "netdash-manifest-plugin",
    resolveId(id: string) {
      if (id === manifestModuleId) {
        return resolvedManifestModuleId;
      }
      return null;
    },
    load(id: string) {
      if (id === resolvedManifestModuleId) {
        return createManifestCode(workspaceRoot);
      }
      return null;
    },
    handleHotUpdate(ctx: { file: string; server: { moduleGraph: { getModuleById: (id: string) => unknown; invalidateModule: (module: unknown) => void }; ws: { send: (payload: { type: string; path?: string }) => void } } }) {
      if (!ctx.file.endsWith("package.json")) {
        return;
      }

      const module = ctx.server.moduleGraph.getModuleById(resolvedManifestModuleId);
      if (module) {
        ctx.server.moduleGraph.invalidateModule(module);
      }
      ctx.server.ws.send({ type: "full-reload" });
    },
  };
}

export default defineConfig({
  plugins: [react(), netdashManifestPlugin()],
  server: {
    port: 5173,
  },
});
