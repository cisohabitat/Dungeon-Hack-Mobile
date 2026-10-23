# Painted dungeon creature sources

The Dark Elf Warrior is the first painted dungeon sprite, approved after a
nine-pose preview on 22 October 2026. The original generated PNG is preserved
as `drow_warrior.png`. OpenAI's `image_gen.imagegen` tool used the current
Dark Elf Warrior bestiary painting, then the approved full-body concept and
pose sheet as references. The tool did not disclose its underlying model.
Terms: [OpenAI Terms of Use](https://openai.com/policies/terms-of-use/).

The final edit corrected the two walking frames to lead with opposite legs,
kept frontal heads and bodies, and preserved ash-grey skin, white hair, black
armour and two held curved swords. The poses, left to right, are Idle, Step A,
Step B, Wind-up, Strike, Recover, Guard, Hurt and Blink. Guard corresponds to
the existing `special` pose; there are no new combat actions or timings.

`python3 art/creatures/export.py` slices measured row gaps, registers the
body centres and foot baseline, and exports nine 256px square cells in
`img/creatures/drow_warrior.webp`. The square registration follows the approved
in-dungeon preview. ImageMagick performs only raster export, without repainting
the generated character. `--check` rejects stale exports. Inspect both the
source and export before updating their hashes in `art/review.json`.

Only the WebP ships. The loader shades each pose once between frames; elite
colour washes are prepared on demand. Every pose retains its procedural
fallback during loading or failure. The renegade companion keeps its own art.

## Twelve-creature expansion

The approved Blink Hound, Cave Wyrm, Lizardfolk, Dwarf Arbalest, Slime, Rustmaw,
Skarrow, Dark Elf Mage, Grey Dwarf, Lizard Shaman, Eyeless Stalker and Puffcap
pose sheets were generated with the same tool on22 October2026. Each used its
current bestiary painting for identity and the approved dungeon style/layout
for presentation. The underlying model was not disclosed. All preserve the
existing warm-left/cool-right painted lighting. See `generation-batch.json`
for source filenames and optional separately generated opposite-leg steps.
The generation record's reference names identify the shipped bestiary WebPs
under `img/bestiary/`; originals remain under `art/bestiary/`.

`python3 art/creatures/export-batch.py --check` reproduces all twelve WebPs.
It needs ImageMagick plus Python Pillow, NumPy and SciPy. The first two use
measured gutters/body centres; the others use nine connected character islands,
assign meaningful detached effects to the nearest body, remove tiny isolated
generation specks and register visible feet. All preparation is offline export;
none of these dependencies ships to players. Sources and final256px cells were
visually inspected for identities, continuous gear, complete limbs and edges.

Slime, Rustmaw, Eyeless Stalker and Puffcap have unused special cells because
the game has no distinct special pose for them. Their rules and wind-ups remain
unchanged. Rustmaw's final idle variation moves antennae, the Stalker's adjusts
its jaw without eyes, and Puffcap's changes gills without inventing a skull face.
Skarrow binds to the existing Wyrm champion objects and keeps three horns,
a facial scar and a viewer-right clouded eye. Other named champions keep
their procedural appearances rather than inheriting the base species atlas.

Each atlas decodes only when its monster is first drawn. Normal and elite shade
palettes are independent per species, cached and switched only when complete.
A missing/corrupt atlas keeps that species procedural without disabling others.
All thirteen atlases are in the installed offline cache.

## Batch A review generation — 22 October 2026

OpenAI's `image_gen.imagegen` generated nine-pose originals for Rat, Bat,
Spider, Goblin, Skeleton, Zombie, Orc, Ghoul, Wraith and Ogre. Each request
used that creature's current `img/bestiary/<kind>.webp` for identity and
`drow_warrior.png` for painted style and layout. The model was not disclosed;
the same OpenAI terms linked above apply. All requests enabled transparency.
Original PNGs remain as `<kind>.png`. Exact prompts, tool output locations,
references, repair requests and registration anchors are recorded in
`generation-batch-a.json`.

Goblin, Orc and Ogre needed separately generated opposite-leg steps; the rejected
first Orc repair is retained as `orc-stepB-rejected.png`. Zombie and Ghoul had
opposite leads in reversed source cells, so their manifests reorder those
two existing cells without mirroring equipment. Repairs and source ordering
are applied only by the reproducible exporter; original sheets remain intact.

`python3 art/creatures/export-batch-a.py` extracts connected pose islands,
registers body centres, scales uniformly and writes transparent 768×768 review
atlases with nine 256×256 cells under `batch-a-preview/`. Grounded figures end
on visible row 236 with at least 12px clearance at the other edges. Bat uses
measured torso centres at a fixed (128,148) anchor. Wraith uses its lowest solid
robe fringe, without adding feet. `--check` compares all exported bytes and
measurements. This workflow requires Pillow, NumPy and SciPy.

`node art/creatures/preview-batch-a.cjs` uses the real dungeon renderer with
temporary Playwright routes to preview these atlases at 390px and 320px.
Review results, images and remaining checks are listed in
`batch-a-preview/REVIEW.md`. These are generated review assets: no owner
approval, runtime integration, offline support or publication is implied.

## Colour and Zombie pose corrections — 23 October 2026

The same image-generation tool edited the Goblin, Orc and Ogre opposite-leg
steps against their original idle palettes. All previous PNGs and intermediate
attempts remain as provenance. `generation-batch-a.json` selects the active
colour source and records every exact prompt, reference and generated output.
The first Goblin passes were too muted, bright or dark. The final edit matched
the replacement within the complete nine-pose atlas; only the top-right cell
from `goblin-colour-sheet.png` is selected, retaining eight original poses
and their previous common registration scale.
No runtime colour filter is added.

`zombie-colour.png` contains generated skin/lighting and blink corrections.
Only its wind-up, hurt and blink cells are selected by `sheet_corrections`;
the other six original source poses remain in use. Blink retains the tilted
head and open mouth of idle with closed eyes. Offline export crops and
registers these tool-drawn figures; it does not paint or colour-grade them.
The exporter also reproduces `batch-a-preview/correction-sheet.png`, comparing
the corrected walking frames and Zombie poses against idle at 256px cell size.

## Batch A runtime integration — 23 October 2026

On the user's instruction, the ten selected review atlases are copied byte for
byte into `img/creatures/`, bound to existing supported pose objects and added
to the offline cache. The Batch A exporter now reproduces both review and
shipped copies. The capture script uses the actual runtime loader without
substituting modules or images. Named champions retain their procedural art;
unused special cells do not introduce game actions. No combat rules changed.

## Batch B review generation — 23 October 2026

OpenAI `image_gen.imagegen` generated Troll, Minotaur, Kobold Trapper, Goblin
Archer, Basilisk, Dark Acolyte, Glimmer Moth, Thornhog, Gutter Imp and Goblin
Cutpurse from their existing bestiary portraits and the Warrior style sheet.
Original PNGs remain as `<kind>.png`; the tool did not disclose its model.
Exact prompts, references, generated paths, selected repairs and measured
registration are recorded in `generation-batch-b.json`.

Tool edits repaired the Troll and Cutpurse's opposite-leg steps, turned all
Kobold heads forward, and separated neighbouring Archer bow/Acolyte staff
figures. The first Troll replacement had an opaque gradient background and is
retained as rejected provenance; a further tool edit removed that background.
Initial single-frame repairs were reviewed against the original eight cells.
The final Troll and Cutpurse selections use complete tool-revised palette sheets,
which keep their lighting coherent across all nine poses; every earlier source
and intermediate remains preserved.

`python3 art/creatures/export-batch-b.py --check` reproduces review WebPs with
nine 256px cells, a shared per-creature scale, visible grounded baseline row236
and at least 12px clearance. Moth uses measured thorax anchors at (128,144).
Only extraction, antialiased raster scaling and registration happen offline;
no runtime colour filter or new painting is applied by the exporter.

`node art/creatures/preview-batch-b.cjs` previews existing supported poses in
the actual dungeon renderer and runtime loader with shipped images. The user
authorised integration and publication on 23 October 2026. Exports reproduce
review and shipped bytes; all ten are cached offline with existing supported
poses. Named champion identities and gameplay remain unchanged.
Review images and findings are under `batch-b-preview/`.

## Batch C — 23 October 2026

OpenAI `image_gen.imagegen` generated Lookout, Hexer, Pikeman, Quillback,
Drowned One, Emberling, chest Mimic, Lich, Heartforged and Warlord from the
existing bestiary/keeper portraits. Model name was not disclosed. Original PNGs,
actual prompts, references and every selected or rejected repair are preserved
in `generation-batch-c.json`. Character repairs use the image tool; the exporter
only extracts, uniformly scales and registers the existing pixels.

`export-batch-c.py --check` reproduces ten 768px atlases, measurements and neutral,
walking and action contact sheets. Grounded alpha ends at row236 with at least
12px clearance; Lich registers its floating torso rather than invented feet.
`preview-batch-c.cjs` exercises shipped images through the real runtime loader
and dungeon renderer at 390px and 320px.

Barrel Mimics remain procedural. The chest atlas is selected only after a chest
Mimic is revealed. All keeper phases after the first and the Warlord's throne
and spear throws keep procedural art; concealment, ripples and gameplay effects
stay with their existing code. No abilities, timing, scale or saves change.

The user authorised Batch C publication on 23 October 2026 after reviewing the
local checks and baseline performance limitation. Normal release/CI gates apply.

## Batch D — 23 October 2026

OpenAI `image_gen.imagegen` generated the default knight Shade, Grisk, Vessra,
Ushgar, Morrow, Orla, Gorrum, Vaelith, Hissra and Durgrim from their existing
bestiary portraits. The model name was not disclosed. Original PNGs, exact
prompts, references, generated paths and selected repairs are preserved in
`generation-batch-d.json`. All character changes use the image tool; the
exporter only extracts, uniformly scales and registers existing pixels.

Full-sheet repairs restore crown/halo/spear clearance, the Shade's floating
lower body, Orla's consistent cracked halo, and distinct opposite walking leads
for Gorrum, Vaelith, Hissra and Durgrim. Selected complete sheets keep palettes
coherent. `export-batch-d.py --check` reproduces ten review/shipped atlases,
contact sheets and registration measurements. Shade and Orla use measured torso
anchors rather than feet; grounded figures retain visible baseline row236.

`preview-batch-d.cjs` uses shipped images through the real runtime loader and
renderer at 390px and 320px. Each named champion binds its own existing
`base.elite[id]` pose objects. Only the default/fighter Shade uses the knight
atlas. Other fallen classes retain their procedural class gear even while that
gear is loading. Unsupported reserve cells do not introduce actions. Combat,
scale, warnings, opacity and saved identities retain their existing rules.
Local integration does not publish the batch.

## Batch E — class Shades, 23 October 2026

Six original nine-pose sheets and two selected Mage/Ranger full-sheet repairs
were generated with `image_gen.imagegen` using the reviewed spectral Shade body
and current class portraits. The model was not disclosed. Exact prompts,
references and output paths are in `generation-batch-e.json`. Both rejected
living-face originals remain preserved. Selected sources and all 54 registered
export cells were visually inspected. Torso anchors align floating bodies;
`export-batch-e.py --check` reproduces all six preview atlases and comparisons.

`preview-batch-e.cjs` produces review-only substituted draws for six supported
poses at 390px/320px, with warning assertions and page/console error checks.
See [the review](batch-e-preview/REVIEW.md) for selection decisions and limits.
There are no shipped atlases or runtime/offline changes in this stage.

## Batch F — companions, 23 October 2026

Six nine-pose sheets plus a separate Mender healing source were generated with
`image_gen.imagegen`, using the six existing companion portraits. The model was
not disclosed. `generation-batch-f.json` records all actual prompts, output paths,
originals, full-sheet repairs and isolated step replacements. First-pass repeated
walking leads were corrected; a Mender repair closing all eyes was rejected.
Selected sources, 54 main cells and the healing export were visually inspected.

`export-batch-f.py --check` reproduces preview bytes and measured registration.
`preview-batch-f.cjs` asserts existing live companion pose selection and scale,
then substitutes review images into real dungeon draws at 390px/320px. All 86
captures report no page/console errors. See [the review](batch-f-preview/REVIEW.md)
for source selections, remaining visual differences and explicit preview limits.
No companion atlas is runtime-bound or cached offline in this stage.
