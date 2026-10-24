# Batch X — additional effects review

Audit evidence included with release0.9.34. X added no painting, shipped image or runtime edit.

The decision is to retain the integrated Q fire/frost impacts and the existing
procedural effects. No additional effects atlas is commissioned. The review
covers selected real casts in controlled combat setups, not a complete run or
all target/region combinations.

## Evidence

`node art/creatures/preview-batch-x.cjs` samples the native view canvas after
normal animation frames. `Game.update`, `Renderer.render`, spell functions and
asset requests remain untouched. Fixtures raise hero level/resources, position
one durable Orc and give it an existing long melee wind-up. The live game clock
must advance and every cast must damage its target. These are actual casts and
scroll use through game APIs, rather than UI input coverage.

Two phone widths, normal and Calm/safe: Burning Hands, Cone of Cold, lightning,
scroll fireball, Flame Strike and insect swarm. Each sequence records travel (immediate onset for lightning),
four post-impact samples and expiry. See [capture records](captures.json) for
observed timestamps; short spells are sampled on available animation frames,
not exactly at atlas boundaries. Native canvas captures omit the surrounding HUD. All 144 samples retain at least
one visible warning according to the renderer; the four gallery sheets were
visually reviewed, with native frost/fire samples checked at full size.

## Per-identity decision

| Visual | Decision and reason |
|---|---|
| Fire/frost contact | Retain Q's four-frame families. Local flame versus angular pale ice gives different shape as well as colour; external fade clears the target. |
| Travelling fire/frost, magic missiles | Retain continuous procedural paths. They follow projected hand/target geometry and existing release/impact timing. A fixed painting would need additional directional/scale handling without a demonstrated missing identity. |
| Lightning | Retain the connected bolt and local angular mark; Calm suppresses travelling arcs. A static lightning sheet would obscure which points are connected. |
| Insect swarm and other arcane effects | Retain deterministic moving particles and existing local marks. No new creature or persistent environmental object is implied. |
| Arrow, knife, stone, cord | Retain target-relative trajectories, rotation and release handling in `spellfx.js`. Additional generic impact art would blur distinct actions. |
| World flames, ripple, laid snare | Already painted through Q and the integrated world loader. Keep field lighting, ripple concealment and original scale/offset rules; a laid loop is distinct from a triggered screen trap. |
| Triggered dart/needle/pit/alarm/disarm/snare | Retain procedural geometry and outcomes. Dodged flight, tightening loop and pit occlusion encode what happened. Code audit only in X; no claim of newly captured trap outcomes. |
| Poison/status, warnings, reading/use | Retain existing overlays and timing. No separate poison-impact spell exists. Warnings and intent remain independent information, never decorative paintings. |

## Format and delivery constraints

Current impacts are straight RGBA 256px canvases with common origins, source-over
compositing and external fire `(1-age)^2` / frost `(1-age)^1.6` alpha. Native
`elementfx.js` selects cells at .135/.4/.7 of post-impact age and rejects ages
outside [0,1). Spell drawing separately checks born/until. At most six projected
targets are considered; X's visual samples use one, not a six-target crowd test.

Order remains world/warnings, spells, held gear, flashes/boss, traps and status.
No new light, damage, obstacle, projectile, pre-hit flash or action is added.
Calm bypasses painted impact substitution. The loader switches a complete
four-image family together; an incomplete/failed family keeps its procedural
fallback independently of the other family. Code audit establishes this policy;
X does not newly inject corrupt effect assets or repeat native offline delivery.
See the published [runtime delivery review](../runtime-preview/REVIEW.md) for
integration/offline evidence and its limitations.

Eight decoded RGBA frames consume 2 MiB of pixel storage; eight cached RGBA
canvases add another 2 MiB before browser/GPU overhead. This is a storage estimate,
not measured process memory. X adds zero runtime image or cache allocation.
Future art must stay lazy, reuse cached frames and perform no per-frame painting;
require the repository's isolated 4x CPU frame budget and full release checks
before shipping runtime changes. X does not establish fresh performance or
physical iOS results. Balance simulation is unnecessary for this audit because
no implementation, visibility or gameplay rule changes.

## Visual findings and validation

The reviewed normal sequences keep the triangle warning above the impact. Fire
and frost remain recognisably different; late cells/fade restore the painted
Orc. The existing brief white damage flash dominates early body detail, notably
for pale frost. Larger or opaque replacement art would compound that coverage;
this is not a demonstrated missing-painting problem. Calm uses restrained local
procedural marks and omits the travelling fan/bolt. These samples support reuse
for this one-target setup, not certification of every crowded encounter.

- 24 actual cast/use sequences, 144 native canvas frames and four overview sheets.
- 18 existing fire/elemental browser checks passed (phone and small, 1.2 minutes).
- Eight shipped impact files still match their visually reviewed hashes;
  [inventory](inventory.json) records dimensions, alpha bounds and pixel-storage estimates.
- Documentation/art inventory and preview syntax checks recorded with this audit.
- No balance simulation, full browser matrix or fresh performance run: no runtime edits.

Reviewed galleries: [390 normal](390-normal-overview.png),
[390 Calm/safe](390-calm-safe-overview.png),
[320 normal](320-normal-overview.png), [320 Calm/safe](320-calm-safe-overview.png).

E–X is now audited. Keep the existing W title overlap and share-card keeper/outcome
follow-ups in the roadmap; this audit does not fix them. W/X evidence accompanies the0.9.34 shield publication.
