# Batch AI: ordinary amber lantern

The native amber lantern was a flat block outline beside the painted hands and
shield ([before](before/390-free-calm.png)). A compact weathered iron cage and
handle now surround the existing animated glass/flame
([native](native/390-free-calm.png)). The first generated cage was too tall;
the selected image-tool repair shortens it. Both sources, exact prompts and
selection reasons are preserved in
[generation-batch-ai.json](../../../art/creatures/generation-batch-ai.json).

The exporter crops the complete alpha>=8 bounds with four source pixels of
fringe, uniformly resizes and translates into 256px. It does not mask, recolor
or paint pixels. The measured transparent windows clip the original glass;
the original flame stays centered at the same position. Flame flicker, light
radius/color, sway clocks, wrist placement and Calm remain native. The old
complete cage remains the independent loading/failure fallback. The blue
Spellblade lantern has its own existing binding and excludes this overlay.

`paintedLantern` uses the existing per-image cache, with no per-frame raster
preparation. The common catalog adds an `overlays` section for its path,
anchor, window and physical scale. Offline catalog enumeration includes it.
Common delivery has 1,551 files; all 1,550 previous runtime files retain their
hashes. Full source/registration/runtime hashes are in the existing review
inventory and runtime-delivery manifest.

## Native review and limits

`capture.cjs` records 18 before and 18 current online scenes: free hand, shield
and two-handed greatsword, normal/Calm, at 320/390/740px. It supplies the existing
dark twist, equipment, cleared monsters and safety, then runs native keyboard
walking/turns and screenshots without replacing Assets, Renderer, Game.update
or dice. Offline mode adds 18 scenes after three fresh worker installations,
actual-origin disconnection, reload and Continue. These are supplied scenes,
not unassisted runs, balance simulations, upgrade evidence or physical Safari.
Manifests are under `before/`, `native/` and `offline/`.

```sh
python3 art/creatures/export-batch-ai.py --check
python3 tools/export-painted-runtime.py --check
node docs/visual/2026-10-28-amber-lantern/capture.cjs
LANTERN_OFFLINE=1 LANTERN_OUTPUT=docs/visual/2026-10-28-amber-lantern/offline node docs/visual/2026-10-28-amber-lantern/capture.cjs
```

The browser regressions add delayed-image upgrade, demand-only request/cached
identity, transparent-window checks, 36 synchronous fitting draws per project,
Calm stability, exact blue-lantern exclusion, unchanged run/dice and independent
corrupt-image fallback. Fitting uses controlled render states and is separate
from native movement. Existing all-art offline decode includes the new overlay
and verifies its native loader after reload.

This is presentation-only: no targeting, fog, world light, hit timing, class,
inventory, saving or seeded rules change; no balance simulation is required.
All six focused Chromium checks passed first try (one worker, 1.0m), including
both all-export native offline reloads on the prepared release. The 18 offline
movement scenes were captured before version metadata preparation; their
painted asset bytes match the prepared candidate, while the subsequent browser
offline tests verify the final cache/build and loader.

The isolated unchanged-threshold 4× CPU budget passed (1.0m): fight 37.8,
wide 43.0, flooded 33.6, painted crowd 38.2, amber/dark crowd 34.0 and rite 49.5 FPS;
startup 2190ms. The amber sample adds the actual new overlay to the same painted
crowd; all previous scenes remain. Thresholds stay 30 FPS (wide 27) and 6000ms
startup. These are observations on this runner, not universal speed claims.

`npm test` passed, including all 751 rule checks in 74 files (rule phase 1m14s),
art inventory/offline entries, agent guidance, release fixtures, types,
generation, security, narration and worker lifecycle.

Both complete Chromium projects passed without retries: 943 ordinary cases
(two workers, 1h00m45s) and six serial full-cache installation cases (2m36s),
949 distinct cases total. Both all-export decode checks include the new overlay
and its native loader after offline reload. No case was skipped or flaky.
[Validation data and source hashes](validation.json),
[focused browser output](focused-browser.log), [performance output](performance.log)
and [repository checks](repository-checks.log) retain the local evidence.

Prepared for v0.9.51/build66/cache126. Fresh committed release-identity checks,
the exact-commit pre-push hook, required CI and the release publisher remain
gates at report creation; their successful statuses on the publication commit
are authoritative. No existing painting was replaced or source hash changed.

The first remote run failed browser installation before any browser assertions
or FPS measurement: `ubuntu-latest` supplied Ubuntu 26.04, unsupported by the
pinned Playwright 1.59.1. The
[CI-only follow-up](../../verification/2026-10-28-ci-runner-pin/README.md)
pins supported Ubuntu 24.04 and retains every suite/threshold. Player and art
bytes, game version/build/cache and the successful local evidence are unchanged.
