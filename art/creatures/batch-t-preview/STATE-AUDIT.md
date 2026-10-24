# Batch T held-equipment state and format audit

## Audit and selected scope

Audited heldart.js, heldview.js, renderer.js, itemart.js and assets.js. The
[inventory](reference-inventory.json) records 18 base held weapon keys across
seven class palettes, plus fist/cast hands: 140 guide captures. This tests visual
availability, not legality of every class/weapon pairing. The three selected
Fighter/longsword, Mage/staff and Ranger/longbow pairs separately pass canEquip.
Sixteen selected pose references plus three group sheets and an overview are
preserved. Inventory icons and named/relic illustrations are not commissioned.

The concrete style gap is the smooth, low-detail procedural first-person material
beside painted creatures/props. T selects three representative families, not the
whole held library. Four other class palettes, other weapons, shields/foci, fists,
casting hands, Wild Shape, named/reflected variants and extra poses stay procedural.
Reuse P's two Rune shield rear sources; its live null-carried gap remains unchanged.
HAND_COLORS has no Ranger entry, so Ranger currently uses Fighter grey glove/cuff
and brown sleeve. This pass preserves that fallback rather than inventing green.

## Exact pose coverage

| Class/key | Painted poses | Grip |
|---|---|---|
| fighter/longsword | rest, drawback, windup, strike, cut, sweep, through, recover, return | One right hand |
| mage/staff | rest, drive | Two bare hands |
| mage/staff | rest, channel | One right hand |
| ranger/longbow | rest, bowdraw, bowfull | One left hand; string/arrow/right hand live |

The source proxy matches exact raw id, class, pose, two-handed flag and lit=false.
It does not strip named prefixes. Six identity guards prove original results for
another class, wrong two-hand mode, lit/reflected frame, mythic bow, casting hand
and an uncovered dagger. They are reference equality checks against original
Assets.held. Carried equipment is not overridden; the P Rune shield gap stays null.

Fighter cut positions remain controlled by meleePose's existing key times
0/.08/.16/.24/.32/.42/.52/.68/.84/1. Blade directions are reference-authored,
not script rotations. At1 the normal rest frame returns. Calm retains the
existing sword cut pose while suppressing its existing visual motion effects;
do not invent a Calm-specific sword frame. Inter-pose perceptual continuity still
needs native animation acceptance; authored shading/foreshortening varies slightly.

Staff uses shaft thrust rest/drive. Cast cu=(now-castAt)/520 and strength=sin(cu*pi):
rest below .3, channel above .3, always one hand while casting. Reading/using
also release the lower staff hand, retaining procedural action/casting hands.
The harness exercises two-hand rest/drive and one-hand rest/channel/read/use.
No duration, impact, range, grip permission or third hand is added.

Bow pull is the existing eased .16-to-.50 draw and .72-to-.79 spring-home path;
release is .72. Source frames contain no string/arrow/drawing hand. Authored
nock endpoints feed the existing live string; upper/lower endpoint names preserve
the original at.top/at.bot convention (top is the lower source endpoint).
Half-draw correction is selected after grip registration. Nock midpoint offsets
from each grip increase from rest to half to full. Calm selects the rest bend and
keeps the existing live string/hand rules; it does not freeze every string point.

## Registration and fitting

All cells are256 RGBA. Author-measured source grips, complete-object bounds and
bow nocks are transformed by crop/scale/translation only. One shared uniform
scale per family preserves source proportions. Object height is capped128px and
width192px before native heldPlacement; sleeves may leave screen as before.
No pixels are painted, recoloured, mirrored, warped or rotated by exporters.
All registered alpha silhouettes have >=12px clearance. Original through-pose
sleeve has only3px raw-sheet clearance but remains intact and separated from the
next cell; this documented source-spacing exception is not clipping in the export.
Target grips stay at128,128 up to integer registration rounding. Conservative
object bounds exclude the forearm while including weapon ends and guards.

The renderer fits object bounds using existing handK/heldPlacement, retaining
anchor attachment. 162 fixture cases cover27 states x3 heights(160/360/464) at
both widths; 150 exercise painted frames,12 retain guarded procedural frames.
Actual painted object boxes stay within view. Nock/string endpoint mismatch is
<=1px and arrow fletching appears before .72, disappears at .72 and returns at
idle recovery. These are frozen renderer checks, not actual attack outcomes.

## Evidence and remaining delivery

54 captures (27 at each390/320px) and six galleries cover all16 selected frames,
recovery, Calm, staff hand changes, bow release/recoil and named/off-class controls.
No page/console errors. Twelve existing held-equipment browser tests pass at both
widths, covering native fitting, bow/knife release, Calm, named silhouettes and
loot clearance. These baseline tests do not establish painted loader integration.

Four source/repair PNGs, exact prompts/references, source crops, generated paths
and failed-request metadata remain in the generation manifest. The first bow edit
was rejected by the image service with no image; a clarified nonviolent prop
request produced the selected full-strip correction. Original source remains.
Light/dark/brown alpha composites have no rectangular black background. Source
blue orb and metal highlights add no lights. New named/rarity/reflection treatment
must be reviewed separately; the prototype deliberately retains original variants.

Before runtime delivery: exact per-slot lazy loading/failure fallback, offline
coverage, native equip/unequip/read/use/cast/attack outcomes, transition continuity,
reflected/named materials, screen occlusion and isolated frame-time/memory checks.
Sixteen decoded256 RGBA cells are4MiB raw, excluding duplicate image/canvas/GPU
storage and derived frames. This is an estimate, not a measured runtime allocation.
No loader, game rules, save, service-worker or carried-shield fix is included.
S source/review assets are published alongside T; its runtime integration remains pending.
