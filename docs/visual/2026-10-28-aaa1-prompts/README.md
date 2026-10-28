# AAA1: tutorial and discovery narration priority

Baseline: main `9d37bdc3916f77dc1f940a48adbad942dfb5598a`, v0.9.53.
Prepared candidate: v0.9.54, build69, cache `deepdelve-v129`.

The fresh review found region narration covering the first controls lesson on
upright phones: approximately34px at390px and36px at320px. Native screenshots
are retained as `before-390.png` and `before-320.png`; `before-bounds.json`
records their actual overlapping element rectangles. Landscape had no rectangle
intersection in that sample. These are observations from the sampled first run,
not a claim about every tutorial or dungeon.

## Change and scope

The discovery scheduler gives a visible tutorial the same priority as an open
overlay or prelude. Its existing interruption path queues an active discovery;
pending discoveries begin after the tutorial closes, subject to the unchanged
enemy-warning/overlay/prelude guards. Interrupted readings use the existing
restart behavior; this does not add seeking or promise position-preserving
resume across interruptions. Normal Pause/Resume/Skip remain available when a
discovery is shown. Prologue, Journal and ending controls are unchanged.

No rendering, art, CSS geometry, touch target, game rule, seeded roll, combat
clock, seven-second tutorial timer or150ms discovery check interval changes.
NEWS describes the player-visible sequencing change. This phase completes a
bounded collision fix; the other AAA phases and unfamiliar-player/full-run
reviews remain open in ROADMAP.md. It does not establish a new overall grade.

## Distinct evidence

- `capture.cjs` runs six fresh native UI flows:320/390/740px in Normal and Double
  text/Calm. It uses shipped recordings and actual New Game, seed, tip dismissal
  and Skip controls. Only real text/Calm preferences are supplied. It makes no
  media/image/renderer/game-clock/enemy/safety substitutions. `native.json`
  records twelve lesson/discovery frames and zero page/console errors. These
  are running UI captures, not a physical-phone, listening or complete-run pass.
- The six new `visual-polish.spec.js` cases run in both Chromium projects and
  focused WebKit. They use a long silent media fixture and clear enemies to
  isolate tutorial priority from the separate combat-warning guard. Each checks
  that narration stays hidden across multiple scheduler ticks while the first
  tip is visible, starts after real dismissal, stays inside the view, supports
  Pause/Resume and stops on Skip. No deadline/retry/threshold is relaxed.
- Temporarily restoring the original scheduler condition with the corrected
  quiet-scene fixture fails at `toBeHidden`: the discovery panel is visible
  over the lesson. The fixed scheduler passes all twelve focused Chromium
  cases. The earlier unisolated negative-control draft instead encountered the
  enemy-warning guard after dismissal; it is not used as proof of this defect.
  Logs/reports for both attempts remain outside Git in the workspace.

Reproduce native evidence from the repository root with:

```sh
node docs/visual/2026-10-28-aaa1-prompts/capture.cjs
```

Complete repository, full Chromium and isolated performance results are recorded
in `validation.json`:751 rule checks passed;965 ordinary plus6 serial offline
Chromium cases passed with no skips, failures or retries; the unchanged isolated
seven-scene FPS gate passed, with reading37.2FPS at4× slowdown and startup1932ms.
The twelve focused fixture checks and twelve native frames are separate evidence
and are not added to the971 distinct full-suite cases. Every CI job and the publisher
must finish successfully before the pushed release is reported as verified.
Passing retries and any local frame-rate miss remain explicit evidence, rather
than being erased by a later passing run. The existing browser-native SIGSEGV
and historical WebKit offline-status causes are separate open investigations.
