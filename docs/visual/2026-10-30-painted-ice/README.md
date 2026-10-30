# Painted ice fields — AL

Implemented for v0.9.66/build81 from the
[wet-surface audit](../2026-10-30-wet-surfaces/README.md), baseline
`5b195ac3af87303d5fa7faf5bfd45510cec220e2`. Oil remains a secondary candidate;
water retains its existing regional paintings, live glints and flooded shimmer.

## Painting and integration

One image-tool source adds muted blue-grey fracture lines and fine frost to
the ice field. Source, exact prompt and registration are recorded in
`art/creatures/generation-batch-al.json`. The source is1254px square; the
exporter crops alpha>=8 bounds with a2px fringe, uniformly fits112px and
centres it in128px. It does not paint, recolour or repair alpha. The source,
registered export and byte-identical shipped image were visually reviewed.

```sh
python3 art/creatures/export-batch-al.py --check
python3 tools/export-painted-runtime.py --check
```

The common delivery now has1,555 images. `img/decals/ice.png` is included in
the catalog, reviewed hash inventory and offline worker. Its existing lazy
loader prepares the circular mask and eight shade canvases once, with512KiB
of shade storage before image/browser overhead. The renderer preserves its
native blue fill, ellipse, four satellite splashes, light/fog and close-up
detail fade. Texture remains half opacity, fading in above12 projected buffer
pixels of height to its full half-opacity at16.

The blue colour is also used by wraith frost. Actual ice fields alone receive
a renderer-private `material: ice` tag. The kept stain clears that tag when
replaced; it is not a gameplay or saved-state field. Unmarked frost, oil/water,
warnings and other gore retain their native rendering. No clock, damage,
holding, conductivity, melting, expiry or dice rule changes.

## Native review

[Gallery](preview.html) compares the original audit's blue patch with the
new material and includes actual Frost-scroll freeze, one forward approach
and native thaw at320/390px in Normal/Calm. Reproduce with:

```sh
node docs/visual/2026-10-30-painted-ice/capture.cjs
```

The shipped Game/Renderer/Assets and updates run normally. Comparison fixtures
supply a60-second ice field, cleared monsters and hero safety. Action fixtures
supply a canonical .34 puddle, passive999HP Orc and Frost scroll. The real
scroll is consumed and freezes the water; the foe is cleared after the real
strike for visibility. Native movement approaches the ice, whose original
expiry reveals the remaining puddle. No renderer, update, image or clock is
replaced. This is bounded action evidence, not unassisted play, balance or
physical-device approval. The capture checks that its six runtime source hashes
remain unchanged from launch through completion.

## Verification

Both Chromium widths passed all12 focused ground-material cases, including
ice demand loading, zero pixels outside the native footprint, Calm, corrupt
image independence, stable cached canvases, unchanged state/dice, unchanged
frost/oil/water, native field replacement and delayed landing. The cache
regression retains exact pixel equality against fresh and context-path drawing.

The installed full-art native reload now explicitly decodes ice as well as
blood/ash. The speed budget retains all eight original scenes and thresholds,
and adds sixty mixed blood/ash/oil/ice/water presentation marks, with native
water glints. That fixture represents mixed marks; it does not claim an
exhaustive worst-case oil-fire spread. Fresh CI and the release publisher are
required before this implementation is a verified published release. Local
results, native source hashes and any failed speed attempts are recorded in
`validation.json`.


The final local installed full-art reload passed at both widths (two cases,
56.2s, no retries). The isolated local9-scene budget failed: amber27.3FPS,
scroll26.5, original stain crowd20.7 and new wet crowd20.0 (30 required).
Other scenes passed, startup2654ms. Raw log/trace remain outside the repo at
`/workspace/painted-ice-perf.log` and `/workspace/painted-ice-perf-results/`.
Earlier v0.9.65 also missed older bars on this local runner before passing CI;
that history does not clear the new scene or establish a causal regression.
No unchanged green rerun or relaxed gate is used. Fresh CI must clear every
scene before the release publisher can proceed.
