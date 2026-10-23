# Batch D integration checks — 23 October 2026

Local implementation on `codex/batch-d-atlases`, based on `c698f5a`.
Release metadata is prepared as 0.9.32, build47, offline cache107. No push or
publication is part of this local change. WebKit/CI and physical iOS checks have
not run; the repository's normal CI gates still apply to publication.

## Art and focused runtime checks

- Ten source sheets, eight selected complete-sheet repairs and all ninety final
  256px cells visually reviewed against their existing bestiary portraits.
- Ten review/shipped atlases match byte for byte. The exporter checks one shared
  scale per identity, visible alpha clearance and registration; Shade and Orla
  use measured torso anchors, grounded creatures use visible baseline row236.
- The runtime preview script captures **160 supported poses** at 390px and 320px,
  plus both overview sheets. All idle/preparation pairs and representative steps,
  strikes, hurt and specials were visually inspected in the actual dungeon.
  Twenty-eight wind-up/special captures assert visible attack marks. Every capture
  asserts current HUD intent rather than retaining a preceding frame's label.
  There are no page/console errors. The script uses shipped images and the actual
  runtime loader, with no module or image substitutions.
- Focused painted-creature suite: **36 passed** across phone and small, covering
  independent cached poses/palettes, lighting, named champion identity, procedural
  class Shades (including gear-loading gaps), warnings, Calm view, wall occlusion,
  dice/state invariance, corrupt/delayed atlas fallbacks and native offline reload.
- Existing reviewed image hashes are unchanged. New images are recorded in
  `art/review.json`; art inventory/offline entries and agent guidance checks pass.
- Balance simulation is unnecessary: this change only substitutes renderer art;
  combat, abilities, timing, targeting, scale, visibility, saves and map dice do
  not change. Unsupported reserve cells do not introduce actions.

## Performance

The unchanged 4× CPU budget ran on one worker using the same system Chromium,
`perf-budget` and `perf-start` seeds. Thresholds and assertions were not changed.
Baseline is a detached worktree at `c698f5a`; each measurement ran separately
from exports, rules and other browser workers. The first Batch D measurement
missed the painted-crowd budget. The repeated Batch D run passed every scene
and startup limit, as did both baseline runs. Keep the first result as evidence
of local variability; these pairs do not establish a stable regression estimate.

| Scene | Minimum fps | Baseline first | Batch D first | Baseline repeat | Batch D repeat |
|---|---:|---:|---:|---:|---:|
| Fight | 30 | 57.4 | 45.4 | 45.8 | 53.1 |
| Wide | 27 | 57.1 | 38.7 | 51.1 | 48.4 |
| Flooded | 30 | 44.7 | 37.9 | 39.5 | 46.9 |
| Painted crowd | 30 | 36.9 | 20.9 | 37.9 | 36.6 |
| Lich rite | 30 | 60.1 | 58.3 | 57.0 | 48.9 |

Startup times: baseline first 2051ms, Batch D first 1675ms, baseline repeat
2049ms, Batch D repeat 2085ms, all below 6000ms. Raw measurements and browser
identity are preserved in `performance-results.json`.

## Commands and environment

Dependencies came from the committed lock file. The local Playwright wrapper
selects preinstalled `/usr/bin/chromium` (154.0.8037.57) and the repository server
without changing any test deadline, threshold or assertion. WebKit was not
installed in this container. Commands used:

```
python3 art/creatures/export-batch-d.py --check
node art/creatures/preview-batch-d.cjs
npm test
node_modules/.bin/playwright test --config=/tmp/deepdelve-playwright.config.cjs test/browser/painted-creatures.spec.js --project=phone --project=small --workers=2
node_modules/.bin/playwright test --config=/tmp/deepdelve-playwright.config.cjs --project=phone --project=small --workers=4
PERF=1 node_modules/.bin/playwright test --config=/tmp/deepdelve-playwright.config.cjs --project=perf --workers=1
```

Main test suite: **passed**, including release tooling, TypeScript, 192 generated
levels, security, telemetry, narration, offline lifecycle and voice catalogue.
Rules: **751 checks in 74 files, zero failures**.

Full Chromium coverage: **all 785 collected cases have passing results**, across
both phone and small projects. `browser-coverage.json` records project counts,
phase counts and identical hashes for the expected and passing test-name sets.
No case is missing or waived. The main two-worker continuation finished with
697 passes and one companion pose assertion failure; that unchanged assertion
passed alone in 6.5s. All Batch D cases passed in the focused and full runs.

The initial four-worker pass had four art timing failures (25-second deferred
readiness and three 60-second render/queue waits). Seventy other cases passed
before that run was paused. The unchanged checkout passed deferred readiness
alone in 9.4s; Batch D passed it in 9.3s, and all four failed cases passed alone
in 43.1s. Another twelve cases passed before reducing concurrency to two workers.
A resumed runner briefly reused a shutting-down server and received connection
refusals; those failures were discarded, a dedicated fresh server was enforced,
and the affected cases were rerun. The two cases that passed before that server
closed were retained. Playwright's explicit test-list filter excluded only
previously passing cases; reporter-added option tags were normalised against
the complete collection for the final coverage audit. Assertions, deadlines,
CPU throttle and performance thresholds were not changed.
