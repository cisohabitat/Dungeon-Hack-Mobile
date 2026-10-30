# CI reliability follow-up — 30 October 2026

Baseline: `0f79e40e3a5687da46b0696a05de8df847535841`, v0.9.63.
This is a test-fixture/documentation phase. No game source, painting, worker,
version, dependency, assertion, deadline, retry count or test coverage changes.

## Retained failures

[Run41008983144](https://github.com/cisohabitat/Dungeon-Hack-Mobile/actions/runs/41008983144)
passed all11 jobs, but two cases required their configured automatic retry.

- Small-phone finished-run replay: Chromium headless shell1217 received
  `SIGSEGV / SEGV_MAPERR 0x1b0` in `browser.newContext`. No application actions
  preceded this failure. This repeats the earlier native context-crash signature;
  it does not establish a replay bug or OOM. No speculative launch flags,
  engine upgrade, extra retries or application workaround are introduced.
  The trace hash and bounded native stack excerpt are in
  [chromium-failure.json](chromium-failure.json).
- Safari ordinary shield offline reload: root navigation completed, then WebKit
  reported internal resource errors for `/js/main.js`, `/css/style.css` and
  `/manifest.json`. `Assets` never became available before the original60s
  total budget expired. The width125/256 mismatch earlier in the trace was an
  intermediate poll; it was not the terminal failure. The compact retained
  console evidence and failed-trace hash are in [safari-failure.json](safari-failure.json).
  Engine/root cause remains unproven. A successful retry is still flaky.

## Bounded change

The shield test served its cold full-cache origin in the same Node process
recording Playwright's trace. It now uses the existing `startOfflineServer`
child, which prepares exact responses through the normal server before browser
navigation. The browser still installs every core asset over real HTTP into a
fresh origin/cache; only static-origin serving is separated from tracing.

Named Playwright steps and a `shield-offline-stages` JSON attachment record the
browser version, reached bootstrap stage, timestamps, failed request paths and
origin counters on every attempt. Cleanup covers context-creation failure too.
These records distinguish a native navigation error from module bootstrap or
art decode failures without suppressing console errors or retrying navigation.

All three legal shield pairs, forbidden-pair guards, exact256px loaded images,
actual origin disconnection, native reload and empty-error assertion remain.
Chromium also retains browser offline mode; WebKit retains actual-origin cutoff.
The original60s total and10s assertion budgets remain. Chromium CI moves this
full-cache test to the existing serial offline step, using complementary grep
filters and the same shard so every case still runs exactly once. WebKit was
already on one worker and keeps its existing selection. Existing CI retains all
attempts and its unchanged automatic retry. No native engine fault is claimed
fixed by isolating a fixture; future failed attempts must still be inspected.

## Validation

Run `python3 docs/verification/2026-10-30-ci-reliability/coverage.py` to compare
the actual before/after CI shard commands. [coverage.json](coverage.json)
confirms647 phone and362 small cases, zero duplicates or omissions, unchanged
Playwright policies and byte-identical WebKit/performance commands.

Local affected checks and required repository checks are recorded in
`validation.json`. Full fresh CI, including WebKit and isolated performance,
remains required before reporting this phase as verified. Linux engine checks
are separate from real iPhone/Android results. AAA5 physical-device confidence
and independent regrade remain open; human listening review stays skipped at
the owner's request.
