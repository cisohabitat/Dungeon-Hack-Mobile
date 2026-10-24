# Batch M regional dressing review — 24 October 2026

Five static regional paintings are complete, matching Batch L and the
approved monsters' gritty material treatment. Two generated sources produce five
256px WebPs, a four-cell 512px atlas and a single-cell 256px atlas. This publication contains source/review assets; gameplay integration remains pending.

Generated with `image_gen.imagegen` (model not disclosed). Exact prompts, active
procedural references, painted style reference, generated original paths, native
sizes, authored crops and anchors are in [the manifest](../generation-batch-m.json).
Originals remain preserved. No painted repair, recolouring or parts assembly was
needed; the exporter performs raster extraction, uniform fitting and registration.

## Visual findings

[Contact sheet](contact-sheet.png) shows a low cracked coffin lid, discarded gear
and eye-ended bar, broken root crown, bound reeds and three dark elven shards.
The lid remains flat rather than an upright gravestone or open coffin. Rusted iron
is distinct from stone, roots retain three leaves and complete tips, reeds have
seven visible stalks and a low binding, and shards remain opaque purple-grey
material with lavender edge reflections rather than glowing magic crystals.
No additional creatures, treasure, machinery or floor slabs were introduced.

Both originals, five active references/two reference groups, all five exports,
two atlases and contact sheet were reviewed for identity, complete silhouettes
and alpha gaps. [Caller/reuse audit](STATE-AUDIT.md) records why no whole L/K cell
fits these five identities.

## Registration and phone views

Both source images are natively 1254×1254. Authored crop rectangles extend into
empty gutters to retain complete lid/root tips; they do not include adjacent
objects. Whole-composition bases end visible alpha at row236 with >=12px margins.
Maximum export heights are lid 104, iron 112, roots 158, reeds 184 and shards 150px;
low scenery is not normalized as a standing creature. Measurements record source
and export hashes, crop bounds, scales, offsets and anchors. Export reproduction
passes byte for byte.

[390px overview](dungeon/390-overview.png) and
[320px overview](dungeon/320-overview.png) show all 44 near/far captures across
eleven existing regional theme mappings. Both overviews and a full-size view per
identity were inspected. Colour/material cues and low silhouettes remain readable
nearby; small floor details deliberately become small at distance. Assertions
verify the actual regional image selection before substitution, saved-kind scale,
position offsets, unchanged dressing record and floor draw/visibility flags.

All thirteen themes × rubble/mushrooms mappings, fell bypass and three selector
precedence cases pass at both widths; the actual fallen render selection is also
checked before every capture. No page/console errors were recorded. See
[metrics](dungeon/review.json).

Review forces theme indices on one fixed corridor and freezes render frames.
Some forced combinations are absent from a theme's ordinary props list; captures
are not evidence of generator placement or region progression. Black-wash levels
are review lighting only. No runtime loader, offline cache, save, collision,
interaction or world-light changes were made. Runtime/fallback, native regional
floors and performance must be validated separately during integration.

## Reproduction

- `node art/creatures/reference-batch-m.cjs`
- `python3 art/creatures/export-batch-m.py --check`
- `node art/creatures/preview-batch-m.cjs`
- `npm run check:art`
- `npm run check:agents`

Balance simulations are unnecessary for these source/review-only assets; no
gameplay changes were made. Publication checks remain separate.
