# Batch AB — named equipment activation

Activation authorised 25 October 2026. This release binds all 397 approved AB source frames through the existing exact held/carried loaders: 381 held frames and 16 carried shield/focus frames across 73 legal class families, including four separate Spellblade lighting variants. All 31 weapon/shield candidates now have painted runtime coverage, including previously active Penitent. Worn/inventory identities and the existing 47 relic portraits are separate surfaces.

The common delivery contains 973 files, including 786 held and 21 carried frames; all 576 previous common files retain identical bytes. Total shipped painting inventory is 1,141 plus three icons. Bows retain native dynamic strings, arrows and drawing hands. Held families load and fail as complete class/identity families; carried images retain independent exact matching and fallback. No gameplay rules or seeded randomness changed; prior balance measurements remain applicable.

## Verification

The new regressions use delivered Assets frames for all 397 exact routes and 2,373 renderer/action fixtures per phone width, with unchanged full game and Dice/Odds state. They cover 160/360/464px heights, bow nocks, named glint tips, Calm suppression, class/identity/hand/light guards, and recovered/read/use/cast/bash fitting. Corrupt-image checks cover reflected named blades, Fighter offhand states, released-hand staff drive, a Mythic bow, shield and focus, while independently valid families keep loading. Real Fighter offhand attacks cover Grimtooth, Whisper and Last Word; native staff read/drink overlaps cover Ninth Circle and Heartroot, restoring both hands afterwards. All 20 new phone/small tests passed.

The [native capture report](captures.json) records 154 sessions (77 legal class/lighting variants at both390×844 and320×667), 546 actual actions, 2,408 captures and154 overview galleries. Every session starts through real class creation, equips a legal base item with its named identity, then performs attack/read/drink and the class's real cast where available; Fighter shields also Bash. Actual game time advances. Each uses the Calm menu control and saves/reloads Continue offline with all807 held/carried frames cached. All captures were visually inspected through154 diagnostic contact galleries; the original full phone screenshots and native canvas frames are retained.

No asset routes, renderer replacements or frozen game updates are used in this native capture pass. Setup supplies legal equipment/resources, clears scenery and places a durable target; this is not unassisted combat, Mythic quest acquisition, physical-device Safari or a balance benchmark. The local server stamps the pre-commit checkout SHA; public deployment identity is checked separately after publication.

Final release checks are recorded below when complete. Historical source-only evidence remains in [source review](../batch-ab-named-preview/REVIEW.md); its asset proxies are not activation evidence.

Repository checks passed: `WORKERS=1 npm test` (751 rules, release fixtures, typecheck, generator, API/security, narration, offline, voice catalogue, art and guidance), source exporter `--check` (397 frames), runtime exporter `--check` (973 files; 576 unchanged), named library audit `--check`, and release metadata validation against origin/main.

Both complete Chromium projects executed all857 tests:852 passed in the four-worker run; five existing readiness checks (deferred procedural art, core offline and creature offline reloads) hit their original deadlines under CPU load. All five passed alone on one worker (1.7m), with no assertion or deadline changes. This distinguishes the initial broad-run failures from their successful isolated verification.

The isolated performance budget passed at4× CPU throttle: fight38.9fps, wide40.9fps, flooded37.1fps, painted37.2fps and rite53.6fps; startup1,853ms. Final art/guidance and whitespace checks passed. Main remained at3b26118 before publication. CI, WebKit and public deployment checks follow the push and must pass before reporting publication verified.
