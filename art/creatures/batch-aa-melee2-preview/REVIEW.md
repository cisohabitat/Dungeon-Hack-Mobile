# AA ordinary melee — second source pass

Activation update: these reviewed frames are now integrated for release0.9.36.
See [native activation evidence](../batch-aa-melee-runtime/REVIEW.md).
The source-only findings below record the earlier review stage.

36 painted frames are complete and reviewed locally. This pass is unpublished
and unactivated. The live game remains0.9.35 with414 paintings,3 icons and246
common delivery files. First AA/Z bindings and reviewed sources are preserved.

| Exact pair | Frames | Selected source |
|---|---|---|
| Fighter/hammer |9 CUT, one right hand |held-aa5.png |
| Fighter/flail |9 CUT, one right hand |held-aa6.png |
| Cleric/flail |9 CUT, one right hand |held-aa7-edges.png |
| Mage/dagger |9 CUT, one right hand |held-aa8-edges.png |

Fighter hammer covers the Sentinel kit, Cleric flail the Crusader kit; Mage's
ordinary kit includes a backup dagger. All four pairs pass Game.canEquip. The
[brief](../REQUEST-batch-aa-melee2.md), [generation manifest](../generation-batch-aa-melee2.json)
and [native inventory](reference-inventory.json) record identities, exact prompts,
references, hand palettes, supported poses and provenance. The wider AA library
remains open: other ordinary class pairings, ranged prop states and named variants.

## Source findings

All seven original/repair sheets and36 selected poses were visually reviewed.
Fighter keeps grey gauntlet/cuff and brown cloth; Cleric keeps brown leather,
muted gold cuff and ivory cloth. Mage has a bare pale skin hand, violet cuff and
purple cloth, not a metal glove or Thief sleeve. Hammer keeps its rectangular
face, opposite pick and small top spike. Both flails retain a short wood shaft,
a short joined curved chain and one spiked iron head. They use the same ordinary
construction with class-specific hands; no new chain physics, move or extra head.

Mage's first blade was too long. The compact image-tool repair shortens it while
retaining the hand and forearm; the final edge edit reduces red/yellow flecks.
Cleric's original sleeve had conspicuous white brush debris. Its selected image
edit reduces those patches. All originals/intermediates remain recorded. Minor
pale/coloured fringe remains, especially along ivory cloth and skin; it has not
been masked, recoloured or erased by scripts. Registered downsamples were checked
on dark/light/brown backgrounds and in dungeon views, without large edge patches.
Two initial flail input requests were rejected without images; exact prompts,
references and request IDs are preserved alongside the successful clarified static
prop requests. The tool model was not disclosed.

An initially suspected missing native Cleric flail head was a transparent-preview
misread. Exact pixel comparison against a fresh render and an opaque diagnostic
showed the complete chain/head. No runtime defect or fix is claimed. Final native
references use fresh browser sessions for each family and retain all36 native cells.

Source grids are approximate. Authored lower first/second-column crop boundaries
are hammer430, Fighter flail450, Cleric flail440 and Mage dagger440. Fighter flail
uses upper row boundary400; Cleric flail uses405/800. These lie in clear gaps and
retain complete chains, spikes and sleeve ends. Other boundaries use418/836.
Not every source meets the requested8% gutter, but all registered alpha>32
silhouettes have>=12px clearance. The exporter only crops, uniformly resizes each
family, translates and lays out existing pixels. No rotation, mirroring, pixel
painting or alpha repair. Object-height caps are hammer112/flails128/dagger64.

[Contact](contact-sheet.png), [grip/object registration](registration-review.png),
[alpha comparison](alpha-review.png) and [measurements](measurements.json) cover
36 RGBA256 cells and four family atlases. Main right-hand anchors and object-only
bounds keep equipment inside the view while sleeves may naturally leave it.
36 cells are9MiB decoded before additional copies/GPU; source review adds no
runtime allocation or offline downloads.

## Dungeon evidence and limits

The [capture inventory](dungeon/review.json) records120 captures and360 fitting
cases across390/320 widths and160/360/464 buffer heights.336 fitting cases use
the new reviewed art;24 controls retain published art or procedural fallbacks.
Ten direct identity guards per width preserve wrong class/pose/hand-count/lit,
Penitent named identity, empty casting hands and existing Cleric hammer/Thief dagger.
Four visible controls per width cover those two published pairs, a wrong two-hand
Fighter flail and the Penitent's Flail. Existing P/Y shields remain unchanged.

Each family has nine CUT boundaries0/.08/.16/.24/.32/.42/.52/.68/.84, recovered1,
Calm cut and cast/read/drink presentation. All four families are one-handed and
reuse rest during these actions. Fighter casting is only a renderer stress case,
not a new class power. Mapping and drink hands keep native selection, including
the actual seeded potion sprite. Flail states are cached poses of current motion,
not a separate swinging-chain simulation.

The preview uses exact raw id/class/pose/two/lit=false source proxies with frozen
Game.update/render-state fixtures. The visible HUD/log intentionally remain the
seeded Fighter context. These are not native class runs, actual equip/attack
transitions, service-worker delivery, failure recovery, occlusion/warning coverage
or a performance benchmark. All120 screenshots were visually reviewed through
eight galleries; source and registered layouts separately cover every pose.
Each capture name includes class AND item, so the two flail families cannot
overwrite one another's Calm/recovery images. A duplicate-name assertion guards
that inventory. No page/console errors occurred.

- [390 Fighter hammer](dungeon/390-fighter-hammer-overview.png) · [320](dungeon/320-fighter-hammer-overview.png)
- [390 Fighter flail](dungeon/390-fighter-flail-overview.png) · [320](dungeon/320-fighter-flail-overview.png)
- [390 Cleric flail](dungeon/390-cleric-flail-overview.png) · [320](dungeon/320-cleric-flail-overview.png)
- [390 Mage dagger](dungeon/390-mage-dagger-overview.png) · [320](dungeon/320-mage-dagger-overview.png)

## Reproduce and validation

```sh
node art/creatures/reference-batch-aa-melee2.cjs
python3 art/creatures/export-batch-aa-melee2.py --check
node art/creatures/preview-batch-aa-melee2.cjs
npx playwright test '/held-equipment\.spec\.js$' --project=phone --project=small --workers=2
npm run check:agents
npm run check:art
```

12 existing held-equipment browser cases passed in34.1s at both widths using
system Chromium and a separate localhost4190 server. They check the unchanged
runtime, not activation of these36 source frames. Exports, source-script syntax,
art hashes, documentation and whitespace checks pass.218 new reviewed rasters
cover7 sources,40 references/grids,43 registered exports/layouts and128 captures/
galleries. No gameplay change means no balance simulation. Full runtime suites,
native action/failure/offline evidence and isolated performance remain activation
and publication gates; no version or offline inventory changes in this pass.
