# Batch A integration checks — 23 October 2026

Scope: Rat, Bat, Spider, Goblin, Skeleton, Zombie, Orc, Ghoul, Wraith and Ogre.
Existing supported pose objects select their reviewed atlases. Named champions
retain their procedural identities. No rules, targeting, combat timing, saves
or random-number streams changed, so balance simulations were not needed.

Completed visual/export checks:

- `python3 art/creatures/export-batch-a.py --check`: all ten atlases, shipped
  copies, two contact sheets and registration measurements reproduce exactly.
- `node art/creatures/preview-batch-a.cjs`: 50 real runtime captures at 390px and
  320px, no page/console errors; all preparation warnings visible.
- Corrected Goblin/Orc/Ogre steps and Zombie wind-up/hurt/blink inspected with
  their idle references. Painted lighting still varies naturally across poses.
- Focused `painted-creatures.spec.js`, phone and small projects: 18 passed.
  Covers all 23 species, cached poses, elite palettes, champion identities,
  unchanged dice, warning priority, Calm view, occlusion, corrupt/delayed
  fallbacks and installed offline native reload with every atlas.
- `npm run check:art`: 138 shipped paintings and three app icons reviewed and
  cached; source/export inventory matches recorded hashes.

`npm test` passed, including 17 release checks, type checking, 192 generated
levels, security/offline/audio checks and 751 rule checks in 74 files (zero
failures).

Isolated `PERF=1 ... --project=perf --workers=1` passed at 4× CPU slowdown:

| Scene | fps |
|---|---:|
| Fight | 46.9 |
| Wide fight | 45.4 |
| Flooded | 44.6 |
| Painted creatures | 40.5 |
| Lich rite | 56.9 |

Startup was 1,701 ms against the 6,000 ms limit. Thresholds remain 30 fps
(27 fps for wide view).

Local Chromium uses `/usr/bin/chromium` through a temporary Playwright config;
committed project matching and assertions are unchanged. Local regression and
isolated frame-rate checks passed. CI supplies
WebKit engine coverage; no physical iPhone Safari pass is claimed.

The full browser run exposed an existing clock-fixture precision issue in the
grouped shot-warning check: fractional `G.t` produced `0.7999999999999985` instead
of exact `0.8`. The fixture now starts at an integer millisecond before deriving
its warning interval. The original exact assertion and runtime are unchanged.
The affected spec is rechecked separately after the full run.

The initial full run was interrupted after 397 passes and one fixture precision
failure. The corrected warning test passed at both phone sizes. Completed
checks were retained through Playwright's test-list support; the final resumed
run passed all 380 selected checks. A coverage audit against the complete
phone/small inventory confirms **767 distinct checks passed, zero missing**.
The audit canonicalises runtime-added mobile tags and counts repeated tests
only once. No assertions, project matching or readiness deadlines were relaxed.

Local commands used the temporary system-Chromium config described above:
`npx playwright test --config=/tmp/dungeon-hack-batch-playwright.cjs
--project=phone --project=small`, then the same command with
`--test-list-invert=/tmp/dungeon-hack-completed-tests.txt --workers=2` to
complete the interrupted run. The corrected warning spec was explicitly
retained for rechecking. Release 0.9.29/build 44 and offline cache v104 were
prepared through the repository's release tooling. Publication follows the
normal main-branch Git/Vercel workflow and CI release gate.
