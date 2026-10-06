import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Migrates one PGlite database per run; each file starts from its snapshot.
    globalSetup: ["src/test/global-setup.ts"],
    hookTimeout: 60_000,
    testTimeout: 20_000,
  },
});
