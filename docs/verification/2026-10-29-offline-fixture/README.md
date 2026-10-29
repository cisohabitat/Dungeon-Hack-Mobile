# Offline fixture isolation, 29 October 2026

The keeper-identity commit `f46811b1a0a25086a8cf158b8a8d792e8e083250`
prepared v0.9.58 but failed required CI run40884371292. Phone shard2/3 failed
installed painted-creature readiness on both attempts; publication was skipped.
v0.9.58 remains untagged. This recovery prepares v0.9.59 without changing the
game implementation or paintings.

## Finding and scope

The failed readiness assertion retained its10s deadline. The first post-failure
DOM snapshots showed core readiness20–30ms later; they do not establish the
first instant it became ready. Both attempts had matching page/worker builds,
all mandatory requests and no page errors. See the retained report inventory
and timing summary. Native Chromium crashes and the separate Safari gate-opening
flaky case are not explained or fixed by this change.

The old fixture handled1854 mandatory responses (50,297,758 bytes at v0.9.58)
in the same Node process that recorded Playwright traces. `test/offline-server.cjs`
forks a dedicated HTTP origin and prepares exact responses through the unchanged
`test/server.js::serve` before navigation. A new child and cold browser cache are
used for each test. All original URLs still travel over actual HTTP into native
service-worker CacheStorage. Headers, stamped HTML, bytes, voice hold/resume,
range requests and actual-origin socket disconnection are retained. No fake ready
flag, cache injection, smaller asset list or relaxed deadline is used.

Unit checks cover exact bytes/headers, all declared assets, separate PID, HEAD,
range, path/method restrictions, voice hold/resume, actual disconnect/reconnect,
cleanup and deliberate503 responses. The six original offline tests passed
serially on both Chromium phone projects with zero retries. An intentional503
for mandatory equipment art fails the original readiness assertion at10s,
exit1, as recorded in `negative.log.gz`; that is an expected negative control.

## Rejected diagnostics

Service-worker cache batches8/24/64 were slower than the original full addAll
on the ordinary local probe (7312/6920/6616 vs6195ms); no production changes
were adopted. Separate filesystem serving improved some local measurements.
Artificial two-CPU contention exceeded10s for every prototype, including the
prepared origin. Secondary late observations were explicitly diagnostic and
are not passing results. Native traces remain outside the repository under
`/workspace/offline-recovery/`; supplied scripts retain their original absolute
paths and are historical reproduction inputs, not portable test commands.

## Validation and release gates

Run `node test/offline-server.test.cjs`, `npm test`, `npm run test:release`,
`release.spec.js` on both Chromium projects, and the original six offline checks
serially with zero retries. Required CI still runs all ten groups and gates
publication; successful retries remain flaky and must be disclosed.

The keeper source and approved images byte-match f46811b. That exact player
implementation already passed991 local Chromium cases and the isolated original
seven-scene performance budget. This fixture-only recovery reuses those player
checks and runs fresh metadata/offline checks. It does not certify physical
devices, listening quality, balance or the remaining Double-text combat crowding.

The final alternating native Pixel5 comparison with full tracing measured
original6107/7105/7098ms and actual helper5102/7211/5142ms; all six met the
unchanged10s assertion. These variable observations support process isolation,
not a universal speedup. See `final-probe-results.json`.
