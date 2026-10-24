# Dungeon artwork and atlas roadmap — Batches E–Q

Prepared 23 October 2026; extended 24 October 2026 after the E–K source/review
publications. E–K artwork is generated and reviewed, with source/review assets
published to main. Runtime integration remains pending. L–Q are proposed future
art batches; no artwork or runtime changes for those batches are complete.
See the completion table below for published review evidence.

## Baseline and scope

The runtime supports 53 painted creature identities: the original thirteen and
Batches A–D. Do not regenerate those approved atlases. See
[ATLAS-BRIEFS.md](ATLAS-BRIEFS.md) for their briefs and inventory.
Local integration does not establish publication; retain each batch's review and
release status separately.

E–K cover remaining dungeon characters, combat variants, traders and encounter
props. L–N extend the painted style to ordinary room dressing, regional details
and remains. O–Q cover separate systems: dungeon surfaces, equipment and effects.
Those need their own briefs and format audits; they are not missing creature
atlases. Existing title art, portraits and relic illustrations already have
separate coverage and are not scheduled for wholesale replacement.

Keep the shared art direction: gritty hand-painted dungeon realism, weathered
materials, muted colours and directional shading matching approved monsters and
revised traders. Avoid cartoon faces, toy-like finishes and inconsistent lighting.

## Production order

| Priority | Batch | Deliverables | Proposed sheets |
|---|---|---|---|
| 1 | E | Six class-specific fallen Shades | 6 nine-pose atlases |
| 2 | F | Six companion identities, including command/rest poses | 6 nine-pose atlases, plus supported-pose extensions if necessary |
| 3 | G | Revealed barrel/default Mimic | 1 nine-pose atlas |
| 4 | H | Boss phase and equipment coverage | 4 proposed new atlases plus existing-atlas reuse audits |
| 5 | I | Three traders | 1 static sheet with 3 figures |
| 6 | J | Remaining encounter characters and scenes | 4 generated source groups plus companion rest-cell reuse |
| Optional | K | Remaining encounter objects and scenery | 7 generated source groups, including existing bone heap |
| Next art priority | L | Ordinary room dressing | Static object sheets; exact packing after audit |
| High | M | Regional dressing details | 5 existing regional identities; reuse where possible |
| High | N | Creature remains | 4 existing remains keys; reuse/composition audit first |
| High visual impact | O | Dungeon surfaces and architecture | Seamless texture/renderer format audit first |
| Medium | P | Equipment consistency and gaps | Item-icon and held-view audit before generation |
| Later | Q | Spell, environmental and trap effects | Effect/timing/format audit before generation |

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

Use the legacy barrel drawer in `js/creatures.js` as the structural reference.
The active `alignCreature` override currently draws a chest-shaped fallback even
for barrel/default forms; preserve active/legacy reference captures and do not
claim the new barrel art is already runtime-bound.
Match the painted chest Mimic's materials and rendering style without turning the
barrel into a chest. Audit default/missing disguise values before binding.
Concealed forms retain their actual chest/barrel scenery. Submerged Drowned
remain ripples; neither is a missing combat pose.

## Batch H — boss variants

Art/review completed locally: four nine-cell atlases, with reused Lich casting
and standing phase-2 Warlord cells. See [review](batch-h-preview/REVIEW.md) and
[state audit](batch-h-preview/STATE-AUDIT.md). Source/review publication complete; runtime integration pending.
Standing phase-1 spear attacks require H4; phase 2 drops ranged equipment because
phase records replace the current overrides rather than accumulating them.


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

Generated and reviewed locally: one three-figure source, three static exports and
one combined atlas. The selected style revision matches the existing monster
paintings; the rejected cartoon draft is retained. See [Batch I review](batch-i-preview/REVIEW.md).
Source/review publication complete; runtime integration pending. No new action poses or shop changes.


One proposed static figure sheet: `merchant`, `wick`, `pedlar` from `js/folk.js`.
Preserve each current silhouette, clothes and trade equipment. These are static
NPCs: use one approved figure per identity, not nine invented fighting poses.
Keep shop interaction, collision, positioning and facing behavior unchanged.

## Batch J — encounter figures and composed scenes

Generated/reviewed locally: 14 new static scenes in four source groups, with three
Batch F rest-cell reuses for J3. See [Batch J review](batch-j-preview/REVIEW.md).
All 18 encounter IDs using these 17 keys retain their mappings, including shared
Wisp. Source/review publication complete; runtime integration pending.


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

Batch K art/review completed locally for the 24 listed keys plus the existing
`bone_heap` prop omitted from this table. J's 17 + K's 25 cover all 42 current
PROPS keys. The heap has combat/corpse/end-card uses; see
[review](batch-k-preview/REVIEW.md) and [state audit](batch-k-preview/STATE-AUDIT.md).
Source/review publication complete; runtime integration pending.


This closes the remaining `PROPS` inventory, not all textures/items in the game.
The existing procedural pictures are valid; prioritize only after characters.

| Sheet | Existing prop keys |
|---|---|
| K1: sacred and magical | `spider_altar`, `heartwell`, `shrine`, `runestone`, `mirror`, `statue`, `idol`, `heart_dais` |
| K2: containers and mechanisms | `strongbox`, `lever_door`, `well`, `bookcase`, `chest`, `barricade`, `dwarf_forge`, `anvil` |
| K3: organic and floor scenes | `wyrmegg`, `egg_clutch`, `rubble`, `fungus`, `silk_larder`, `bones`, `pool`, `cookpot` |
| K3c: existing collapsed bones | `bone_heap` (also used by corpse/end-card paths) |

`lampfolk_dark` is already J1. Do not commission unsupported objects. Preserve
actual pool colors, transparent openings and rule-bearing object identity.
Painted replacements must not change obstacles, interactions, counts or placement.

## Delivery priority — integrate E–K

Prioritize runtime integration of the published E–K art so players can see it in
normal play. This is a separate delivery track from new painting. Preserve
per-state and per-key procedural fallbacks, lazy loading, offline caching,
lighting, warnings and native phone performance. Integration is not completed by
publishing source sheets or substituting pictures in a review harness.

For the next **art** batch, start with L. Follow with M/N for visual consistency;
O has high visual impact but requires more renderer work. P/Q follow their audits.
The sections below define proposed scope, not authorization to regenerate
approved artwork or claims that runtime integration has been done.

## Batch L — ordinary room dressing

Paint the static, non-interactive dressing in `js/dressing.js`:
`barrel`, `oilcask`, `anvil`, `chest`, `crate`, `shackles`, `bones`, `rubble`,
`candles`, `mushrooms`, `urn`.

These render through the `dress_*` namespace and are separate from K's encounter
props, even where names match. Keep ordinary chests distinct from wired encounter
chests and Mimics. Audit reuse of K/J artwork only when identity, silhouette,
footprint and framing match; do not substitute a whole encounter composition for
an ordinary object. Preserve existing dressing sizes, floor anchors, placement,
non-blocking behaviour and Mimic concealment scenery. Proposed output: static
object sheets with authored crops/anchors; determine packing after the audit.

`flames`, `ripple` and `snare` belong to Q's effect audit. The four `remains_*`
keys belong to N; avoid generating them twice in L.

## Batch M — regional dressing details

Cover the five current `js/regionalprops.js` identities:
`crypt_lid`, `iron_scrap`, `roots`, `reed_bundle`, `elf_shards`.

Match each area's materials and the approved painted style. Preserve the saved
dressing kind, footprint, height, regional selection and non-blocking behaviour;
the regional system changes the picture, not the rules. Reuse compatible L/K
materials and compositions before commissioning distinct static cells. Do not
invent extra regional objects merely to fill a sheet.

## Batch N — creature remains

Audit and paint `remains_bones`, `remains_staves`, `remains_shards`, `remains_husk`
from `js/dressing.js`, matching the creatures/materials they actually represent.

Keep these low on the floor and readable as aftermath. They are distinct from
L's decorative `bones`, K's seated gambler `bones`, and K's violet-eyed
`bone_heap` used by collapsed Skeletons. Reuse only where anatomy, colour and
state match; do not add violet eyes to ordinary remains. Preserve corpse/remains
selection, timing, footprint, floor occlusion and loot readability. No new death
behaviour or standing silhouettes are introduced by the artwork.

## Batch O — dungeon surfaces and architecture

Audit existing theme coverage, texture generation in `js/assets.js`, regional
architecture and sampling in `js/renderer.js`. Prioritize seamless wall, floor
and ceiling sets, followed by existing doors, arches, stairs and structural
details that visibly need a matching pass.

This is a separate texture/architecture system, not a 256px sprite-sheet batch.
Confirm tile dimensions, repeats, texel density, perspective, cached darkness
levels and renderer constraints before commissioning assets. Preserve door/lock
colours, openings, stairs, collision and navigation cues; do not paint new routes
or bake misleading directional light into seamless surfaces. Review tiling seams,
near/far views, multiple themes, native offline reload and isolated frame-rate
checks before integration. Determine the sheet budget only after this audit.

## Batch P — equipment consistency and gap pass

Audit ordinary item art in `js/itemart.js` and first-person equipment in
`js/heldart.js` / `js/heldview.js` against the painted monster/prop style.
Commission demonstrated gaps or inconsistent pieces; do not repaint the entire
existing equipment library or already covered relic illustrations.

Keep inventory icons and held views as separate deliverables. Preserve item
identity, named markings, handedness, grip attachment, weapon geometry, attack
and recovery timings, occlusion by hands/shields, Calm view and small-screen
clearance. Existing bows, projectiles, staffs and spears need their supported
motions audited before any pose sheets are specified. Counts and formats remain
TBD until the gap audit is complete.

## Batch Q — spell, environmental and trap effects

Audit `js/spellfx.js`, renderer/combat effect callers and dressing `flames`,
`ripple`, `snare`. Prioritize existing spell impacts, fire, frost, poison and trap
visuals that need a consistent pass; preserve each effect's current meaning.

Effects may require animated frames, masks or procedural rendering rather than
static paintings. Set formats after checking trigger, lifetime, alpha blending,
lighting, layering and warning/release timing. Keep danger cues readable with
colour-blind palettes, Calm/reduced-motion settings and phone HUD/held gear.
Do not add damage, range, persistent obstacles or light sources through an art
replacement. Review frame-rate and memory cost; retain a procedural fallback
when an image-based effect would be less clear or more expensive.

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

| Batch | Source/review publication | Review evidence |
|---|---|---|
| E | `b7960b5` | [Class Shades](batch-e-preview/REVIEW.md) |
| F | `5ca1779` | [Companions and Mender heal](batch-f-preview/REVIEW.md) |
| G | `c9ac72e` | [Barrel Mimic](batch-g-preview/REVIEW.md) |
| H | `e498369` | [Boss variants](batch-h-preview/REVIEW.md) |
| I | `0aec3a1` | [Revised static traders](batch-i-preview/REVIEW.md) |
| J | `d3307ce` | [Encounter compositions](batch-j-preview/REVIEW.md) |
| K | `025702c` | [Remaining props and bone heap](batch-k-preview/REVIEW.md) |
| L–Q | Proposed only; not generated or integrated | Scope and audits above |

E–K still require runtime integration and full runtime validation. Their published
source/review assets are not evidence of live bindings, failure fallback or offline
readiness. Track art production and runtime delivery separately; keep links to
briefs, originals/repairs, visual reviews, integration checks and publication
commits as each stage is actually completed.
