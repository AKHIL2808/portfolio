import { defineConfig } from "@playwright/test";

// Minimal config so Playwright only looks in tests/e2e (Vitest owns tests/unit).
// F.4/W.03 adds the viewport, base URL, web server and parity settings.
export default defineConfig({
  testDir: "./tests/e2e",
});
