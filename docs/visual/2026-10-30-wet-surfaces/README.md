# AL wet-surface audit

Audited the shipped v0.9.65 runtime at commit
`93ed23aed72715af2ea458c87b683358fa2914d4`. This phase records decisions and
native evidence. It does not commission new images or activate a new atlas.

| Surface | Current appearance and function | Decision |
|---|---|---|
| Ice | Broad, uniformly pale blue ellipses with satellite splashes. It remains distinct from the dark floor, but lacks the material detail of the monster paintings. Ice also suppresses standing-water conductivity and expires. | First painting candidate: a muted transparent fracture/grain texture, contained inside the original ellipse. Keep the blue hazard identity, existing silhouette, expiry, cold hold and conductivity rules. |
| Oil | Dark brown spill with a separate pale native sheen. It can catch fire and become ash. At phone size, dense painted detail would compete with the small highlight. | Secondary candidate: sparse dark material detail only after ice has cleared visual and performance checks. Keep the sheen separate; no baked reflection, extra liquid footprint or new light. |
| Water | Small blue-grey puddles have moving native glints, held steady in Calm. Flooded floors have a separate blue overlay and live shimmer. Cistern water-floor materials already have thirteen selected regional paintings. | Retain current water rendering. A further water atlas is not justified by this audit. Do not confuse existing water-floor paintings with live puddles or the flooded overlay. |

The captures show oil/ice patches two squares ahead on both phone widths.
Their projected main height is about23 buffer pixels; detail should remain
subtle at this size. The smaller canonical .34-radius puddle has about17 pixels
of projected height. Preserve the established close-up detail fade rather than
adding grain to distant or subpixel patches.

## Evidence and reproduction

[Gallery](preview.html) contains16 full-page native screenshots: oil, ice,
puddle and flooded floor at320/390px, each in Normal and Calm. Images were
reviewed at the smallest phone size; the larger view is included for comparison.

```sh
node docs/visual/2026-10-30-wet-surfaces/capture.cjs
```

Requires project Playwright and system Chromium; `CHROMIUM_PATH` can select
another installed Chromium. The capture runs the shipped Game, Renderer and
Assets with normal updates and rendering. It supplies cleared monsters, safety
HP, an oil/ice field with60 seconds remaining, a canonical-sized puddle and the
flooded twist. These are labelled presentation fixtures, not generated wins,
balance trials or physical-device approval. No image, renderer, update or clock
is replaced. Oil/ice fields are checked through the actual `Game.fieldAt` API.

A forwarding observer records native water-glint draw calls. Each width must
show multiple changing glints in Normal and one stable glint in Calm; every
original draw still executes. A separate supplied ice field with900ms remaining
must expire on the native clock. This checks expiry processing, not the normal
eight-second duration or a real cold spell. `native/evidence.json` records all
sixteen views, both expiry observations and five exact runtime source hashes.
`water-materials.json` inventories and hashes the thirteen existing water-floor
paintings selected by `floorOf(4)`. No new gameplay or art fallback test is
needed for this documentation-only phase.

## Gates for the next implementation

Ice is the next proposed painting, not completed art. Generate a transparent
image-tool source matching the muted monster style; retain prompts, sources,
registration and reviewed exports. Keep its native ellipse and satellites,
shade/fog, field boundaries, delayed landing, clocks and game rules. Any loader
must remain independent, lazy, cached and safe on corrupt/offline images.

Compare actual wet-to-ice and melting/expiry scenes in Normal/Calm before
activation. Preserve every existing speed-budget scene and threshold, and add
representative wet-field coverage rather than replacing the sixty-stain crowd.
The v0.9.65 crowd cleared its4xCPU CI bar at30.8FPS; this is modest measured
headroom on that runner, not a universal device guarantee. No texture is
automatically approved because an atlas slot is available. AM spell contacts
and AN healing/ward accents remain later audit candidates.
