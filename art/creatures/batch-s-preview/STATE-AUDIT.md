# Batch S material/state audit

## Coverage and reuse

Audited assets.js, looks.js, renderer.js and regionart.js. Thirteen themes have
20 selected secondary keys each (260 active reference PNGs); see
[reference inventory](reference-inventory.json) and [overview](inventory-overview.png).
69 existing theme decoration entries are counted in metadata and retain original
bindings; no new decoration paintings are commissioned or claimed reviewed here.
O already supplies base wall/room-floor/rock-ceiling source art; R supplies baseline
architecture. Do not repaint them. The S booth retains existing procedural bases
and architecture while substituting only selected secondary materials.

This is20 Grey Halls baseline cells, not260 regional paintings. Other themes'
wood/stone/metal/bone/glass/reed identities and overlays remain procedural until
coordinated matching. Water is always the actual shallow cistern floor variant;
marsh mud and drowned base floor remain separate O identities, not water aliases.

| Family | Keys | Source layout |
|---|---|---|
| Floor path/shrine | floor1/2/3 | S1 3x1; selected diamond correction |
| Wet/aftermath floor | floor4/5/6 | S2 3x1 |
| Roof | ceil1/2/3 | S3 3x1 |
| Wall/rock | wallB/wallDamp/wallCracked/rock/fallen/rockPillar | S4 3x2 |
| Fountain states | fountain/fountainDry | S5 2x1 |
| Torch frames | torch0/1/2 | S6 3x1 |

## Format and live state mappings

All exports are opaque64 square textures with256 detail reviews. Floor/roof use
8 cached Uint32Array levels,4096 entries each: RGB truncation by(1-level/7),
opaque alpha and an exact black final level. The browser verifies every channel
of all72 levels at each width (144 total). No per-frame source painting is added.

lookOf selects floor1 for paths, floor2/3 for shrine mosaic/central altar, floor4
for cistern, floor5 for rubble/forge and floor6 for straw outside a cell aisle.
The booth uses those actual metadata kinds and verifies the floor-render bitset;
altar framing moves nearer its central tile and straw framing moves off the plain
central aisle. Mosaic/altar fixtures share the same shrine layout. Roof1 is the
beam roof of hall shapes; roof2 uses earth-theme cave metadata for roots; roof3
uses a non-earth cave. This is controlled kind selection, not native region generation.

Wall variants are coordinate-selected, with original decorations retained. The
wall booth faces undecorated x3,y4; facing x4,y4 instead selects an existing banner
and does not prove source sampling. Plain wall variants are unified to the selected
surface only inside their controlled fixture. Bare rock uses cave metadata; fallen
uses a rubble piece; rockPillar uses an isolated wall in a cave. Numeric columns
assert rock/fallen/pillar states. Image provenance is tracked through existing
softWall canvases at distance>3, and actual view draw calls assert the selected
material is used. Failed initial banner-facing fixtures were corrected before
final captures; assertions were not weakened.

Fountain selection uses T.FOUNTAIN and features[x,y].used; wet retains existing
renderer glints, dry selects fountainDry and has no stream/blue basin. The booth
does not drink/use a fountain or establish outcomes. Torch uses T.TORCH and existing
light maps,140ms frame steps and sequence[0,1,0,2,1,2,0,2,1], offset x*5+y*3.
The review chooses times selecting upright/left-tall/right-short. Calm is primed
with frame1 then rendered2800ms later; the selected-frame draw assertion verifies
it stays held. Do not substitute frame0 as an invented Calm rule. Existing torch
flicker/light logic and local glow remain; no new light sources are introduced.

## Repeats and integration gates

Fifteen native3x3 repeat panels are visual diagnostics, not a mathematical
periodicity certification. Current join/interior ratios exceed2 for ceil3,
wallB, rock and fallen on one/both axes. Numeric ratios do not prove continuity:
root branches, straw heaps, rubble and water curves also require join review.
Root branches do not join perfectly at every edge; repeated moss/altar motifs
remain visible. Rock-pillar lateral shading is intentional single-column framing,
not a suitable flat-wall repeat. Wall foot/roof shading also needs coordinated
integration rather than arbitrary vertical repeats. No exporter seam blending,
recolouring or synthetic edge repair is used. Additional tool-painted corrections
may be needed after native regional layout/material integration review.

84 frozen captures (42 per width) cover20 cells near/far, Calm torch and safe dry
fountain. Original doors, arch masks, lock/cell-lock variants and decor identities
are checked and restored across13 themes. Six existing region-art browser tests
pass at phone/small, verifying original coded locks, blue water, shade-cache
stability, deterministic reload and regional foe scenery. They are baseline
native checks, not evidence of painted-loader integration. No page/console errors.

Before delivery: coordinate O/R/S materials and exact R arch geometry, resolve
repeat joins as needed, retain all regional overlays/secret-wall meaning, lazy
load with independent fallback, invalidate derived caches correctly, verify native
regions and state transitions/offline reload, and measure isolated phone frame-time
and memory. Nine floor/roof families x8 RGBA64 caches cost1.125MiB raw; eleven
other native RGBA64 cells cost176KiB, combined1.296875MiB before decoded image,
canvas/GPU and derived softening/glint/light overhead. This is an estimate, not
measured runtime allocation. No shipped loader, offline list or game rules change.
