import { defineConfig, devices } from "@playwright/test";

// Minimal config for the F.3/W.03 scroll smoke test (tests/e2e; Vitest owns tests/unit).
// F.4/W.03 extends it (viewport, seed, parity settings): extend, don't replace.
const baseURL = "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "pnpm dev", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
