# Treasure readability: steady hovering in Calm view

Baseline: published main `a39229f09708dc820ca9bf8ba9cee6fc033e2137`, v0.9.74.

## Finding and change

Native generated treasure approaches in Grey Halls, Blue Vaults, the Warrens,
Dark Elf Halls and Old Forges provide no clear reason to rearrange loot or add
scenery. The review instead found a motion-setting defect: Calm already
suppresses treasure glints, but the Heart and named relics continue to bob.
At a supplied two-tile projection pose, the baseline Heart moves nearly6px
vertically, including with unavailable staging art.

`motion.js` now supplies a steady hover offset only for floating treasure.
The renderer selects it when Calm is active. The original normal-view sine,
phase, amplitude, scatter, sprite sizes and glints remain intact. The Heart keeps
its0.17 plinth lift, or0.04 loading/failure lift; a named relic keeps0.04 plus
any existing0.2 altar lift. Bases and ordinary loot keep their previous offsets.
The setting can change live without changing sprites or saves.

No artwork bytes, asset requests, tiles, light sources, loot, pickup locks,
collisions, encounters, timing rules or dice change. Recorded historical balance
measurements remain applicable: this is a cosmetic motion-setting fix, not a
new reward or gameplay feature. Human listening stays skipped; physical devices,
unassisted usability and an independent AAA regrade remain open.

## Evidence boundaries

`capture.cjs` records running generated floors using shipped art and native
updates/inputs. Safety HP and legal inspection poses are supplied through
save/load. Actions record observed position changes; blocked inputs are not
successful walks. Hold frames use the actual clock. These are controlled native
inspections, not unassisted play or physical-device evidence. The named-relic
case uses the naturally placed Shadowskin in the12-floor Blue Vaults.

`compare.cjs` separately loads the exact baseline renderer for a frozen-state
source comparison on a supplied shrine fixture. All72 normal-view comparisons
and24 ordinary-gold Calm controls retain identical pixels.46 floating-treasure
Calm images change as the intended bob is removed. This is controlled projection
evidence, not native action footage or balance clearance.

The regression cases in `painted-world.spec.js` measure actual forwarded drawing
positions across five times and three render heights, including unavailable
altar/plinth art. Gold stays steady in both settings, normal treasure moves,
and Calm treasure stays steady. Copied exploration arrays isolate the renderer's
expected map-reveal writes; game state and both dice streams remain unchanged.

Two initial fixture setup attempts failed before measuring the bug: the camera
was aimed at the old player position, then expected map-exploration writes
invalidated a read-only assertion. Their logs remain separate from the corrected
baseline, which fails specifically on nearly6px of unwanted Calm motion. The
first focused invocation discovered the standalone file was outside the small
project's explicit suite list; the cases were moved into the existing covered
painted-world suite. All four focused Chromium cases then passed. Existing test
policies, budgets and retries are unchanged.

## Reproduce

Use repository dependencies and system Chromium:

```sh
AAA3_KEYS=0,3,7,8,12 AAA3_ACTIONS=1 AAA3_WIDTH=390 AAA3_OUT=/tmp/treasure-review node docs/visual/2026-10-31-treasure-readability/capture.cjs
AAA3_KEYS=relic-vault AAA3_ACTIONS=1 AAA3_WIDTH=320 AAA3_CALM=1 AAA3_OUT=/tmp/treasure-calm node docs/visual/2026-10-31-treasure-readability/capture.cjs
TREASURE_COMPARE_OUT=/tmp/treasure-comparison.json node docs/visual/2026-10-31-treasure-readability/compare.cjs
```

Use width740 for landscape. Source routing exists only in the explicitly labelled
frozen comparison; final native captures use the actual current modules.
`validation.json` records completed checks and prepared source hashes. Full
Chromium, isolated FPS, exact-commit pre-push rules and all required CI jobs remain
publication gates. This slice does not approve keeper relocation or close AAA3.

Representative final native views: [390px](native-390/12-treasure.png),
[320px](native-320/relic-vault-treasure.png),
[Double/Calm](native-calm320/relic-vault-treasure.png) and
[landscape](native-740/relic-vault-treasure.png). All12 final native sessions
match the recorded rendering-source hashes of the prepared release. Native populations and clocks can
differ between inspection sessions; only the frozen matrix claims pixel equality.

The original isolated local FPS run missed decals at27.9FPS and wet surfaces at
29.4 against30. Other seven scenes and startup1,921ms passed. The
[retained log](performance-local.log.gz) records that miss; an unchanged rerun cannot
clear it. Required CI still runs the complete original gate before publication.

After deployment identity and bytes are verified, `live-smoke.cjs` observes the
actual running game at320px Double/Calm. It forwards the existing drawing calls
and checks the generated relic's steady projection while game time advances.
It supplies a legal inspection pose and safety HP, without replacing source,
images, the renderer or clocks. Run it on this release's checkout:

```sh
TREASURE_LIVE_SHA="$(git rev-parse HEAD)" TREASURE_LIVE_OUT=/tmp/treasure-live node docs/visual/2026-10-31-treasure-readability/live-smoke.cjs
```

Full local Chromium verification passed all1,045 distinct cases:665 phone and
380 smallest-phone cases, including10 serial full-cache offline cases. There
were zero failures, skips or retries. Prepared runtime hashes remain unchanged.
The local running-loop probe also passed:67 forwarded relic draws had zero
vertical span while game time advanced normally. Its baseline development-server
stamp identifies the working-tree test, not a published commit. Deployed identity,
exact resource bytes and production loop behavior are checked after publication.

Captured logs are stored as gzip archives to preserve the original reporter bytes,
including whitespace; raw originals remain in the recorded workspace evidence.
