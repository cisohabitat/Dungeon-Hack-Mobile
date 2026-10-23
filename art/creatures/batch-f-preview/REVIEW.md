# Batch F companion art review — 23 October 2026

Six nine-pose companion atlases and one Mender healing extension, generated with
`image_gen.imagegen` (model not disclosed). Actual prompts, references, output
paths, selected sources and intermediates are in `../generation-batch-f.json`.
This is a source/export and dungeon-fitting review, not runtime integration.

## Identity and pose review

All original sheets, repairs, isolated replacements, selected 54 main export cells
and the healing extension were visually inspected.

- Hound (`dog`): scruffy brown coat, floppy ears, cream muzzle/chest, red collar
  and attached brass tag. This is distinct from hostile Blink Hound (`hound`).
- Wolf: grey coat, amber eyes, pricked ears, low tail and no collar. Its rest pose
  lies down with head up; the broad resting silhouette limits the common scale.
- Goblin (`scrag`): olive skin, brown hood, attached picks/keys and cuff-chain
  stubs, right-hand knife. Rest squats with feet and hands intact.
- Sellsword: kettle hat, scar, muted red sash and blue-grey brigandine/mail.
  One greatsword stays connected to two closed grips. Rest leans on its planted
  sword, standing rather than sitting on the ground.
- Mender: grey-green hood/robe, leaf embroidery, herb satchel and ash staff with
  tied herbs/bell. Rest kneels sorting bandages, staff beside knees. The extra
  standing heal cups both hands with a restrained green light and retains the
  staff in the left-arm crook. The selected face is smoother than the portrait;
  clothing, equipment and hair remain recognisable. No change to healer rules.
- Renegade: ash-grey skin, amber eyes, silver hair, grey-green hood, brown leather
  and two curved blades. Rest stands with both blades down, separate from the
  ordinary enemy Dark Elf Warrior identity.

## Repairs and selection

The six originals repeated leading feet/paws and several crowded the source
edges. Full-sheet repairs add source margins. Hound/Wolf now lead with opposite
front paws. Mender's second correction opens the first eight pairs of eyes and
reverses stepB; the first repair closed all eyes and is explicitly rejected.
Sellsword's final full sheet gathers the corrected opposite step into a coherent
palette. Goblin and Renegade use separately generated/repaired stepB figures,
normalized to stepA source height, with weapons and handedness preserved. Their
isolated-step foreshortening/material shading differs slightly from adjacent
cells; full walking comparisons are retained for inspection.

Single-frame tool previews appeared to have studio backgrounds. Numeric alpha
inspection showed usable transparency; extraction retained the connected figure
and antialiased edge. They were not opaque-background failures. Intermediate
files use `draft` names; original tool outputs remain preserved. Selection is
based on final source/export identity, gait, palette and framing, not the preview
background appearance.

## Registration and layout

Main sheets: 768×768 WebP, nine transparent 256px cells. Row-major mapping is
idle, stepA, stepB, windup, strike, recover, **sit**, hurt, blink. Slot seven is
explicitly `sit`, not `special`. One shared scale across each selected main sheet,
measured horizontal body centres and visible ground baseline row 236 retain
natural standing/sitting heights. The Wolf rest anchor balances its full resting
body/tail; no change to runtime companion scale is proposed.

Mender's heal uses cell seven from a separate matching full sheet, exported as
`mender-heal.webp` (256×256). Measured crown-to-boot spans normalize that source
to the main body's scale before applying the same grounded baseline. Every main
cell and the extension pass clipping and at least 12px visible-alpha clearance.
Only extraction, alpha-island selection, scaling and registration happen in the
exporter; drawing and palette changes use the image tool.

## Actual companion pose selection, review-only pictures

`node art/creatures/preview-batch-f.cjs` captures **86** views: idle, both steps,
windup, rest, hurt and blink for six companions, plus Mender healing, at 390px and
320px. It sets existing companion state/timing to select each supported pose,
asserts the chosen procedural pose object, then substitutes the decoded review
cell only for the frozen dungeon draw. All captured companion scales remain
**0.62**, and neither width reports page/console errors. Both overview sheets
were visually inspected for fitting, rests and held-equipment clearance.

The companion selector uses windup during its lunge; strike/recover are review
reserve cells, not new runtime actions. Companions do not use enemy windup
warning markers. The harness does not prove runtime loader integration, offline
cache, Calm view, failure isolation, recruitment-prop reuse or saved-game behavior.
No gameplay, timing, command, progression, healing or save rules change.

## Reproduction and remaining work

- `python3 art/creatures/export-batch-f.py --check` reproduces six atlases, healing
  extension, measurements and neutral/walking/action/rest-heal comparisons.
- `node art/creatures/preview-batch-f.cjs` requires the locked Playwright dependency
  and system Chromium; `CHROMIUM_PATH` overrides `/usr/bin/chromium`.
- `npm run check:art` checks reviewed hashes, not anatomical quality.

No runtime files, `img/creatures/` exports, service-worker entries or release
numbers change. Later integration must support companion kind IDs and map the
custom sit slot and extra heal frame explicitly. Retain per-kind procedural
fallback and current companion scale; validate the real loader, commands,
lighting, Calm/reduced motion, native offline and performance before publication.
