# Moving scenery and interaction review — 27 October 2026

Prepared for v0.9.47, following the v0.9.46 sliding-panel correction. CI and
the release publisher remain required; their final result is recorded by the
release, not inferred from this pre-publication report.

## Confirmed defects and corrections

Native commands against v0.9.46 reproduced three continuity defects:

1. Battered doors lost their cracks while opening, though the saved damage was
   still present. Closing showed the cracks again.
2. A silver-key unlock recorded the moving lock as `any`, losing its actual
   colour as soon as the leaf started moving. Both wooden doors and cell gates
   were affected.
3. A door's fire expired into ash, but its moving remnant reverted to clean wood.

[Before observations](before-failures.json) preserve the three failing browser
cases and the initial local browser-launch setup failure. The latter was resolved
by selecting the installed system Chromium; no browser download or assertion
change was needed to reproduce the runtime defects.

`renderer.js` now applies damage to a ray-hit door leaf even after its saved tile
has opened. A moving burned remnant keeps the final charred stage from the
existing `burntDoors` marker. This marker cannot paint a jamb or recreate a panel
after the opening animation ends. Keyed unlocks call `setTile` before deleting
the saved lock, matching the existing companion/forced-unlock ordering and
preserving the colour in the transient animation record.

Source paintings, caches' source identities, ray intersections, texture-scroll
fractions, collision, opening duration, key consumption, final lock removal,
burn duration and seeded outcomes are unchanged. This is presentation work;
balance simulation is not required. The rule suite checks the interaction rules.

## Fresh evidence and limits

- `captures/evidence.json`: 24 native sessions at 320×667, 390×844 and 740×360;
  ordinary and battered opening/closing, silver-key gate unlock/closing, fire
  expiry, secret-wall discovery, chest breaking, snare disarming and leaving a
  lever encounter. Each session uses actual game commands, updates and renderer.
  Nearby geometry/objects and resources are supplied; paintings are not replaced.
- The same manifest records 72 **frozen** fitting views: three representative
  regions (0/6/10), door/gate, both wall directions and both approach sides at
  65% shut. These are geometry/material checks, not native traversal or a fresh
  all-region motion audit. Early views retain the existing floor-title overlay;
  the underlying panels remain visible. All 72 had visible moving columns.
- `traps/evidence.json`: 15 additional native sessions cover dart, needle, pit,
  alarm and snare at all three widths. Nearby traps, 999 HP and Wisdom 1 expose
  the effects without replacing spotting/dodging or dice. All five families
  actually triggered; the record distinguishes successful dodges. Each trap was
  removed after stepping onto it. These samples do not cover every trap/hero
  combination or physical haptics/audio.
- `lever-actions/evidence.json`: three further native sessions choose “Work out
  the order from the marks” through the real encounter UI. This seed produces
  the failed-check/dart result at each width. The static encounter painting and
  result/return flow were reviewed; this does not establish a successful-check
  capture or invent a separate animated wall-switch system.
- `offline/evidence.json`: two real worker installations, disconnects, offline
  reloads and Continue flows. Each executes a silver-key battered door **and**
  gate opening/closing at 320/390px with decoded painted sources and unchanged
  saved damage. These are current-version installs, not upgrade/retry profiles;
  the previous phase's historical upgrade evidence stays separate.

The native interaction views, angle views and trap contacts were visually
reviewed. No further confirmed defect was found in the sampled chest, secret
wall, lever or trap presentation. There is no new atlas or repaint in this phase.
This bounded review does not certify every generated room or device.

The original three regression cases passed on both Chromium projects (six
cases). They then received same-turn initial-frame rendering and bounded native
fire-expiry polling so loaded workers need not happen to catch a brief interval;
the final full browser runs below verify that version of the tests. Existing
assertions and deadlines are unchanged. Full local release results are recorded
in `validation.json` before publication.

## Reproduce

Use the repository's installed Playwright dependency and `/usr/bin/chromium`.
Run capture tools serially, before browser suites or performance measurement:

```sh
node docs/visual/2026-10-27-interactions/capture.cjs
node docs/visual/2026-10-27-interactions/traps.cjs
INTERACTION_KINDS=levers INTERACTION_ANGLES=0 INTERACTION_LEVER_CHOICE=0 \
  INTERACTION_OUTPUT=docs/visual/2026-10-27-interactions/lever-actions \
  node docs/visual/2026-10-27-interactions/capture.cjs
node docs/visual/2026-10-27-interactions/offline.cjs
node docs/visual/2026-10-27-interactions/gallery.cjs
```

The nine contact sheets are named `angles-*`, `native-*` and `traps-*`. Full
captures and per-frame timestamps/state remain in their evidence folders.

The new regressions live in `test/browser/painted-world.spec.js`: damage and
key-colour continuity for doors/gates, and native burn expiry through an empty
doorway. Keep the existing region/leaf/cache/failure/offline checks alongside
them. Required local release gates are `npm test`, both full Chromium projects
(the three full-cache install cases serially), release identity checks and the
isolated `PERF=1` project. WebKit runs in CI; these captures are not physical
iOS Safari verification.
