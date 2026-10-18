// Prepare immutable release metadata before committing; publish only tested main.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const read = path => readFileSync(path, 'utf8');
// A feature commit can still be a small addition. Larger version milestones
// are a deliberate --bump decision, never inferred from commit labels.
export function bumpKind(_messages) { return 'patch'; }
const RESET_FILE = 'tools/version-resets.json';
const resets = () => existsSync(RESET_FILE) ? JSON.parse(read(RESET_FILE)) : [];
export function bump(version, kind) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Expected a stable semantic version.');
  const [a, b, c] = version.split('.').map(Number);
  if (![a, b, c].every(Number.isSafeInteger)) throw new Error('Version is too large.');
  if (kind === 'major') return `${a + 1}.0.0`;
  if (kind === 'minor') return `${a}.${b + 1}.0`;
  if (kind === 'patch') return `${a}.${b}.${c + 1}`;
  throw new Error('Bump must be major, minor or patch.');
}
function metadata(text) {
  const version = text.match(/RELEASE_VERSION = '([0-9]+\.[0-9]+\.[0-9]+)'/)?.[1];
  const build = Number(text.match(/BUILD_NUMBER = (\d+);/)?.[1]);
  if (!version || !Number.isSafeInteger(build) || build < 1) throw new Error('Invalid release metadata.');
  return { version, build };
}
function validate() {
  const release = metadata(read('js/release.js'));
  const pkg = JSON.parse(read('package.json')), lock = JSON.parse(read('package-lock.json'));
  if ([pkg.version, lock.version, lock.packages[''].version].some(v => v !== release.version)) throw new Error('Release/package/lock versions differ.');
  return release;
}
function playerFile(path) {
  return /^(?:js\/|css\/|img\/|icons\/|api\/|[^/]+\.(?:html|js)$|manifest\.json$|sw\.js$|vercel\.json$)/.test(path)
    && !['js/release.js', 'js/types.js', 'playwright.config.js'].includes(path)
    || /^sound\/.*\.(?:json|ogg|m4a)$/.test(path) && !/^sound\/(?:masters|narration\/(?:brief|provenance|production)\.json)/.test(path)
      && !['sound/manifest.json', 'sound/production.json', 'sound/validation.json'].includes(path);
}
function changed(base, staged = false) {
  const args = ['diff', ...(staged ? ['--cached'] : []), '--name-only', '-z', base, '--'];
  return execFileSync('git', args, { encoding: 'utf8' }).split('\0').filter(playerFile);
}
function messages(base) {
  return git('log', '--format=%B%x00', `${base}..HEAD`).split('\0');
}
function prepare(options) {
  // A staged snapshot makes omitted/untracked files explicit and avoids mixing
  // somebody's unrelated working edits into a release.
  if (git('diff', '--name-only')) throw new Error('Stage intended changes first; unstaged tracked files remain.');
  const current = validate();
  const base = git('log', '-1', '--format=%H', '--', 'js/release.js');
  const original = metadata(git('show', `${base}:js/release.js`));
  if (current.version !== original.version || current.build !== original.build) {
    console.log(`Already prepared ${current.version}, build ${current.build}.`); return;
  }
  const tag = `v${current.version}`;
  const comparison = git('tag', '--list', tag) ? git('rev-list', '-1', tag) : base;
  const files = changed(comparison, true);
  if (!files.length && !options.bump && !options['reset-version']) { console.log('No player-facing changes; version/build unchanged.'); return; }
  const kind = options.bump || bumpKind([...messages(comparison), options.message || '']);
  const version = options['reset-version'] || bump(current.version, kind), build = current.build + 1;
  if (options['reset-version']) {
    bump(version, 'patch'); // Validate before any file is written.
    if (options.bump || !options.reason?.trim()) throw new Error('A version reset requires --reason and cannot use --bump.');
    const order = version.split('.').map(Number).reduce((n, v, i) => n || Math.sign(v - Number(current.version.split('.')[i])), 0);
    if (order >= 0) throw new Error('A reset must name a lower version. Use --bump for ordinary releases.');
    if (files.some(f => f !== 'sw.js')) throw new Error('Publish version resets separately from player-facing changes.');
    if (git('tag', '--list', `v${version}`)) throw new Error('The reset version already has a tag; never reuse published versions.');
  } else if (options.reason) throw new Error('--reason is only used with --reset-version.');
  if (!Number.isSafeInteger(build) || `${version} (build ${build})`.length > 32) throw new Error('Release exceeds telemetry limits.');
  const sw = read('sw.js'), match = sw.match(/const CACHE = 'deepdelve-v(\d+)';/);
  if (!match) throw new Error('Unknown service-worker cache format.');
  if (options['reset-version']) {
    const records = resets();
    records.push({ from: current.version, fromBuild: current.build, to: version, toBuild: build, reason: options.reason.trim() });
    mkdirSync('tools', { recursive: true });
    writeFileSync(RESET_FILE, JSON.stringify(records, null, 2) + '\n');
  }
  const pkg = JSON.parse(read('package.json')), lock = JSON.parse(read('package-lock.json'));
  pkg.version = lock.version = lock.packages[''].version = version;
  writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
  writeFileSync('js/release.js', read('js/release.js').replace(/RELEASE_VERSION = '[^']+'/, `RELEASE_VERSION = '${version}'`).replace(/BUILD_NUMBER = \d+;/, `BUILD_NUMBER = ${build};`));
  writeFileSync('sw.js', sw.replace(match[0], `const CACHE = 'deepdelve-v${Number(match[1]) + 1}';`));
  console.log(`Prepared ${options['reset-version'] ? 'numbering reset' : kind + ' release'} ${version}, build ${build}. Stage package.json, package-lock.json, js/release.js, sw.js${options['reset-version'] ? ' and ' + RESET_FILE : ''} before committing.`);
}
function check(base) {
  const current = validate();
  if (!base || /^0+$/.test(base)) throw new Error('A real comparison commit is required.');
  // Validate refs as commits before using them in revision expressions.
  base = git('rev-parse', '--verify', `${base}^{commit}`);
  const prior = metadata(git('show', `${base}:js/release.js`));
  const order = current.version.split('.').map(Number).reduce((n, v, i) => n || Math.sign(v - Number(prior.version.split('.')[i])), 0);
  if (order < 0) {
    const entries = resets();
    const entry = entries.find(r => r.from === prior.version && r.fromBuild === prior.build && r.to === current.version && r.toBuild === current.build && typeof r.reason === 'string' && r.reason.trim());
    const before = git('ls-tree', '--name-only', base, '--', RESET_FILE) ? JSON.parse(git('show', `${base}:${RESET_FILE}`)) : [];
    const oldSw = execFileSync('git', ['show', `${base}:sw.js`], { encoding: 'utf8' }), cache = oldSw.match(/const CACHE = 'deepdelve-v(\d+)';/);
    if (!entry || current.build !== prior.build + 1 || entries.length !== before.length + 1
      || JSON.stringify(entries.slice(0, -1)) !== JSON.stringify(before) || entries.at(-1) !== entry
      || changed(base).some(f => f !== 'sw.js') || !cache
      || read('sw.js') !== oldSw.replace(cache[0], `const CACHE = 'deepdelve-v${Number(cache[1]) + 1}';`)) {
      throw new Error('A version reset needs a new matching audit record, one newer build/cache and no gameplay changes.');
    }
    return console.log(`Authorised version reset ${prior.version} to ${current.version}, build ${current.build}: ${entry.reason}`);
  }
  if (current.build < prior.build || (order > 0) !== (current.build > prior.build)) throw new Error('Version and build must advance together, never backwards.');
  if (!changed(base).length) return console.log('No player-facing changes to version.');
  const kind = bumpKind(messages(base));
  const floor = bump(prior.version, kind).split('.').map(Number);
  const actual = current.version.split('.').map(Number);
  const compare = actual.reduce((n, v, i) => n || Math.sign(v - floor[i]), 0);
  if (current.build <= prior.build || compare < 0) throw new Error(`Player-facing changes need at least ${kind} ${floor.join('.')} and a newer build. Run release:prepare.`);
  console.log(`Release ${current.version}, build ${current.build}, covers the ${kind} changes.`);
}
function publish() {
  if (process.env.GITHUB_EVENT_NAME !== 'push' || process.env.GITHUB_REF !== 'refs/heads/main' || git('rev-parse', 'HEAD') !== process.env.GITHUB_SHA) throw new Error('Publishing requires the tested main push commit.');
  const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' });
  const remote = gh('api', 'repos/{owner}/{repo}/git/ref/heads/main', '--jq', '.object.sha').trim();
  if (remote !== process.env.GITHUB_SHA) return console.log('A newer main commit exists; leave publishing to its CI run.');
  const { version } = validate(), tag = `v${version}`, commit = process.env.GITHUB_SHA.slice(0, 7);
  // A failed API request must fail the job, never be mistaken for a missing release.
  const releases = JSON.parse(gh('release', 'list', '--limit', '1000', '--json', 'tagName'));
  if (releases.some(r => r.tagName === tag)) return console.log(`${tag} is already published; nothing to do.`);
  const tagged = git('tag', '--list', tag);
  if (tagged && git('rev-list', '-1', tag) !== process.env.GITHUB_SHA) throw new Error('Existing tag points elsewhere; refusing to move it.');
  gh('release', 'create', tag, '--target', process.env.GITHUB_SHA, '--title', `Deepdelve ${version} · ${commit}`, '--latest', '--generate-notes', '--notes', `Release ${version}, commit ${commit}. All required CI jobs passed.`, ...(tagged ? ['--verify-tag'] : []));
  console.log(`Published ${tag}, commit ${commit}.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [command, ...args] = process.argv.slice(2), options = {};
    while (args.length) {
      const arg = args.shift();
      if (!['--message', '--bump', '--reset-version', '--reason'].includes(arg) || !args.length) throw new Error('Use prepare [--message TEXT] [--bump patch|minor|major] or [--reset-version VERSION --reason TEXT], check or publish.');
      options[arg.slice(2)] = args.shift();
    }
    if (command === 'prepare') prepare(options);
    else if (command === 'check') check(process.env.RELEASE_BASE);
    else if (command === 'publish') publish();
    else throw new Error('Expected prepare, check or publish.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
