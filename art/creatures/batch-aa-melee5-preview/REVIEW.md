# AA melee5 — all remaining basic melee source pairs

Local source/review work only; not activated, committed or published. Live0.9.36
still has495 shipped paintings and156 held frames. The preceding36 club frames
remain intact and local:133 class/state bindings across the two pending passes.

## Coverage

| Weapon | Class | States |
|---|---|---:|
| Mace | Fighter |9 |
| Shortsword | Fighter, Ranger |18 |
| Shortsword | Spellblade, plain and reflected |18 |
| Longsword | Thief, Ranger |18 |
| Longsword | Spellblade, plain and reflected |18 |
| Quarterstaff | Fighter, Cleric, Druid |12 |
| Spear | Fighter, Ranger |4 |

97 class/state frames across12 legal class/item pairs and14 atlas groups.
77 newly painted unique poses;20 reused states. Ranger shortsword9 and spear2
share new Fighter source pixels only after native PNG, grip, bounds and dimensions
match exactly. Ranger longsword9 copies approved registered T Fighter PNGs and
measurements byte for byte after the same native audit. Separate class keys remain.
See `reference-inventory.json` for all three per-pose reuse proofs and legal pairs.
The references deliberately block held paintings and service workers; these are
procedural construction references, not runtime failure/offline tests.

## Painting and registration

Mature worn materials match the approved held art: Fighter/Ranger grey gauntlets
and brown cloth, Thief charcoal/brown/olive, Spellblade charcoal/slate/dark blue-grey,
Cleric brown/gold/ivory and Druid brown/green/brown. Keep the round blunt-knobbed
mace, plain steel swords, blue-capped ordinary quarterstaff and red-bound spear.
These are ordinary items, separate from named/legendary identities.

11 original image-tool sheets include two reflected Spellblade edits. Eight
additional repair requests clean four plain sword sheets, two reflected sheets,
and the Cleric staff twice. All19 successful requests retain exact prompts,
references and generated source paths in `generation-batch-aa-melee5.json`.
No scripted painting, recolouring, mirroring, rotation or alpha masking. Scripts
only crop, uniformly resize each family, translate and compose review layouts.

Source cells do not all meet the requested8% transparent gutters. Authored complete
object crops use inspected extents plus3px padding, including poses crossing a
nominal grid gap. Tiny coloured/grey fringes remain after image-tool repairs;
registered alpha reviews show their actual small-scale appearance. The first
Cleric repair retained cut-off sleeve ends and white scraps; the second restores
rounded complete sleeves. Reflected shortsword edges are slightly stronger than
longsword edges; neither adds light, aura or visibility. Plain/reflected pairs
share one minimum family scale, avoiding a size jump solely from registration.

All exports are256px RGBA, with authored closed-hand grips and full prop bounds.
Minimum registered alpha>32 clearance is28px across all97 cells.
Mace/shortsword caps112px; longsword/staff/spear caps128px. Actual rendered scale
may be smaller to preserve width/alpha clearance; crop dimensions do not enlarge
props independently. Ranger longsword retains the original T registration exactly.
Bounds include downward sword tips and the Druid channel staff butt. Staff tips
are authored separately for the existing small surface glint. Preserve this `tip`
metadata through the common exporter and loader during future activation; do not
claim the older Mage T source already supplies it.

## Source previews and checks

`preview-batch-aa-melee5.cjs` freezes game updates and substitutes exact
id/class/pose/two/lit review frames.368 unique phone captures plus28 class/atlas
galleries at390px/320px;1,104 fitting cases across160/360/464 dungeon heights.
All97 frames are exercised.13 direct protected fallback guards per width retain
wrong classes, hand counts, lit flags, poses, named items and existing paintings.
Seven visible controls per width retain published Cleric mace, Thief shortsword,
Fighter longsword, Mage staff, Druid spear, wrong-hand mace and named Penitent.
Staff reading/drinking/casting release the lower hand; early casting and channel
select separately. Glint path centres match the authored painted tip, and Calm
suppresses the glint. Spear/staff attack expectations use the existing shaft
rest/drive motion; swords/mace use all9 CUT states. No page/console errors.

These are renderer fixtures on a Fighter HUD, not native class creation/equipment,
real attacks, new abilities, offline operation, loader failures or performance
measurements. Fighter/Thief/Ranger generic casts are stress fixtures only. Existing
12 held-equipment browser checks pass separately at both widths in31.7s. Export reproduction,
JavaScript syntax, art inventory, generated instructions and whitespace checks pass.

Reproduce:

- `node art/creatures/reference-batch-aa-melee5.cjs`
- `python3 art/creatures/export-batch-aa-melee5.py --check`
- `node art/creatures/preview-batch-aa-melee5.cjs`

## Remaining work

Activate these97 and the preceding36 club frames through exact guarded families,
propagating staff tip metadata and all explicit reflected states. Preserve existing
named/unsupported-hand fallback, independent whole-family readiness and offline
coverage. Native class/equip/action checks, corrupt/missing-family fallback,
service-worker offline reload, complete release suites and isolated performance
remain activation/publication gates. No balance or game rules changed.

All ordinary basic melee class pairs now have source art. This is not all held
art: greatsword freed-hand variants, rare scimitar/dwarfhammer, ranged props and
named/legendary/Mythic variants remain. See the roadmap and coverage-audit.json.

679 new rasters are hash-registered in `art/review.json`. See `validation.json`
for source counts and reproducibility checks.1,062 fitting cases draw new frames;
42 retain protected controls. No existing reviewed raster changed.

## Subsequent runtime activation

The historical source-only findings above are retained. This pass is integrated
locally for0.9.37; publication validation is tracked in the combined
[runtime review](../batch-aa-melee45-runtime/REVIEW.md).
