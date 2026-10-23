# Batch C integration checks — 23 October 2026

Local validation recorded before publication. The user authorised publication on
23 October 2026; release preparation and CI verification follow this record.

- `python3 art/creatures/export-batch-c.py --check`: ten nine-pose review and
  shipped atlases, contact sheets and registration measurements reproduce exactly.
- `node art/creatures/preview-batch-c.cjs`: 146 real runtime captures across
  390px and 320px; no page/console errors. All ten idle/preparation pairs were
  visually reviewed in the overview sheets, alongside representative special
  and strike captures. Thirty wind-up/special captures assert visible warnings.
- Painted-creature browser suite: **28 passed** across phone and small projects,
  including cached poses, alpha/lighting, elite tints, champion/companion isolation,
  dice invariance, corrupt/delayed loading, Calm view, occlusion and native offline
  reload. After correcting the zero-based keeper phase boundary, all four
  Batch C warning/variant checks passed again at both sizes.
- `npm test`: **passed**. Generator: 192 checked levels, no failures. Telemetry,
  security, narration, offline lifecycle and voice catalogue checks passed.
  Rules: **751 checks in 74 files, zero failures**.
- Final art inventory, agent guidance, TypeScript and whitespace checks passed.
- Isolated performance budget: **failed locally**; baseline comparison below.
  No thresholds or CPU-throttle settings were changed.

Browser commands used the repository's Playwright configuration through a local
wrapper at `/tmp/deepdelve-playwright.config.cjs`, selecting the preinstalled
`/usr/bin/chromium` and the repository's server working directory. No test
assertions, deadlines or thresholds were relaxed. Commands:

```
npx playwright test --config=/tmp/deepdelve-playwright.config.cjs test/browser/painted-creatures.spec.js --project=phone --project=small --workers=2
npx playwright test --config=/tmp/deepdelve-playwright.config.cjs test/browser/painted-creatures.spec.js --project=phone --project=small --workers=2 --grep 'Batch C'
PERF=1 npx playwright test --config=/tmp/deepdelve-playwright.config.cjs --project=perf --workers=1
```

WebKit/CI and physical iOS checks have not run; publication requires the repository's
normal release preparation and CI gates. This presentation-only change does not
require balance simulations. Barrel Mimics, submerged Drowned, later keeper
phases and Warlord throne/spear handling retain their existing pictures and rules.

## Performance comparison

Same system Chromium, one worker, seeded `perf-budget` scenes and 4× CPU throttle.
Both runs are isolated from the export, rules and other browser workers.
The unchanged baseline is commit `39361ad` in a detached worktree under
`/tmp/deepdelve-batch-c-baseline`, served on port 4174.

| Scene | Target fps | Batch C first | Baseline | Batch C final |
|---|---:|---:|---:|---:|
| Fight | 30 | 21.8 | 19.3 | 23.1 |
| Wide | 27 | 18.2 | 24.3 | 25.3 |
| Flooded | 30 | 22.0 | 27.6 | 26.9 |
| Painted crowd | 30 | 15.9 | 22.3 | 24.1 |
| Lich rite | 30 | 43.2 | 43.6 | 26.9 |

Startup: Batch C first 4,931ms; baseline 4,278ms; Batch C final 3,258ms.
All meet the 6,000ms startup limit. All three runs fail the unchanged frame-rate
budget. Per-scene variation is substantial, including the rite between Batch C
runs; these single-run comparisons do not establish a stable regression estimate.
Raw measurements and browser identity are preserved in `performance-results.json`.
Functional/art/offline checks pass locally. The user authorised proceeding with
publication after reviewing the baseline performance failure. CI performance and
WebKit remain required gates; no assertions or publication conditions are waived.
