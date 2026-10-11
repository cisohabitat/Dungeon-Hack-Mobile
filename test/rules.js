'use strict';
// Rule-level regression checks. These load the real game logic and exercise the
// edge cases that are easy to break and hard to notice in play.
//
// The checks themselves are in test/rules-<subject>.js, one file a subject, each
// exporting a function that takes the helpers they share (test/rules-lib.js). This
// file finds them, shares them out over a few processes (in one process the suite
// took near five minutes) and prints one last line, which CI, the pre-push hook
// and `npm test` read along with the exit code:
//   rule checks complete, N failure(s): ...
// WORKERS=1 runs every file in this process, one after another, for debugging;
// ONLY="part of a name" runs the matching checks alone, in every file; TIMES=1
// says how the files were shared out and how long each took.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { fork } = require('child_process');

/** Run these files in this process, each with the shared helpers, and say what was counted. */
async function runFiles(names) {
  const h = require('./rules-lib');
  for (const name of names) {
    const t0 = Date.now();
    await require('./' + name)(h);
    if (process.env.TIMES) console.error(`  ${name} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  return h.counts();
}

/** The files of checks, in name order. */
function listFiles() {
  return fs.readdirSync(__dirname).filter(f => /^rules-.+\.js$/.test(f) && f !== 'rules-lib.js').sort();
}

/**
 * About how long a file runs alone, in seconds: what it says of itself (`weight`), or else its
 * size, which is a fair guide for all but the one check that swings a sword 180,000 times.
 */
function weightOf(file) {
  const said = require('./' + file).weight;
  return said || fs.statSync(path.join(__dirname, file)).size / 4000;
}

/** Share the files out by weight, the heaviest first and each to the lightest process so far. */
function shareOut(files, workers) {
  const bins = Array.from({ length: workers }, () => ({ weight: 0, files: [] }));
  const weighed = files.map(f => [f, weightOf(f)]).sort((a, b) => b[1] - a[1]);
  for (const [f, weight] of weighed) {
    const bin = bins.reduce((a, b) => (b.weight < a.weight ? b : a));
    bin.weight += weight;
    bin.files.push(f);
  }
  return bins.filter(b => b.files.length).map(b => b.files);
}

/** Run one share of the files in a child process; what it counted, or null if it died first. */
function inChild(files) {
  return new Promise(resolve => {
    const child = fork(__filename, files, { env: { ...process.env, RULES_WORKER: '1' } });
    let counts = null;
    child.on('message', m => { counts = m; });
    child.on('error', e => { console.error('THROW: a worker could not start -', e.message); resolve(null); });
    child.on('exit', code => {
      if (!counts) console.error(`THROW: a worker died before it reported (exit ${code}): ${files.join(' ')}`);
      resolve(counts);
    });
  });
}

async function main() {
  const t0 = Date.now();
  const files = listFiles();
  const workers = Math.max(1, Math.min(files.length, Number(process.env.WORKERS) || Math.min(4, os.cpus().length)));
  let ran = 0, failures = 0;
  if (workers === 1) {
    ({ ran, failures } = await runFiles(files));
  } else {
    const shares = shareOut(files, workers);
    if (process.env.TIMES) shares.forEach((s, i) => console.error(`process ${i + 1}: ${s.join(' ')}`));
    for (const counts of await Promise.all(shares.map(inChild))) {
      if (counts) { ran += counts.ran; failures += counts.failures; } else failures++;
    }
  }
  const secs = Math.round((Date.now() - t0) / 1000);
  console.log(`rule checks complete, ${failures} failure(s): ${ran} checks in ${files.length} files, ${workers} process(es), ${Math.floor(secs / 60)}m${String(secs % 60).padStart(2, '0')}s`);
  process.exitCode = failures ? 1 : 0;
  // the game's modules may leave a timer running: do not let one hold the process open
  setTimeout(() => process.exit(), 1000).unref();
}

if (process.env.RULES_WORKER) {
  // a child: run the files named on the command line, report what was counted, and go
  runFiles(process.argv.slice(2))
    .then(counts => process.send(counts, () => process.exit(0)))
    .catch(e => { console.error(e); process.exit(2); });
} else {
  main().catch(e => { console.error(e); process.exit(1); });
}
