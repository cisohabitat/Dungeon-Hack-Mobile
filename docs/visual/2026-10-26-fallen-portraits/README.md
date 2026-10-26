# Fallen hero portraits

Seven new death-state paintings retain each living hero’s actual class identity:
Fighter’s nasal helmet/red cloth/chainmail; Thief’s leather hood; Cleric’s cream
vestments and sun emblem; Mage’s indigo robes and brass clasp; Ranger’s auburn
hair, hood-down cloak, bow and arrows; Druid’s curls, leaf mantle and spiral
pendant; and Wayfarer’s embroidered hood, sword and blue lantern.

[Living/dead pairs and 88px fitting](identity-contact.png). The skull replaces the
living face on the death screen and in the hero corner of a death share card.
Victory, creation, prologue and living hero-sheet portraits retain their original
images. Earned mastery frames remain visible; the old death grayscale/dimming
filter is removed so class colors remain readable. No combat or death rules change.

## Sources and delivery

`art/portraits/fallen/generation.json` records exact reference paths and prompts.
Each image was generated from its existing living portrait, not the earlier
three-class concept sheet. `repairs.json` records selected Cleric/Mage corrections
to remove fleshy external ears. Both initial paintings remain as provenance.
Sources and all seven 512px WebP exports were visually inspected, including the
small-size contact sheet. Hair and clothing are deliberately retained as identity
cues around the skull. The existing Wayfarer keeps its distinctive bright backdrop.

Reproduce bytes: `python3 art/portraits/fallen/export.py --check`.
`npm run check:art` checks class coverage, reviewed source/export hashes and all
seven service-worker entries. Death images load independently on demand, with an
immediate class-color skull fallback; failures never substitute a living face.
Late loads update the existing share canvas. Sharing waits at most 1.5 seconds
for the portrait before exporting the fallback, and checks that the run is current.

## Native regression evidence

`portraits.spec.js` creates each class through native setup, supplies a saved safe
floor, deals lethal damage through `Game.hurtPlayer`, waits for the real death
screen, exports through its actual share button, and restores the save through
Load. This is supplied-state transition coverage, not unassisted gameplay.
The tests also exercise failed/stalled images, independent classes and all seven
paintings after an installed offline reload. `endgame.spec.js` checks a native
victory retains its living portrait. No image requests or DOM art are substituted
in the successful capture cases.

Reproduce native death captures with both Chromium projects:
`npx playwright test 'portraits.spec.js$' --grep 'fallen .* keeps class identity' --project=phone --project=small --workers=2`.
Use the system Chromium override described in repository guidance in this container.
Captures are phone-sized Chromium evidence, not physical iOS verification.

| Class | Small phone death screen | Phone share card |
| --- | --- | --- |
| Fighter | [Native screen](small-fallen-fighter.png) | [Exported card](phone-fallen-fighter-share.png) |
| Thief | [Native screen](small-fallen-thief.png) | [Exported card](phone-fallen-thief-share.png) |
| Cleric | [Native screen](small-fallen-cleric.png) | [Exported card](phone-fallen-cleric-share.png) |
| Mage | [Native screen](small-fallen-mage.png) | [Exported card](phone-fallen-mage-share.png) |
| Ranger | [Native screen](small-fallen-ranger.png) | [Exported card](phone-fallen-ranger-share.png) |
| Druid | [Native screen](small-fallen-druid.png) | [Exported card](phone-fallen-druid-share.png) |
| Spellblade | [Native screen](small-fallen-spellblade.png) | [Exported card](phone-fallen-spellblade-share.png) |

Initial exact-pixel comparisons differed by a few one-unit channel values because
the reference used a different canvas size/placement. The corrected reference
uses the same 800×420 canvas and (34,34) portrait position; all pixel comparisons
remain exact, with no tolerance introduced. Fourteen native cases then passed
across both Chromium projects.

Required local validation is complete: `npm test` passed, including 751 rule checks;
all 891 distinct Chromium cases passed (887 parallel cases in 1.0h plus four full-cache
cases on one worker), with zero failures in those final runs. The 14 earlier native
capture cases also passed. The isolated 4× CPU performance recheck passed: fight 40.8fps,
wide41.9, flooded42.3, painted36.8, rite47.2; startup 2151ms. The first performance
run had one failure, painted 28.8fps against the unchanged 30fps budget; its other
scenes passed. Both runs are retained in [validation.json](validation.json).
No performance thresholds or test deadlines changed. Export reproduction,
reviewed art/offline inventory, guidance sync and whitespace checks passed.
Local WebKit and physical iOS checks were not performed.
Prepared for release0.9.43. Publication was authorized on26October2026; this
record captures local checks before publication. The release workflow verifies
the published commit separately.
