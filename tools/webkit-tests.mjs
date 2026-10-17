// Keep each native WebKit process independent. Closing a context is not the
// same as releasing its browser's renderer/media caches between game tests.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const cli = require.resolve('@playwright/test/cli');
const cwd = fileURLToPath(new URL('../', import.meta.url));
const base = ['test', '--project=safari', '--workers=1'];
const listOnly = process.argv.includes('--list');
if (process.argv.slice(2).some(a => a !== '--list')) throw new Error('Use --list to validate the plan without launching browsers.');
function list(extra = []) {
  const result = spawnSync(process.execPath, [cli, ...base, ...extra, '--list', '--reporter=json'], {
    cwd, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `Discovery exited ${result.status}`);
  return JSON.parse(result.stdout);
}
function cases(suites) {
  return suites.flatMap(s => [
    ...(s.specs || []).flatMap(spec => spec.tests.map(test => ({
      id: `${spec.id}/${test.projectId}`, title: spec.title,
    }))), ...cases(s.suites || []),
  ]);
}
const plan = list(), selected = cases(plan.suites);
if (!plan.config.fullyParallel || !selected.length) throw new Error('WebKit isolation needs a nonempty, fully parallel test collection.');
// Check the partition, rather than assume a shard still selects one test after
// somebody changes the suite. No mobile case may disappear or run twice.
const seen = new Set();
for (let n = 1; n <= selected.length; n++) {
  const shard = cases(list([`--shard=${n}/${selected.length}`]).suites);
  if (shard.length !== 1 || seen.has(shard[0].id)) throw new Error(`Shard ${n} is not one distinct test.`);
  seen.add(shard[0].id);
}
if (seen.size !== selected.length || selected.some(t => !seen.has(t.id))) throw new Error('The WebKit partition lost a selected test.');
console.log(`Validated isolation plan: ${selected.length} selected WebKit tests, one fresh browser per test.`);
if (!listOnly) {
  const failed = [];
  for (let n = 1; n <= selected.length; n++) {
    console.log(`WebKit process ${n}/${selected.length}`);
    const result = spawnSync(process.execPath, [cli, ...base, `--shard=${n}/${selected.length}`, `--output=test-results/webkit-${n}`], {
      cwd, stdio: 'inherit',
    });
    if (result.error) console.error(result.error.message);
    if (result.error || result.status !== 0) failed.push(n);
  }
  if (failed.length) {
    console.error(`WebKit failed in process(es): ${failed.join(', ')}`);
    process.exitCode = 1;
  }
}
