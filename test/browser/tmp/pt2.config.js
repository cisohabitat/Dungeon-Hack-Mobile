'use strict';
const { defineConfig, devices } = require('@playwright/test');
const PORT = 4417;
module.exports = defineConfig({
  testDir: '.',
  testMatch: /pt2-.*\.spec\.js/,
  outputDir: '../../../test-results/tmp-pt2',
  timeout: 600_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  use: { actionTimeout: 10000, baseURL: `http://127.0.0.1:${PORT}`, launchOptions: { args: ['--no-sandbox'] }, serviceWorkers: 'block' },
  projects: [{ name: 'phone', use: { ...devices['Pixel 5'] } }],
  webServer: { command: `node test/server.js ${PORT}`, cwd: '../../..', url: `http://127.0.0.1:${PORT}`, reuseExistingServer: false, stdout: 'ignore' },
});
