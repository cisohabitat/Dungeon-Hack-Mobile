# Deepdelve class portrait sources

Six original portraits generated on 2026-10-15 with OpenAI's `image_gen.imagegen` tool. The tool did not expose an underlying model identifier. These are AI-generated illustrations, not photographs or commissioned human paintings.

Terms: [OpenAI Terms of Use](https://openai.com/policies/terms-of-use/), including the Content section covering generated output.

The game's existing `../keyart/portrait.png` supplied the world, colour palette and lighting reference. The fighter was generated first; the other five use both the title artwork and fighter as references for a consistent set. The rogue archetype is exported as `thief.webp` for the game's Thief class. Each character has distinct class equipment and a clear face. `generation.json` preserves the exact prompts, reference paths and original generation filenames.

The original 15 October PNGs are preserved here without editing. The current
18 October paintings are the six refreshes in `overrides/`, retained as
`previousOverrides` in `generation.json`. They use the original faces as identity references, the
later Grey Dwarf/High Priestess bestiary art as style references, and the
refreshed Fighter for set consistency. The quieter dungeon backgrounds replace
the repeated burning cavern city; class identities and animated pixel fallbacks
remain the same. Exact prompts and generation filenames are recorded in the
override entries. The tool did not expose an underlying model identifier.

Each current game export in `../../img/portraits/` is an opaque 512 × 512 WebP,
made with FFmpeg's Lanczos resampling and libwebp quality 85, without changing
composition or colour. Only these compressed files ship; originals, overrides
and production notes stay out of deployment through `.vercelignore`.

Export or verify all six classes and all three keepers from their active sources:

```sh
python3 art/portraits/export.py
python3 art/portraits/export.py --check
```

The faces use the existing portrait slots and mastery borders. Procedural
portraits remain as loading and missing-file fallbacks.

On 2026-10-18, the procedural fallback faces were redrawn in `js/heroart.js`
to depict the same six people as these paintings, including hair, skin tone,
facial hair and class equipment. At that stage the paintings stayed unchanged.
The paintings were subsequently refreshed as described above, preserving those
identities. The related animated bestiary alignment is in `art/identity.json`.

## Approved refinement — 19 October 2026

The current portraits are the user-approved six-class refinement in `refined/`.
`approved-sheet.png` preserves the exact generated preview, including labels.
The six square source crops exclude labels and gutters; their coordinates are
recorded in the active override entries in `generation.json`. The existing
exporter resamples these 474-pixel crops to the game's 512-pixel slots. This
is resampling, not additional generated detail.

The preview was iteratively edited with `image_gen.imagegen` using the prior
six-class sheets as references. The final reference was
`exec-ec169f31-49c9-4cf1-9c98-bb8a6d4db88b.png`; final output was
`exec-7f5bace9-8194-42df-9773-2df76c7bb481.png`. Direction: preserve all six
identities and mature dark-fantasy tone; simplify fabric, clasps and druid
foliage; distinguish expressions; reduce orange lighting and background detail;
keep natural faces and physically coherent equipment readable on a phone.
This paragraph summarizes the direction, rather than quoting the full prompt.
The tool did not expose a model identifier. The user approved this final preview
for application and a push to main. Earlier source images remain preserved.
