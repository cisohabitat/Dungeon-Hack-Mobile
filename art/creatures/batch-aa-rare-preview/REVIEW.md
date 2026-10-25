# AA rare scimitar and Dwarven Hammer — source review

63 class/state frames are complete locally, pending activation/publication.
Live0.9.37 remains unchanged:289 held frames,628 shipped paintings plus3 icons.
The preceding26 ranged/bow source frames remain intact and pending:89 local frames
total. No runtime loader, delivery list, rules, balance or release files changed.

| Weapon | Classes | Frames |
|---|---|---:|
| Dark Elf Scimitar | Fighter, Thief, Ranger, Spellblade plain |36 |
| Dark Elf Scimitar | Spellblade reflected |9 |
| Dwarven Hammer | Fighter, Cleric |18 |

Each group has rest/drawback/windup/strike/cut/sweep/through/recover/return, all
one-hand two=false.54 unique painted states and9 Ranger reuse states cover all6
legal class/item pairs in these two tier99 families. Native references block held
paintings and serviceworkers. All9 Fighter/Ranger native scimitar PNGs, grips,
weapon bounds and dimensions match before reuse. Their source crops, scales,
registered output bytes, grips and bounds remain identical with separate class
keys. Plain/reflected Spellblade groups use exact lit metadata and a shared scale.

## Production and visual review

Six original image-tool sheets plus two selected edge repair sheets are preserved,
with prompts, reference paths and original output paths in the generation manifest.
One initial Thief request produced no image; an identical retry succeeded. There
were9 image requests and8 outputs. Fighter scimitar and Cleric hammer edge repairs
were selected; originals remain retained. All8 outputs, native opaque grids, all63
registered frames/contact/registration/alpha diagnostics,14 phone galleries and
selected full-size captures were visually inspected. Opaque composites resolved
strong fringe artifacts in the transparent-image viewer. Small raw edge flecks
remain documented; no scripted alpha cleanup or painting occurred.

Scimitars retain broad curved steel, an angled curved tip, small silver guard,
tiny violet inset, dark wrap and silver pommel. Hammers retain a short wooden haft,
compact flat striking face, opposite pick, top spike and pale dwarven reinforcing
facets. Class glove/cuff/cloth palettes remain grey/brown, charcoal/olive,
charcoal/slate and brown/gold/ivory. Reflected Spellblade adds a restrained cached
cool edge and knuckle/cuff reflections without emissive light or changing blade
metal. Image-tool edits introduce small foreshortening differences between plain
and reflected poses; distinct registration retains their grips and full ends.

All tips, pommels, head/pick ends and forearms are complete in the source crops.
Several crops cross nominal grid gaps: bottom through/recover boundary450;
Thief strike/cut boundary390 and right-column sweep/return row800; reflected
Spellblade upper/middle boundary430. These authored rectangles avoid clipping or
neighbour traces without masks. Original gutters are narrower than the requested
8percent in places. Registered alpha>32 clearance is>=25px. Only crop, uniform
family scale, translation and diagnostic layouts were scripted. Atlas cell pixels
match individual exports exactly; measurement/export bytes reproduce.

## Source renderer evidence

208 frozen captures and14 galleries at390/320px cover all9 CUT states, recovery1,
Calm cut and cast/read/drink.624 fitting cases at160/360/464 renderer heights keep
weapon bounds inside the view with minimum clearance 3.50px. Seventeen
exact id/class/pose/two/lit guards per width preserve ineligible classes, unsupported
hand/pose/reflection requests, published hammer, named Penitent and bear fist.
Six visible controls retain original fallback art. Spellblade lit fixtures carry
the existing lantern; plain fixtures remove it. Source frames stay selected during
action-hand stress cases. Full Game.state and Dice/Odds comparisons pass without
excluding fields; recording is disabled before snapshots because renderState logs
API calls. No page/console errors occurred. All12 existing held-equipment phone/
small checks passed in31.2s after captures finished.

Both source viewports use height844;320px is a width check, not the native small
667px screen. Fighter HUD/class mutations and generic Fighter/Thief/Ranger casts
are review stress fixtures, not real class powers or native equip/action evidence.
The source fixtures do not prove offline integration, native combat, real quest
progress or performance. Activation requires those delivery/runtime gates and
whole-family fallback checks separately.

## Reproduce and remaining work

Run `python3 art/creatures/export-batch-aa-rare.py --check`,
`node art/creatures/reference-batch-aa-rare.cjs` and
`node art/creatures/preview-batch-aa-rare.cjs` from the repository root.
See [validation](validation.json), [coverage](coverage-audit.json),
[measurements](measurements.json), [native references](reference-inventory.json)
and [capture report](dungeon/review.json). Existing baseline command:
`npx playwright test 'held-equipment\.spec\.js$' --project=phone --project=small --workers=2`;
local execution selected system Chromium via a temporary config.

Next: Fighter greatsword released-hand art, then named/legendary/Mythic equipment
by actual identity. These two rare families are source-complete; the whole AA
library is still open.89 frames across this and the earlier two passes await
activation/publication.
