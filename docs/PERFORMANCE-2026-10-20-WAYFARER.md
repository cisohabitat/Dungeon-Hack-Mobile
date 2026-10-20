# Wayfarer local performance checks

The unchanged absolute performance gate failed locally for both the new feature
and the current production revision. The feature has not received performance
clearance from these measurements. No assertion, deadline or throttle was changed.

## Method

One isolated Chromium worker, system `/usr/bin/chromium`, existing 4× DevTools
CPU throttle and existing fixtures. Neither the balance bench nor another
browser suite ran alongside these measurements. Working revision:
`0aa55321a68c8a584b93f15ee5178908b7062198`. Baseline: production
`41bf3aaf4568e4ccbbb2b5df104b767f1ff043b4`, in a separate worktree/server.

Command: `PERF=1 npx playwright test --project=perf --workers=1`; local config
adapters select system Chromium and distinct output directories/servers.
Required: fight, flooded and rite at least 30 fps, wide at least 27 fps,
and startup no more than 6,000 ms.

| Revision | Fight fps | Wide fps | Flooded fps | Rite fps | Startup ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Wayfarer | 2.0 | 4.4 | 4.4 | 3.4 | 62,680 |
| Existing production | 18.4 | 19.5 | 19.7 | 37.7 | 2,988 |

The first measurement was markedly worse, including startup. The baseline
also fails three scene budgets. These two samples do not identify the cause
or rule out a feature regression; do not substitute their relative scores
for the absolute gate. Stable-runner CI clearance remains required before
publication. Physical Android and iPhone Safari validation is also pending.
