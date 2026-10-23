# Batch B integration checks — 23 October 2026

Scope: Troll, Minotaur, Kobold Trapper, Goblin Archer, Basilisk, Dark Acolyte,
Glimmer Moth, Thornhog, Gutter Imp and Goblin Cutpurse. Existing supported pose
objects select their reviewed atlases; reserve cells introduce no new actions.
Gorrum and other named champions keep their own art. No gameplay rules, timing,
saves or random-number streams changed, so balance simulations were unnecessary.

Completed source/export and focused checks:

- `python3 art/creatures/export-batch-b.py --check`: ten review/shipped atlases,
  three comparison sheets and measured registration reproduce exactly.
- `node art/creatures/preview-batch-b.cjs`: 100 captures using shipped images
  and the actual runtime loader at 390px and 320px; no module/image routes,
  no page/console errors, every preparation warning visible. Both overviews
  were inspected after integration; sources and all 90 cells were reviewed
  before integration, including repaired steps and coherent palette sheets.
- Focused `painted-creatures.spec.js` on phone and small: 22 passed. Covers all
  33 species, cached supported poses, elite palettes, Gorrum isolation,
  unchanged dice/recordings, warning priority, Calm view, occlusion, corrupt
  and delayed fallbacks, and installed native offline reloads with every atlas.
- `npm test`: passed, including release metadata, type checking, 192 generated
  levels, security/offline/audio checks and 751 rule checks in 74 files.
- The artwork inventory now covers 148 shipped paintings and three app icons.

Local browser checks use system Chromium through a temporary Playwright config.
Full Chromium and isolated performance results are recorded after completion.
CI supplies WebKit coverage; no physical iPhone Safari pass is claimed.

Full local regression: **771 passed** across the phone and small projects
(51.3 minutes). No failures or skipped cases.

Isolated frame-rate budget passed at 4× CPU slowdown with unchanged thresholds:

| Scene | fps |
|---|---:|
| Fight | 41.3 |
| Wide fight | 36.0 |
| Flooded | 37.3 |
| Painted crowd including Troll, Minotaur, Archer and Moth | 34.0 |
| Lich rite | 54.6 |

Startup: 1,575 ms against 6,000 ms. Minimums remain 30 fps, 27 fps wide.
`npm run check:art` confirms all 148 shipped paintings and three icons are
reviewed, their hashes current and offline assets present. Release metadata
was prepared before browser workers: version 0.9.30, build 45, cache 105.
