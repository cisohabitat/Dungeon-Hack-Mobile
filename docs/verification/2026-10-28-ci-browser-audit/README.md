# CI browser closure and offline retry audit — 28 October 2026

Baseline: `f15a96a3012b424f9357e85a3e11dbfeb9d80ff9`, v0.9.53, build68,
cache `deepdelve-v128`. This phase changes CI diagnostics only. No game source,
painting, service worker, rule, release number or performance threshold changes.

## Findings

Three successful main runs each had one test that passed on its automatic retry:

| Run | Job / case | First-attempt evidence |
| --- | --- | --- |
| [40624438776](https://github.com/cisohabitat/Dungeon-Hack-Mobile/actions/runs/40624438776) | phone, Lich Take share card | `browser.newContext` failed; Chromium logged `Received signal 11 SEGV_MAPERR 0000000001b0` |
| [40635805861](https://github.com/cisohabitat/Dungeon-Hack-Mobile/actions/runs/40635805861) | small, finished-run replay | same context-creation failure and native SIGSEGV address |
| [40650246766](https://github.com/cisohabitat/Dungeon-Hack-Mobile/actions/runs/40650246766) | WebKit, core/voice offline reload | last reload left `#offline-status` hidden/empty past its unchanged10s assertion; logged browser exits were clean |

The Chromium faults occurred before a test context opened. They establish a
native browser crash, not an application replay/share-card assertion failure.
The common address alone does not identify its trigger. No available evidence
establishes OOM. The WebKit status failure is separate; this audit does not infer
an application fix from a successful retry. Exact metadata and bounded job-log
excerpts are retained alongside this report.

The GitHub artifact API returned **zero artifacts for all three runs**. Uploads
used `if: failure()`, so a successful retry suppressed collection. In Chromium,
the later serial offline command also reused the default output directory,
which Playwright cleans at the start of a run. That could erase earlier traces
even if the later step failed. These are confirmed diagnostic defects.

## Change

`tools/run-browser-ci.sh` executes the same native Playwright command with a
distinct output directory, JSON report, `pw:browser` stderr log, and resource
snapshots for each step. It returns the original Playwright exit code. The
report includes failed attempts even when a retry passes. Native launch/exit
logs help diagnose failures before context creation, when a page trace may not
exist. Regular and serial offline steps cannot overwrite each other's evidence.

All browser jobs and the isolated performance job upload those diagnostics on
success or failure, unless cancelled, with seven-day retention. Reports are
machine-readable; passing retries remain flaky. No assertion, retry count,
deadline, worker count, project filter, shard, engine, permission or publication
gate is relaxed. Existing failure screenshots and retained traces remain enabled.

`tools/browser-diagnostics.cjs` samples memory/pressure, cgroup counters and
process names before/after a test command. It records bounded kernel OOM/fault
messages where readable. It does not collect environments or process command
lines. Missing/denied counters are explicitly recorded. Cgroup-root counters
may describe a wider runner scope than an individual browser; they cannot
attribute memory to that process. Snapshots run outside the performance test,
with no polling process beside the FPS measurements. Browser debug logging is
enabled during the command; no zero-overhead claim is made.

## Repeatable verification

From the repository root:

```sh
CHROMIUM_PATH=/usr/bin/chromium node test/ci-diagnostics.cjs
node docs/verification/2026-10-28-ci-browser-audit/inventory.cjs
python3 docs/verification/2026-10-28-ci-browser-audit/workflow.py
```

The diagnostic control uses a separate temporary spec/config and the real
browser, wrapper and reporters. An intentional first-attempt failure must pass
on retry, retain both attempts and its failed trace, and survive a later test
command. An intentional hard failure must still exit1. Native launch/exit logs,
resource snapshots and invalid-label rejection are checked. These deliberate
failures are control fixtures, not game-suite failures. The control requires an
installed Chromium; `CHROMIUM_PATH` selects the system browser locally.

Discovery is identical before/after: **622 phone +337 small =959 Chromium**,
**207 WebKit**, and the one isolated performance case. The workflow comparison
(requires PyYAML) checks exact selection commands, matrices, sparse checkout,
runner labels and unchanged rules/publication jobs. `inventory.json` and
`workflow.json` retain the results.

Local repository/release and affected native browser results are recorded in
`validation.json` when complete. Final pushed CI status and artifact availability
are checked separately before reporting publication. A passing fresh run is
not proof that intermittent native faults or the WebKit status timeout are
eliminated. Inspect the next retained failed attempt before changing engine
versions, game startup or offline readiness.
