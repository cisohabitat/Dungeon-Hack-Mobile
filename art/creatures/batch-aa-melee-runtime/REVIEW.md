# AA ordinary melee activation — release0.9.36

81 additional held frames are integrated:72 reviewed unlit class frames from
AA melee2/3 plus9 matching Spellblade lantern-reflected poses. The common delivery
exporter now covers327 files, including156 held frames.495 paintings and3 app
icons are included in the offline cache. No game rules, visibility or balance change.

| Pair | New frames | Source |
|---|---|---|
| Fighter/hammer |9 CUT |AA melee2 |
| Fighter/flail |9 CUT |AA melee2 |
| Cleric/flail |9 CUT |AA melee2 |
| Mage/dagger |9 CUT |AA melee2 |
| Fighter/dagger |9 CUT |AA melee3 |
| Ranger/dagger |9 CUT, matching Fighter pixels |AA melee3 |
| Druid/dagger |9 CUT |AA melee3 |
| Spellblade/dagger |9 plain +9 reflected CUT |AA melee3 + reflection correction |

[Second source review](../batch-aa-melee2-preview/REVIEW.md) and
[third source review](../batch-aa-melee3-preview/REVIEW.md) retain historical
frozen-proxy scope, exact image prompts and source findings. Ranger's nine native
reference PNGs/grips/bounds and exported pictures match Fighter exactly. Class
keys remain separate; no runtime deduplication or shared failure is assumed.

## Native reflection correction

The first native pass showed zero painted draws for Spellblade: its normal
lantern requests lit=true, while the reviewed source was explicitly unlit.
Those preliminary captures are excluded from final evidence. The correction
uses an image-tool edit, not a scripted source recolour, to retain the silver
blade/brass fittings/class cloth with muted blue reflected edges. No new light
or aura is introduced. Exact prompt, source and generated path are recorded in
[the manifest](../generation-batch-aa-reflected.json) and
[brief](../REQUEST-batch-aa-reflected.md).

[Reflected contact](../batch-aa-reflected-preview/contact-sheet.png),
[registration](../batch-aa-reflected-preview/registration-review.png),
[alpha comparison](../batch-aa-reflected-preview/alpha-review.png) and
[measurements](../batch-aa-reflected-preview/measurements.json) cover all nine
new RGBA256 states. Crop gaps and minor raw edge/gutter exceptions remain from
the unlit source. Export only crops, uniformly resizes, translates and lays out
pixels. Small review-layout spacing was corrected before final visual inspection.

The catalog now records an explicit lit boolean. The loader requires exact
id/class/pose/two/lit, retaining other reflected, off-class, named, left-hand,
unsupported-pose and wrong-hand-count fallbacks. Plain/reflected Spellblade
pictures switch as one complete eighteen-frame family; a failed reflected file
keeps both variants procedural. Other class/weapon families remain independent.
The loader remains lazy and cached; no per-frame painting or image decoding.
The81 added PNGs total1,366,911 bytes (1.30MiB) on disk. A9-frame
256px RGBA family is2.25MiB decoded before browser copies/GPU; Spellblade
plain/reflected together are4.5MiB. Families decode only when requested.

## Native action and offline evidence

`preview-batch-aa-melee-runtime.cjs` starts actual classes through the creation
UI, supplies legal equipment/resources, clears scenery and places durable targets.
Spellblade is unlocked through the five real title taps. Game.update and renderer
continue normally; there are no asset routes, frozen updates or picture/renderer
substitutions. A passive drawImage observer forwards every draw unchanged and
rejects actions that never use a painted family.

Both390/320 phone widths cover all eight legal pairs with real attacks, consumed
mapping scrolls/healing potions, native Calm menu controls, save and offline
reload/Continue. Cleric casts Cure Light Wounds; Mage casts Shield; Druid casts
Thorn Lash at a supplied target; Spellblade casts Spellguard. No Fighter/Ranger
casting power is invented. Existing shields and lantern/action hands remain;
normal Spellblade attacks/read/drink/casts use the reflected painting.

[Capture metadata](captures.json) records equipment, item consumption, action
clocks, advancing game time, observed painted draws, exact capture files and
console errors. Native timing under load may skip a short CUT boundary; all
source poses are separately reviewed. Early white hit flashes and ordinary
hit/miss receipts remain. This is not unassisted combat, exhaustive warning/
occlusion coverage or a physical iOS test.

All248 final captures and16 galleries were visually reviewed and their264 raster
hashes registered. All16 contexts cache156 held frames and report zero page/
console errors. Every native action records painted draws; Spellblade uses the
reflected keys throughout.

The source-reference helpers explicitly block painted held requests/service
workers, so their procedural geometry remains reproducible after activation.
This deliberate reference isolation is separate from the native activation
harness and browser fallback/offline checks.

## Reproduce

```sh
python3 art/creatures/export-batch-aa-melee2.py --check
python3 art/creatures/export-batch-aa-melee3.py --check
python3 art/creatures/export-batch-aa-reflected.py --check
python3 tools/export-painted-runtime.py --check
node art/creatures/preview-batch-aa-melee-runtime.cjs
npm test
npx playwright test --project=phone --project=small
PERF=1 npx playwright test --project=perf --workers=1
```

Focused checks pass: six class-family corruption cases and two all-pose fitting
cases across both phone widths. The latter cover243 exact painted frame/height
bindings per width (486 total), unchanged state and dice, and no clipped bounds.
An initial fixture snapshot preceded render-state preparation, which updates
monster interpolation; the snapshot now follows preparation, matching the existing
held-equipment tests. All assertions and object/dice bounds remain unchanged.

`npm test` passes:751 rules across74 files, types, release tooling, generator,
security/telemetry, narration, offline lifecycle, voice catalogue and art/docs
checks. Rules ran in one low-priority process alongside browsers (13m17s for
rules); this is not a performance benchmark. All327 delivery files reproduce
byte-for-byte; all246 previous files retain their earlier hashes. Source exports,
script syntax, documentation links and whitespace checks pass.

Both complete Chromium projects pass all809 cases in53.5 minutes:544 phone and
265 smallest-phone, including native offline/failure/binding checks and the
corrected fitting fixture. No application or deadline changes were needed.

The isolated4xCPU frame budget passes in55.3s: fight49.2, wide42.9, flooded39.4,
painted35.9 and rite56.9 FPS; startup1970ms. Thresholds remain30FPS, wide27FPS
and startup6000ms. These are Linux Chromium observations, not physical iOS
validation or a claimed performance improvement.

Fresh post-commit release identity checks, the exact-commit pre-push hook and
all main CI jobs (including Safari and version publication) govern publication.

After activation, both procedural reference helpers reproduce all81 reference
rasters byte-for-byte (40 second-pass,41 third-pass). Painted requests and
service workers are deliberately blocked only in those source-reference helpers.
