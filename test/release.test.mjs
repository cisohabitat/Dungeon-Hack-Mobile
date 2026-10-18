import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { bump, bumpKind } from '../tools/release.mjs';
const tool = resolve('tools/release.mjs');

test('small additions and commit labels default to patches; milestones use explicit bumps', () => {
  assert.equal(bumpKind(['fix: a bug', '\nfeat(ui): portraits\n']), 'patch');
  assert.equal(bumpKind(['fix: a bug\n\nfeat: quoted example']), 'patch');
  assert.equal(bumpKind(['feat: puzzles', 'fix(save)!: new format']), 'patch');
  assert.equal(bumpKind(['fix: saves\n\nBREAKING CHANGE: old codes cannot load']), 'patch');
  assert.equal(bumpKind(['Improve portrait contrast']), 'patch');
  assert.equal(bump('1.2.3', 'major'), '2.0.0');
  assert.equal(bump('1.2.3', 'minor'), '1.3.0');
  assert.equal(bump('1.2.3', 'patch'), '1.2.4');
  assert.throws(() => bump('not-a-version', 'patch'));
  assert.throws(() => bump('1.0.0', 'anything'));
});
function fixture(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'deepdelve-release-test-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const write = (name, value) => writeFileSync(join(dir, name), value);
  const read = name => readFileSync(join(dir, name), 'utf8');
  const run = (args, env = {}) => spawnSync(process.execPath, [tool, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } });
  try {
    git('init', '-q'); git('config', 'user.name', 'Release test'); git('config', 'user.email', 'release@example.invalid');
    // A fresh clone must not inherit the real repo's hooks or signing settings.
    git('config', 'core.hooksPath', '/dev/null'); git('config', 'commit.gpgSign', 'false');
    mkdirSync(join(dir, 'js')); mkdirSync(join(dir, 'test'));
    write('package.json', JSON.stringify({ version: '1.2.3' }));
    write('package-lock.json', JSON.stringify({ version: '1.2.3', packages: { '': { version: '1.2.3' } } }));
    write('js/release.js', "export const RELEASE_VERSION = '1.2.3';\nexport const BUILD_NUMBER = 8;\n");
    write('sw.js', "const CACHE = 'deepdelve-v64';\n"); write('index.html', 'base');
    git('add', '.'); git('commit', '-qm', 'chore: baseline'); git('branch', '-M', 'main');
    fn({ git, write, read, run, base: git('rev-parse', 'HEAD') });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
for (const [message, version] of [['feat: puzzles', '1.2.4'], ['fix: layout', '1.2.4'], ['feat!: save format', '1.2.4']]) {
  test(`prepare and CI check cover ${message}`, () => fixture(({ git, write, read, run, base }) => {
    write('index.html', 'changed'); git('add', '.');
    let result = run(['prepare', '--message', message]); assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(read('package.json')).version, version);
    assert.equal(JSON.parse(read('package-lock.json')).packages[''].version, version);
    assert.match(read('js/release.js'), /BUILD_NUMBER = 9;/);
    assert.match(read('sw.js'), /deepdelve-v65/);
    git('add', '.'); result = run(['prepare', '--message', message]);
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /Already prepared/);
    git('commit', '-qm', message);
    result = run(['check'], { RELEASE_BASE: base }); assert.equal(result.status, 0, result.stderr);
    git('tag', `v${version}`);
    write('README.md', 'documentation only'); git('add', '.');
    result = run(['prepare', '--message', 'feat: documentation helper']);
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /unchanged/);
    assert.equal(JSON.parse(read('package.json')).version, version);
  }));
}
test('documentation and development tooling do not create releases', () => fixture(({ git, write, read, run }) => {
  write('README.md', 'docs'); write('test/helper.js', 'test'); git('add', '.');
  const before = read('js/release.js'), result = run(['prepare', '--message', 'feat: test helper']);
  assert.equal(result.status, 0, result.stderr); assert.equal(read('js/release.js'), before);
  assert.match(result.stdout, /unchanged/);
}));
test('CI rejects unversioned player changes and missing comparison refs', () => fixture(({ git, write, run, base }) => {
  write('index.html', 'changed'); git('add', '.'); git('commit', '-qm', 'feat: puzzles');
  assert.notEqual(run(['check'], { RELEASE_BASE: base }).status, 0);
  assert.notEqual(run(['check'], { RELEASE_BASE: '' }).status, 0);
}));
test('unstaged edits and non-main publication are rejected', () => fixture(({ write, run }) => {
  write('index.html', 'unstaged');
  assert.notEqual(run(['prepare']).status, 0);
  assert.notEqual(run(['publish'], { GITHUB_EVENT_NAME: 'pull_request', GITHUB_REF: 'refs/heads/main' }).status, 0);
}));
test('committed features are detected when preparing their next release', () => fixture(({ git, write, run, read }) => {
  write('index.html', 'changed'); git('add', '.'); git('commit', '-qm', 'feat: puzzles');
  const result = run(['prepare']); assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(read('package.json')).version, '1.2.4');
}));

test('publication creates once, reruns safely, and fails closed on API errors', () => fixture(({ git, run, write, read, base }) => {
  const dir = git('rev-parse', '--show-toplevel');
  git('remote', 'add', 'origin', dir);
  mkdirSync(join(dir, 'bin'));
  const fake = join(dir, 'bin/gh'), state = join(dir, 'releases.json');
  write('releases.json', '[]');
  writeFileSync(fake, `#!/usr/bin/env node
const fs = require('fs'), args = process.argv.slice(2), path = process.env.RELEASE_TEST_STATE;
if (process.env.RELEASE_TEST_API_FAIL) process.exit(1);
const releases = JSON.parse(fs.readFileSync(path, 'utf8'));
if (args[0] === 'api') console.log(process.env.GITHUB_SHA);
else if (args[1] === 'list') console.log(JSON.stringify(releases));
else if (args[1] === 'create') { releases.push({tagName: args[2], latest: args.includes('--latest')}); fs.writeFileSync(path, JSON.stringify(releases)); }
else process.exit(2);
`, { mode: 0o755 });
  const env = { PATH: `${join(dir, 'bin')}:${process.env.PATH}`, RELEASE_TEST_STATE: state, GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: base };
  let result = run(['publish'], { ...env, RELEASE_TEST_API_FAIL: '1' });
  assert.notEqual(result.status, 0); assert.equal(read('releases.json'), '[]');
  result = run(['publish'], env); assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(read('releases.json')).length, 1);
  assert.equal(JSON.parse(read('releases.json'))[0].latest, true);
  result = run(['publish'], env); assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(read('releases.json')).length, 1); assert.match(result.stdout, /already published/);
}));
test('version and build cannot move backwards or advance separately', () => fixture(({ git, write, run, base }) => {
  write('js/release.js', "export const RELEASE_VERSION = '1.2.3';\nexport const BUILD_NUMBER = 9;\n");
  git('add', '.'); git('commit', '-qm', 'chore: metadata');
  assert.notEqual(run(['check'], { RELEASE_BASE: base }).status, 0);
}));

for (const [kind, version] of [['minor', '1.3.0'], ['major', '2.0.0']]) {
  test(`an explicit ${kind} milestone is preserved`, () => fixture(({git, run, read, base}) => {
    const result = run(['prepare', '--bump', kind]); assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(read('package.json')).version, version);
    git('add', '.'); git('commit', '-qm', 'chore: reviewed milestone');
    assert.equal(run(['check'], {RELEASE_BASE: base}).status, 0);
  }));
}
test('owner-requested 0.9.0 reset preserves history and resumes patch increments', () => fixture(({git, run, read, write, base}) => {
  git('tag', 'v1.2.3');
  assert.notEqual(run(['prepare', '--reset-version', '0.9.0']).status, 0);
  const result = run(['prepare', '--reset-version', '0.9.0', '--reason', 'Owner requested pre-1.0 numbering']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(read('package.json')).version, '0.9.0');
  assert.match(read('js/release.js'), /BUILD_NUMBER = 9;/);
  assert.equal(git('rev-parse', 'v1.2.3'), base);
  git('add', '.'); git('commit', '-qm', 'chore: reset release numbering');
  assert.equal(run(['check'], {RELEASE_BASE: base}).status, 0);
  const reset = git('rev-parse', 'HEAD');
  git('tag', 'v0.9.0');
  write('index.html', 'small feature'); git('add', '.');
  assert.equal(run(['prepare', '--message', 'feat: more art']).status, 0);
  assert.equal(JSON.parse(read('package.json')).version, '0.9.1');
  git('add', '.'); git('commit', '-qm', 'feat: more art');
  assert.equal(run(['check'], {RELEASE_BASE: reset}).status, 0);
}));
test('a reset cannot mask gameplay changes or reuse an existing tag', () => fixture(({git, run, write}) => {
  write('index.html', 'changed'); git('add', '.');
  assert.notEqual(run(['prepare', '--reset-version', '0.9.0', '--reason', 'Owner request']).status, 0);
  git('reset', '--hard', 'HEAD'); git('tag', 'v0.9.0');
  assert.notEqual(run(['prepare', '--reset-version', '0.9.0', '--reason', 'Owner request']).status, 0);
}));
test('CI rejects an unrecorded downgrade and changes bundled into an audited reset', () => fixture(({git, run, write, base}) => {
  write('js/release.js', "export const RELEASE_VERSION = '0.9.0';\nexport const BUILD_NUMBER = 9;\n");
  write('package.json', JSON.stringify({version:'0.9.0'}));
  write('package-lock.json', JSON.stringify({version:'0.9.0',packages:{'':{version:'0.9.0'}}}));
  git('add', '.'); git('commit', '-qm', 'chore: unrecorded downgrade');
  assert.notEqual(run(['check'], {RELEASE_BASE: base}).status, 0);
  git('reset', '--hard', base);
  assert.equal(run(['prepare', '--reset-version', '0.9.0', '--reason', 'Owner request']).status, 0);
  write('index.html', 'hidden gameplay change'); git('add', '.'); git('commit', '-qm', 'chore: mixed reset');
  assert.notEqual(run(['check'], {RELEASE_BASE: base}).status, 0);
}));
test('an audited reset permits only the exact cache-number change', () => fixture(({git, run, write, read, base}) => {
  assert.equal(run(['prepare', '--reset-version', '0.9.0', '--reason', 'Owner request']).status, 0);
  write('sw.js', read('sw.js') + 'self.extraBehaviour = true;\n');
  git('add', '.'); git('commit', '-qm', 'chore: reset with unrelated worker code');
  assert.notEqual(run(['check'], {RELEASE_BASE: base}).status, 0);
}));
