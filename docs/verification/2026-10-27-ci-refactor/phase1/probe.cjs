'use strict';
// Controlled reproduction: extend only the native Pack entry fade; do not
// change production styles, WCAG rules, audit scope, deadlines or game state.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../..');
const baseline = '62be4c80a760feed1a1837308ab43610fded9348';
const before = process.argv.includes('--before');
const out = path.resolve(process.env.A11Y_PROBE_OUTPUT || path.join(os.tmpdir(), before ? 'deepdelve-ui-ready-before' : 'deepdelve-ui-ready-after'));
fs.mkdirSync(out, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deepdelve-ui-ready-'));
try {
  let source = before ? execFileSync('git', ['show', baseline + ':test/browser/delve-guide.spec.js'], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, 'test/browser/delve-guide.spec.js'), 'utf8');
  for (const mod of ['@playwright/test', '@axe-core/playwright']) source = source.replaceAll(`require('${mod}')`, `require(${JSON.stringify(path.join(root, 'node_modules', mod))})`);
  source = source.replace("require('./helpers')", `require(${JSON.stringify(path.join(root, 'test/browser/helpers'))})`);
  source = source.replace('async function journal', `test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '#ov-inv.open { animation-duration: 2000ms !important; }';
      document.head.append(style);
    }));
  });\nasync function journal`);
  fs.writeFileSync(path.join(dir, 'delve-guide.spec.js'), source);
  const config = path.join(dir, 'probe.config.cjs');
  fs.writeFileSync(config, `const base = require(${JSON.stringify(path.join(root, 'playwright.config.js'))});
    module.exports = { ...base, testDir: ${JSON.stringify(dir)}, outputDir: ${JSON.stringify(path.join(out, 'artifacts'))}, retries: 0,
      use: { ...base.use, baseURL: 'http://127.0.0.1:4194', launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] } },
      projects: base.projects.filter(p => p.name === 'phone').map(p => ({ ...p, use: { ...p.use, launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] } } })),
      webServer: { command: ${JSON.stringify('node ' + path.join(root, 'test/server.js') + ' 4194')}, url: 'http://127.0.0.1:4194', reuseExistingServer: false } };
  `);
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules/@playwright/test/cli.js'), 'test', '--config=' + config, '--project=phone', '--workers=1', '--repeat-each=3', '--grep', 'guide pages, map landmarks and search'], { cwd: root, encoding: 'utf8', env: process.env });
  const log = ((result.stdout || '') + (result.stderr || '')).replace(/\u001b\[[0-9;]*m/g, '');
  fs.writeFileSync(path.join(out, 'probe.log'), log);
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ baseline, before, exitCode: result.status, repeats: 3,
    scope: 'Actual guide navigation/audits with only Pack entry duration extended to2s. Diagnostic stress, not an unmodified WebKit reproduction. No audit rules, serious/critical threshold, test deadline or production animation changed.' }, null, 2) + '\n');
  console.log(log.split('\n').filter(l => /passed|failed|contrastRatio/.test(l)).slice(-8).join('\n'));
  console.log(JSON.stringify({ output: out, before, exitCode: result.status }));
  if (before ? result.status === 0 || !log.includes('"id": "color-contrast"') || !/3 failed/.test(log) : result.status !== 0) process.exitCode = 1;
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
