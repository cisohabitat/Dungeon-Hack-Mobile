# Combat effects polish — 27 October 2026

Candidate: v0.9.49 (build 64), based on main 5c4ca94c3aa009d858ddcfa7a2b4758edb200770 (v0.9.48).

Two presentation defects were confirmed and corrected:

- Painted fire/frost impacts used full projected wall height as their size while
  their procedural fallbacks used a bounded torso radius. Nearby bursts could
  reach across the creature's face. Both now use the bounded radius. Existing
  four-phase paintings, native decoding/fallback and fade durations are retained.
- Spells were painted after damage receipts and could recolour their opaque ink.
  Spells now precede receipts. Each attack-warning rectangle is clipped separately
  so overlapping warnings remain protected from travelling and impact effects.

Original code fails both new pixel regressions: a sampled impact exceeds 103px,
while a stationary overlapping lightning volley changes 29 opaque text pixels.
[Original failure log](before/regressions.txt) retains both failures. The first
local draft of the new size test required more than 10 pixels even at far range;
its legitimately tiny first-phase mark had9. The final test requires a nonempty
far mark, more than 10 close pixels, bounded size, smaller distant size, a close
size cap, expiry and restored canvas state. A second draft mistakenly sampled projection 200 as already capped; its radius 52 is below the 54 cap, so240 is the correct comparison with 800. These two fixture errors are retained in the validation logs. No existing assertion was relaxed.

[Before](before/close-frost.png) and [after](close-frost.png) are frozen fitting
views after a native Cone of Cold cast, not native animation evidence. The
probe freezes simulation/time after the cast and captures its40% phase. Hero
names/stats and native spell rolls differ; the comparison demonstrates shape
fitting, not identical game outcomes. Reproduce with `node
 docs/visual/2026-10-27-combat-effects/probe.cjs`; `COMBAT_PROBE_OUTPUT` selects
an alternate image path. [Comparison](comparison.png). The baseline was captured before modifying runtime.

`capture.cjs` runs real game actions and frames on supplied level 10 heroes and
stationary enemies. Melee attempts may reset recovery between misses, but use
native hit dice. It records running hit reactions, death, weapon and spell
frames; no asset, renderer, simulation or dice substitutions. The main sweep records 78 actions,4,680 frame records and 390 selected images
at 320/390/740px, in normal and Calm view. Each action retains four canvas
frames and a subsequent whole-view capture; the latter's `after` suffix does
not assert expiry. The six online fire-scroll runs cover the first~980ms
(reading/travel/early impact), not their entire1,350ms presentation. Temporary
extra canvas images were archived outside the repository; all60 frame records
per action remain. `capture.cjs` now saves only the selected frames and extends
scroll sampling to 100 frames; the later offline runs include fade/expiry.
A second 390px sweep adds 12 actions/720 frames for skeleton, slime, wraith, bat,
puffcap and emberling, covering the other six native death styles in both modes.
The original orc covers `fall`. Scroll fire uses the real consumed
scroll, not an invented Mage Fireball spell. These are supplied combat scenes,
not a complete generated dungeon or a balance simulation.

Offline mode installs the real service worker/core/voice, disconnects browser
and controlled origin, reloads/Continues, then casts real frost/fire actions.
Two installed profiles, at 320/390px, record8 actions/640 frames and48 images.
All actions pass; the 100-frame fire-scroll sequences reach beyond native effect
expiry. Fresh installation does not prove upgrades from a previous version. Linux
Chromium phone viewports do not establish a physical iOS Safari pass.

Commands (system Chromium; project dependencies already installed):

```sh
node docs/visual/2026-10-27-combat-effects/capture.cjs
COMBAT_OFFLINE=1 node docs/visual/2026-10-27-combat-effects/capture.cjs
```

`COMBAT_OUTPUT` selects a separate evidence directory. `COMBAT_BASE_URL` can
select a public origin for native online smoke checks; `COMBAT_WIDTHS` and
`COMBAT_CLASSES` restrict that sweep. `COMBAT_ACTIONS` supplies a Fighter action
list, used for the separate death sweep:

```sh
COMBAT_WIDTHS=390 COMBAT_ACTIONS=death-skeleton,death-slime,death-wraith,death-bat,death-puffcap,death-emberling COMBAT_OUTPUT=docs/visual/2026-10-27-combat-effects/deaths node docs/visual/2026-10-27-combat-effects/capture.cjs
```

Offline mode requires
the controlled local server. Complete captures before performance/browser
workers to avoid CPU contention.

[Validation data and source hashes](validation.json) retain all samples.
All 50 distinct focused cases passed across the final fixtures (46 existing
checks plus the 4 corrected new cases). Both original-code regressions failed
as expected. The initial draft fixture errors are retained in validation logs.

Local performance **did not pass** the unchanged isolated budget. At 4× CPU,
the initial candidate measured 29.3/34.2/31.1/29.7/38.1 FPS for fight/wide/
flooded/painted/rite. One paired comparison measured the unchanged previous
release 27.1/33.5/28.6/22.5/41.2 and candidate 30.6/26.6/29/24.2/41.2.
Startup was 2712/2547/2462ms respectively. All thresholds, workloads, throttling
and single-worker settings were preserved. No further local samples were
selected to obtain a pass. These mixed readings do not establish a speed
improvement or regression caused by this change. CI's separate performance
check must pass before publication can be reported as verified. The game rules, targeting, controls, impact timestamps,
spell costs and damage, hit flashes, corpse poses, saved state and dice are
unchanged; no balance simulation is required for these drawing-only changes.
No source painting or new atlas is commissioned.

`npm test` passed, including 751 rule checks in 74 files (1m38s) and generator,
type, art, release, security, narration and offline lifecycle checks. Both full Chromium projects passed: 937 ordinary cases (two workers, 1.1h)
and 6 full-cache offline cases (one worker, 2.9m), for 943 distinct passing
cases with no failures. Required CI, including its separate performance job,
and release publication remain gates after pushing this candidate.
