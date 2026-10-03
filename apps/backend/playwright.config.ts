import { defineConfig } from '@playwright/test';

// End-to-end scenarios over the example projects, watched in the observer window. Run on this PC only: Edge, headed,
// one scenario at a time, each in its own world.
export default defineConfig({
  testDir: 'e2e/scenarios',
  testMatch: '*.e2e.ts',
  globalSetup: './e2e/global-setup.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 20 * 60_000,
  // The whole suite: nothing runs past this, whatever a scenario waits on
  globalTimeout: 4 * 60 * 60_000,
  reporter: [['list'], ['./e2e/observer/reporter.ts']],
  outputDir: '../../.e2e-results',
  use: {
    channel: 'msedge',
    headless: false,
    viewport: null,
    colorScheme: 'dark',
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
    launchOptions: {
      args: ['--start-maximized', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
});
