# Subtle painted lamp oil — AL follow-up

Implemented for v0.9.68/build83 from baseline
`3bddf025f2641ecb5a9758ef789f2584cfbc569d`. The wet-surface audit selected
ice first and oil second. Water keeps its thirteen regional paintings and
native puddle glints/flooded shimmer. AM spell contacts remain the next audit.

## Source and fit

One flat image-tool oil film adds restrained dark umber marbling. The initial
source looked like raised muddy grit and is retained as rejected provenance.
The selected repair removes that grain and leaves a quiet continuous film;
no reflection, light, glow or glint is baked into it. Source prompts, source
hashes and limits are in `art/creatures/generation-batch-al-oil.json`.

```sh
python3 art/creatures/export-batch-al-oil.py --check
python3 tools/export-painted-runtime.py --check
```

Registration crops the explicit1254px square to alpha>=8 bounds with2px
fringe, uniformly fits112px and centres the result in128px. It does not paint,
recolour or repair alpha. The source, registered export and identical runtime
PNG were visually reviewed. The common delivery now has1,556 files; the new
runtime URL is `img/decals/oil.png`, included in the reviewed inventory and
offline worker. The existing independent lazy loader prepares its mask and
eight cached shades once (512KiB of shade canvases before image/browser overhead).

## Native rendering and actions

Only the actual oil base has the private `material: oil` marker. Unmarked
brown stains and the native pale `#8e6e2c` sheen retain their original paths.
Its constant35% opacity is prepared once in cached canvases (8-bit alpha
rounding, peak about89/255); readable marks use globalAlpha1. The existing
12-to16 projected-pixel detail fade still applies.
The native base ellipse, four satellites, separate later sheen, fog, lighting,
field boundaries and landing suppression remain. The marker is reset when a
kept field changes type; no gameplay/saved-state field or rule changes.

[Gallery](preview.html) compares the previous native rendering and the new
material at320/390px in Normal/Calm, with an approach and actual throw,
ignition and ash. Reproduce from the repository root:

```sh
node docs/visual/2026-10-31-painted-oil/capture.cjs
```

`before/` was captured against the unchanged v0.9.67 baseline before code
integration. `native/` records v0.9.68. Each contains12 screenshots/records,
with exact source hashes guarded from launch to completion. Do not rerun the
before mode against a newer runtime and relabel that result as the baseline.

The shipped Game/Renderer/Assets and updates run normally. Comparison fixtures
supply oil, cleared dressing/monsters and safety HP. Actual action fixtures
supply a Flask of Lamp Oil and Fire scroll, consume both through the real item
API and use native movement. The flask's actual landing is awaited; its real
oil is ignited against a supplied passive999HP Orc, then the foe is cleared
for visibility. The original fire duration expires into ash. No clock, image,
renderer or update is replaced. Forwarding draw observers record alternating
material/sheens in comparison views, preserving the separate later highlight.
This is bounded action evidence, not unassisted play, balance or physical-device
approval.

## Verification and publication

All14 focused cases passed across both Chromium widths (54.9s, no retries).
They retain exact changed-pixel containment, unchanged state/dice, Normal/Calm,
corrupt-image independence and zero per-frame canvas preparation. Oil is now
explicitly checked alongside ice for replacement and delayed landing; the
native sheen still draws once after oil and not for airborne fields. Unmarked
oil, standalone sheen, water, wraith frost and warnings keep exact native pixels.
The existing warmed/fresh/context-path cache comparisons remain intact.

The installed full-art reload explicitly decodes all four material families.
The nine speed scenes, sixty mixed wet marks, thresholds and zero-retry speed
policy remain. Only the existing oil marks gain the actual oil material tag
so the same wet scene now measures this texture as well. No scene, stain,
glint or budget was removed to add art. Fresh full browser CI and all nine
speed scenes must pass before release publication. `validation.json` records
local evidence and any failed attempts separately from CI clearance.


The first local9-scene run passed the eight older scenes but missed wet marks
at28.1FPS (30 required), startup2244ms. Its unmodified log and trace remain
in `/workspace/painted-oil-perf.log` and `/workspace/painted-oil-perf-results/`.
The oil opacity is now prepared once with its mask/shades, allowing readable
marks to use the direct-alpha image path. Both phone sizes passed all14 focused
cases again (55.4s). Explicit peak-alpha and draw-alpha checks guard against
omitted or doubled opacity. A new gate measures this actual implementation
change; no unchanged green rerun or relaxed budget is used. Original initial
native images are retained outside the repo at `/workspace/painted-oil-initial-native/`;
final captures must match the new frozen runtime source hashes.


The explicit alpha/containment checks passed at both widths (11.9s). The next
local9-scene run still missed wet marks at27.6FPS (30 required), while all
older scenes passed and startup was1958ms. Its log/trace remain in
`/workspace/painted-oil-cached-alpha-perf*`. Between-run variation is not a
causal speedup claim. No unchanged rerun, removed work or relaxed gate is used;
all9 scenes must clear fresh CI before release verification.
