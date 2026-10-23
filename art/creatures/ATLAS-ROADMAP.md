# Dungeon atlas roadmap after Batch D

Prepared 23 October 2026 from the checked-out `main` source and Batch C/D reviews.
This is a production plan, not a record of generated or approved artwork.
Batch E sources and review atlases are generated, repaired and visually reviewed;
runtime integration remains pending (review assets published as `b7960b5`).
Batch F sources, repairs, review atlases and Mender heal extension are complete;
see [Batch F review](batch-f-preview/REVIEW.md). Batches G–K remain planned.
See [Batch E review](batch-e-preview/REVIEW.md). Batch letters E–K are assigned here.

## Baseline and scope

The runtime supports 53 painted creature identities: the original thirteen and
Batches A–D. Do not regenerate those approved atlases. See
[ATLAS-BRIEFS.md](ATLAS-BRIEFS.md) for their briefs and inventory.
Local integration does not establish publication; retain each batch's review and
release status separately.

This roadmap covers remaining dungeon characters, alternate combat forms, traders
and encounter figures, followed by an optional static scenery pass. It does not
propose replacement title art, portraits, relic illustrations, held-item art or
wall/floor textures. Those are separate art systems, not missing creature atlases.

## Production order

| Priority | Batch | Deliverables | Proposed sheets |
|---|---|---|---|
| 1 | E | Six class-specific fallen Shades | 6 nine-pose atlases |
| 2 | F | Six companion identities, including command/rest poses | 6 nine-pose atlases, plus supported-pose extensions if necessary |
| 3 | G | Revealed barrel/default Mimic | 1 nine-pose atlas |
| 4 | H | Boss phase and equipment coverage | 4 proposed new atlases plus existing-atlas reuse audits |
| 5 | I | Three traders | 1 static sheet with 3 figures |
| 6 | J | Remaining encounter characters and scenes | 3 proposed static sheets |
| Optional | K | Remaining encounter objects and scenery | 3 proposed static sheets |

E–H budget: **17 proposed new character atlases**. Boss reuse findings can change
that count; companion extension sheets are not included. I–K use a new static-sheet
pipeline, not the existing fixed nine-pose loader. These are production groupings,
not a requirement to download an entire batch together.

## Batch E — class-specific Shades

Start with **Spellblade Shade**. Then finish the five ordinary non-fighter classes.
Use the existing Shade body, current class portrait and `SHADE_GEAR` in
`js/champions.js` together as references. Preserve current equipment rather than
inventing a new class loadout. Proposed export names:

| Order | Atlas | Identity to preserve |
|---|---|---|
| E1 | `shade_spellblade` | Wayfarer hood/mantle, silver lantern with connected carry grip, current blade and spectral lower body |
| E2 | `shade_thief` | Cold blue hood and cloak, existing Shade equipment |
| E3 | `shade_mage` | Cold blue-violet robe, staff with pale focus, existing attack kit |
| E4 | `shade_cleric` | Pale tabard, restrained sun emblem, existing equipment |
| E5 | `shade_ranger` | Muted green hood/cloak, bow and quiver, existing attack kit |
| E6 | `shade_druid` | Leaf mantle and brow, leaf-tipped staff, no invented antlers |

Use transparent 3×3 sources and registered 768×768 exports with 256px cells.
Shades float: measure torso anchors rather than aligning mist to a foot baseline.
The nine-cell convention remains idle, step A, step B, windup, strike, recover,
special reserve, hurt and blink. Step cells are reserve drift studies: current
Shades have no walking pose objects. Do not add movement, casting, lantern powers
or class abilities to make the cells usable.

Bind each class through `shade.elite.shade_<class>` and its supported pose objects.
Replace the blanket non-fighter procedural guard only for an exact supported,
reviewed class binding. Keep fallback correct before deferred gear preparation
finishes and when an individual atlas fails. Fighter keeps the Batch D atlas.

## Batch F — companions

These are separate identities from enemies, even where their names overlap.
Reference `img/companions/`, `js/companionbook.js`, `js/folk.js` and the actual
pose selection in `js/companion.js`.

| Order | Atlas / runtime sprite | Identity and extra pose requirements |
|---|---|---|
| F1 | `dog` | Scruffy brown companion Hound, frayed red collar; sitting command pose |
| F2 | `wolf` | Lean grey wolf, amber eyes; lying/rest command pose |
| F3 | `scrag` | Freed goblin companion; squatting command pose, current tools/weapon |
| F4 | `sellsword` | Scarred mercenary, kettle hat, blue-grey brigandine, red sash; sword planted for rest |
| F5 | `mender` | Grey-green hood, herbs, bandages and ash staff; kneeling rest and healing poses |
| F6 | `renegade` | Amber-eyed dark elf, weathered leather, grey-green cloak and two blades; lowered-blade rest |

Audit actual idle, steps, windup, reactions, blink and command/rest/heal objects
before writing briefs. Use the ninth/special cell for a supported rest pose only
with an explicit mapping; add a small extension sheet if all required poses do
not fit. Mender must retain both rest and healing. Do not drop supported actions
to force nine cells. The existing loader currently names that cell `special`.

Companion Hound (`dog`) must never use hostile Blink Hound (`hound`) art. Renegade
must never borrow the ordinary Dark Elf Warrior identity. Preserve existing
companion scale, movement, command rules, progression and healing timing.
Recruitment props currently reuse some procedural rest figures; share approved
painted rest cells where the encounter composition allows it.

## Batch G — barrel Mimic

| Atlas | Scope |
|---|---|
| `mimic_barrel` | Revealed barrel/default form: continuous staves and hoops, attached jaws/tongue, frontal attacks and distinct steps |

Use the current barrel creature in `js/creatures.js` as the structural reference;
match the painted chest Mimic's materials and rendering style without turning the
barrel into a chest. Audit default/missing disguise values before binding.
Concealed forms retain their actual chest/barrel scenery. Submerged Drowned
remain ripples; neither is a missing combat pose.

## Batch H — boss variants

Phase indices are 0, 1 and 2. Existing painted boss atlases cover phase 0 only;
`js/motion.js` currently retains procedural art for every later phase, throne
state and Warlord shot windup. A gameplay phase does not automatically require
a whole new body atlas.

| Order | Proposed work | Decision and visual requirements |
|---|---|---|
| H1 | `heartforged_open` | Phase 1: open chest furnace, continuous iron anatomy and connected hammer; spawned Emberlings stay separate |
| H2 | `heartforged_whitehot` | Phase 2: white-hot iron, retained silhouette and readable warnings; preserve existing light/fog rules |
| H3 | `warlord_throne` | Seated throne form with held spear; no walking action; shield-bearers remain separate creatures |
| H4 | `warlord_spear` | Spear windup/release/recovery coverage wherever a shot state is reachable; do not show the cleaver performing a spear throw |
| H5 | Lich phase 1/2 reuse audit | Check whether the existing cold-blue body and casting cells cover the live poses. Reuse where correct; commission a rite/casting extension only for a demonstrated gap |
| H6 | Warlord standing phase 1/2 reuse audit | Reuse current cleaver/drum body for standing combat where correct, including after leaving the throne. Add frenzy poses only if existing supported draws need distinct art |

Audit reachability before deciding whether H3/H4 can share a sheet. Inspect both
phase-1 outcomes: shield-bearers present and no valid bearer spawn. Include direct
phase skips, throne exit, phase 2, ranged warnings and interrupted attacks.
Lich teleport, guards, extinguished torches and Heart rite remain existing effects
and rules; do not bake those scenes into a body atlas. No new phase costumes are
required merely to fill a batch. Keep procedural guards until each state has an
exact mapping, and retain per-state fallbacks afterwards.

## Batch I — traders

One proposed static figure sheet: `merchant`, `wick`, `pedlar` from `js/folk.js`.
Preserve each current silhouette, clothes and trade equipment. These are static
NPCs: use one approved figure per identity, not nine invented fighting poses.
Keep shop interaction, collision, positioning and facing behavior unchanged.

## Batch J — encounter figures and composed scenes

Inventory below follows every character-bearing entry in `js/props.js` not already
covered by traders or companions. Proposed sheet groups:

| Sheet | Existing prop keys |
|---|---|
| J1: spirits and people | `forge_spirit`, `lastdelver`, `wisp`, `prisoner`, `duelist_ghost`, `lampfolk_dark`, `kept_smith`, `mapmaker` |
| J2: creature scenes | `goblin_hurt`, `mule`, `ogre_sleep`, `goblin_toll`, `stray`, `cage` |
| J3: recruitment compositions, if needed | `hireling`, `exile`, `stray_healer` |

First check reuse: J3 already delegates to companion sitting figures; `stray` and
`cage` may share companion artwork but still need scene framing and props.
Sleeping Ogre and goblin scenes should preserve the approved species identities.
A shared `wisp` asset serves multiple encounters; do not invent separate creatures
for encounter titles. Preserve hidden outcomes and existing encounter state.
Static sheets use authored crop rectangles and anchors, with no invented animation.

## Optional Batch K — encounter objects and scenery

This closes the remaining `PROPS` inventory, not all textures/items in the game.
The existing procedural pictures are valid; prioritize only after characters.

| Sheet | Existing prop keys |
|---|---|
| K1: sacred and magical | `spider_altar`, `heartwell`, `shrine`, `runestone`, `mirror`, `statue`, `idol`, `heart_dais` |
| K2: containers and mechanisms | `strongbox`, `lever_door`, `well`, `bookcase`, `chest`, `barricade`, `dwarf_forge`, `anvil` |
| K3: organic and floor scenes | `wyrmegg`, `egg_clutch`, `rubble`, `fungus`, `silk_larder`, `bones`, `pool`, `cookpot` |

`lampfolk_dark` is already J1. Do not commission unsupported objects. Preserve
actual pool colors, transparent openings and rule-bearing object identity.
Painted replacements must not change obstacles, interactions, counts or placement.

## Acceptance gate for every batch

1. Write exact per-identity briefs and live-pose/state mappings before generation.
2. Preserve original PNGs, tool prompts, references and every repair in a generation
   manifest. Use the image tool for character changes; do not claim approval from
   extraction scripts or automated checks alone.
3. Review all source cells and final exports: frontal identity, connected anatomy
   and grips, alternate leads, consistent palette, alpha and uncut equipment.
   Grounded figures use the established row-236 baseline and 12px clearance;
   floating figures need measured torso registration. Static scenes need authored
   anchors and crop bounds rather than creature foot rules.
4. Produce neutral/action comparisons and actual runtime previews at 390px/320px.
   Preview supported actions and transition boundaries, lighting, occlusion and
   attack warnings. Bind only supported poses and retain Calm/reduced-motion rules.
5. Extend lazy loading and offline coverage with independent failure fallback,
   cached shading and no per-frame painting. Static sheets require their own
   crop-aware integration; do not feed them into the fixed 768px creature loader.
6. Record visual review, reproducible exports and hashes. Run applicable art,
   rules/browser, native offline and isolated performance checks. Require the
   repository's full release checks, including CI WebKit, before publication.
   Balance simulations are needed only if implementation changes gameplay.

## Completion tracking

Batch E has completed generation, repair and source/export review, with review-only
dungeon captures. Integration, full validation and publication remain pending.
Batch F has completed source/export review and 86 review-only companion captures;
integration, full runtime validation and publication remain pending.
Batches G–K are not generated. Track each deliverable through:
**briefed → generated → repaired → visually reviewed → integrated locally →
validated → published**. Keep each stage separate, record evidence links and
update this roadmap and the canonical atlas brief library as work progresses.
