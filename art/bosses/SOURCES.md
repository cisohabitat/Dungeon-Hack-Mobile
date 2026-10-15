# Deepdelve boss portrait sources

Three original AI-generated illustrations made on 2026-10-15 with OpenAI's `image_gen.imagegen` tool. The tool did not disclose an underlying model identifier. Terms: [OpenAI Terms of Use](https://openai.com/policies/terms-of-use/), including its Content section covering generated output.

The Dread Lich was previewed first using the title artwork (`../../img/keyart-portrait.webp`) and Mage portrait (`../../img/portraits/mage.webp`) as references. The Goblin Warlord and Heartforged use the title artwork and that Lich preview as references. Each follows the existing descriptions in `MONSTERS` and `BESTIARY`: the undead keeper, a great goblin wearing hammered gold, and the old smiths' iron furnace guardian. `generation.json` records source filenames, reference images and a summary of each generation brief.

The unedited original PNG outputs are preserved here. Only the 512 × 512 WebP exports in `../../img/bosses/` ship to players; `art/` is excluded by `.vercelignore`. Exports use the same recipe as the six class portraits, without composition or colour changes:

```sh
ffmpeg -hide_banner -loglevel error -y -i art/bosses/lich.png -vf scale=512:512:flags=lanczos -c:v libwebp -quality 85 img/bosses/lich.webp
```

The portraits appear at the first introduction and in bestiary entries after the boss has been met. The original procedural sprites remain in the dungeon and serve as missing-file fallbacks.
