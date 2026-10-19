# Relic portrait sources

The four approved preview sheets were generated with OpenAI image_gen.imagegen
for this conversation. The tool did not expose a model identifier.
Terms: https://openai.com/policies/terms-of-use/

The user approved all 47 named relics before asking to push to main. Prompts
specified a three-column, four-row painted object catalogue, dark backgrounds,
ivory labels, tactile aged materials, restrained magic and connected weapon
construction. Each object was described using its name, base type and full lore
from js/relics.js and js/mythicdata.js. Sheet 4 contains the twelve legends;
sheet 3 ends with a decorative crest, which is not exported as an item.

The original sheets are preserved. generation.json records the crop for every
identity. Run `python3 art/relics/export.py` to export 512-pixel WebPs and add
`--check` to reject stale exports. Crops omit captions; resizing preserves aspect
ratio and pads where necessary. Upsampling does not add generated detail.
