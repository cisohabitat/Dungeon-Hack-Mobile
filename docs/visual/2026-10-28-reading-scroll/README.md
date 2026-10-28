# Batch AJ: open reading parchment

The blank, worn vellum replaces the procedural page and rolled ends during a
read. Existing class hands, five writing lines, spell colours, burn rectangle,
embers, flourishes and release timings are unchanged. READ_MS remains1,000ms.
The Pack's closed scroll keeps its existing painting; its fixed writing and wax
seal cannot represent the open blank surface required here.

`art/creatures/generation-batch-aj.json` records both exact image-tool prompts,
source hashes and selection. The first wide source is retained as rejected
provenance: its short panel did not fit the original five lines. The selected
taller panel leaves room for those lines without changing their coordinates.
`export-batch-aj.py` crops the whole alpha>=8 bounds with a four-source-pixel
fringe, uniformly scales and registers the source. It performs no painting,
recolouring, masking or nonuniform distortion. Source and256px shipped output
were visually inspected before recording review hashes.

The common exporter adds `PAINTED.overlays.reading_scroll`, with its anchor,
panel landmarks and physical scale. All1,551 previous delivery rows and bytes
remain identical; total common delivery is1,552 files. The independent image
cache starts on actual reading demand and rasterises once. `spellfx.js` uses
the painting inside the original burn clip; loading/failure keeps the complete
old page and both rolls, with the same writing/fire on top. No new saved state,
rules, identification policy, costs, seeded dice or light source was added.

```sh
python3 art/creatures/export-batch-aj.py --check
python3 tools/export-painted-runtime.py --check
node docs/visual/2026-10-28-reading-scroll/capture.cjs
SCROLL_OFFLINE=1 SCROLL_OUTPUT=docs/visual/2026-10-28-reading-scroll/offline node docs/visual/2026-10-28-reading-scroll/capture.cjs
```

`before/` and `native/` each contain84 canvas frames: seven actual consumable
actions, normal/Calm at320/390/740px, sampled during writing and burning.
The harness supplies inventory, cleared enemies and safety; unknown status is
reset before each read so empty-floor/repeated scrolls remain legitimate native
uses. Actual `Game.useItem`, game updates and renderer run without substitutions
or clock changes. The initial baseline draft reused a known Fire scroll on an
empty floor and correctly refused it; the harness was corrected to supply an
unknown scroll on every iteration. This was a review-fixture issue.

`offline/` uses fresh worker installations on three isolated origins, cuts the
origin's sockets, switches Chromium offline, reloads, Continues and repeats the
actual reads. This is installed reload evidence, not an upgrade or physical
Safari check. The before/online captures preceded release preparation; offline
captures use the prepared version/cache. Their evidence JSON records scope.

`reading-scroll.spec.js` compares all non-body draw commands between loading
fallback and ready painting across seven spell colours and nine phases. It
also checks126 renderer placements across seven classes, three view heights,
normal/Calm and three phases, with unchanged run/dice. Corrupt loading must keep
the complete page and both rolls while the independent lantern remains painted.
These synchronous controls are distinct from the running native captures.
The all-export installation regression now requests/decodes both overlays after
offline reload. The existing FPS budget retains every scene, threshold and
deadline and adds repeated native reads on the same dark painted crowd.

All six final focused checks passed (1.1m), including both sizes' all-export
offline decoding and ready native overlay loaders. No retries/skips/failures.

The isolated local FPS run failed the added reading scene:27.4 FPS at4x CPU,
against the unchanged30 FPS threshold. Fight35, wide38.4, flooded36,
painted30.8, amber31.8, rite47.9; startup1915ms. A following procedural-scroll
control also failed: reading24.4 and painted29.7 FPS; other scenes32.8/36.3/
33.6/30.5/46.4, startup1967ms. Both logs and the exact temporary control test
are retained here. The control forces the native corrupt-image fallback and
waits for failure instead of readiness; its original module-path setup error
was corrected before any test ran. Its absolute imports record the local
as-run diagnostic, not a portable production test command.

These sequential samples do not establish a painting regression or a reliable
speedup. The local reading budget failure remains explicit; no threshold,
deadline, retry or scene is removed. Required CI performance is an additional
publication gate on its separate runner.

`npm test` passed all repository checks, including751 rules in74 files
(rule phase1m17s). Both full Chromium projects passed:947 ordinary cases
(three workers,59.5m) plus six serial installation cases (one worker,2.6m),
953 distinct cases total, with zero skipped, unexpected or flaky results.
The exact stats are in `validation.json`; raw full JSON/logs remain outside
Git under `/workspace/scroll-full-{ordinary,offline}.{json,log}`. All native
captures preceded the full run. Committed release-stamp checks and the required
CI/publisher gates follow; successful statuses on the final commit are
authoritative. This report retains the local FPS failure alongside those gates.
