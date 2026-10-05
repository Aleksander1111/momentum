import { defineConfig } from '@playwright/test';

// End-to-end scenarios over the example projects, watched on the runner's page. Run on this PC only: the installed
// Firefox, headless, several scenarios side by side, each in its own world.
export default defineConfig({
  testDir: 'e2e/scenarios',
  testMatch: '*.e2e.ts',
  globalSetup: './e2e/global-setup.ts',
  // Each scenario in a world of its own: they run side by side, as many as E2E_WORKERS says
  workers: Number(process.env.E2E_WORKERS ?? 6),
  fullyParallel: false,
  retries: 0,
  timeout: 20 * 60_000,
  // The whole suite: nothing runs past this, whatever a scenario waits on
  globalTimeout: 4 * 60 * 60_000,
  reporter: [['list'], ['./e2e/observer/reporter.ts']],
  outputDir: '../../.e2e-results',
  use: {
    browserName: 'firefox',
    channel: 'moz-firefox',
    headless: true,
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'dark',
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
    launchOptions: {
      firefoxUserPrefs: { 'media.navigator.streams.fake': true, 'media.navigator.permission.disabled': true },
    },
  },
});
