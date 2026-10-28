# Exact idle, blink and recovery fixtures

The Ubuntu 24.04 follow-up [run](https://github.com/cisohabitat/Dungeon-Hack-Mobile/actions/runs/40619663929)
installed browsers successfully. Nine required jobs passed, but phone shard 2
failed the existing boss/class-Shade fixture on both attempts. The class guard
was correct (`procedural` false); its selected image differed from the idle
Mage object. See [failure evidence](ci-failure.json) and its retained CI artifact.

`motion.js` selects `img.blink` for 130ms of each UID-dependent presentation
cycle. The fixture froze `Game.update` but still sampled `performance.now()`;
an awake Shade can therefore legitimately blink during its idle-only equality
assertion. The [deterministic native probe](probe.cjs) forces the two phases:
[results](probe.json) show the old predicate passes at idle (`[true,true]`)
and fails during a correct blink (`[true,false]`). This reproduces the predicate
error, not the original CI timing or trace.

The correction keeps every Heartforged, Warlord, concealed-Mimic and class
guard assertion. It waits for the class blink object as well as windup, then
derives a future cycle from the actual monster UID. At 200ms it requires the
exact Mage idle object; at 64ms it requires the exact Mage blink object. Both
must retain the non-procedural class route. No arbitrary pose is accepted as
idle, no timeout is extended, and the game's clock/blink code is unchanged.
This is a fixture-only change; v0.9.51/build66/cache126 and all runtime/painting
bytes remain identical to the verified lantern commit.

The same run's phone shard 1 [retried an Orc recovery test](orc-flake.json):
the hurt image was correct, but its +900ms sample was a legitimate blink.
The fixture now anchors its supplied hit timestamp so the original +60ms hurt
and exact +900ms idle comparisons stay unchanged. A separate post-reel blink
sample must equal the Orc blink object. All named-champion pixel/pose checks
remain. The probe reproduces the old +900ms failure and confirms the corrected
hit-to-idle interval is exactly 900ms, with hurt/idle/blink all exact.

The first extended diagnostic omitted waiting for Orc hurt/blink readiness;
its unprepared objects produced `reeling:false, after:true`. It was corrected
by awaiting those native poses; the actual recovery test already waited for
the complete art queue. An initial repeated combined fixture pass is retained
in [its log](initial-combined-focused.log). The final fixture additionally
retains the exact 900ms sample rather than moving recovery to a later cycle.
No game code or assertion deadline was changed for these diagnostics.

```sh
node docs/verification/2026-10-28-shade-clock/probe.cjs
npx playwright test --project=phone --project=small --workers=2 --repeat-each=5 test/browser/painted-world.spec.js test/browser/art.spec.js --grep 'boss equipment and class shades|a struck monster is drawn reeling'
```

All 15 final focused repetitions passed without retries (1.1m): five class-route
checks in each phone project and five Orc/champion checks in the phone project
that includes `art.spec.js`. [Final output](focused-browser.log) and
[validation data](validation.json) retain the exact intervals and controls.
`npm test` passed, including 751 rules in 74 files (rule phase 1m19s), agent/art
checks, release fixtures, types, generation, security and worker lifecycle.

Fresh committed release checks, full CI and the publisher remain required;
successful statuses on the follow-up commit are authoritative. This does not
require repeating the unchanged full local game suite or frame budget; their
recorded lantern evidence remains valid.
