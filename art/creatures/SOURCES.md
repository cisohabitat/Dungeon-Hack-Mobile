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
