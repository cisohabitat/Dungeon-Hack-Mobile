# Batch I static trader review — 24 October 2026

One selected transparent three-figure source sheet, three 256px static WebPs and one
768x256 combined atlas. Generated with `image_gen.imagegen` (model not disclosed).
See [manifest](../generation-batch-i.json) for prompt, references, original path
and body-centre registration. The original `traders.png` is retained as rejected
style provenance. `traders-painted.png` is the selected complete style revision,
using approved Goblin and Warlord atlases as painting references.

## Style correction

The first sheet was rejected by the user as too cartoonish: bulbous heads,
oversized glossy pupils, soft round faces and bright toy-like materials.
The selected replacement follows the approved monster paintings: weathered,
angular faces with recessed eyes and smaller pupils; lean knuckled hands/feet;
muted earthy colours; deeper creases; worn woven cloth, scratched brass and iron.
Merchant/Wick retain the Lampfolk's pale eyes and long drooping ears without the
original baby-faced proportions. Pedlar follows the existing Goblin's facial
anatomy while remaining a trader. Compare all three against Goblin/Warlord idle
cells in `style-comparison.png`; the exporter reproduces that comparison.

## Identity and source review

Active runtime references are reproduced with `node art/creatures/reference-batch-i.cjs`.
Merchant and Wick are grey Lampfolk with large pale eyes and drooping ears,
not green goblins. Merchant keeps the patched brown robe, blanket pack, pan/cup,
viewer-left lamp staff and viewer-right coin. Wick has no pack: spectacles,
rust scarf, blue-grey cloak with hood back, viewer-left ledger and viewer-right
crook lamp distinguish him. Both have bare grey feet.

Pedlar retains green skin, wide swept ears, floppy red cap, wry, restrained expression,
short stained brown tunic, purse, bandy bare legs and long green feet. His pack
carries scavenged cookware, a small lantern and a sheathed sword whose hilt shows;
no weapon is held. Charms remain linked to the cord in his viewer-left hand;
his viewer-right hand beckons. The Merchant coin, Wick ledger, lamp suspensions
and all pack contents remain visibly supported. There are no detached props,
extra figures, opaque background, scenery, ground shadows or combat actions.

The source, all three runtime reference rasters, every exported cell, combined
atlas and contact sheet were visually reviewed. One common scale is used across
the sheet; body centres register to x128 and visible alpha ends at row236.
`measurements.json` records bounds, offsets, scale and hashes. Exports have at
least 12px visible-alpha clearance; staff tops, ears, hands and feet are complete.

## Live state audit and preview checks

`js/motion.js` selects `pedlar` for a market first, otherwise Wick when the NPC's
`wick` flag is set, otherwise Merchant. Scale stays 0.95, yOff 0; all are static
billboards facing the view. Encounter sprites use their separate path. These
traders have no animation/attack pose requirements in the current draw path.

`node art/creatures/preview-batch-i.cjs` makes 12 frozen painted-cell dungeon
captures: each identity at 1 and 3 tiles, at 390px and 320px. It checks the actual
sprite identity and unchanged position/scale before substituting the review cell,
then keeps the renderer's lighting, fog, occlusion and held gear. All 12 captures
and both overviews were visually inspected for fitting, readable silhouettes and
connected equipment. There are no page/console errors.

For each identity at both widths, actual forward input opens the expected shop
without moving through the NPC: Lampfolk trader, Wick of the Lampfolk, Goblin
pedlar. The harness closes through the existing UI and waits for its closing fade
before the far capture. Two additional selection checks confirm that a market
still uses Pedlar when `wick:true`. The six shop checks and two precedence checks
are recorded in `dungeon/review.json`; no shop UI or rules are modified.

## Reproduce and integration limits

```
node art/creatures/reference-batch-i.cjs
python3 art/creatures/export-batch-i.py --check
node art/creatures/preview-batch-i.cjs
```

References/previews need Playwright and system Chromium (`CHROMIUM_PATH` override).
The exporter needs Pillow, NumPy and SciPy and performs no painting or recolouring.

The current painted creature loader accepts only supported creature names and
768x768 nine-pose sheets. These static traders are deliberately not fed into that
loader. Future integration needs static cell decoding/binding with per-identity
procedural fallbacks, lazy loading and offline cache entries. The preview manually
substitutes raster frames, so it does not prove live loading, failure fallback,
offline readiness, buying/selling transactions or every possible shop context.
Shop names/collision are checked using current gameplay, independently of the
picture substitution. No runtime, service worker or shipped image changes.
This publication contains source/review assets; runtime integration remains pending.
