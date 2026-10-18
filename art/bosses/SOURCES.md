# Deepdelve boss portrait sources

Three original AI-generated illustrations made on 2026-10-15 with OpenAI's `image_gen.imagegen` tool. The tool did not disclose an underlying model identifier. Terms: [OpenAI Terms of Use](https://openai.com/policies/terms-of-use/), including its Content section covering generated output.

The Dread Lich was previewed first using the title artwork (`../../img/keyart-portrait.webp`) and Mage portrait (`../../img/portraits/mage.webp`) as references. The Goblin Warlord and Heartforged use the title artwork and that Lich preview as references. Each follows the existing descriptions in `MONSTERS` and `BESTIARY`: the undead keeper, a great goblin wearing hammered gold, and the old smiths' iron furnace guardian. `generation.json` records source filenames, reference images and a summary of each generation brief.

The unedited 15 October PNGs remain here as provenance. The current three
paintings are the 18 October refreshes in `overrides/`, selected by
`generation.json`. These keepers are bestiary creatures, so their current
compositions and brushwork follow the existing bestiary directly: Dark Acolyte,
Goblin King, Forge-Thane and the fourth creature sheet. Their earlier appearances
supply identity only. Hero portraits are not style references for this set.

The Lich has its complete crown, a connected skeletal casting hand and violet
magic in a crypt; the Warlord has a war-drum and held beater in his plundered
hall; the Heartforged has its furnace, both iron arms and a continuous held
hammer in the old forge. The wider upper-body compositions show identifying
anatomy, gear and habitat like the other bestiary entries. Exact prompts,
reference paths and generation filenames are preserved. The previous portrait
pass is recorded under `supersededRefreshes`; only `overrides` selects exports.

Only the 512 × 512 WebP exports in `../../img/bosses/` ship; `art/` is excluded
by `.vercelignore`. The shared exporter selects the active overrides and uses
FFmpeg Lanczos and libwebp quality 85, without composition or colour changes:

```sh
python3 art/portraits/export.py
python3 art/portraits/export.py --check
```

The portraits appear at the first introduction and in bestiary entries after the boss has been met. The original procedural sprites remain in the dungeon and serve as missing-file fallbacks.
