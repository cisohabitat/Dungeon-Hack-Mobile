# Batch K static prop review — 24 October 2026

25 painted static prop exports cover the remaining `PROPS` inventory: the roadmap's
24 objects plus the existing `bone_heap`. Seven source groups produce six 512px
square atlases and one 256px heap atlas, alongside 25 individual 256px WebPs.
Together J's 17 keys and K's 25 cover all 42 current props.

Generated with `image_gen.imagegen` (model not disclosed). Exact prompts, active
procedural references, painted style reference, original output paths, repairs,
selected sources, crop rectangles and scene anchors are in
[the manifest](../generation-batch-k.json). Painting and repairs use the image
tool; export scripts only crop, uniformly scale and register raster artwork.
This publication contains source/review assets; runtime integration remains pending.

## Reviewed objects and cues

| Group | Preserved composition |
|---|---|
| K1a | Black spider altar with eight folded obsidian legs, garnet eyes, wine bowls, violet candle and open web canopy; red-lit Heartwell shaft; two-candle grey stepped shrine; violet-glyph dark runestone |
| K1b | Gold oval mirror with red-eyed hooded reflection inside blue-grey glass; stone kneeling knight with real horizontal sword and water tears; jade idol with two ruby eyes; red fire orb over two-step Heart dais |
| K2a | Closed brown iron-banded strongbox with silver chain/rusty lock; closed framed door and three levers; roofed open well with connected rope/bucket; three book rows, one gold middle-row spine and fallen/open books |
| K2b | Closed red/gold chest with tripwire/anchor; four blue/red/grey/green shields, red banner, helm and skull; hot dwarf forge/anvil/ingots/ale cask; cold hearth/anvil with one ember, blade/tongs/hammer |
| K3a | One unhatched green scaled Wyrm egg with small warm crown crack; ten pale clutch eggs on dark mud/marsh water; rubble and one emerging sleeved arm; five pale gilled mushrooms over skull/hand/cloth |
| K3b | Five hanging silk cocoons with short complete threads and one sword hilt; seated bare gambler skeleton with cup, gold pot and two floor dice; low blue-black pool with subtle submerged pale hint; cauldron/chain/ladle on three-legged tripod above small fire |
| K3c | Low scattered bones, collapsed ribs/pelvis and tipped skull with two violet eyes; no upright or seated skeleton silhouette |

The selected paintings use weathered stone, wood, metal, bone and woven silk with
directional shading matching the approved monster/encounter art. Original sheets
and five full-sheet spacing repairs remain preserved. Repairs provide complete
mirror ornament/gear and clear cell gutters, preserving counts and closed states.
The wired chest and strongbox remain visually distinct. Water in `pool` remains
black/blue-black; marsh water belongs only to the clutch scene. Mirror glass is
opaque-reflective; gaps outside the frame, between well posts, web strands and
tripod legs remain transparent. No solved/open mechanism outcomes are painted.

All original/selected cells, 25 individual active references, seven grouped
references, individual exports, grouped atlases and contact sheet are reviewed
for complete silhouettes, expected material/colour/count cues and alpha edges.
The pale shapes under mushrooms or water are existing prop cues, not new outcomes.
No new living characters or additional obstacle geometry is added.

## Scene crops and registration

Each scene uses an authored source rectangle and whole-composition base anchor,
with visible alpha ending at row 236 and at least 12px clearance. Low pool/heap
exports have a 96px maximum height; the low clutch uses 125px. No foot inference or
standing-creature normalization is used. The exporter retains alpha above 32 plus
a 3px antialias rim, excluding faint generator haze elsewhere in the rectangle.
The heap original's dark studio-like RGB preview has transparent background alpha;
review uses its actual composited alpha, not the raw preview appearance.

`measurements.json` records source hashes, crop rectangles, visible bounds, anchors,
scales, offsets and export hashes. The exporter deterministically reproduces all
25 cells, seven grouped atlases, neutral contact sheet and measurements.

## Mapping and preview evidence

[STATE-AUDIT.md](STATE-AUDIT.md) records mappings and the extra heap's callers.
The 24 encounter keys serve 28 encounter IDs; shrine/bones/barricade aliases stay
shared. The current Vigil Lamp Out still selects the same shrine prop, with no
independent unlit painting or changed rung logic introduced in this batch.

The preview checks actual scene identity, position, scale 0.85 and yOff 0 before
substituting painted cells into the existing renderer. It captures 112 near/far
world views for the 28 encounter IDs at 390px/320px, plus 56 unanswered cards. Card
checks verify the actual procedural URL binding, title, definition choice labels,
current offered-button count and unresolved result before a review-only DOM image
URL substitution. All opening/closing overlay fades finish before captures.

Eight more world captures force early/late collapsed-Skeleton states at 1/3 tiles
and both widths, assert the actual `bone_heap` binding and scale 0.855, and retain
the existing violet rise-progress ring. No collapse/revival rules are changed.
All 176 captures and four overviews are visually reviewed with no page/console
errors. The script asserts exact J/K coverage of the current `PROPS` inventory.

Game updates are frozen after setup; one preview NPC/monster is manually placed.
No choice is answered. Between cards the harness clears unanswered setup state
and dismisses its overlay. These checks do not establish generation eligibility,
unchanged run-history state, encounter resolution, rewards, puzzle solutions,
real collapse/revival timing, corpse transitions or end-screen share flows.

## Reproduce and integration limits

```
node art/creatures/reference-batch-k.cjs
python3 art/creatures/export-batch-k.py --check
node art/creatures/preview-batch-k.cjs
```

Reference/preview tools require Playwright and Chromium (`CHROMIUM_PATH` override);
reference assembly/export require Pillow. Sources and review bytes live under
`art/creatures/`; no shipped image, gameplay, asset-loader or service-worker file
is changed. The current painted creature loader accepts 768x768 nine-pose sheets,
so static decoding, per-key fallbacks, lazy loading, offline caching and card URL
handling remain separate integration work. Static black-wash preview shading
also does not establish exact procedural emissive masks or added light sources.
