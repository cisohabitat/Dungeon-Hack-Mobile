# Phase 1 — settled accessibility audits

Baseline: `62be4c80a760feed1a1837308ab43610fded9348`.
The guide's final Pack audit intermittently read low-contrast labels while a
native entry fade was unfinished. In baseline CI40542440308, job122324096062,
the double-text guide case failed first try and passed its configured retry;
other checks passed. Recorded foreground colors included#292535 against
#1e1b2a, contrast1.13, although the settled CSS uses#9a93a8 for those labels.

`uiReady` waits for finite animations in the active overlay or screen and for
outgoing overlays to close. It ignores infinite decorative motion, uses the
existing bounded10s readiness scale, and does not modify animation, clocks,
artwork loading or production styles. General accessibility scans replace a
guessed250ms sleep with the same helper. The guide retains every navigation,
overflow, keyboard and serious/critical assertion, all WCAG tags and its120s
test deadline. No retry setting changes. No player files change; v0.9.50,
build65/cache125 remain unchanged. No balance simulation is needed.

## Controlled reproduction

`probe.cjs` executes the actual baseline or current guide test with only the
native Pack entry animation extended to2s. It performs three fresh repeats
without retries. This is controlled timing stress, not an unmodified local
WebKit reproduction. Production still uses its original170ms fade. WebKit is
verified in CI; Linux engine tests do not establish physical iPhone coverage.

```sh
node docs/verification/2026-10-27-ci-refactor/phase1/probe.cjs --before
node docs/verification/2026-10-27-ci-refactor/phase1/probe.cjs
```

The default output directories are under `/tmp`; `A11Y_PROBE_OUTPUT` can select
another directory. The existing project Playwright and system Chromium are used;
`CHROMIUM_PATH` may override `/usr/bin/chromium`. Raw traces remain outside Git
under `/workspace/ci-refactor-artifacts/`, with selected logs/results copied here.

## Regression guard and verification

The new tagged regression stretches the real Pack fade to900ms and adds harmless
infinite title decoration. It asserts settled opacity and an ordinary clean axe
audit, then checks that a visible low-contrast label triggers a serious contrast
violation. An initial exact-background-color negative control produced no axe
violation: the first focused run had34 existing cases pass and only that new
control fail at both sizes. That rejected fixture and its traces are retained
outside Git. The corrected visible-color control passed both sizes in10.7s.

Final repeated comparison, focused suites, repository checks, committed release
identity checks and required CI results are recorded before completion. The
same seven CI gates and publisher remain mandatory.

The controlled original failed all three repeats with contrast violations;
the selected helper passed all three repeats under the same2s Pack fade.
The probe orchestrations completed in39.7s and37.4s respectively. These results
do not claim an unmodified local Safari reproduction or a physical-device pass.

Final focused run:36passed in223.0s, no retries. `npm test` passed all751rule
checks (1m21s rules;172.7s overall) and all other required repository checks.
Fresh committed release-identity checks, the exact-commit hook, all required
CI jobs/publisher and public commit delivery remain gates after this commit.

The phase1 push is `1c6fb9431012f002469b375b7678a05b773e236f`. Its
[CI run40555937167](https://github.com/cisohabitat/Dungeon-Hack-Mobile/actions/runs/40555937167)
provides the authoritative required-gate results. Fresh committed release
checks passed6cases in28.8s; the exact-commit hook passed751rules (1m26s).
Public commit metadata and five runtime files matched the unchanged v0.9.50
source exactly. Both new-control and guide cases passed first try in the
completed phone shard; final WebKit results were still pending at this local
phase2 commit.
