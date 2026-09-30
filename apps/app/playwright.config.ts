import { defineConfig } from '@playwright/test';

// Runs against a back-end serving the web build: MOMENTUM_URL and MOMENTUM_PASSWORD
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: {
    baseURL: process.env.MOMENTUM_URL ?? 'http://127.0.0.1:7300',
    channel: 'msedge',
  },
  projects: [
    { name: 'web', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { viewport: { width: 400, height: 860 }, hasTouch: true } },
  ],
});
