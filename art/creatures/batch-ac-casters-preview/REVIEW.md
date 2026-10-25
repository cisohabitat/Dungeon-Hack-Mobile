# AC ordinary caster source review — 25 October 2026

Seven reviewed carried frames: Mage spellbook, crystal orb and storm orb; Cleric
wooden holy symbol, silver sunburst and reliquary; Spellblade Silver Lantern.
This completes ordinary caster **source art**. Nothing in `img/`, the runtime
catalog or offline cache has changed; public v0.9.39 remains the AB release.

The three original image-tool PNGs and their prompts/references are preserved in
`generation-batch-ac-casters.json`. No repairs were needed. Native procedural
references preceded generation and used actual `canEquip`/`spriteFor`: seven
legal pairs, with the other42 class/item pairs rejected. Those references mutate
the class for measurement; they do not demonstrate native class creation/equip.
The written brief consolidates the audit and exact prompts after generation.

All original cells and registered exports were visually reviewed for connected
left hands, class palettes, complete item tips/cords/stand feet, transparent
backgrounds and distinct ordinary identities. The Mage book retains its closed
red cover, pages and clasp; blue/brass and navy/silver orbs remain distinct.
Cleric sun pendants retain wood/cord versus silver/chain, and the gilt house has
its bone window, red apex gem and four blue studs. The lantern keeps a closed
charcoal fist around the attached carry handle, silver angled cage and blue flame.
The three-background [alpha comparison](alpha-review.png) retains natural edge
antialiasing without an opaque matte; raw hairline colour fringes are not masked.

Crops follow complete connected figures rather than a nominal grid: the wooden
sun extends6px into the next nominal724px column. Its actual crop ends736px and
the silver figure starts823px; there is no cross-figure overlap. Requested8–10%
source margins were not met everywhere, but equipment and sleeve ends remain
complete. Registered alpha>32 clearance is at least16px on every256px export.
Only cropping, uniform scaling and translation resample the original pixels;
component labels are used for analysis, never masks. Landmarks come from uniform
native-silhouette alignment and visual review, with an authored correction for
the lantern's actual cage bounds/base. The initial padded lantern bounds extended
below the rim; corrected metadata removes that false clipping report without
changing pixels, runtime geometry or the existing renderer.

There are98 full-phone source-preview captures,49 per width, and14 labelled
screen-crop galleries. All14 galleries were visually inspected, covering every
capture at390/320px: rest, maximum walking bob, damage, Calm, cast, read and drink.
The source item lowers out of view during left-hand actions as the renderer
already requires; the acting hand stays procedural. Cropped sleeves can leave the
viewport.294 fixtures cover those states at160/360/464-row view buffers; rest,
walking, damage and Calm object bounds fit, including the complete lantern rim.
70 exact class/identity guards per width preserve all21 published carried pairs
and wrong-class source fallbacks. Full `Game.state()` and both Dice/Odds states
remain unchanged during fixture drawing; there are no page/console errors.

These are **frozen presentation fixtures with exact carried source proxies**.
The HUD still labels the setup Fighter; the view fixture selects target class
costume. They do not establish native actions, legal consumption, real class
transitions, whole-family loading failures, offline delivery or performance.
Existing equipment regressions separately passed12/12 cases across phone/small
in47.5s. Export reproduction and the standard repository checks are recorded in
`coverage-audit.json`. Balance simulations are unnecessary: this pass changes
source art, review tools and documentation only.

Reproduce from the repository root:

```sh
node art/creatures/reference-batch-ac-casters.cjs
python3 art/creatures/register-batch-ac-casters.py
python3 art/creatures/export-batch-ac-casters.py --check
node art/creatures/preview-batch-ac-casters.cjs
python3 art/creatures/gallery-batch-ac-casters.py
```

For activation, copy all seven exact class/id frames and their authored grip,
object bounds and **lantern `base` → `at.base`**. Preserve independent loading /
failure fallback, native read/drink/cast lowering, live lantern settling and
Spellblade reflected-weapon bindings. Verify real class creation/equip/actions,
short-view cage fitting, Calm, installed offline Continue and the full release
checks before publishing. No new world light, item rules or action timing.

Next painting: AD remaining ordinary shield backs, after auditing active P/Y/AB
coverage. AE hands, AF small item sprites, AG/AH regional materials follow.
