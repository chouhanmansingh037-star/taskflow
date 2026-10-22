import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    // All suites share one test database, so run files one at a time.
    fileParallelism: false,
    testTimeout: 15000,
  },
});
