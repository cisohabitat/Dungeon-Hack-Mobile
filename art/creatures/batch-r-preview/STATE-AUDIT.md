# Batch R architecture/state audit

## Inventory and reuse

Audited assets.js, renderer.js, looks.js and regionart.js. Thirteen themes each
supply eight baseline architecture textures plus five plank-lock and five cell-lock
variants: 234 active references, assembled in [inventory overview](inventory-overview.png).
Exact theme names/key colours are in [reference inventory](reference-inventory.json).
The eight paintings are a Grey Halls baseline kit, not thirteen regional kits.
Existing regional wood, metal straps, carvings, ossuary bones and other overlays
remain procedural; do not apply this neutral kit wholesale to other themes.
Recess side walls reuse the current wall material, not a newly invented asset.

Selected keys: door, cellDoor, pillar, stairsUp, stairsDown, stairsUpBack,
stairsDownBack, stairArch. First r1 gate and two subsequent repairs had seven
bars and are rejected for that cell; r5 provides eight. Door/pillar retain r1.
Gate r5 has rougher stone and more rust than r1, documented as a separate material
illustration rather than a perfect palette clone. It retains neutral lock meaning.
No separate lock repaint is required to fill a source gap: five colours already
have exact existing variants. These stay procedural in previews and integration
must resolve matching materials without losing the key cues.

## Native format and geometry

Wall/architecture sampling expects 64x64 CanvasImageSource textures. Seven cells
are opaque; stairArch is straight RGBA. Detail256 files are review only. No
creature baseline/alpha padding applies. All exports are uniform full-cell resizes
from authored source rectangles; no recolouring, mask rewriting or synthetic paint.

A pillar occupies the inner square [.2,.8] on both axes; the renderer supplies
its narrower geometry, while the full square texture supplies cylinder shading,
capital and plinth. An adjoining wall must stop using the pillar surface.

Doors are recessed halfway across their tile. Sliding frames sample
floor((wallX+1-shut)*64), then flip texture columns for wall orientation.
The booth uses shut .75/.5/.25, and existing crackedDoor 1/2/3 and burningDoor
stage 0/1/2 are applied to the painted base by the actual renderer. Calm fire
uses frame zero. Captures do not establish native player interactions or outcomes.

Stair recess depth is .9 square. STAIR_OPEN=21/64 each side of centre; opening
is elliptical above native y20 and vertical below it. The renderer draws the
recess back or side wall first, then a cached shaded arch, keeping opening alpha.
Only the entrance-facing side exposes a stairwell; side/back faces use wall.
Caved stairs use fallen rock. Eight-level floor/ceiling caches are untouched.

At alpha>=128, the painted arch differs from the original native mask in 26 of
4096 pixels. It is a reviewed source candidate, not an exact geometry replacement.
The preview explicitly retains the original procedural arch. Future integration
must preserve the exact mask, for example by retaining original geometry while
applying an approved material, and test all sightlines. No exporter edits alpha.
Flat stairsUp/Down are source comparisons; facing stair previews exercise the
back textures with the original arch, not those flat fallback faces.

## Review and delivery gates

68 frozen captures at 390/320px cover near/far door/gate/pillar/up/down, joined
pillar, side/buried stairs, ten colour-lock controls, three sliding positions,
three damage states, three burning states, Calm fire and safe palette. Assertions
check renderer columns, preserved lock and arch bindings, and original identity
restoration for all thirteen themes. These are controlled baseline substitutions,
not generated regional levels or live save/load/navigation tests. No mutations
are made to shipped game code. The original surrounding floor/walls/decor remain.

Four existing native architecture tests pass at each phone width (eight total):
entrance/side/buried stairs, door recess/jambs, free/joined pillar and actual door
opening. A temporary test configuration selects art.spec.js for small; default
small configuration does not include it. No assertions are weakened.

Before runtime delivery: coordinate O/S material matching, resolve exact arch mask
and lock materials, retain secret walls and region overlays, use independent load
failure fallback and lazy decode, review native regional layouts and transitions,
verify offline reload, and measure isolated frame-time/memory. Eight native RGBA
cells total 128KiB raw before image/canvas/GPU and derived shade/damage/fire caches.
This is a size estimate, not a measured runtime allocation or FPS result.
