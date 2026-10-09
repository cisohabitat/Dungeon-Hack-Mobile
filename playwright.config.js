'use strict';
const { defineConfig, devices } = require('@playwright/test');

const PORT = 4173;

module.exports = defineConfig({
  testDir: './test/browser',
  // the game is real-time, so a few waits are unavoidable; keep them bounded
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // this repo's containers often run as root, where the sandbox cannot start
    launchOptions: { args: ['--no-sandbox'] },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // the frame-rate budget runs alone, on one worker, in its own CI job: beside
    // the rest it would measure the machine's load, not the game (see perf.spec.js)
    { name: 'phone', use: { ...devices['Pixel 5'] }, testIgnore: /perf\.spec\.js/ },
    // the smallest phone in the device matrix (docs/DEVICES.md): the interface and
    // the core loop again at its size, in Chromium (WebKit is not installed here)
    { name: 'small', use: { ...devices['iPhone SE'], browserName: 'chromium', defaultBrowserType: 'chromium' }, testMatch: /(interface|play|a11y)\.spec\.js/ },
    { name: 'perf', use: { ...devices['Pixel 5'] }, testMatch: /perf\.spec\.js/, retries: 0 },
  ],
  webServer: {
    command: `node test/server.js ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
  },
});
