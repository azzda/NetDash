import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@netdash/shared": path.resolve(__dirname, "packages/shared/src/index.ts"),
    },
  },
  test: {
    globals: true,
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**", "apps/*/src/**"],
      exclude: ["**/*.test.ts", "**/*.spec.ts"],
    },
  },
});
