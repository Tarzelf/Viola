import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration.
 *
 * Runs against a real server with the real pipeline in mock mode, so the whole
 * path — upload, vision, product resolution, layout, render, publish — actually
 * executes. Nothing is stubbed at the network layer, because the interesting
 * failures live in the seams between those stages rather than inside any one
 * of them.
 *
 * The device profile is a phone. 62% of the audience is on one, and a share
 * recipient almost always arrives from a message thread.
 */
export default defineConfig({
  testDir: './e2e',
  // The pipeline plus three card renders is genuinely slow on a cold start.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  // Publishing consumes the weekly quota, so retries would hit the paywall
  // rather than the bug.
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  /**
   * Chromium with a phone viewport rather than the iPhone device preset.
   *
   * The preset drives WebKit, which needs a separate ~100MB download and
   * system libraries that are not present on every CI image. A suite nobody
   * can run is worth less than slightly lower browser fidelity, and the things
   * being tested here — auth walls, cookies, layout at phone width — do not
   * hinge on the engine.
   */
  projects: [
    {
      name: 'mobile-web',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 393, height: 852 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],

  // Reuse a server that is already up; start one otherwise.
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
