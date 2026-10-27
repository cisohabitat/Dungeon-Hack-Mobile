# Installed-game and slow-loading art audit

Completed 27 October 2026. No confirmed runtime/art defect was found. This is a
review-only change: the shipped v0.9.45 game and images remain unchanged.

## Real installed-release updates

Eight fresh Chromium profiles cover320×667 and390×844, successful updates and
interrupted/retried updates, from each of these historical releases:

| Historical install | Exact commit | Cache | Updated install |
| --- | --- | --- | --- |
|v0.9.43|17a2331fd2a98bcea8d3d7bf4b7841d374dc46d9|deepdelve-v118|v0.9.45 / deepdelve-v120|
|v0.9.44|22d88b1fd5df6ed75723a46e5e4ea658dbf883e7|deepdelve-v119|v0.9.45 / deepdelve-v120|

`upgrade.cjs` serves full historical and current checkouts on one origin and
updates the real service worker at the same URL. No worker proxy, fabricated
cache or route substitution is used. The interrupted case returns503 for one
new-install core painting. The previous worker/cache remains usable for a real
offline reload and Continue; restoring the asset allows the update to retry.

Every scenario verified the saved hero's name, class, seed, depth and equipped
weapon after update/offline Continue. Setup supplies Heartroot and removes
starting enemies; this is not unassisted gameplay or a full save-field comparison.
Each waits for current core/voice readiness, confirms the old game cache is
retired, and checks an unrelated cache sentinel remains untouched.

Six representative world/dais, fallen-portrait, held-staff, regional-floor and
relic images were fetched and decoded offline in every profile. Their SHA-256
hashes match current files:48 successful current-image checks. Critically, the
v0.9.43 cases also compare historical cached bytes: both old Heart paintings
change to the exact new core/dais bytes, in all 4 scenarios. The v0.9.44 upgrade
uses the same paintings as today and alone would not establish changed-art
replacement. [v43 evidence](upgrade-evidence-v43.json) ·
[v44 evidence](upgrade-evidence-v44.json).

The origin is cut and Chromium offline emulation enabled for offline reloads.
A zero origin-rejection count means emulation stopped the request first, not
that the origin stayed enabled. No page errors were recorded. Twelve native
screenshots show the saved hero running offline, including the preserved old
install after failed updates; they are not visual proof of every cached image.
Examples: [failed v43 update](v43-320-interrupted-old-install.png),
[retried v43 offline](v43-390-retried-offline.png),
[retried v44 offline](390-retried-offline.png).

## Independent installation and failure checks

All 36 focused browser cases passed on phone/small projects:

- 12 serial full-cache cases (4.1m): core play while voices are blocked, resumable
 voice download/ranges, creature offline reload, all 1,550 painted-catalog files
 decoded after a native offline reload, living/fallen portraits, release/commit
 identity and native ending-card export.
- 20 fallback/cache cases (1.0m): late floor replacement invalidates the rendered
 cache without changing the supplied level; failed/stalled portraits stay usable;
 creature fallback poses survive corrupt/delayed art; held/carried/region failures
 stay independent; Heart fallbacks preserve the core identity.
- 4 sharing cases (20.5s): corrupt/stalled killer art keeps export usable and
 independent, including late replacement after a stalled request.

The node offline lifecycle harness also passed: early activation, resumed voice
work, cache isolation, failed-core preservation and byte ranges. Full-cache tests
ran alone on one worker, before fallback tests. No existing deadline, assertion
or coverage was weakened. [Validation](validation.json).

## Reproduction and limits

Create the historical checkout outside the main repository, then run the tool:

```sh
git worktree add --detach ../offline-art-baseline 17a2331fd2a98bcea8d3d7bf4b7841d374dc46d9
node docs/visual/2026-10-26-installed-art-audit/upgrade.cjs
git worktree remove ../offline-art-baseline
```

For v0.9.44, create that commit's checkout instead and set
`OFFLINE_BASELINE_CACHE=deepdelve-v119`,
`OFFLINE_BASELINE_COMMIT=22d88b1fd5df6ed75723a46e5e4ea658dbf883e7` and
`AUDIT_LABEL=v44`. `OFFLINE_BASELINE_ROOT` optionally selects its absolute path.
Project Playwright and system `/usr/bin/chromium` are required. Finish these
profiles before running the repository browser checks to avoid CPU contention.

These are local-origin Chromium checks, not a physical installed iOS/Safari
exercise, production TLS/CDN test, storage-quota/eviction test or OS-kill recovery
test. The 1,550-file catalog is distinct from individual paintings packed into
atlases; portrait/relic surfaces have separate offline checks. No balance or
performance rerun is needed because this audit changes no shipped game/art bytes.
