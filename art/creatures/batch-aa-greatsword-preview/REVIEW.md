# AA Fighter greatsword released-hand source review

Nine released-hand CUT frames are complete locally, pending activation/publication.
Live0.9.37 stays unchanged:289 held frames,628 shipped paintings plus3 icons.
The89 earlier ranged/bow/rare source frames remain intact;98 total await activation.
No runtime loader, serviceworker, rules, balance or release files changed.

## Scope and production

Fighter is the only legal greatsword class. New two=false, lit=false frames cover
rest/drawback/windup/strike/cut/sweep/through/recover/return. The renderer keeps the
current CUT pose during overlapping read/use/cast while releasing the lower hand;
converting rest alone would leave those other requests procedural. All9 existing
two=true frames remain published and byte-unchanged. Reflected Fighter art is not
requested by the renderer, so no reflected variant was invented.

One image-tool edit of approved held-aa4 plus one windup repair were generated.
The first output retained the former left forearm in top-right; the selected repair
restores a single primary right forearm descending below that raised grip, as in
the native reference. Both originals and exact prompts/reference/output paths
remain in the manifest. The long straight silver blade, brass guard/pommel, dark
wrap, grey gauntlet/steel cuff and brown sleeve retain the approved mature painted
style. Lower grip/pommel are exposed where the second hand lets go. Minor painted
shading/foreshortening differences remain between original and released sources;
no pixel-identical transition geometry claim is made.

Both outputs, native one-/two-hand opaque grids, all9 registered cells/contact/
registration/alpha diagnostics, the hand-release comparison,12 phone galleries
and selected full-size captures were visually reviewed. Full blade/guard/pommel,
fingers and single connected right sleeve remain inside source crops. Small raw
edge flecks remain; opaque diagnostics avoid misleading transparent-view fringe.
No scripted painting, masks, recolours, mirroring or rotation occurred: only crop,
uniform family scale, translation and diagnostic layouts.

Authored crop boundaries cross nominal gaps: bottom through/recover450 and
recover/return900; right-column upper/middle row430 and middle/lower row800.
These retain full forearm ends and return tip without neighbour traces. Original
gutters are narrower than the requested8percent in places. Registered alpha>32
clearance is>=37px. Atlas cell pixels equal individual exports; measurements and
all diagnostic/export bytes reproduce.

## Renderer evidence

130 frozen captures and12 galleries at390/320px cover all9 original two-hand poses,
all9 released poses during each read/drink/cast overlap, Calm cut, action phases
0/.001/.15/.5/.999/1, reading precedence over drinking, completion during a cut,
and fallback controls.390 fixture checks at renderer heights160/360/464 comprise
270 new weapon bounds checks,96 protected published two-hand draws and24 other
fallback checks. New prop clearance is>=3.63px.90 captures draw new art,
32 draw the published two-hand family and8 preserve other fallback art.

Reading/drinking release from phase0 until before1. Cast uses sin(progress*pi),
so phase0 and phase1 retain two-hand art while0<phase<1 selects released art.
Each active read/drink/cast produces exactly one procedural action-hand request;
reading suppresses drinking when both clocks overlap. Those action hands can be
below the viewport at entry/exit; call counts do not imply visibility at every
boundary. When the action ends, the current two-hand CUT frame returns.

22 direct exact id/class/pose/two/lit guards per width protect every published
nine-state two-hand binding, all other classes, unsupported/reflected requests,
other weapons and bare hands. Visible controls retain reflected ineligible
Spellblade, ineligible Thief, published Fighter longsword and bear hand fallbacks.
Fighter reflection is a direct guard only because renderer reflections require
Spellblade's lantern. The published greatsword family is explicitly awaited before
mapping its images: lazy loading otherwise swaps provisional procedural frames.
Full Game.state and Dice/Odds comparisons pass without excluding fields; recording
is disabled before snapshots because renderState calls normally append events.
No page/console errors occurred. All12 existing held-equipment phone/small browser
checks passed in29.4s after capture completion.

These frozen fixtures use a Fighter HUD, modified view/clocks and paused updates.
Generic Fighter casting is a stress fixture, not a new class power or real cast.
Both review viewports are844px tall;320px is a width check, separate from native
small-device baseline coverage. This is not native equip/action, offline delivery
or performance evidence. Activation must add these9 to the existing9 as one
18-state Fighter greatsword family with complete failure/offline/runtime gates.

## Reproduce and next work

Run `python3 art/creatures/export-batch-aa-greatsword.py --check`,
`node art/creatures/reference-batch-aa-greatsword.cjs` and
`node art/creatures/preview-batch-aa-greatsword.cjs` from the repository root.
See [validation](validation.json), [coverage](coverage-audit.json),
[measurements](measurements.json), [native references](reference-inventory.json),
[hand comparison](hand-release-review.png) and [captures](dungeon/review.json).
Baseline command: `npx playwright test 'held-equipment\.spec\.js$' --project=phone --project=small --workers=2`;
local execution selected system Chromium via a temporary config.

Next source work is named, legendary and Mythic equipment, audited by actual
identity. Greatsword hand coverage is source-complete; the whole AA library remains
open. Live action hands, bow strings/arrows and moving projectiles stay procedural.
