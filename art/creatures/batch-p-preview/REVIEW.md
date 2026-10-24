# Batch P targeted equipment review — 24 October 2026

Seven regional inventory paintings and two separate Rune-Cut Shield rear views
are complete locally. Six icons have live ordinary base selections; the seventh
Tooth Charm fang is a reviewed reserve. Three original sources produce seven
256px WebPs, a 512px icon atlas, a 768×256 strip and two grip-registered 256px PNG
rear frames. Source/review assets are published; runtime integration remains pending.

Generated with image_gen.imagegen (model not disclosed). Exact prompts, active
references, original generated paths, authored crop/grip/object bounds and export
measurements are in [the manifest](../generation-batch-p.json). No painted repair
was needed. Exporter scripts only crop, uniformly fit and assemble raster reviews.

## Visual review

[Inventory contact](contact-sheet.png), [icon sizes](icon-scales.png) and
[held contact](held-contact.png) show the selected sources. All 95 active ordinary
item references were audited in [the inventory overview](inventory-overview.png).
All source sheets, selected reference groups and exports were inspected.

Mail retains violet edging; marsh hide stays olive/scaled; dwarf plate/hammer
keep iron and copper; shield has two bars, boss and restrained cyan rune; hand
crossbow retains stock, violet gem, two connected prod limbs, taut string and
one seated bolt. Hammer's beak/top spike are existing geometry, not new powers.
The reserve fang stays single and yellow. No bodies/mannequins, extra gear,
new lights or named markings are invented.

The rear views show one connected left hand per class on a vertical rear grip,
forearm beneath a leather strap and iron plate backing. Front rune/boss stay out
of the rear view. Fighter grey/brown and Cleric brown/brass/ivory palettes match
their active guides. They are separate first-person sources, not rotated Pack art.

## Registration and findings

Icons use authored complete-object crops and uniform centre fitting with >=12px
margins; no row236 feet/baseline rule applies. Crops cross empty nominal gutters
to retain plate shoulders and hammer/crossbow tips. At 32px fine ring/grain detail
merges, while silhouette/palette and shield rune remain the primary cues.

Held sources use explicit grip points/object bounds, not icon centring. The first
export fitted at rest but clipped during the existing bash in the 160px view;
reducing uniform source scale to cap shield object height at 128px fixes that case.
The final frames pass 36 object-bound checks at 160/360/464px across both classes,
rest/bash/Calm and both phone widths. Sleeves may extend off-screen; the object
fits. Cast-lowering intentionally takes the shield down out of view.
Reproduction verifies bytes, source hashes, anchor transforms and object bounds.

## Mapping and preview evidence

[Caller/motion audit](STATE-AUDIT.md) records two important guards: ordinary Tooth
Charm keeps its seeded picture even when identified, and Rune-Cut Shield currently
has no carried frame. The fang does not replace seeded or named Hissra artwork.
The new rear frames are preview-only; the live null carried gap remains unfixed.
Fighter/Cleric eligibility is asserted against all seven classes.

56 captures, with six galleries:

- [390px floor](dungeon/390-floor-overview.png), [320px floor](dungeon/320-floor-overview.png): 24 near/far views of six direct base keys.
- [390px Pack](dungeon/390-pack-overview.png), [320px Pack](dungeon/320-pack-overview.png): 12 details plus four unchanged Tooth appearance checks.
- [390px held](dungeon/390-held-overview.png), [320px held](dungeon/320-held-overview.png): 16 two-class rear rest/bash/Calm/lowering views.

All galleries were visually reviewed, with full-size mail/crossbow Pack, known
Tooth and held rest/bash checks. Original image bindings, item names/actions,
floor scale/flags and unchanged item records are asserted before substitutions.
The temporary carried override is restored and the original null gap rechecked.
No page/console errors were recorded; [metrics](dungeon/review.json) retain evidence.
Twelve existing held-equipment browser checks also passed at both widths; those
audit baseline handling and do not establish painted loader integration.

No runtime, save, combat, item-rule, rarity, named illustration or offline changes
were made. Native loading/fallback, emissive/rarity rendering, class hand/action
integration and performance remain future gates. Balance simulations are not
needed for this source/review-only artwork.

## Reproduction

- `node art/creatures/reference-batch-p.cjs`
- `python3 art/creatures/export-batch-p.py --check`
- `node art/creatures/preview-batch-p.cjs`
- `npm run check:art`
- `npm run check:agents`
- `npx playwright test held-equipment.spec.js --project=phone --project=small --workers=2` (system Chromium override used locally)

Publication checks remain separate from this local source review.
