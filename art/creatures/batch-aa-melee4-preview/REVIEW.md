# AA ordinary melee — fourth source pass: clubs

36 painted frames are complete and reviewed locally, covering all four classes
allowed to equip an ordinary club. This pass is unpublished and unactivated.
The live game remains0.9.36 with495 paintings,3 app icons,156 held frames and327
common delivery files. All published sources/bindings remain unchanged.

| Exact pair | Frames | Selected source |
|---|---|---|
| Fighter/club |9 CUT, one right hand |held-aa13.png |
| Cleric/club |9 CUT, one right hand |held-aa14-edges.png |
| Thief/club |9 CUT, one right hand |held-aa15.png |
| Druid/club |9 CUT, one right hand |held-aa16-edges.png |

[Brief](../REQUEST-batch-aa-melee4.md), [manifest](../generation-batch-aa-melee4.json)
and [native inventory](reference-inventory.json) retain exact prompts, source
references, tool-generated paths, palettes, geometry and supported poses. All
four pairs pass Game.canEquip; Mage, Ranger and Spellblade are explicitly rejected
by the same API and receive no club atlas. Source references deliberately block
painted held requests/service workers to retain procedural geometry after later
activation; this is separate from actual runtime fallback/offline evidence.

## Source review

All four originals and two selected image-tool edge edits were visually reviewed.
Clubs retain rounded knotted wood, a narrower cord-wrapped grip and small flush
iron heads, without long spikes, a metal mace head, chain, magic glow or giant
log proportions. Each hand stays connected to the handle; wood tips, fingers
and sleeve ends are complete. The nine directions follow existing CUT poses,
not nine copies of an upright item. Mature worn materials follow approved held
paintings and the monster-art direction.

Fighter keeps grey gauntlet/cuff and brown cloth. Cleric keeps brown leather,
muted gold cuff and ivory cloth. Thief keeps charcoal glove, brown cuff and
muted green cloth. Druid keeps brown glove, green cuff and brown cloth. These
are separately generated class paintings, not scripted palette substitutions.
The [opaque palette comparison](reference-palettes.png) avoids ambiguous
transparent previews and shows all36 native reference poses.

The original Cleric sheet had white brush debris and red/yellow edge flecks;
Druid had red edge traces. Selected image-tool edits reduce them. Small residual
pale/coloured fringe remains, especially along ivory sleeves, and is documented
rather than erased by script. Dark/light/brown [alpha comparisons](alpha-review.png)
and both phone widths show no large detached patches at registered size. Exact
prompts and originals remain in the manifest; all six requests succeeded and the
tool did not disclose its model.

Source grids are approximate. Lower first/second-column boundaries are Fighter466,
Cleric450, Thief440 and Druid444. Fighter middle second/third-column boundary822
keeps extended cut/sweep figures separate. Cleric rows use418/818; Thief418/800;
Druid404/800. Other rows use418/836. These gaps preserve sleeve ends and upper-left
return tips. Some raw cells miss the requested8% gutters. Source pixels are only
cropped, uniformly resized by family, translated and laid out: no scripted
painting, masking, recolouring, rotation or mirroring.

[Contact](contact-sheet.png), [grip/object registration](registration-review.png)
and [measurements](measurements.json) cover36 RGBA256 cells and four review
atlases. Registered alpha>32 silhouettes have at least19px clearance (required12).
Measured object height is at most106.58px under the112px cap. Object bounds include
downward through tips and the full right-leaning Cleric windup head. Weapon-only
bounds keep props inside the view while sleeves can naturally leave it.
The36 cells are9MiB decoded before browser/GPU copies; this source pass adds no
runtime allocations or offline downloads.

## Phone evidence and limits

[Capture inventory](dungeon/review.json) records120 captures and360 fitting cases
across390/320 widths and160/360/464 buffer heights.336 fits use the new art;
24 retain published/procedural controls. All36 frames are used. Ten direct guards
per width preserve ineligible classes, wrong hand count, lit/reflected state,
unsupported left/channel poses, named Penitent identity, published Cleric mace
and empty casting hands. Four visible controls per width retain Fighter hammer,
Cleric mace, Thief dagger and a procedural wrong-two-hand Druid club.

Each class covers nine CUT boundaries0/.08/.16/.24/.32/.42/.52/.68/.84,
recovered1, Calm cut and cast/read/drink presentations. All clubs are one-handed
and use rest during those hand actions. Fighter/Thief casting is only a renderer
stress case, not a new ability. Native mapping/potion hand selection and existing
shields remain. Capture names include class AND item, including recovery/Calm;
a duplicate-name assertion prevents overwritten evidence.

All120 screenshots were visually reviewed through eight galleries, with zero
page/console errors. These are exact raw id/class/pose/two/lit=false source proxies
with frozen updates/render fixtures. The HUD/log remain the seeded Fighter context;
these are not actual class runs, legal equip/attack transitions, native action
speeds, offline delivery, image-failure recovery, warning/occlusion coverage or a
performance benchmark. All such gates remain necessary for future activation.

- [390 Fighter](dungeon/390-fighter-club-overview.png) · [320](dungeon/320-fighter-club-overview.png)
- [390 Cleric](dungeon/390-cleric-club-overview.png) · [320](dungeon/320-cleric-club-overview.png)
- [390 Thief](dungeon/390-thief-club-overview.png) · [320](dungeon/320-thief-club-overview.png)
- [390 Druid](dungeon/390-druid-club-overview.png) · [320](dungeon/320-druid-club-overview.png)

## Validation and remaining work

```sh
node art/creatures/reference-batch-aa-melee4.cjs
python3 art/creatures/export-batch-aa-melee4.py --check
node art/creatures/preview-batch-aa-melee4.cjs
npx playwright test '/held-equipment\.spec\.js$' --project=phone --project=small --workers=2
npm run check:agents
npm run check:art
```

12 existing held-equipment browser checks pass in29.4s using system Chromium
and a fresh localhost4190 server. The checks validate unchanged runtime behavior,
not activation of these clubs.218 reviewed rasters comprise6 source/repair sheets,
41 reference cells/grids/palette comparison,43 registered cells/atlases/layouts
and128 phone captures/galleries. Export reproduction, syntax, art/docs/hash
inventories, capture uniqueness and whitespace checks pass. No gameplay changes
means no balance simulation; no version, service worker or runtime inventory change.

The [coverage audit](coverage-audit.json) compares actual ITEMS class lists with
current PAINTED held pairs. After this club source pass, remaining basic melee
class gaps are Fighter mace; Fighter/Ranger/Spellblade shortswords; Thief/Ranger/
Spellblade longswords; Fighter/Cleric/Druid staffs; Fighter/Ranger spears. Existing
ordinary daggers, hammers, flails, Fighter battleaxe and two-hand greatsword already
have active pair bindings. Pair existence does not establish every hand state:
greatsword freed-hand poses stay procedural, and Spellblade swords require plain
and lantern-reflected source variants. Rare scimitar/dwarfhammer and named variants
remain later work; the wider AA library is not complete.

## Subsequent runtime activation

The historical source-only findings above are retained. This pass is integrated
locally for0.9.37; publication validation is tracked in the combined
[runtime review](../batch-aa-melee45-runtime/REVIEW.md).
