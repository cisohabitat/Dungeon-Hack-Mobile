# Calm flight: remove idle bob, retain combat motion

Baseline: published v0.9.75/main `1c27ef7e7a13a6884fe5447749700fd72fe36b85`.

## Finding and change

The preceding treasure correction exposed a related gap: flying creatures keep
their periodic vertical bob even when Calm is enabled. The supplied clear-floor
projection fixture reproduces 3.88px of unwanted bat motion at its four-tile pose.
A separate running-game reference, paused through the real Menu while rendering
continues, measures about 9.93px for the selected bat view and 4.44px for its group.

Alive flying creatures now supply `stillYOff` alongside their original `yOff`.
It contains the authored flight altitude plus actual movement lift. Calm removes
only the ambient sine bob; normal height math remains unchanged. Both solo and
pack branches use this rule. Grounded, concealed, submerged, collapsed and dying
bodies retain their existing treatment. Wing poses, shade flicker, lunges, hurt
reactions, warning growth, words, timing, visibility rules and actual movement
remain intact. This does not globally freeze creature animation.

No monster stats, AI, attacks, targeting, population, geometry, loot, save schema
or random stream changes. This is a cosmetic AAA4 compatibility correction;
recorded balance measurements remain applicable. It does not approve layout
changes or complete AAA3, physical-device review or an independent AAA regrade.
Human listening remains skipped at the owner's request.

## Evidence boundaries

The regression case in `painted-creatures.spec.js` measures real forwarded drawing
positions for all five flying identities at three render heights, plus permitted
bat groups and a grounded Rustmaw control. It also requires a sideways Wraith
step to retain its vertical arc in Calm and its visible warning to remain the
same in both settings. The supplied clear-floor fixture copies exploration arrays
to isolate expected map-reveal writes; idle state and both dice streams remain
unchanged. The initial exploratory fixture additionally exercised unspawned moth/
wraith groups; the final case uses `Dungeon.PACK_KINDS` instead. Its first bat
failure is the same reproduced defect, not balance clearance for new groups.

`capture.cjs` uses naturally generated bats, moths, Wraiths, Orla and a bat group,
selected by a 22-floor headless survey. It supplies legal hero inspection poses
and safety HP. The real Menu pauses AI/game time while the normal rendering
clock keeps advancing. The observer forwards drawing calls without replacing
images, the renderer or clocks. Resume and turn inputs run normally afterward.
These are controlled inspections, not unassisted play or physical-device evidence.
The Shade is covered in the projection fixture rather than presented as a
naturally generated fresh-run encounter.

The historical reference routes only v0.9.75's `motion.js`, with shared current
dependencies and metadata. It is explicitly a source comparison, not an untouched
historical deployment. Final current-runtime captures use no module routing.
The paused bat probes require old/reference and normal views to exercise actual
vertical bobbing, and current Calm views to have zero projected vertical span.
Native populations and clocks can differ across sessions; no native pixel-pair
or gameplay win-rate claim is inferred from them.

## Reproduce

Use existing repository dependencies and system Chromium:

```sh
FLIGHT_WIDTH=390 FLIGHT_OUT=/tmp/flight-normal node docs/visual/2026-11-01-calm-flight/capture.cjs
FLIGHT_WIDTH=320 FLIGHT_CALM=1 FLIGHT_OUT=/tmp/flight-calm node docs/visual/2026-11-01-calm-flight/capture.cjs
FLIGHT_KEYS=bat,bat-group FLIGHT_WIDTH=320 FLIGHT_CALM=1 FLIGHT_BASELINE=1 FLIGHT_OUT=/tmp/flight-reference node docs/visual/2026-11-01-calm-flight/capture.cjs
```

Use width 740 for landscape. After verifying a matching ready deployment, set
`FLIGHT_URL` to its URL and `FLIGHT_EXPECT_SHA` to its exact commit for the same
native check against production. No source routing is used for production.

`validation.json` records completed gates and prepared source hashes. Every
original rule, full Chromium, isolated FPS, WebKit CI and publication gate remains
required. Do not infer physical-device or independent-player clearance from them.

The original isolated local frame-rate run measured wet surfaces at 28.3 FPS
against 30; the other scene measurements met their budgets and startup was2,045ms.
The [retained raw log](performance-local.log.gz) keeps that miss separate from
required CI. No unchanged local rerun or reduced threshold clears it.

Both full Chromium projects passed all 1,047 cases: 666 phone and 381 small-phone,
including ten serial offline-install cases. There were no failures, skips or
retries, and runtime hashes still match the prepared capture manifest. The final
full-run projection attachments are `projection-phone.json` and
`projection-small.json`; the reports and logs are retained losslessly as gzip.
Typechecking and both focused regression cases passed as well.

The fifteen current-runtime native inspections cover five generated creature
views at 390px, 320px Double-text/Calm and 740px landscape. Their complete numeric
records, selected play frames and hashes are in `capture-manifest.json` and the
three `native-*` folders. Two historical-motion reference inspections are kept
separately in `reference-calm320`.
