# AA ranged — sling, throwing knife and hand crossbow

Source-complete locally, pending activation and publication. Live0.9.37 remains
unchanged:289 held frames,628 shipped paintings plus3 icons. No runtime bindings,
service-worker list or game rules changed.

| Weapon | Legal classes | Painted states |
|---|---|---:|
| Sling | Fighter, Cleric, Thief, Druid, Ranger | loaded rest + empty loosed:10 |
| Throwing knife | Fighter, Mage, Thief, Ranger | rest:4 |
| Dark Elf Hand Crossbow | Fighter, Thief, Ranger | rest:3 |

17 class/state frames across12 legal class/item pairs;13 unique new paintings
from9 image-tool originals and4 exact Ranger reuse states. Native procedural
references block held paintings and service workers. Fighter/Ranger PNG pixels,
grips, object bounds and dimensions match for all three weapons before reuse;
exports assert equality while retaining separate class keys. Spellblade is not
eligible for these weapons; no reflected states were invented.

## Visual review

All9 originals,17 registered frames, contact/registration/alpha diagnostics and
24 class galleries at390/320px were inspected. Slings retain a single loaded grey
stone or empty dark pouch, a retention cord and free knotted end. Knives are single
narrow guardless blades with dark wrap and ring pommels. Crossbows keep the short
steel prod, pale drawn string, seated bolt and modest violet inset. Class gloves,
bare hands and brown/white/green/purple cloth follow native references and the
approved mature painted held-art style. Pouch tails, blade/ring ends and crossbow
prod/string/bolt ends remain complete. Minor original edge flecks remain; no
scripted repainting, palette swaps, rotation, mirroring or alpha cleanup occurred.
Only authored crop, uniform scale, translation and review layouts were scripted.
Minimum alpha>32 registration clearance is 15px. Atlas cells equal individual
exports exactly; registration and measurements reproduce byte for byte.

## Motion and boundary review

292 frozen captures,24 galleries and876 fits cover both viewport widths and
renderer heights160/360/464. Minimum measured prop clearance is 3.55px.
Sling whirl remains procedural with one live cord, stone only before progress.55,
and bare fist; source empty pouch begins at.62 and loaded rest returns at1.
Throwing knife changes to bare fist at.4, returning at1. Crossbow preserves its
existing rest art/seated bolt throughout recoil; no unloaded state was added.
Combat projectile release constants remain knife.4, sling.55 and crossbow.32.
These source fixtures inspect renderer boundaries; they do not simulate actual
projectile travel or hits. Calm, reading, drinking and casting stress fixtures
retain existing action hands; Fighter/Thief/Ranger generic casts are not new powers.

20 direct exact-key/class/pose/two/lit fallback guards per width protect illegal
classes, unsupported states, named Vashti, fists and published longsword art.
Visible controls preserve native/published fallback. Full Game.state and Dice/Odds
comparisons pass. Recording is disabled before the fixture snapshot because each
renderState API call normally appends a recording event. No state fields are
excluded from the comparison. No page/console errors occurred.

Both review viewports use height844;320px is a width check, not the actual667px
small-device screen. The existing phone/small baseline suite separately passed
all12 held-equipment cases in31.5s. Source review does not establish native equip,
combat, offline loading or performance; those remain activation gates.

## Reproduce and remaining work

Run `python3 art/creatures/export-batch-aa-ranged.py --check`,
`node art/creatures/reference-batch-aa-ranged.cjs` and
`node art/creatures/preview-batch-aa-ranged.cjs` from the repository root.
See [measurements](measurements.json), [validation](validation.json),
[coverage](coverage-audit.json), [native references](reference-inventory.json)
and [capture report](dungeon/review.json).

Next source gaps include Fighter/Thief shortbow and Fighter longbow, then rare
scimitar/dwarfhammer, greatsword released-hand states and the named/legendary/Mythic
library. This pass completes the three requested weapons, not every ranged atlas.
