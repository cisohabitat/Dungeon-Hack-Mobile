# Restore the supported CI runner

The [first lantern release run](https://github.com/cisohabitat/Dungeon-Hack-Mobile/actions/runs/40617987363)
on `13fb5259d55f58129e771615b7de586c8d9dbd38` failed all nine browser/performance
jobs while installing browsers. No browser test or FPS measurement began.
`ubuntu-latest` supplied Ubuntu 26.04, which the pinned Playwright 1.59.1 rejects:

```text
Cannot install dependencies for ubuntu26.04-x64 with Playwright 1.59.1!
Error: ERROR: Playwright does not support chromium on ubuntu26.04-x64
Error: ERROR: Playwright does not support webkit on ubuntu26.04-x64
```

The install helper retried the same unsupported command three times and failed
as intended. This is an OS support mismatch, not a transient mirror failure or
a failed game test. The run remains as failure evidence; it is not rerun or
presented as a successful browser verification.
The original rules job passed all 751 checks; the publisher correctly skipped
because the browser/performance gates failed.

All six job definitions now use explicit `ubuntu-24.04`, the supported image
used before the alias rollover. YAML comparison permits only these six
`runs-on` changes; matrices, shared sparse checkout, commands, engine version,
assertions, deadlines, retries, permissions and publisher needs are identical.
The eight browser shards, isolated performance job, rules and publisher remain.

The game stays v0.9.51/build66/cache126. No player or painting bytes change in
this follow-up. The completed local lantern evidence remains in the
[art review](../../visual/2026-10-28-amber-lantern/README.md): 949 Chromium cases,
751 rules and the isolated six-scene frame budget passed before publication.
This CI/documentation-only follow-up requires repository checks and fresh
committed release/footer/offline checks locally; all engine and performance
checks must pass in the new CI run before release publication is verified.

The [structural comparison](workflow-comparison.json) and
[failure excerpts](failure-summary.json) record the cause and bounded change.
Required new CI/publisher statuses on the follow-up commit are authoritative.

Local `npm test` passed, including 751 rules in 74 files (rule phase 1m23s),
release fixtures, types, art inventory and worker/security checks. Release
preparation correctly leaves version/build/cache unchanged. No `js/`, `img/`,
CSS, main HTML or release/cache metadata differs from the tested art commit.
