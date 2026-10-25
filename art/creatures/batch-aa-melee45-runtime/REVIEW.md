# AA melee4/5 — runtime activation for0.9.37

133 newly activated class/state frames:36 clubs plus97 remaining basic melee
frames. Sources, original/repair prompts and frozen reviews remain under the
fourth/fifth pass directories; their source-only findings are historical.
Common delivery has460 files and289 held frames. There are628 shipped paintings
and3 app icons, all offline-listed. All327 earlier common files retain identical
bytes. The runtime addition is133 byte-identical copies of reviewed source PNGs.

## Bindings and materials

Clubs cover Fighter/Cleric/Thief/Druid. Mace adds Fighter; shortsword adds Fighter/
Ranger/Spellblade; longsword adds Thief/Ranger/Spellblade; ordinary quarterstaff
adds Fighter/Cleric/Druid; spear adds Fighter/Ranger. Every basic ordinary melee
class pair now has painted source and runtime bindings. This does not cover rare,
named/legendary/Mythic/ranged or unsupported greatsword released-hand variants.

Spellblade swords each include9 plain and9 muted reflected frames, selected by
actual lantern state. Staff families contain two-hand rest/drive and released-hand
rest/channel; all4 become ready together. Optional source `tip` metadata passes
through the common exporter and loader to the existing small surface glint.
Older Mage T staff metadata is unchanged. Grips/bounds, Ranger reuse, cloth/metal
identity and plain/reflected family scales retain their reviewed registration.

Whole-family readiness and independent decode failure retain procedural fallbacks.
Exact raw id/class/pose/two/lit guards protect illegal classes, named equipment,
unsupported poses/hand counts and lights. Nothing changes game rules, light,
visibility, dice or balance. Release0.9.37/build52 uses offline cache deepdelve-v112.

## Native evidence

`node art/creatures/preview-batch-aa-melee45-runtime.cjs` records36 native sessions:
16 legal weapon/class pairs and two additional Spellblade plain-lantern-removed
variants at390px and320px. It creates real classes through the title UI (including
Spellblade's five real unlock taps), supplies legal ordinary equipment through
Game.equip and removes the actual lantern with Game.unequip for plain cases.
Game updates, renderer and asset routes remain native. Setup supplies resources,
clears scenery and places a durable stationary target; this is not unassisted
combat, full quest coverage or a balance benchmark.

124 real public-API actions advance game time and draw painted frames.552 captures
and36 galleries were visually reviewed: all families at rest, attacks at natural
animation times, scroll reading, healing potion use, actual class spells, the real
Calm menu control and offline Continue. All36 reloads work offline, with all289
held frames verified in cache. No page/console errors. Native draw observers
confirm staff drive-two on attacks, rest-one on reading/drinking and channel-one
on Cleric/Druid casting. Fighter staff channel remains a generic renderer state,
not a new Fighter ability. Spellblade plain/reflected draw keys remain separate.
See `captures.json` and `validation.json` for measured results and setup limits.

## Release validation

Both complete Chromium projects ran819 cases:816 passed in the four-worker
48.4-minute run. Three existing failures (25-second deferred painting, creature
lean observation and offline-ready indicator) passed alone unchanged in42.0s;
no assertions, deadlines or product code were altered for those reruns. The
smallest-phone project passed all270 cases. All new weapon tests passed on both
projects, including642 exact bindings per project and staff glints/Calm.

The isolated4x-CPU frame budget passed in54.1s: fight42.4fps, wide45.5fps,
flooded49.3fps, painted38.7fps and rite60fps; startup1626ms. Default limits remain
30fps, wide27fps and startup6000ms. The complete npm test suite passed, including type checks, release tooling,
192 generated levels, security, narration, offline lifecycle and165 readings;
all751 rule checks in74 files passed on4 processes in1m11s. Exact-commit pre-push
checks, CI WebKit and public deployment verification are tracked by the release
workflow; do not infer a physical-device pass from these automation results.
Meaningful browser coverage adds corrupt club, independent Ranger shortsword,
reflected Spellblade longsword and released-hand staff-family failures.642 exact
pose/hand/lit bindings are fitted at160/360/464 rows per phone project with run/dice
neutrality. Staff tip metadata, glint placement and Calm are tested separately.

Reproduction:

- `python3 art/creatures/export-batch-aa-melee4.py --check`
- `python3 art/creatures/export-batch-aa-melee5.py --check`
- `python3 tools/export-painted-runtime.py --check`
- `node art/creatures/preview-batch-aa-melee45-runtime.cjs`
- `npm test`
- Both full Chromium projects and the isolated frame-rate budget as in AGENTS.md.

WebKit runs in CI; Linux automation does not establish a physical iOS device pass.
