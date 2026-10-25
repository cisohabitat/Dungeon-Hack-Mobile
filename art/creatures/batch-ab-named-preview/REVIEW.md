# Batch AB — complete named equipment source review

All 30 remaining named weapon/shield identities are painted and reviewed locally: **397 exact class/state files**, comprising **381 held and 16 carried**, across 73 legal class families (77 class/lighting variants). There are 347 unique paintings and 50 verified Ranger reuses. Penitent remains the previously delivered family. All 31 named weapon/shield candidates now have source coverage: 20 held weapon families including Penitent and 11 carried families. The other 16 named identities are worn/inventory categories; existing 47 relic portraits are a separate surface.

**Status: source complete; this batch is not activated or published.** The live game remains v0.9.38. No runtime, shipped image, cache or version files changed.

[Library contact sheet](named-library-contact.png) · [coverage audit](coverage-audit.json) · [source manifest](../generation-batch-ab-named.json) · [phone capture report](dungeon/review.json)

## Identity coverage

| Identity | Class/state files | Legal classes |
| --- | ---: | --- |
| the Last Gate | 1 | fighter |
| Mercy's Oath | 1 | cleric |
| the Bloodstar | 1 | mage |
| Horizon | 3 | ranger |
| Grimtooth | 65 | druid, fighter, mage, ranger, spellblade, thief |
| Whisper | 47 | fighter, ranger, spellblade, thief |
| Thirst | 45 | fighter, ranger, spellblade, thief |
| Dawnbringer | 18 | cleric, fighter |
| the Ogre's Toll | 9 | fighter |
| Staff of the Ninth Circle | 20 | cleric, druid, fighter, mage |
| Emberwood | 20 | cleric, druid, fighter, mage |
| Vashti's Needles | 4 | fighter, mage, ranger, thief |
| Heartseeker | 9 | fighter, ranger, thief |
| Kest's Bulwark | 2 | cleric, fighter |
| the Sisters' Buckler | 4 | cleric, druid, fighter, thief |
| the Midnight Folio | 1 | mage |
| Sparkglass | 1 | mage |
| the Boarspear | 6 | druid, fighter, ranger |
| Galewind | 6 | fighter, ranger |
| Oakheart | 5 | druid |
| the Bastion | 2 | cleric, fighter |
| Red Harvest | 9 | fighter |
| the Sunhammer | 18 | cleric, fighter |
| the Lantern of Mercy | 1 | cleric |
| Cinderheart | 1 | mage |
| the Rimebound Grimoire | 1 | mage |
| the Last Word | 65 | druid, fighter, mage, ranger, spellblade, thief |
| Farstrider | 6 | fighter, ranger |
| Thornbinder | 6 | druid, fighter, ranger |
| Heartroot | 20 | cleric, druid, fighter, mage |

## Painting and registration

Thirty original image-tool sheets plus five repair outputs are retained (35 raw outputs). Heartroot's spacing repair is selected. A separate two-cell Dawnbringer repair replaces only Fighter/Cleric windups; the other 16 poses retain their original pixels. The selected exports therefore use 31 diagnostic sheets. All prompts, references, crop rectangles, geometry, density and repair selection reasons are retained in the generation manifest.

The Ninth Circle and Ogre's Toll full-exposure repairs were rejected after native close-ups confirmed that grips intentionally cover some authored marks. A proposed Boarspear repair was cancelled before generation for the same reason. Heartseeker's apparent vignette was a viewer artifact: opaque compositing confirmed clean original transparency, so its unnecessary background repair was rejected. See [mark review](MARK-REVIEW.md). These corrections supersede the initial defect claims.

Connected-alpha analysis measures complete source figures; it does not mask their pixels. Registration uses uniform scale and translation against native silhouettes, then authored landmark bounds include actual painted tips. Higher-resolution repair cells normalize source density before the shared family scale is chosen. Every exported frame retains at least 16px alpha32 clearance. All 31 final registration panels were visually reviewed. Bow endpoints use the bow corridor beyond the grip rather than forearm extrema; all four final bow panels were re-reviewed after that metadata correction. All 397 frame bytes stayed identical through the bow metadata correction.

## Verification and limits

The native reference pass checked actual canEquip/spriteFor eligibility for all 73 legal families and legal offhand reasons, and compared all 50 Ranger reference images and landmarks with Fighter. The final export audit matches every planned id/class/pose/hand/light/kind tuple and verifies 397 hashes; carried source classes are reported separately from held source poses.

The frozen source preview produced 1,582 full phone captures at 390×844 and 320×667, with 4,746 renderer checks across 160/360/464px heights. It checks exact source selection, fitted bounds, native dynamic bow-string attachment, named glint tips/Calm suppression, 292 fallback guards per width, and unchanged full run/Dice/Odds state. After bow endpoint metadata correction, 128 bow captures and 384 checks were refreshed and merged into the final report. All 82 final galleries, including Calm/recovered/read/use/cast and shield bash fixtures, were visually reviewed. Materials remain gritty and class costumes distinct; no detached bow endpoints or clipped painted weapon tips were found.

These fixtures freeze updates and proxy source Assets lookups. Generic cast/read/use fixtures do not establish class abilities or real input transitions. Native activation, whole-family loading/fallback, cache/offline delivery, real equip/actions and performance remain future activation gates. All 12 existing phone/small equipment regression tests passed (32.8s); these validate the unchanged active equipment renderer, separately from the AB source proxies.

Final checks passed: `npm test` (including 751 rule checks), source exporter `--check` (397 frames), named library audit `--check`, existing runtime exporter `--check` (576 unchanged exports), Python/JavaScript syntax checks, 2,648 current raster review hashes and `git diff --check`. No shipped files changed.

Activation authorised and wired for v0.9.39 on25 October2026. The source-only results above remain historical; see [native activation review](../batch-ab-runtime/REVIEW.md) for delivery and action/offline evidence.
