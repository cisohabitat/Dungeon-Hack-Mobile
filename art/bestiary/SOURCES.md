# Deepdelve bestiary portrait sources

Fifty original AI-generated paintings made on 2026-10-15 with OpenAI's
`image_gen.imagegen` tool. The tool did not disclose an underlying model identifier.
Terms: [OpenAI Terms of Use](https://openai.com/policies/terms-of-use/), including
its Content section covering generated output.

The four unedited original contact sheets are preserved here. Their creatures
follow `MONSTERS`, `BESTIARY` and the champion descriptions in `js/champions.js`.
The shared style follows the existing boss paintings: amber torchlight,
blue-violet cavern shadows and weathered materials. No reference image was
submitted to the generation tool. `generation.json` records the exact prompts
and the creature order in each sheet.

Each sheet is divided into equal square tiles, left to right, top to bottom.
Tile boundaries are rounded to the nearest pixel, then each tile is exported
at 512 × 512 using Lanczos resampling and WebP quality 85. There are no colour
or composition changes. Run `python3 art/bestiary/export.py` from the repo root
to reproduce the exports with ImageMagick's `identify` and `convert` installed.

Only `img/bestiary/*.webp` ships to players; `art/` is excluded from deployment.
The three keeper portraits still come from `img/bosses/` (see
[`../bosses/SOURCES.md`](../bosses/SOURCES.md)). Each of the 53 bestiary entries
therefore has its own painting, including the ten champions and the shade.
The title bestiary and Journal share these portraits. Unmet creatures' pictures
are darkened and blurred, with names and details still concealed. The dungeon
retains its animated sprites, which also serve as missing-file fallbacks.
