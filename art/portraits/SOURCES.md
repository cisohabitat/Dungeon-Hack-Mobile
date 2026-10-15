# Deepdelve class portrait sources

Six original portraits generated on 2026-10-15 with OpenAI's `image_gen.imagegen` tool. The tool did not expose an underlying model identifier. These are AI-generated illustrations, not photographs or commissioned human paintings.

Terms: [OpenAI Terms of Use](https://openai.com/policies/terms-of-use/), including the Content section covering generated output.

The game's existing `../keyart/portrait.png` supplied the world, colour palette and lighting reference. The fighter was generated first; the other five use both the title artwork and fighter as references for a consistent set. The rogue archetype is exported as `thief.webp` for the game's Thief class. Each character has distinct class equipment and a clear face. `generation.json` preserves the exact prompts, reference paths and original generation filenames.

Original generated PNGs are preserved here without editing. Each game export in `../../img/portraits/` is a 512 × 512 WebP, made with FFmpeg's Lanczos resampling and libwebp quality 85, with no change to composition or colour. Both original and exported images are opaque squares. The six exports together are about 450 KiB; only those compressed files ship to players. The originals and production notes stay out of the deployment through `.vercelignore`.

Export recipe, for each class:

```sh
ffmpeg -hide_banner -loglevel error -y -i art/portraits/fighter.png -vf scale=512:512:flags=lanczos -c:v libwebp -quality 85 img/portraits/fighter.webp
```

The faces use the existing portrait slots and mastery borders. The procedural portraits remain as loading and missing-file fallbacks; creature and dungeon art are unchanged.
