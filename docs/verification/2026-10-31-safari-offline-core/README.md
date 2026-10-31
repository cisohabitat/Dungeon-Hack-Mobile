# Installed core and Safari offline reopening

The v0.9.71 main deployment is live, but [run41195332729](https://github.com/cisohabitat/Dungeon-Hack-Mobile/actions/runs/41195332729)
failed the Safari core offline case on both configured attempts. The native
reload returned HTML, then WebKit reported internal resource errors for
`main.js`, `style.css` and `manifest.json`; offline status stayed empty. All
nine other completed test jobs passed and publication was skipped. The two
original traces, their hashes, console events and full artifact inventory are
retained here. The same bootstrap symptom occurred before this art phase;
its engine root cause is not claimed proven.

The worker previously probed the network for every installed core response and
launched replacement cache writes without extending its event lifetime. It now
reads installed core files from its current version cache first, including the
root/index/query shell aliases. A newer worker installs the next complete
snapshot. Optional resources retain network-first streaming, and `waitUntil`
covers their good-response cache writes. Unavailable CacheStorage retains
online delivery. Existing API/cross-origin/master/listen exclusions, current-only
core fallback, voice resumption, old voice range fallback and cleanup remain.

Node regressions exercise core requests with the network unavailable, cached
root aliases, missing-current-core rejection, denied storage and a delayed
cache write that must outlive delivery of its streaming response. The new
`core play is ready offline across repeated native root aliases` case checks
exact module/CSS/manifest hashes, proves installed core reads avoid the
connected origin, then cuts the real origin and performs six native
navigations/reloads across root/index/query aliases with usable creation UI.
It retains the standard deadline and empty-error guard. Its existing core-play
title group runs serially in Chromium CI; WebKit retains one worker. No
existing assertion, retry, timeout, offline cutoff or navigation is weakened.

Fresh complete Chromium, original isolated FPS, same-origin worker upgrade
and native WebKit CI results are recorded in `validation.json`. The previous
CI failure is not retried unchanged. Human listening review stays skipped.
AAA3 room staging follows this verified recovery; physical-device confidence
and the rest of the AAA roadmap remain separate.

The full local run encountered ENOSPC while saving two phone-case screenshots
and attachments. Their original errors are retained in
`local-artifact-failures.json`. Four inactive Playwright staging directories
were archived and byte-compared before removal; saved traces, reports and
screenshots remained in place (`storage-cleanup.json`). Only the two affected
cases are rechecked on the same frozen source after the complete run. The
original run is not reported as a zero-failure run.
