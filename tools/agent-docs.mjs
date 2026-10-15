// Keep the instructions read by coding agents in step with the source notes.
import { readFileSync, writeFileSync } from 'node:fs';

const source = new URL('../CLAUDE.md', import.meta.url);
const target = new URL('../AGENTS.md', import.meta.url);
const expected = '<!-- Generated from CLAUDE.md by npm run docs:agents; edit CLAUDE.md, then regenerate. -->\n\n' + readFileSync(source, 'utf8');

if (process.argv.includes('--check')) {
  let actual = '';
  try { actual = readFileSync(target, 'utf8'); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (actual !== expected) {
    console.error('AGENTS.md is missing or out of date. Update CLAUDE.md, then run npm run docs:agents and commit both files.');
    process.exitCode = 1;
  } else console.log('Agent guidance is in sync.');
} else {
  writeFileSync(target, expected);
  console.log('Wrote AGENTS.md from CLAUDE.md.');
}
