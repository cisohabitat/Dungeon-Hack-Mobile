# AAA3 selected approaches and Heart staging — 31 October 2026

Baseline: v0.9.69/build 84, `1a0262accb245352e16c05fd1135fb7269db4a35`.
The owner deferred browser-stability work for this round. All ordinary release,
browser and performance gates still apply.

## Finding and bounded change

The selected generated-room review covers cistern, shrine, fallen hall and
regional scenery, plus treasure views and all three keepers. Fourteen baseline
views at 320px retain live updates and shipped assets. Later views use supplied
legal inspection poses, testing HP and save/load; they are not unassisted
approaches or physical-device evidence. Some chosen inspection angles do not
show the room's entrance, so these are not a complete approach-readability grade.
The earlier rejected guard-relocation experiments remain rejected.

One concrete mismatch was visible at the final objective: the hall description
places the Heart on a dais, but its floor sprite was only the floating core.
Its existing approved ending/choice painting already supplies matching steps.
`paintedHeartPlinth` clips that source above row 176 and prepares five shade
frames once on demand. It neither edits the source image nor adds an asset URL.
The floor now draws those fixed steps beneath the original independently
animated core. It retains the core's 0.4 scale, 300ms sine divisor, 0.03 bobbing
amplitude and glint; its vertical offset rises from 0.04 to 0.17 only while the
0.5-scale base is ready. Both share the exact scattered item coordinates and
existing floor sort. The base has no glint, dungeon light or interaction.

Delayed/corrupt dais art retains the complete original floating core and its
0.04 offset. Removing the Heart removes the base. Pack, encounter, ending and
share-card bindings are unchanged. No guard, geometry, collision, loot, pickup
lock, item count, game clock, saved field or random stream changes. No balance
change or new balance clearance is claimed.

Representative native views: [original Heart](before/05-heartforged-treasure.png),
[320px with steps](native-320/05-heartforged-treasure.png),
[390px Warlord objective](native-390/05-warlord-treasure.png) and
[landscape Heartforged objective](native-740/05-heartforged-treasure.png).
These share supplied spatial poses but have different live motion/times.

## Verification evidence

The final native review uses the current modules without source/image routing,
frozen rendering or a substituted clock. It records all three keeper objectives
at 320, 390 and 740px, with supplied legal poses and safety HP. Recorded action
requests are distinguished from observed position/direction changes. Captures
include active guards and warnings; those fights remain unchanged. Normal live
motion is retained. These views do not certify every close approach, Calm view,
physical devices or the rest of AAA3.

The focused browser regressions cover transparent upper crop pixels, identical
lower source pixels, fixed base/core registration, native bobbing/glint, zero
warm-frame canvas allocations, unchanged game state and dice, ordinary gold,
removal, and delayed/corrupt independent fallback. The installed all-art reload
also demands the cached plinth while offline, using the existing asset entry.
All 1,029 local Chromium cases passed with zero failures/skips/retries: 657
phone and 372 small-phone checks, including eight serial installation cases.
The source hashes remained equal to all 18 final native views.
The original nine performance scenes and all thresholds are unchanged.
The required local run missed wet surfaces at 29.1 FPS against 30; the other
8 scenes passed, including the final-floor rite at 54.4 FPS. Startup was
1,831ms. The [local failure log](performance-local.log) is retained alongside
its external trace/results directory. No unchanged rerun or benchmark reduction
is used to clear this miss; fresh CI must pass every original gate before
publication. Differences between machines/runs are not a causal speedup claim.

The first focused attempt passed four cases and failed two state snapshots.
A retained diagnostic found only the `recording` field changed during view
inspection; both dice remained equal and warm-frame allocations were zero.
The frozen fixture now disables replay recording before taking its snapshot,
as the earlier Heart fitting audit did. All state/dice assertions remain.
Original logs/traces remain under `/workspace/aaa3-plinth-focused-results/` and
`/workspace/aaa3-plinth-diagnostic-results/`; final results go in `validation.json`.

Native screenshots are spatial comparisons with different live times/population
motion, not exact before/after pixel pairs. Original captures and their hashes
are indexed in `capture-archive.json`. `validation.json` records final source
hashes and completed checks; eventual CI/publication records stay outside this
immutable source snapshot.

## Reproduce

From the repository root with existing dependencies and system Chromium:

```sh
AAA3_KEYS=0,2,5,8,12,05-warlord,05-heartforged AAA3_WIDTH=320 AAA3_ACTIONS=1 AAA3_OUT=/tmp/landmark-review node docs/visual/2026-10-31-landmark-approaches/capture.cjs
AAA3_KEYS=5,05-warlord,05-heartforged AAA3_WIDTH=740 AAA3_ACTIONS=1 AAA3_OUT=/tmp/heart-staging node docs/visual/2026-10-31-landmark-approaches/capture.cjs
```

Use width 390 for the larger portrait view. Baseline reproduction requires the
recorded baseline commit; current checkout captures are the candidate.
