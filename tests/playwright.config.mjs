import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  globalSetup: './support/setup.mjs',
  globalTeardown: './support/artwork-report.mjs',
  timeout: 45000,
  expect: { timeout: 15000, toHaveScreenshot: { maxDiffPixelRatio: 0.005 } },
  fullyParallel: false,
  workers: 2,
  retries: 0,
  updateSnapshots: 'none',
  forbidOnly: true,
  outputDir: '/results/test-results',
  snapshotPathTemplate: '{testDir}/../baselines/{projectName}/{arg}{ext}',
  reporter: [['list'], ['html', { outputFolder: '/results/report', open: 'never' }], ['json', { outputFile: '/results/results.json' }]],
  use: {
    baseURL: 'http://site.test:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-GB',
    timezoneId: 'UTC',
    colorScheme: 'light',
  },
  projects: [
    // Software WebGL on hosted runners makes input and capture slow for heavy
    // sketches. Keep a bounded budget for the whole observation and teardown.
    {
      name: 'artwork', testMatch: /artwork\.spec\.mjs/, timeout: 180000,
      expect: { timeout: 45000 },
      use: {
        ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 },
        // Keep action/network traces and explicit screenshots. Automatic DOM
        // snapshots and screencast readback stall behind software WebGL frames.
        trace: { mode: 'retain-on-failure', screenshots: false, snapshots: false },
      },
    },
    { name: 'contracts', testMatch: /contracts\.spec\.mjs/ },
    { name: 'chromium', testMatch: /(?:browser|libraries|webgl)\.spec\.mjs/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'firefox', testMatch: /(?:browser|libraries)\.spec\.mjs/, use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } } },
    { name: 'webkit', testMatch: /(?:browser|libraries)\.spec\.mjs/, use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-chromium', testMatch: /(?:browser|libraries)\.spec\.mjs/, use: { ...devices['Pixel 7'] } },
    { name: 'mobile-webkit', testMatch: /(?:browser|libraries)\.spec\.mjs/, use: { ...devices['iPhone 13'] } },
  ],
});
