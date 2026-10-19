# Art review — 18 October 2026

Reviewed the current `main` checkout, starting at `65a1af7`, for disconnected
weapons, incoherent grips and obvious detached body parts.

## Repairs

| Asset | Finding | Change |
| --- | --- | --- |
| Dark Elf Warrior painting | The viewer-right curved blade floated beside the forearm, disconnected from the fist. | Reference-based repaint with two continuous swords, guards and held hilts. Preserved the corrected original in `art/bestiary/overrides/drow_warrior.png` and regenerated the shipped 512 × 512 WebP. |
| Dwarven hammer in hand | Its override called `HELD_ART.hammer`, which does not exist, and threw during rendering. | Removed the invalid override; the normal fallback now uses the existing dark-iron `ITEM_ART.dwarfhammer` drawing. Added a rendering regression check for every base held weapon and pose, including both bows. |

## Coverage

- Visually inspected all 61 shipped paintings: 50 bestiary creatures, three
  keepers, six class portraits and two title compositions. No other comparable
  disconnected weapon was identified.
- Checked the SVG app icon and both PNG sizes for consistent composition.
- Inspected rendered creature poses, champion defaults, shade gear, base and
  named item icons, held weapon poses, carried named shields and foci, encounter
  props, floor dressing and fallback class portraits. These inspection sheets
  help find obvious defects; they do not prove every pixel, equipment combination,
  material variant or animation transition is correct.
- Reproduced all 50 bestiary exports exactly using ImageMagick, applying the
  corrected individual portrait after cropping the original sheets.
- Reproduced all nine class/boss exports exactly using their documented FFmpeg
  recipe. Both title exports match their original dimensions and compositions;
  each RGB channel's RMS difference from its PNG source is below six, consistent
  with lossy WebP compression.
- Confirmed the corrected Dark Elf Warrior loads through the title bestiary as
  `img/bestiary/drow_warrior.webp`, at 512 × 512, without browser errors.
- Recorded source and export hashes in `art/review.json`. `npm run check:art`
  checks that inventory and every painting's offline-cache entry. It detects
  changes since review; it does not automatically judge anatomy or regenerate
  approvals for altered images.

The bestiary exporter honours individual corrections on every run. Use
`python3 art/bestiary/export.py --check` to detect stale exports without changing
the checkout. Original contact sheets remain unedited as provenance.

Release preparation advances the patch version and service-worker cache together
so installed copies can receive the corrected portrait after publication. No
gameplay, combat timing, statistics, targeting or loot rules changed; balance
simulations are therefore unnecessary for this art change.

## Portrait and sprite identity alignment

All 53 bestiary entries and all six classes were compared side by side with
their paintings. The owner chose to retain the animated pixel/parts style and
align appearance. `art/identity.json` records the reviewed identifying traits
for every entry; `check:art` now rejects missing monster or class coverage.

The six fallback heroes now depict the same people as their paintings: the
fighter's beard, the cleric's cropped hair and cream vestments, the older
brown-skinned grey-haired mage, the unmasked hooded thief, the loose-haired
auburn ranger and the curly-haired druid without invented antlers or a beard.
Their faces remain connected to the collars. Class shade gear no longer
reintroduces the discarded masks, pointed hats, mitres or antlers.

Creature changes include a faceless slime, a smooth blind Stalker without ears,
a pale round Puffcap without a skull face, an active chest Mimic, a longer-jawed
Wyrm with curled horns, a charcoal violet-lit Blink Hound, a red-brown winged
Imp, a bear-like Quillback without boar tusks, feathered beetle antennae, warm
bat/moth/basilisk colours, skeleton helmet and held shield, black Acolyte robes
and held staff, a whistle sentry without a large banner, dark dwarven beards
and smith's hammers, fuller lizard crests, a dark-clad crowned Lich and leather
on the Warlord. Named champions inherit the relevant species changes while
retaining their own crowns, markings and equipment. The Wraith has a skull;
the Abbess deliberately has an empty face.

Paintings remain the visual reference. Cropped portraits need not show every
item seen on a full-body sprite. Class-specific shade equipment and the
Mimic's barrel disguise remain deliberate variants. No monster statistics,
ability timing, target geometry, saved disguises, random streams or game rules
were changed; no balance simulations are required for these drawing changes.

## Identity alignment validation

The updated core suite passes: types, release metadata, art inventory and
identity coverage, all pose/silhouette and held-gear checks, 192 generated levels,
APIs/security, narration, offline lifecycle, voice catalogue and all 722 rule
checks. Existing pose and creature-distinctness thresholds remain unchanged.
All 59 final painting/sprite pairs were visually inspected after the edits;
29 creature/champion drawings and all six fallback portraits changed.

All 38 focused bestiary, class-portrait and boss-portrait browser checks pass
on both phone sizes after the alignment. A separate browser check blocked all
six painted class images at 390 px and 320 px: every updated fallback loaded,
could be selected, and raised no script error. All 50 bestiary exports still
reproduce exactly from their sources, including the corrected warrior.

The isolated frame budget still fails at the original 4× throttle: fight
31.6 fps, wide 29.6 fps, flooded 19.4 fps, rite 20.8 fps, start 3422 ms.
Flooded and rite remain below 30 fps. The earlier unchanged-baseline failure
below establishes an existing environment/budget problem, but does not clear a
regression in this alignment. No threshold was changed.

A fresh broad Chromium run selected both projects with two workers and stopped
on its first failure: 20 tests passed, the deferred-art readiness check timed
out with 276 pictures pending at its unchanged 25-second deadline, one concurrent
test was interrupted and 557 did not run. That readiness check also failed on
the earlier unchanged baseline (below). The full suite remains unverified.
The interrupted champion/recoil check subsequently passed in isolation, along
with four other affected art checks: creature effects/deaths, hero portraits,
class-specific shade gear and sway/step/fall/Calm animation (five passes).

## Early painted-set refresh

The subsequent painting pass refreshes all six hero paintings and all three
keepers (Lich, Warlord and Heartforged). These were the early standalone set,
made before the bestiary contact sheets. The refreshed set uses the later Grey
Dwarf and High Priestess paintings as references for the six classes, with the
refreshed Fighter keeping those hero portraits consistent. The three keepers
instead use existing bestiary entries directly as style/composition references:
Dark Acolyte, Goblin King, Forge-Thane and the fourth creature sheet. Their
previous appearances supply identity only; hero paintings do not set their style.
The other 50 bestiary paintings and title compositions retain their reviewed
sources, including the separately corrected Dark Elf Warrior.

The hero refresh replaces the repeated blazing cavern-city backdrop with
quieter dungeon stone and torchlight. The keepers now use the bestiary's wider
upper-body creature compositions, weathered materials and individual habitats:
a complete crowned skull and connected casting hand for the Lich in a crypt,
the Warlord's drum and held beater in his hall, and the Heartforged's furnace
and hammer grasped by both articulated hands in a forge. Their faces/head
designs and class/keeper identifiers remain recognizable. The hero equipment
remains stowed with continuous grips/shafts, and the Ranger's string joins the
bow stave. No new disconnected blade or body part was identified in the final
exports. The same three creature paintings serve bestiary and introductions.

Original PNGs remain intact. `art/portraits/overrides/` and
`art/bosses/overrides/` contain the current paintings, selected by their
generation manifests; the manifests preserve prompts, reference paths and
output filenames. `python3 art/portraits/export.py --check` reproduces all nine
512 × 512 WebPs exactly using FFmpeg Lanczos/libwebp quality 85. All nine were
inspected as a set and against their original paintings before the review hashes
were updated. Sprite/fallback identities and animations remain unchanged.

The source/export check, current art/cache/identity inventory, generated agent
guidance and TypeScript checks pass. The release remains the same uncommitted
0.9.3/build 18/cache 74 batch. This painting-only pass does not resolve the
broader deferred-art readiness timeout or frame-rate failures documented above.
The initial painting refresh passed all 38 focused portrait/bestiary/keeper
browser checks on normal and small phones, including story/sheet/ending/share
card use. After the keeper compositions were corrected to match the bestiary
directly, all 26 affected bestiary/keeper checks passed again on both phone
sizes, including introductions, enlargement, missing-file fallbacks and offline
reloads. Release-tooling tests also pass. The broader browser/performance
results remain the recorded failures above; no assertion or threshold changed.

## Deferred-art readiness repair — 19 October

Commit `4e89a3d` passed six CI checks, including performance and Safari, but
the first Chromium shard failed the unchanged 25-second deferred-art deadline:
21 pictures were pending initially and 56 on retry. Release publication was
correctly skipped. The local failures recorded above did not establish that
this readiness budget would pass on the runner.

The follow-up reduces rasterisation work in `js/painter.js`. Polygon edge
crossings are calculated once per row with the same arithmetic and odd/even
fill rule as `insidePoly`; curved-sheet bounds are reused, and each part's
material ramp is resolved once. Unused generic elite colour variants retain
their metadata and pose links immediately, while their tint/shade canvases are
built once when requested and cached, following the existing finer-elite
behavior. Normal, relic and legendary item variants share the same base raster,
with separate outlines and finished canvases. Base pictures, poses and queue
priorities remain prepared as before.
No test deadline, assertion, frame-rate threshold or CI job was weakened.

Back-to-back isolated system-Chromium profiles measured readiness at 18.6
seconds before the raster/elite changes and 9.8 seconds after, including
navigation. After adding item-raster sharing, a separate final run measured
15.8 seconds with no page errors. All 5,412 captured sprite, pose, elite, shade
and flash canvas-layer hashes still match the original exactly. These are
local measurements, not a guarantee of every device's timing.

The final two-worker regression run passed all 12 checks: three repetitions
each of the unchanged readiness deadline, throttled queue-priority behavior,
elite-cache/pose links and the Dark Elf parry flow. The core regression checks
compare rasterised coverage with `insidePoly` for concave, clipped, fractional,
reversed and self-intersecting polygons at four scales. Browser checks retain
the original readiness deadline and verify cached elite images, shade levels
and pose links.

The broad local run passed 85 checks, including the original readiness test,
then exposed a Dark Elf parry check racing its deliberately deferred special
pose. That test now uses the same bounded `artReady` helper already used by
the dwarf test; its final pose/tell assertion is unchanged. The isolated local
frame budget measured fight 48.4 fps, wide 16.2 fps, flooded 30.4 fps, rite
46.1 fps and start 2304 ms. The wide result still fails the unchanged 27 fps
bar. Full browser and performance verification remains gated by CI.

## Earlier repair validation

The core checks passed: agent guidance, release tooling, types, generator and
sprite checks, APIs/security, narration, offline lifecycle, voice catalogue and
722 rule checks. The generator suite was rerun with the held-weapon regression:
192 levels checked, zero failures. Source/export reproduction and the art
inventory check also pass.

All 38 focused portrait browser checks passed across the phone and small-phone
Chromium projects: bestiary and Journal art, class portraits, boss introductions,
zoom, fallbacks and offline reloads. Browser checks used the preinstalled system
Chromium through a local, ignored configuration; repository thresholds and test
configuration remain unchanged.

The broad Chromium run recorded 66 passes and three art-related timeouts before
being stopped for isolation. Two timeout cases passed when rerun alone. The
remaining case waits for all deferred art to finish within 25 seconds; it also
fails on an unchanged checkout of `65a1af7` on this machine (115 pictures still
pending at the deadline). No timeout, assertion or performance threshold was
weakened. The full browser suite is therefore not a clean verification result.

The frame-rate budget also fails on this machine, including on the unchanged
baseline. All runs were isolated, with one worker and the original 4× CPU
throttle and thresholds (30 fps, or 27 for the wide view).

| Revision / run | Fight fps | Wide fps | Flooded fps | Rite fps | Start ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Unchanged `65a1af7` | 37.1 | 25.2 | 22.7 | 26.9 | 2629 |
| Art repair, first run | 26.1 | 29.0 | 6.5 | 25.1 | 2949 |
| Art repair, second run | 18.7 | 23.8 | 12.2 | 22.4 | 4582 |

These variable, failing measurements do not establish performance parity or
clear a performance regression. No rendering thresholds were lowered, and the
changes have not been pushed or deployed. The source/export and portrait-flow
results above are verified; full-suite and performance verification remain open.


## Approved hero refinement — 19 October 2026

Applied the approved final six-class preview to Fighter, Cleric, Mage, Thief,
Ranger and Druid. Each portrait retains the established face, hair, skin tone
and class equipment. Quieter backgrounds, simpler clothing and distinct
expressions improve the visual focus on faces. Druid foliage is reduced around
the face; the Ranger retains a continuous bow and coherent quiver. No hands or
exposed weapon blades are introduced. Animated pixel fallbacks remain aligned
with the same identities.

The approved sheet and six label-free square crops are retained under
`art/portraits/refined/`. Crop coordinates and prior overrides are preserved in
the generation manifest. The 474-pixel sources are exported to the existing
512-pixel WebP slots using the documented recipe. No image regeneration after
approval was used. This batch changes portrait assets and the release notice,
with no gameplay or procedural rendering changes.

All 12 portrait-flow checks pass on phone and small-phone Chromium, covering
class selection, enlargement, fallback, story/sheet/end/share use and offline
retention. Source/export reproduction and the art inventory checks pass. A
broader local run was stopped after 22 passes to focus local checks on this
asset batch; full browser and frame-rate verification is delegated to the
unchanged CI matrix. Release-display checks initially encountered an old local
server commit stamp; the server was restarted before rerunning those checks.


## Companion collection — 19 October 2026

Added the previewed Hound, Wolf, Goblin, Sellsword, Mender and Renegade portraits
for a collection available from the title and Journal. Their appearance follows
existing companion sprites and recruitment descriptions. Visually reviewed the
six label-free exports: hound collar, wolf ears, goblin face, sellsword helmet,
mender staff and renegade hood/ears are coherent. Portraits represent types,
not fixed names, since names vary between runs. Sources and crop coordinates
are preserved in `art/companions/`. Existing animated sprites remain unchanged.

Validation: all 44 selected companion, bestiary and accessibility browser checks
passed on phone and small-phone Chromium. Two additional collection checks at
double text size passed WCAG scans and layout checks. The full core suite passed,
including 722 rule checks, collection sanitization and legacy recovery. All 15
class/keeper/companion exports reproduce from their current sources, and the
67-painting inventory passes.

The isolated local 4x-throttled frame budget failed: fight 17.5 fps, wide 28.9,
flooded 23.1, rite 34.5, start 2611 ms. The original thresholds remain unchanged.
These results do not establish performance parity. Full Chromium and Safari
matrix verification remains outstanding; this feature has not been pushed.
