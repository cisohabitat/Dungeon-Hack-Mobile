'use strict';
// Compare discovery under the previous/current real project configurations.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const baseline = process.env.AUDIT_BASE || 'f15a96a3012b424f9357e85a3e11dbfeb9d80ff9';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deepdelve-ci-inventory-'));
const source = execFileSync('git', ['show', baseline + ':playwright.config.js'], {cwd: root, encoding: 'utf8'});
try {
  const previous = {exports: {}};
  const scopedRequire = require('node:module').createRequire(path.join(root, 'playwright.config.js'));
  new Function('require', 'module', 'exports', source)(scopedRequire, previous, previous.exports);
  const current = require(path.join(root, 'playwright.config.js'));
  for (const key of ['timeout', 'expect', 'fullyParallel', 'workers', 'retries', 'use', 'projects', 'webServer']) {
    assert.deepEqual(current[key], previous.exports[key], key + ' policy must stay unchanged');
  }
  const configs = {
    before: `const scopedRequire=require('node:module').createRequire(${JSON.stringify(path.join(root, 'playwright.config.js'))});
const loaded={exports:{}};new Function('require','module','exports',${JSON.stringify(source)})(scopedRequire,loaded,loaded.exports);
const base=loaded.exports;`,
    after: `const base=require(${JSON.stringify(path.join(root, 'playwright.config.js'))});`,
  };
  const inventories = {};
  for (const [label, load] of Object.entries(configs)) {
    const config = path.join(dir, label + '.cjs');
    fs.writeFileSync(config, load + `\nmodule.exports={...base,testDir:${JSON.stringify(path.join(root, 'test/browser'))},webServer:undefined};\n`);
    const data = JSON.parse(execFileSync(process.execPath, [require.resolve('@playwright/test/cli'),
      'test', '--config', config, '--list', '--reporter=json'], {cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024}));
    assert.deepEqual(data.errors, []);
    const cases = [];
    function walk(suites, parents = []) {
      for (const suite of suites || []) {
        for (const spec of suite.specs || []) for (const test of spec.tests) {
          cases.push({project: test.projectName, file: spec.file, line: spec.line,
            title: [...parents, suite.title, spec.title].join(' > ')});
        }
        walk(suite.suites, [...parents, suite.title]);
      }
    }
    walk(data.suites);
    inventories[label] = cases.sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  assert.deepEqual(inventories.after, inventories.before, 'discovered cases/projects must stay identical');
  const counts = {};
  for (const item of inventories.after) counts[item.project] = (counts[item.project] || 0) + 1;
  const output = {baseline, identical: true, policiesUnchanged: true, counts, cases: inventories.after};
  fs.writeFileSync(path.join(__dirname, 'inventory.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify({baseline, identical: true, policiesUnchanged: true, counts}));
} finally { fs.rmSync(dir, {recursive: true, force: true}); }
