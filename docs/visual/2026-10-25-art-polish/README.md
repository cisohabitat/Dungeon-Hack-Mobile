# First art polish follow-up

Reviewed the art active at `ef105dbc` (v0.9.41). This is a bounded first visual pass, not approval of every scene, animation or physical device.

## Finding and fix

Some historical item review captures show very dark large relic portraits. The approved Sparkglass image itself is bright. Fresh native Pack captures show the same portrait reaching full opacity after its item entrance animation; no artwork replacement is needed.

`preview-runtime-items.cjs` stored `deepdelve.calm=on`, but the UI recognises `1` or `0`. It also decoded only the small detail pictures before capturing, leaving large relic portraits and their entrance animation unsettled. The tool now sets `1`, decodes either picture size, and awaits any remaining image animations. Historical review images are retained unchanged. No production art, CSS, gameplay or release metadata changed in this follow-up.

| Evidence | 320px | 390px |
|---|---|---|
| Running game after a real forward input | [View](320-live-walk.png) | [View](390-live-walk.png) |
| Portrait captured early | [View](320-portrait-early.png) | [View](390-portrait-early.png) |
| Same portrait after the animation | [View](320-portrait-settled.png) | [View](390-portrait-settled.png) |

[Recorded metrics](evidence.json) include the native position/time advance, early opacity, final opacity of 1, decoded 512px portrait and empty console/page-error lists. Inventory was supplied for inspection. Game updates and rendering were not frozen or replaced, and no source image requests or DOM picture substitutions were used. These two seeded samples are not full playthroughs.

## Visual coverage

- Inspected the existing 320px galleries for all twelve AG regions: door, gate, pillar, ascending stair and descending stair. Openings remain legible; no obvious exposed edge or broken join warrants a repair in these sampled views. This does not cover every repeating surface or viewing angle.
- Inspected the seven caster and seven shield overview rows at 320px, plus rest/punch/read/drink views for all eight empty-hand families. Grip placement and the intended lower-wrist cropping remain consistent. Frozen fixture poses do not establish native ability availability, particularly for the bear.
- Inspected representative small-item floor and Pack views: the first ring/lantern group, Sparkglass/Boarspear/Galewind/Sexton's Locket, and eight distance-three examples. Small shapes remain distinguishable; large portrait brightness must be judged after its entrance animation.
- Added fresh running-game and settled Pack samples at 320×667 and 390×844. The fresh gameplay sample uses the starting Fighter kit; caster, shield and hand coverage above comes from the existing fixture galleries.

No repaint or automatic next atlas is justified by this sample. The earlier mobile layout and ending/share-card follow-ups remain open. Regional palette preferences and unreviewed views need further evidence before changing approved paintings.

## Reproduction and validation

Run `node docs/visual/2026-10-25-art-polish/capture.cjs` from the repository with its installed Playwright dependency and system Chromium. It writes the running-game/portrait samples and evidence JSON beside this file. The ordinary item review command remains `node art/creatures/preview-runtime-items.cjs`; it regenerates that tool's existing review outputs.

The corrected item tool completed all 602 captures in a temporary output directory, preserving historical evidence. At each width it passed 280 floor checks and 140 Pack checks, with no console/page errors. The summary and tool hash are in [capture-verification.json](capture-verification.json). Selected corrected-tool captures: [320px](320-corrected-tool-portrait.png), [390px](390-corrected-tool-portrait.png). Syntax, guidance synchronization and whitespace checks also passed. This follow-up needs no balance simulations because it changes review tooling and documentation only. This review changes capture tooling only; the separate enlarged-text menu implementation is recorded in the adjacent mobile-layout review. Both are included in release0.9.42.
