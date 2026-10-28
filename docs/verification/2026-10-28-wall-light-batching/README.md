# Wall-light batching and the reading-scroll gate

Baseline: main `ea8ecc9024df7066a387eec14f67a7b386ba337b` (v0.9.55).
Its CI run40713460160 completed all979 Chromium and217 WebKit cases, with
three passing automatic retries. The performance job failed the reading scene
at28.8FPS against30, and publication was skipped. The latest tagged release
remained v0.9.54. Main/Vercel deployment is distinct from tagged publication.
The failed trace and all14 reports are retained in `/workspace/aaa2-ci-*.zip`;
`/workspace/aaa2-publication.json` records that full outcome. Local baseline
and candidate misses from AAA2 remain in its committed interface review.

## Selected change

The floor-profile investigation led to several rejected caches and occlusion
experiments. The selected change instead reduces wall-light canvas calls.
It records the original shade/warmth colour steps and integer rectangles in
four fixed320-entry buffers (3,200 bytes). Shade and warmth keep their original
order within every column; adjacent rectangles merge only when colour, top
and height match exactly. Columns do not overlap, so drawing all shade and
then all warmth preserves compositing. Wall images and webs still precede
these passes; fountains, particles and sprites still follow them.

Both step buffers clear every frame. Fogged columns and open stair arches
cannot inherit an earlier wall's lighting. Stair-recess shading remains ahead
of the arch. No painter bytes, floor arithmetic, lighting values, fog reach,
collisions, exploration, camera, warning placement, animation time, game rules
or dice change. No balance simulation or physical-device approval is claimed.

## Pixel and timing evidence

`measurements/wall-batches-pixels.json` compares2,340 supplied native-material
views:13themes, three buffer heights, five floor conditions, three angles and
four Calm/flicker snapshots. Every complete RGBA image matches the original.
`transitions.cjs` separately exercises closed/open/sliding doors, cell bars,
stair arches, pillars, fountains and far fog, changing contexts on the same
renderer to check that frame-local lighting clears. Its supplied geometry is
labelled separately from native play.

The longer alternating diagnostic (`wall-batches-timing.json`,1xCPU,
100renders/batch,10rounds) measured ordinary lit rendering at2.798ms original
versus2.469ms candidate (11.8% less time). Other medians were unlit1.913/1.822,
flooded3.119/3.018, dark1.762/1.768 and overgrown3.053/2.924ms. These frozen
readback-canvas diagnostics are not whole-game FPS or universal speedup claims;
the short timing samples in pixel checks are noisy and retained separately.

One planned sequential original/candidate native budget used identical source
routing, the unchanged scenes,4xCPU, original deadlines/bars and zero retries:

| Source | Fight | Wide | Flooded | Painted | Amber | Reading | Rite | Start ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Original | 35.6 | 34.3 | 34.3 | 45.7 | 34.8 | 32.0 | 43.6 | 2055 |
| Rectangles | 38.2 | 37.0 | 36.7 | 38.8 | 34.9 | 32.3 | 49.0 | 2079 |

Both passed; the small reading difference and lower painted sample illustrate
variability. They do not erase the prior CI28.8 failure, establish attribution
to AAA2 artwork, or prove a reliable reading-FPS improvement by themselves.
The final integrated source must pass the original isolated budget and all
required CI jobs before tagged publication is called verified.

The original integrated v0.9.56 budget (no diagnostic source routing) passed:
fight40.7, wide38.4, flooded35.0, painted44.9, amber38.9, reading44.8 and
rite51.4FPS; startup2175ms. All thresholds, scene lengths,4xCPU and zero-retry
policy remained unchanged. This is a separate required check on the final
source, not a replacement for the paired observations or previous failures.

Nine native movement sessions at320/390/740px cover45actions and540frames in
lit, dark and flooded views, with no browser errors (`native/evidence.json`).
They use running native updates and shipped assets on supplied safe terrain
with level10 Mage resources. They are distinct from frozen pixel comparisons,
normal loot/balance observations, physical devices and listening evidence.

## Rejected experiments

`experiments.json` inventories hashes and retained external source paths; all
raw measurements are in `measurements/`. Warmed-texture caching thrashed and
was much slower. Projection caching and its separate stationary kernel did
not consistently improve lit rendering. Zero-light-cell/fog-fill changes were
mixed. Current-frame opaque-wall culling preserved2,340 views but gave modest
gains for a larger pipeline refactor. Colour-grouped Path2D wall fills gave no
clear advantage over the simpler selected rectangles. None of those variants
ships. An initial external occlusion comparison had a generation-marker/path
setup error; no browser measurement ran until that was corrected.

Reproduce comparisons from the repository root with existing dependencies:

```sh
RENDER_BASE=ea8ecc9024df7066a387eec14f67a7b386ba337b node docs/verification/2026-10-28-wall-light-batching/compare.cjs
RENDER_BASE=ea8ecc9024df7066a387eec14f67a7b386ba337b node docs/verification/2026-10-28-wall-light-batching/transitions.cjs
```

`validation.json` records final local checks:979 Chromium cases passed without
retries (973ordinary plus six serial full-cache offline checks), along with
751rules in74files and all repository checks. The required CI budget and every
matrix job remain unchanged. Native browser crashes, offline retries, listening,
physical devices and independent AAA assessment remain separate open issues.
