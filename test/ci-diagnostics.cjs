'use strict';
// Exercise the real runner/reporter with a passing retry followed by another
// step, then a hard failure. No game test is changed to make these controls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deepdelve-ci-diagnostics-'));
const prefix = 'diagnostic-control-' + process.pid;
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'ci-diagnostics', name), 'utf8'));
const specs = report => report.suites.flatMap(function flatten(suite) {
  return [...(suite.specs || []), ...(suite.suites || []).flatMap(flatten)];
});
const run = (label, grep, retries) => {
  const result = spawnSync('sh', ['tools/run-browser-ci.sh', label, '--config', path.join(dir, 'config.cjs'),
    '--grep', grep, '--retries=' + retries, '--workers=1'], {
    cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 2 * 1024 * 1024,
  });
  assert.ifError(result.error);
  return result;
};
try {
  fs.writeFileSync(path.join(dir, 'config.cjs'), `
const base=require(${JSON.stringify(path.join(root, 'playwright.config.js'))});
const phone=base.projects.find(p=>p.name==='phone');
module.exports={...base,testDir:__dirname,testMatch:/control.spec.cjs/,webServer:undefined,
projects:[{...phone,use:{...phone.use,launchOptions:{...base.use.launchOptions,
${process.env.CHROMIUM_PATH ? 'executablePath:' + JSON.stringify(process.env.CHROMIUM_PATH) : ''}}}}]};
`);
  fs.writeFileSync(path.join(dir, 'control.spec.cjs'), `
const {test,expect}=require(${JSON.stringify(require.resolve('@playwright/test'))});
test('passing retry retains evidence',async({page},info)=>{
  await page.setContent('<p>Native browser control</p>');
  expect(info.retry,'deliberate first-attempt assertion').toBe(1);
});
test('serial followup passes',async({page})=>{
  await page.setContent('<p>Followup</p>');
  await expect(page.locator('p')).toHaveText('Followup');
});
test('hard failure stays failed',async({page})=>{
  await page.setContent('<p>Failure control</p>');
  expect(true,'deliberate hard failure').toBe(false);
});
`);
  const first = prefix + '-regular', second = prefix + '-offline', failed = prefix + '-failed';
  let result = run(first, 'passing retry', 1);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const report = read(first + '-results.json'), test = specs(report)[0].tests[0];
  assert.equal(test.status, 'flaky');
  assert.deepEqual(test.results.map(r => [r.retry, r.status]), [[0, 'failed'], [1, 'passed']]);
  assert.match(test.results[0].errors[0].message, /deliberate first-attempt assertion/);
  const trace = test.results[0].attachments.find(a => a.name === 'trace');
  assert.ok(trace && fs.existsSync(trace.path), 'a passing retry must retain its failed-attempt trace');
  result = run(second, 'serial followup', 0);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(specs(read(second + '-results.json'))[0].tests[0].status, 'expected');
  assert.ok(fs.existsSync(trace.path), 'the followup must not erase the first step trace');
  assert.deepEqual(read(first + '-results.json'), report, 'followup must not overwrite the first report');
  result = run(failed, 'hard failure', 0);
  assert.equal(result.status, 1, 'diagnostic collection must preserve a hard failure exit code');
  assert.equal(specs(read(failed + '-results.json'))[0].tests[0].status, 'unexpected');
  for (const label of [first, second, failed]) {
    const before = read(label + '-before.json'), after = read(label + '-after.json');
    assert.ok(before.recordedAt <= after.recordedAt);
    assert.ok(before.memory.text || before.memory.unavailable);
    assert.ok(Array.isArray(after.cgroupRoot));
    const log = fs.readFileSync(path.join(root, 'ci-diagnostics', label + '-browser.log'), 'utf8');
    assert.match(log, /<launching>/);
    assert.match(log, /process did exit/);
  }
  const invalid = spawnSync('sh', ['tools/run-browser-ci.sh', '../invalid'], {cwd: root});
  assert.equal(invalid.status, 2);
  console.log(JSON.stringify({result: 'passed', controls: ['passing retry retains failed trace/report',
    'serial followup preserves previous evidence', 'hard failure exits 1', 'native launch/exit logs',
    'before/after resource snapshots', 'invalid label rejected'], artifactPrefix: prefix}, null, 2));
} finally {
  fs.rmSync(dir, {recursive: true, force: true});
}
