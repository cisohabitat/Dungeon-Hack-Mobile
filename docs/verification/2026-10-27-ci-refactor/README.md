# CI refactor

Baseline: `62be4c80a760feed1a1837308ab43610fded9348`, game v0.9.50.
These phases change test execution, not game behavior or art. Keep the same
assertions, installation deadlines, performance thresholds and publication
dependencies. Verify and publish each phase separately; the next publication
waits for the preceding phase to pass even if independent preparation overlaps.

1. [Settled accessibility audits](phase1/README.md): share actual finite-panel
   readiness, remove the guide contrast race and prove genuine contrast faults
   still fail. No animation suppression or retry increase.
2. [Refactor CI execution](phase2/README.md): reduce browser checkout payload while preserving every
   runtime/test dependency and required release history; balance browser
   workloads, especially WebKit. Compare exact file/test inventories before and
   after, keeping every case once, one worker per WebKit runner and the native
   performance budget isolated. Measure checkout and execution independently.

The baseline CI run is [40542440308](https://github.com/cisohabitat/Dungeon-Hack-Mobile/actions/runs/40542440308).
Its Chromium shard test steps took10.4–17.7minutes, the small-phone regular step
23.2minutes and WebKit41.8minutes. One existing guide contrast case auto-retried.
Five browser checkout-to-Node-setup intervals ranged from90.2s to1172.0s,
measured from timestamped completed job logs, not an inferred download size.
Checkout timing, test timing and machine variation must remain separate.
