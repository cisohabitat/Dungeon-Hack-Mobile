# Phase 2 — CI checkout and workload layout

Baseline: phase1 commit `1c6fb9431012f002469b375b7678a05b773e236f`.
No game files, test assertions, retry settings, installation deadlines or FPS
thresholds change. Game v0.9.50/build65/cache125 remain unchanged; no balance
simulation is required for workflow/documentation changes.

## Runtime checkout

The browser, small-phone, WebKit and performance jobs share a YAML checkout
anchor. Non-cone sparse patterns keep runtime/test inputs, tooling, root files
and top-level creature JSON metadata while omitting raw art, review documents
and audio masters. In particular, named-equipment.cjs must retain
`art/creatures/generation-batch-ab-named.json`. The selected metadata includes
all48 top-level creature JSON files. Credentials remain unpersisted.

Checkout v4 selects `blob:none` when sparse-checkout is provided (see its
[fetch implementation](https://github.com/actions/checkout/blob/v4/src/git-source-provider.ts)).
Rules and publication retain their original full-history checkouts: release
validation must be able to read historical metadata without a later lazy fetch
after credentials have been removed. Source/provenance checks remain complete.

The real local sparse worktree initially selected2,795 tracked files/about104MiB;
raw art, review documents and masters account for roughly3.9GiB in the baseline.
These are working-tree file sizes, not compressed network download measurements.
Final exact sizes, hashes and all service-worker URLs are recorded in sparse.json.

## Native shards and gates

Phone stays at three Chromium shards/two workers each. The small-phone suite
uses two shards/two workers each, with the original serial offline step and
matching shard selector. WebKit uses three shards, one worker per runner through
the existing npm script. The performance budget remains alone on one worker,
with its unchanged4×CPU throttle and thresholds. Every matrix has fail-fast
disabled. Failure artifact names include their shard to avoid upload collisions.

There are ten required test jobs: rules +3phone +2small +3WebKit +1performance.
The publisher still depends on all five matrix/job groups and retains its
exclusive contents-write permission. Native Playwright sharding replaces no
case or assertion. This is count-based sharding; actual job times and machine
variation are measured separately, without a universal speedup guarantee.

## Exact inventory and sparse verification

The review tools require Python3 with PyYAML6 (used locally:6.0.3), plus the
repository's Node/Playwright install and the phase1 baseline commit available
locally. They are review tools, not new CI runtime
dependencies. No local WebKit installation is needed for `--list`.

```sh
python3 docs/verification/2026-10-27-ci-refactor/phase2/inventory.py --output=/tmp/ci-full.json
python3 docs/verification/2026-10-27-ci-refactor/phase2/inventory.py --root=/path/to/sparse-worktree --output=/tmp/ci-sparse-inventory.json
python3 docs/verification/2026-10-27-ci-refactor/phase2/sparse.py --sparse=/path/to/sparse-worktree --output=/tmp/ci-sparse-bytes.json
```

inventory.py expands the actual old/new workflow YAML, aliases, matrix values
and npm command. It uses the pinned Playwright's real discovery output and
checks exact project/file/line/suite/title identities against each complete
project. It also checks workers, filters, offline separation and release gates.
Both full and sparse checkouts discover615phone,330small,200WebKit and1perf
cases with zero omissions/duplicates. Discovery is not browser execution;
required CI verifies all actual jobs before completion.

sparse.py compares all selected tracked bytes, verifies required runtime/test
paths, checks the actual checkout patterns and resolves every native precache
URL. It does not execute the service worker or substitute any image/game code.
Fresh sparse-worktree browser smoke, repository checks, exact-commit release
checks/hook, all required CI jobs/publisher and public delivery remain gates.

Local sparse-tree smoke passed three cases in45.7s: the accessibility readiness
contrast control, every named-equipment state through its exact runtime route,
and all activated-art decoding after a native offline reload. The sparse byte
review covers all1,851 service-worker asset URLs and2,745 runtime/test paths,
with no byte differences among the2,795 selected tracked files.

`npm test` passed, including all751rule checks in1m24s and the complete
release/security/type/generator/offline checks. At local commit creation,
fresh committed release specs, the exact-commit hook, all ten CI jobs/publisher
and public delivery remain publication gates. Phase2 publication waits for
phase1 CI to complete successfully.
