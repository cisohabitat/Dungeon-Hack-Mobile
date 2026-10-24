# Batch Z — remaining starting weapons

Runtime update: the selected exports are integrated for release0.9.35. See the
[native weapon activation review](../batch-zaa-runtime/REVIEW.md). The source-stage
findings and limits below are historical; they are separate from delivery evidence.

Priority1 source/review complete locally: **Cleric mace, Thief shortsword,
Ranger shortbow and Druid spear**.23 new registered frames; no shipped bindings,
offline entries, release metadata or game rules changed. This is unpublished
source work. The live game remains release0.9.34 with E–Y delivery.

## Scope and actual mappings

| Pair | Source/export frames | Existing selection |
|---|---|---|
| cleric/mace |9 | rest, drawback, windup, strike, cut, sweep, through, recover, return |
| thief/shortsword |9 | Same nine ordinary cut poses |
| ranger/shortbow |3 | rest, bowdraw, bowfull; string/arrow/drawing hand remain live |
| druid/spear |2 | rest/drive; one right hand, `two=false` |

All four pairs pass `Game.canEquip` and match the actual starting kits in data.js.
The earlier proposed dagger/Druid-staff follow-up order is superseded by these
more frequently visible starting weapons. Those alternate-kit items remain in AA.

Cleric keeps brown glove, gold cuff and ivory sleeve; Thief charcoal glove,
brown cuff and olive sleeve. Ranger retains the existing Fighter grey glove/cuff
and brown sleeve fallback, with no invented green palette. Druid keeps brown
glove, green cuff, brown sleeve, simple leaf-point spear and red binding.
Weathered metal, grain, leather and cloth match the approved mature held kit.
The mace retains its reference rounded head and short blunt knobs; the sword
stays shorter than the existing longsword. No new ornament, light or ability.

Spear is one-handed in current data. It uses the shaft thrust path, not the
nine-cut path, and does not select the staff-only channel pose. Cast/read/drink
reuse rest. All other classes, raw ids, named/reflected versions, wrong two-hand
modes and unselected off-hand/action poses remain native procedural fallbacks.

## Sources, repairs and registration

Original PNGs, all exact prompts/references, generated paths and tool-model
availability are in [generation manifest](../generation-batch-z.json).
Seven source/repair images are preserved: mace original/spacing correction,
shortsword original/spacing correction, shortbow original/arm correction and
spear original. The first shortsword request and first bow repair request were
rejected by input moderation with no image; clarified static prop/illustration
requests produced the selected results. Failed prompts and request IDs remain
in the manifest, without claiming a model version the tool did not disclose.

The original mace lower row overlapped nominal cell divisions; its selected
correction separates complete views. The shortsword correction removes the large
white fringe patches but still uses an approximate grid: its through/recover
figures are separated at authored row-specific x460 in the clear gap. No sleeve
is cut away, no neighbouring pixels included, no mask rewritten. Selected mace
upper sleeves have1–5px raw lower clearance, shortsword windup2px and bow full
forearm7px raw left clearance, below the requested8% padding. These complete-end
spacing exceptions are retained explicitly rather than claimed repaired away.
Minor source-edge colour flecks remain; at registered size they are subdued on
the reviewed dark/light/brown composites. Future changes require image-tool edits.

The original half/full bow cells omitted forearms. The selected correction has
three connected left forearms and brown sleeves, with coherent bends and no
painted string, arrow or drawing hand. Nocks are authored on the wrapped end tips;
`top` denotes the lower source endpoint, retaining the existing runtime convention.

`python3 art/creatures/export-batch-z.py --check` reproduces23 RGBA256 frames,
four family atlases, [contact](contact-sheet.png),
[registration review](registration-review.png), [alpha review](alpha-review.png)
and [measurements](measurements.json). Only crops, uniform family resizing,
translation and diagnostic layout are used. No pose rotation, mirroring, painting,
recolouring, alpha-mask repair or independent per-frame enlargement. Each family
uses a common scale; source proportions and source grip-to-object relationships
remain. Grips register within rounding of128,128. Registered visible silhouettes
(alpha>32) have>=12px clearance. Object bounds exclude the trailing sleeve.
Shortbow object height is capped110px to keep it distinct from T's longer bow;
other objects cap at128px. These are art-fit choices, not reach/range changes.

## Preview evidence

`node art/creatures/reference-batch-z.cjs` records23 original native held frames,
four reference grids, palettes, grips/nocks and equip legality.
`node art/creatures/preview-batch-z.cjs` uses an isolated exact
class/raw-id/pose/two/lit source proxy with frozen renderer states. It does not
alter shipped modules. The Fighter fixture HUD/log is retained and does not claim
real Cleric/Thief/Ranger/Druid runs or native combat outcomes. Some generic cast
stress states, including Thief cast, test renderer geometry only; no spell or
ability is added. Eight direct guard comparisons preserve original frame objects;
three visual controls retain off-class mace, named bow and wrong-two-hand spear.
The existing integrated Y Cleric shield remains native and is not substituted.

92 phone captures and eight galleries show46 states at390px/320px.276 fitting
and release cases cover those states at160/360/464 buffer heights, including258
painted cases and18 procedural visual controls. Object bounds stay in view;
sleeves may leave the viewport as before. Ordinary cut intermediates/recovery,
Calm, cast/read/drink, one-handed spear, shortbow half/full/pre-release/release/
recoil/recovery and named/off-class guards are included. Live string endpoints
agree with authored nocks within1px; arrow fletching is present before .72,
absent at .72 and during recoil, restored at rest. These are frozen-source
selection/fitting checks, not seamless native animation or warning/loot coverage.
No page/console errors. See [capture records](dungeon/review.json).

| Class |390px |320px |
|---|---|---|
| Cleric | [Gallery](dungeon/390-cleric-overview.png) | [Gallery](dungeon/320-cleric-overview.png) |
| Thief | [Gallery](dungeon/390-thief-overview.png) | [Gallery](dungeon/320-thief-overview.png) |
| Ranger | [Gallery](dungeon/390-ranger-overview.png) | [Gallery](dungeon/320-ranger-overview.png) |
| Druid | [Gallery](dungeon/390-druid-overview.png) | [Gallery](dungeon/320-druid-overview.png) |

## Validation and activation gates

Twelve existing held-equipment browser checks pass on phone/small (31.2s),
covering current fits, bow/knife release, Calm/named shapes and loot clearance.
They are baseline checks, not proof Z is delivered in the runtime. Export
reproduction, preview syntax, docs generation/currency, art inventory and diff
checks pass. No balance simulation or full runtime/performance run is required
for this reversible source-review draft: no rules or implementation changed.

23 decoded RGBA frames use5.75MiB pixel storage; cached copies may add5.75MiB
before browser/GPU overhead. This is an estimate, not a measured allocation.
Activation must lazy-load complete families with exact guards, retain independent
failure fallback, add reviewed bytes to the offline cache and review native
legal-kit equip/attack/recovery/read/drink/cast transitions and bow contact. Full
Chromium, isolated performance and CI including Safari remain publication gates.
Do not claim WebKit or physical-device acceptance from this source preview.

The roadmap now records priorities1–8 as Z–AG. Only priority1 is painted in this
pass. AA–AG remain planned; no automatic publication or new runtime binding.
