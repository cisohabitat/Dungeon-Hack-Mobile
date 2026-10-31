# AAA3: generated shrine landmarks

Baseline: published v0.9.72/main `6cf2a3ca5378817641d85429b3e30577697bdc28`.
The Safari offline CI blocker is cleared before this phase: all11 jobs passed,
1,278 browser cases had zero failures/retries, including both core offline
WebKit cases. The original nine-scene FPS gate passed. Human listening stays
skipped; physical devices and independent AAA assessment remain open.

## Finding and change

Actual generated defiled, ordinary and kept shrine rooms in Mossy Depths, Grey
Hold and Drowned Halls name an altar but show loose centre loot, without an
encounter shrine in that location. The native review supplies legal inspection
poses through save/load and safety HP; geometry, population, updates, images and
clocks remain native. Entrances use their actual generated positions. These
are controlled composition reviews, not unassisted exploration or balance proof.

The implementation uses rows152–255 of the existing approved `shrine.webp`, without
its encounter idol or flame tips. It caches the crop and five shade frames once.
A decorative0.65-scale stone base remains after loot collection. Existing centre
offerings and a sealed puzzle coffer rise0.2; positions, scatter, size, glint,
rarity, native bobbing, reward filtering and pickup behavior remain. Its floor
sort anchor groups the base and raised objects while keeping their actual
projection, wall occlusion, fog and lighting. Ordinary floor loot stays native.
No source painting, new asset URL, generation, guard, collision, light, saved
field, interaction or random stream changes. Legacy room shapes and centre NPCs
retain their existing presentation. Delayed/corrupt art retains native floor loot.

## Evidence and verification

`capture.cjs` records the actual entrances, centre approaches and close treasure
views for all three variants. Native action requests retain observed position/
direction changes; blocked movement is not claimed as a walk. Baseline and
candidate views share spatial poses but their live population and clock differ.
The isolated forwarding draw-order fixture supplies a clear floor and eight
camera angles; it is separate from native action evidence.

`validation.json` records native source hashes, focused and complete browser
checks, the original FPS sample, and the subsequent CI/publication evidence.
Every ordinary release gate remains required. This bounded shrine improvement
does not complete broader keeper/layout staging or certify an AAA grade.

Compare the same Grey Hold inspection pose in
[the baseline](before-390/09-treasure.png) and
[the candidate](native-390/09-treasure.png). Other representative close views:
[defiled Mossy shrine](native-390/02-treasure.png),
[kept Drowned shrine](native-390/11-treasure.png),
[320px](native-320/09-treasure.png),
[landscape](native-740/09-treasure.png) and
[Calm](native-calm320/09-treasure.png).
All36 final views share the recorded candidate source hashes.

Reproduce with existing dependencies and system Chromium:

```sh
AAA3_KEYS=2,9,11 AAA3_WIDTH=390 AAA3_ACTIONS=1 AAA3_OUT=/tmp/shrine-review node docs/visual/2026-10-31-shrine-staging/capture.cjs
```

Use width320 or740, and `AAA3_CALM=1` for Calm view. Baseline reproduction
requires the recorded v0.9.72 runtime; current checkout captures the candidate.

Final local verification passed all1,039 distinct Chromium cases:662 phone
and377 small-phone cases, including10 serial offline cases, with zero failures,
skips or retries. The offline all-art reload also creates the altar crop from
the cached existing source. The native and browser source hashes match.
Headless fallback, typecheck and actual renderer draw order at eight angles
passed. The original isolated nine-scene FPS sample missed wet surfaces at
25.7FPS against30; the other eight scenes passed, including decals31.2 and
rite51.2, with startup2,131ms. The retained [failure log](performance-local.log)
and validation keep that miss separate from fresh required CI. No unchanged
rerun, reduced scene or lowered threshold clears it.
