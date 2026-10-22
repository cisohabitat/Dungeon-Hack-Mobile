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
