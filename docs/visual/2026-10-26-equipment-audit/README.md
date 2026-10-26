# Rare equipment in motion

Audit of the shipped v0.9.45 equipment renderer after the keeper/victory review.
No confirmed rendering defect was found in the reviewed captures and checks.
No game, art, balance, test assertion or deadline was changed.

## Fresh native coverage

`capture.cjs` derives from the existing AB native-runtime tool, using delivered
Assets rather than source-art proxies. It equips legal named items through
Game.canEquip/Game.equip and runs the real attack, read, drink, class cast and
Fighter shield Bash commands. Actual game time advances; no renderer/asset route
replacement or frozen updates are used. Setup supplies equipment/resources,
clears scenery and places a durable enemy. These are not unassisted discoveries,
quest completions or combat victories.

The28 class/item combinations comprise all16 named carried shield/focus pairs,
all8 named bow pairs and Heartroot's4 compatible classes (Fighter, Cleric, Mage,
Druid). Each runs at320×667,390×844 and740×360:84 sessions,306 native actions,
1,254 original captures and84 per-session contact galleries. Twelve comparison
sheets below were visually reviewed, with selected originals enlarged. Captures
include native Calm rest views; Calm attack/glint geometry is checked separately
by the deterministic renderer matrix. This is not native motion coverage for
every named blade, every ordinary caster item, or every equipment pairing.
Carried-family sessions remove the main weapon to isolate the carried surface.

## Heartroot finding

All24 attack/read and attack/drink overlaps showed the exact `drive-one` painting
at or after the consumable start, followed by `rest-two` after that action ended.
[Trace summary](heartroot-trace-summary.json) records every class/viewport/action.
[Early overlap comparison](heartroot-early-contact.png) shows the left hand using
the consumable while the right holds the staff, with no extra gripping hand.

The original observation test passed in both projects in the focused run, then
passed all6 unchanged repeats on one worker (three per project). The previous
Safari failure waiting for this brief pose **was not reproduced in this Chromium
audit**. This does not prove that the Safari timing failure is permanently fixed:
there was no new WebKit or physical-device run here, and no timing test was
weakened or changed. The earlier successful Safari rerun remains historical
release evidence rather than a fresh result from this audit.

## Other visual findings

Reviewed bow strings/arrows remain on the bow's nocks and grip; shield/focus
hands lower for consumables and casts, then return. Native landscape samples
keep the painted objects in the short view; sleeves can continue off-screen.
The entire carried object can intentionally lower out of view during use/cast.
No additional hand, broken grip or new object clipping was confirmed in these
samples. This is a bounded review, not every possible simultaneous-action frame.

| View | Part1 | Part2 | Part3 | Part4 |
| --- | --- | --- | --- | --- |
|320px|[Review](320-review-1.png)|[Review](320-review-2.png)|[Review](320-review-3.png)|[Review](320-review-4.png)|
|390px|[Review](390-review-1.png)|[Review](390-review-2.png)|[Review](390-review-3.png)|[Review](390-review-4.png)|
|Landscape|[Review](740-review-1.png)|[Review](740-review-2.png)|[Review](740-review-3.png)|[Review](740-review-4.png)|

The original native frames and84 session galleries are indexed in
[captures.json](captures.json). That file also retains exact painted draw keys
and timestamps. Historical null offline-cache fields in its inherited schema
mean **not checked here**: this capture pass performs no offline reload. Early
console labels inherited from the older tool mentioned offline; the final tool
label and this report distinguish the actual scope.

## Regression checks

All24 focused browser checks passed in1.4m across phone/small projects. They
include2,373 named renderer/action fixtures per project (4,746 total) at
160/360/464px canvas heights, bow-string endpoints, glint tip registration,
Calm suppression, exact class/identity/hand/light bindings, independent corrupt
frame fallbacks, native Fighter offhands and native staff overlaps. The separate
ranged/rare/released-hand fitting check includes Penitent as well as ordinary
weapons. These deterministic fixtures prove exact runtime drawing and state/dice
neutrality, not native eligibility or real-time actions for every pose.

The6 unchanged single-worker Heartroot repeats passed in48.6s:30 focused browser
cases total. See [validation.json](validation.json). No balance/performance rerun
is needed for this review-only change: every shipped game/art byte stays the same.
Fresh offline and Safari coverage are outside this audit. Full repository rules
run against the committed review through the mandatory publication hook.

Reproduce native captures with
`node docs/visual/2026-10-26-equipment-audit/capture.cjs` (project Playwright and
system Chromium). Finish captures before browser workers. The review sheets are
diagnostic resized comparisons; original captures remain available for zooming.
