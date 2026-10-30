# Dungeon artwork and atlas roadmap — Batches E–AJ

Prepared 23 October 2026; extended and integrated through 28 October 2026.

## Current delivery — release 0.9.52

For release 0.9.52, approved playable batches through AJ are integrated.
The common catalog delivers 1,552 files, including 810 held and 35 carried frames,
plus the original creature atlases and separate portrait libraries. The older
release/source-stage sections below are historical records, superseded by their
later activation reports. They do not describe today's remaining work.

The [coverage audit](../../docs/visual/2026-10-27-art-coverage/README.md) reconciles
all current encounter/dressing keys, item reserves, creature poses, thirteen
regional selections, source hashes and offline declarations. Its native loader
sweep covers 569 creature pose routes and all common world/equipment bindings.
That audit predates AI; its next proposals were
[AI/AJ](#remaining-procedural-object-conversions--27-october-2026). Both
implementations and their release gates are recorded at the end.

## Runtime delivery — release 0.9.34

Batch Y's three ordinary shield rear frames are now integrated through exact
class/raw-id matching, lazy per-image fallback and offline cache entries. The
common delivery inventory covers187 files (184 E–T plus3 Y). W/X audits and Y
source/review evidence accompany this release. See [Y native review](batch-y-runtime/REVIEW.md).
The reports below retain the original review-stage scope and exceptions.

### Previous delivery — release 0.9.33

E–T approved gameplay exports now bind to actual game systems and the offline
cache: 184 newly shipped files. U/V reuse audits are included; their existing
approved portraits and UI art remain in place. See the
[runtime inventory](runtime-delivery.json) and [integration review](runtime-preview/REVIEW.md).
This delivery supersedes the historical source-only statuses in the batch notes.

The painted stair arch remains excluded because its alpha mask differs from
live occlusion; the original exact mask stays. The Tooth Charm base painting is
an unused reserve: the seeded amulet look stays, including after identification.
Unused pose cells do not create actions. R/S baseline architecture/materials are
only for Grey Halls; other regions keep their authored architecture and overlays.
T remains three held families plus P Rune shields, with other kits procedural.
Regional repeat refinement and further held library painting remain separate
work, not missing runtime bindings for approved playable art. W/X audits are
complete locally; Y begins a specific held-library extension below.

## Baseline and scope

The original 53 painted monster identities from the first thirteen and Batches A–D
remain, with E–H class, companion and keeper-state variants now added. Do not regenerate those approved atlases. See
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
| Reviewed/published | L | Ordinary room dressing | 11 cells on two square atlases and one strip; runtime integrated; see delivery review |
| Reviewed/published | M | Regional dressing details | 5 cells in two source groups; runtime integrated; see delivery review |
| Reviewed/published | N | Creature remains | 4 low cells on one atlas; runtime integrated; see delivery review |
| Base pass reviewed/published | O | Dungeon surfaces and architecture | 13 base wall/floor/ceiling sets; architecture/variants remain procedural |
| Reviewed/published | P | Equipment consistency and gaps | 7 regional icons (1 reserve), 2 class Rune shield rear frames; runtime integrated; see delivery review |
| Reviewed/published | Q | Spell, environmental and trap effects | 3 static world cells and 8 impact frames; runtime integrated; see delivery review |

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

Source/review art through N and O’s base surface pass is published. P’s targeted equipment pass and Q’s effects pass are published as source/review assets. O architecture matching and secondary
variants require separate state-aware integration work.
The sections below define proposed scope, not authorization to regenerate
approved artwork or claims that runtime integration has been done.

## Batch L — ordinary room dressing

Eleven static room-dressing identities from `js/dressing.js`:
`barrel`, `oilcask`, `anvil`, `chest`, `crate`, `shackles`, `bones`, `rubble`,
`candles`, `mushrooms`, `urn`.

These render through the `dress_*` namespace and are separate from K's encounter
props, even where names match. Keep ordinary chests distinct from wired encounter
chests and Mimics. Audit reuse of K/J artwork only when identity, silhouette,
footprint and framing match; do not substitute a whole encounter composition for
an ordinary object. Preserve existing dressing sizes, floor anchors, placement,
existing interactions and Mimic concealment scenery. Five containers (barrel,
crate, urn, oilcask, chest) are already smashable/kickable; preserve their loot,
oil spill/burst and movement behaviour. Other decorative pieces remain as before.

Three newly generated sources, eleven 256px exports, two 512px atlases and one
768×256 strip are reviewed and published. Authored crops/anchors retain low floor
profiles and complete alpha margins. Sixty review-only phone captures check
ordinary dressing, concealed Mimics and locked puzzle chests at near/far distances.
See [Batch L review](batch-l-preview/REVIEW.md) and
[caller/reuse audit](batch-l-preview/STATE-AUDIT.md). No J/K scene directly fits
these identities. Runtime integration remains pending.

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

Five new paintings are reviewed and published: two sources, five 256px cells, one
512px atlas and one 256px atlas. Forty-four phone captures cover eleven regional
theme mappings, with saved-kind scale/offset checks and fallen-rubble bypass.
No whole-cell L/K reuse fits these silhouettes. See
[Batch M review](batch-m-preview/REVIEW.md) and
[mapping/reuse audit](batch-m-preview/STATE-AUDIT.md). Runtime integration remains pending.

## Batch N — creature remains

Audit and paint `remains_bones`, `remains_staves`, `remains_shards`, `remains_husk`
from `js/dressing.js`, matching the creatures/materials they actually represent.

Keep these low on the floor and readable as aftermath. They are distinct from
L's decorative `bones`, K's seated gambler `bones`, and K's violet-eyed
`bone_heap` used by collapsed Skeletons. Reuse only where anatomy, colour and
state match; do not add violet eyes to ordinary remains. Preserve corpse/remains
selection, timing, footprint, floor occlusion and loot readability. No new death
behaviour or standing silhouettes are introduced by the artwork.

Four paintings and one 512px atlas are reviewed and published, with 24 phone captures
and 56 real reveal/expiry selection checks. Two preserved full-sheet repairs
correct pottery count, low framing and decoration. No existing L/K/M full cell
fits the remains identities. See [Batch N review](batch-n-preview/REVIEW.md)
and [caller/timing audit](batch-n-preview/STATE-AUDIT.md). Runtime integration remains pending.

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
checks before integration.

The audit selected thirteen baseline material strips: one wall/floor/ceiling per
existing theme, producing 39 opaque native 64px tiles plus detail/repeat panels.
One marsh repeat repair, 52 controlled phone captures and exact eight-level
darkness-format checks are complete and published. See
[Batch O review](batch-o-preview/REVIEW.md) and
[format/architecture audit](batch-o-preview/FORMAT-AUDIT.md). Repeat diagnostics
and limits are documented; this is not a certification of mathematically periodic
textures. Existing architecture states and secondary surface kinds remain
procedural. State-aware material matching, native layouts/offline/fallback and
isolated frame-rate checks remain integration gates. Source/review assets are published; runtime integration remains pending.

## Batch P — equipment consistency and gap pass

Audit ordinary item art in `js/itemart.js` and first-person equipment in
`js/heldart.js` / `js/heldview.js` against the painted monster/prop style.
Commission demonstrated gaps or inconsistent pieces; do not repaint the entire
existing equipment library or already covered relic illustrations.

Keep inventory icons and held views as separate deliverables. Preserve item
identity, named markings, handedness, grip attachment, weapon geometry, attack
and recovery timings, occlusion by hands/shields, Calm view and small-screen
clearance. Existing bows, projectiles, staffs and spears need their supported
motions audited before any pose sheets are specified. Counts and formats are set by the gap audit.

The 95-item audit selected seven regional icon paintings (six direct base keys
and a reserve Tooth Charm fang), plus two separate Fighter/Cleric Rune-Cut Shield
rear frames for a demonstrated null-carried gap. Seeded amulet appearances and
named Hissra art remain unchanged; the runtime gap is not fixed by these sources.
Fifty-six phone captures, 36 held fitting checks and 12 baseline browser checks
pass locally. See [Batch P review](batch-p-preview/REVIEW.md) and
[identity/motion audit](batch-p-preview/STATE-AUDIT.md). Runtime integration remains pending.

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

Source/review pass complete locally: three static world cells and four phases each
for fire/frost. Calm, poison, lightning and triggered traps remain procedural.
88 frozen captures, 52 lifetime pixel checks and 14 baseline browser tests pass.
See [review](batch-q-preview/REVIEW.md) and [format audit](batch-q-preview/STATE-AUDIT.md).
Native integration, offline and performance gates remain pending.

## Remaining painting roadmap — Batches R–X

E–Q complete their selected source-art scope, not every possible art upgrade.
R–S continue the confirmed unfinished architecture/variant scope of O. T–X are
proposed coverage audits: their existence does not establish missing paintings
or authorize wholesale replacement of existing art. Determine actual keys,
reuse, states and formats before fixing asset counts or generating sources.
Keep the gritty painted monster style throughout. Runtime integration of E–Q
remains a separate delivery priority and does not require new paintings.

| Order | Batch | Scope | Status |
|---|---|---|---|
| 1 | R | Doors, locks, arches, recesses, stairs and pillars | Eight baseline cells published; arch geometry/regional matching and runtime integrated; see delivery review |
| 2 | S | Secondary floors, walls, ceilings, fountains, torches and structural details |20 baseline cells published; repeat joins/regional matching and runtime integrated; see delivery review |
| 3 | T | First-person weapons, shields, hands and class sleeves |16 baseline held frames published; remaining library procedural, runtime integrated; see delivery review |
| 4 | U | Hero/class portraits and character selection | Reuse audit complete locally: seven existing portraits, zero new paintings; audit publication pending |
| 5 | V | Inventory frames, journal, bestiary, shops and status icons | Proposed interface art audit; counts and formats unset |
| 6 | W | Title, loading, death and victory illustrations | Proposed screen audit; preserve approved existing title/other artwork |
| 7 | X | Additional projectiles, magical and environmental effects | Optional audit after Q integration; retain procedural rendering where clearer |

### Batch R — architecture and navigation forms

Recommended next painting batch. Audit plank/barred doors and their lock states,
arches, recess/back pieces, up/down stairs and pillars against O’s materials.
Preserve transparent openings, secret-wall equivalence, lock colours, stair
perspective, collision and navigation cues. Reuse existing geometry and details
where appropriate. Establish renderer sampling and state-specific crops before
commissioning matching material artwork; these are not creature pose atlases.

R baseline source pass: eight paintings selected after a 234-reference audit across
thirteen themes. Eight native browser tests and 68 frozen phone captures pass.
Five-colour lock variants and the exact procedural arch remain; the painted arch
mask differs by 26 native pixels. This is not thirteen completed regional kits.
See [R review](batch-r-preview/REVIEW.md) and [state audit](batch-r-preview/STATE-AUDIT.md).
Runtime integration and regional material matching remain pending.

### Batch S — secondary dungeon materials and details

Audit floor kinds room/path/mosaic/altar/water/rubble/straw; roofs rock/beams/roots/cave;
and wall kinds plain/rock/fallen plus alternate, damp and cracked variants.
The base room/plain surfaces may reuse O. Include wet/dry fountains, torch
frames/animation and wall decorations only where the material pass demonstrates
a mismatch. Preserve water/solid-ground meaning, transparent geometry, existing
light sources and interaction states. Check repeats, native texel density,
near/far views and cached darkness levels for each selected material family.

S baseline source pass reviewed locally:20 cells in six groups, one preserved
mosaic correction,84 frozen phone captures,144 shade-level checks and six native
regional browser tests.260 active references were audited across13 themes;69
existing decoration entries retain original bindings. This is not260 individually
painted variants. Repeat joins, regional matching, offline/fallback/performance
and runtime integration remain follow-ups; source/review assets are published. See
[S review](batch-s-preview/REVIEW.md) and [state audit](batch-s-preview/STATE-AUDIT.md).

### Batch T — first-person equipment and class presentation

P covered seven regional inventory paintings and two Rune shield rear frames;
it did not repaint the full held library. Audit existing weapons, shields, hands
and class sleeves for visible style gaps. Inventory icons and held views are
separate deliverables. Map actual rest, attack, recovery, ranged and casting
motions before specifying sheets. Preserve grip attachment, handedness, weapon
geometry, gear occlusion, Calm view and short-screen clearance. Reuse P’s shield
sources and existing item/relic art; do not duplicate them or invent new motions.

T baseline pass reviewed locally: nine Fighter longsword poses, four Mage staff
grip variants and three Ranger longbow bends.140 held guides audit18 base weapons
and fist/cast hands across seven palettes; not every pairing is equip-legal.
54 frozen captures,162 fitting/release cases and12 native browser tests pass.
Reuse P shield sources; other classes/weapons, named/reflected gear, standalone
hands and Wild Shape remain procedural. Runtime integration, transition review
and broader library coverage remain follow-ups. See [T review](batch-t-preview/REVIEW.md)
and [state audit](batch-t-preview/STATE-AUDIT.md).

### Batch U — hero portraits and character selection

Inventory existing hero/class portraits and selection-screen artwork first.
Compare faces, equipment, class identity and materials with approved monsters
and companions. Commission only absent or visibly inconsistent presentation.
Keep player portraits distinct from fallen Shades and named champions; reuse
approved portraits when framing and identity fit. No wholesale portrait repaint
is scheduled by this proposal.

U audit complete: retain all seven approved portraits; no missing or
inconsistent face requires a new painting.42 actual native UI captures/downloads
and32 existing portrait/unlock browser checks pass at 390/320px, including unlocked
seven-portrait offline reload. Existing portraits are integrated; audit evidence was published with release 0.9.33. See
[U review](batch-u-preview/REVIEW.md) and [inventory](batch-u-preview/inventory.json).

### Batch V — interface art consistency

Audit inventory frames, journal, bestiary, shop presentation and status icons in
the actual phone layouts. Reuse existing item pictures, portraits and relic
illustrations. Propose a coherent frame/icon treatment only for demonstrated
gaps. Preserve readable text, contrast, status meanings, touch targets, double
text scaling and safe palette cues. Choose scalable or raster formats by use;
do not bake interface labels into decorative artwork.

V audit complete: reuse the existing shared CSS frames, SVG controls,
compact item sprites and approved bestiary/relic paintings. No new painting or
runtime change is justified by the reviewed states. Native phone captures cover
390/320px at normal and double text size, with safe palette on the latter.
See [V review](batch-v-preview/REVIEW.md) and [inventory](batch-v-preview/inventory.json).
44 native captures and49 browser checks pass. Track the observed double-text
header density, tab wrapping and shop gold/Close crowding as CSS/layout follow-ups,
not painting gaps. Audit evidence is included with release 0.9.33; E–T runtime delivery is recorded above.

### Batch W — major screen illustrations

Audit existing title, loading, death and victory presentation before generation.
Reuse approved title/screen illustrations where suitable; commission only a
missing scene or a demonstrated style mismatch. Plan phone/desktop crops and
safe areas for controls and text. Avoid spoilers in loading art and preserve
screen purpose, class identity and existing gameplay outcomes.

W audit complete locally: retain the approved portrait/landscape key art,
prologue reuse and class portraits on death and all three ending screens.
58 native captures/downloads, eight galleries and seven browser checks support
reuse; no new major-scene painting is justified by the reviewed layouts.
See [W review](batch-w-preview/REVIEW.md) and [inventory](batch-w-preview/inventory.json).
Double-text title facts can overlap the logo/New Game area and need a layout
follow-up. Existing win-share keeper captions and generic Heart accents require
a separate content/state-selection follow-up. Audit evidence is included with release0.9.34.

### Batch X — optional additional effects

Review Q in normal play before selecting more painted effects. Audit existing
projectiles and magical/environmental visuals for a clear benefit from imagery.
No blanket effects repaint: Calm, poison/status, lightning, telegraphs and
triggered traps deliberately retain procedural rendering unless a later audit
justifies a specific replacement. Do not invent a poison-impact spell or add
lights, damage or obstacles through art. Define alpha, lifetime, layering,
warning readability, fallback and memory/frame-time budgets before generation.

Batch X audit completed locally: retain the integrated Q fire/frost families and
procedural travel, lightning, swarm, trap/status and warning effects. No new
atlas is commissioned. Native live-cast evidence at 390px/320px in normal and
Calm/safe views is recorded in [X review](batch-x-preview/REVIEW.md).
X made no runtime changes; its evidence is included with release0.9.34. The E–X art roadmap is now audited; remaining
work is specific delivery/presentation follow-up, not another automatic batch.
Keep W's double-text title overlap and share-card state/content issues open.

### Batch Y — ordinary shield rear views (T extension)

Three new source/review frames: Fighter ordinary shield, Cleric ordinary shield
and Thief buckler. These retain rear wood/iron construction, vertical grip,
connected left hand/forearm strap and current class palettes. Existing renderer
motions use one static frame per pair; no new poses/actions are added. Exact raw
id/class guards preserve named/off-class shields, foci and P Rune shield art.
See [Y review](batch-y-preview/REVIEW.md) and [brief](REQUEST-batch-y.md).
36 phone captures,108 fitting cases and12 existing browser checks pass. Source
spacing exception and native integration gates are recorded. Runtime integrated for0.9.34; see the native review above. This extends the remaining held-library gap identified in T;
the completed E–X audits did not certify every possible held item as painted.

## Remaining procedural-art conversion plan

Prioritise visible starting equipment, then the wider held library and regional
materials. These are separate production passes; a source review does not imply
runtime activation or publication. Keep the approved E–Y artwork and exact
class/item guards. Preserve unidentified looks, named identities, authored grips,
live strings/arrows, original geometry/masks, Calm and procedural failure fallback.

| Priority | Batch | Scope | Production gate |
|---|---|---|---|
| Complete | Z | Starting weapons | Activated for0.9.35 |
| Complete | AA | Ordinary held weapons, legal class pairs and Penitent | Activated through0.9.38; historical source notes below |
| Complete | AB | All remaining named weapon/shield candidates |397 states activated for0.9.39; all31 identities delivered including Penitent |
| Activated 0.9.40 | AC | Ordinary caster equipment: spellbook, two orbs, two symbols, reliquary, Wayfarer lantern |7 reviewed frames; [review](batch-ac-casters-preview/REVIEW.md); activation/native/offline gates remain |
| Activated 0.9.40 | AD | Seven missing ordinary shield backs: three bucklers, two tower shields, two Quill Shields | [Review](batch-ad-shields-preview/REVIEW.md); all12 legal ordinary pairs have source, five active and seven pending |
| Activated 0.9.40 | AE | Fists, casting and read/drink hands; Wild Shape bear claws | Exact supported class/action states and current timing |
| Activated 0.9.40 | AF | Small floor/Pack item sprites | Small-size legibility; preserve seeded/unidentified families and separate relic portraits |
| Activated 0.9.40 | AG | Regional doors, stairs, pillars and arch materials beyond Grey Halls | Preserve openings, occlusion, locks, perspective and navigation cues |
| Activated 0.9.40 | AH | Regional secondary materials and decorations, fountain/torch variants | Preserve terrain meaning, light sources, animation and cached shading |

These labels supersede the earlier prospective AB–AG assignments: AB became the
named-equipment pass, AC now covers ordinary caster equipment, and subsequent
painting batches shift through AH. Earlier dated source reports retain their
historical scope. Named caster equipment is already part of active AB; AC only
adds the seven ordinary exact class/id pairs.

Z corrects the earlier proposed follow-up order: the Thief starts with a
shortsword, Ranger with a shortbow and Druid with a spear. Dagger and Druid staff
remain later legal-kit candidates. The Cleric starts with a mace. See
[Z brief](REQUEST-batch-z.md) for pose, palette and source-review constraints.

Z source review is complete with preserved originals/repairs and authored
registration. See [Z review](batch-z-preview/REVIEW.md). Selected source-spacing
exceptions are documented; all registered silhouettes have>=12px clearance.
The source proxy does not establish runtime delivery, native transitions or offline
readiness. AA and AB are now activated through0.9.39. AC–AH have local source art; AG/AH regional joins, exact masks and gate edges remain delivery gates. The paragraphs below describe historical AA production stages.

AA first tranche has36 frames: Thief/dagger9, Fighter/battleaxe9,
Cleric/hammer9 and Fighter/greatsword9. See [AA review](batch-aa-preview/REVIEW.md)
and [brief](REQUEST-batch-aa.md).120 captures and360 fitting cases reviewed;
12 existing browser checks pass. Z/AA activation for0.9.35 uses the reviewed59 frames; see [native weapon review](batch-zaa-runtime/REVIEW.md).
Greatsword cast/read/drink retain the procedural one-handed grip; do not bind
these two-handed frames to freed-hand actions. Preserve Z's selected sources and grips.

AA's second ordinary-melee pass now has36 reviewed source frames in addition
to its36 already integrated first-pass frames. See [second-pass review](batch-aa-melee2-preview/REVIEW.md)
and [brief](REQUEST-batch-aa-melee2.md). All new pairs are one-handed; the short
flail chain remains the existing construction. This source pass leaves0.9.35
runtime/offline bindings untouched at that stage. These frames are now integrated for0.9.36.

AA's third ordinary-melee pass adds36 reviewed class frames (27 unique painted
poses) for Fighter/Ranger/Druid/Spellblade daggers. Ranger reuses Fighter only
after all9 native PNGs, grips and object bounds match; exact class keys remain.
See [third-pass review](batch-aa-melee3-preview/REVIEW.md) and
[brief](REQUEST-batch-aa-melee3.md). All six legal dagger classes now have source
coverage; all six are active after0.9.36. Cleric dagger is ineligible.
The second and third passes are integrated for release0.9.36:72 class frames,
63 unique painted poses, plus9 matching Spellblade lantern-reflected frames
needed for native play. See [native activation evidence](batch-aa-melee-runtime/REVIEW.md). The wider AA library stays open.

AA remaining production passes stay open:

| Pass | Remaining work | Gate |
|---|---|---|
| Second pass — integrated for0.9.36 | Fighter hammer, Fighter/Cleric flails and Mage dagger:36 frames |120 source captures/360 fits; native activation/offline evidence for0.9.36; [review](batch-aa-melee-runtime/REVIEW.md) |
| Third pass — integrated for0.9.36 | Remaining dagger classes: Fighter/Ranger/Druid/Spellblade,36 class frames/27 unique painted poses |120 source captures/360 fits; exact Ranger reuse; native activation/offline evidence for0.9.36; [review](batch-aa-melee-runtime/REVIEW.md) |
| Fourth pass — source review complete locally | Clubs for Fighter/Cleric/Thief/Druid:36 frames; all four legal club classes covered |120 captures,360 fits,12 baseline checks; activated for0.9.37; [runtime review](batch-aa-melee45-runtime/REVIEW.md) |
| Fifth pass — source review complete locally | Fighter mace; missing shortsword/longsword, spear and staff class pairs:97 states, including18 Spellblade reflections |368 captures,1,104 fits; activated for0.9.37; [runtime review](batch-aa-melee45-runtime/REVIEW.md) |
| Activation — integrated locally for0.9.37 | Fourth/fifth passes:133 class/state bindings | Staff tip/glint, hand counts, reflected keys and audited Ranger reuse retained; [native/release review](batch-aa-melee45-runtime/REVIEW.md) |
| Following | Sling, throwing knives and hand crossbow | Keep stone/knife/bolt release, live hands and existing projectiles; paint only actual cached prop states |
| Later | Remaining ordinary/class and named/legendary/Mythic held variants | Preserve each named construction and unidentified appearance; reuse only when exact identities match |

The [fourth-pass coverage audit](batch-aa-melee4-preview/coverage-audit.json)
compares current ITEMS eligibility with active held catalog pairs. Clubs and all five fifth-pass groups now have complete basic class-pair source
coverage and are activated for0.9.37. The [fifth-pass audit](batch-aa-melee5-preview/coverage-audit.json)
updates the historical fourth-pass gaps:

| Weapon | Fifth-pass coverage, activated for0.9.37 |
|---|---|
| Mace | Fighter9 |
| Shortsword | Fighter9, Ranger9, Spellblade9 plain+9 reflected |
| Longsword | Thief9, Ranger9, Spellblade9 plain+9 reflected |
| Quarterstaff | Fighter4, Cleric4, Druid4 |
| Spear | Fighter2, Ranger2 |
| Rare melee, later | Scimitar: Fighter/Thief/Ranger/Spellblade; dwarfhammer: Fighter/Cleric |

Ordinary dagger, hammer and flail class pairs, plus Fighter battleaxe and the
normal two-hand greatsword, already bind active art. Pair coverage is not every
hand state: retain greatsword freed-hand fallback, and retain the newly activated plain/reflected
Spellblade swords for its actual lantern request. Named variants remain separate.

Warning glyphs, map/UI symbols, lightning paths, triggered traps, poison/status
and Calm effects remain procedural under the X audit. They are not blanket
repaint targets. Retain all procedural loaders' fallbacks even after conversion.

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
| L | `46a2a59`; runtime integrated; see delivery review | [Room dressing](batch-l-preview/REVIEW.md) |
| M | Source/review published; runtime integrated; see delivery review | [Regional dressing](batch-m-preview/REVIEW.md) |
| N | Source/review published; runtime integrated; see delivery review | [Remains](batch-n-preview/REVIEW.md) |
| O | Baseline source/review published; architecture/variants procedural; runtime integrated; see delivery review | [Base surfaces](batch-o-preview/REVIEW.md) |
| P | `1e55f72`; runtime integrated; see delivery review | [Equipment and shield rear gap](batch-p-preview/REVIEW.md) |
| Q | `1e55f72`; eleven cells; runtime integrated; see delivery review | [Effects review](batch-q-preview/REVIEW.md) |
| R | Baseline source/review published; exact mask/regional matching and runtime integrated; see delivery review | [Architecture review](batch-r-preview/REVIEW.md) |
| S |20 baseline cells published; baseline runtime integrated; broader regional matching remains separate | [Secondary materials](batch-s-preview/REVIEW.md) |
| T |16 baseline held frames published and integrated; other library entries procedural | [Held equipment](batch-t-preview/REVIEW.md) |
| U | Reuse audit included in 0.9.33; seven portraits integrated/offline; zero new painting | [Portrait reuse](batch-u-preview/REVIEW.md) |

E–T approved exports are integrated in release 0.9.33 (`8e34f9f`); see the
[runtime delivery review](runtime-preview/REVIEW.md). Historical source-only
reports retain their original scope. Track art production and runtime delivery
separately, including exact-mask and unused-reserve exceptions.

| Later audit | Current status | Review evidence |
|---|---|---|
| V | Interface reuse audit included in 0.9.33; zero new painting | [Interface reuse](batch-v-preview/REVIEW.md) |
| W | Audit included with0.9.34; layout/share follow-ups open | [Major screens](batch-w-preview/REVIEW.md) |
| X | Audit included with0.9.34; retain Q and procedural controls | [Additional effects](batch-x-preview/REVIEW.md) |

| New source pass | Current status | Review evidence |
|---|---|---|
| Y | Three ordinary shield rear frames; integrated for0.9.34 | [Shield rear views](batch-y-preview/REVIEW.md) |
| Z |23 reviewed starting-weapon frames integrated for0.9.35 | [Starting weapons](batch-z-preview/REVIEW.md) |
| AA |117 held frames integrated through0.9.36 across three passes and Spellblade reflection correction; wider library open | [Wider held weapons and native activation](batch-aa-melee-runtime/REVIEW.md) |
| AA melee2 |36 ordinary-melee frames integrated for0.9.36; wider library open | [Second melee pass](batch-aa-melee2-preview/REVIEW.md) |
| AA melee3 |36 dagger class frames/27 unique painted poses integrated for0.9.36; all six legal dagger classes have source coverage | [Third melee pass](batch-aa-melee3-preview/REVIEW.md) |
| AA melee4 |36 club frames activated for0.9.37; all four legal classes | [Fourth melee pass](batch-aa-melee4-preview/REVIEW.md) |
| AA melee5 |97 remaining basic melee class/state frames activated for0.9.37 | [Fifth melee pass](batch-aa-melee5-preview/REVIEW.md) |

AA melee4/5 activation for0.9.37 supersedes their historical source-only statuses
above:133 bindings are integrated, with native and release validation in the
[combined native delivery review](batch-aa-melee45-runtime/REVIEW.md). Next painting
work now continues with the remaining bow class pairs, rare scimitar/dwarfhammer,
greatsword released-hand states and the named/legendary/Mythic library.


### AA ranged source pass — complete locally, pending activation

17 class/state frames cover all legal sling (5 classes, loaded/empty), throwing
knife (4 classes, rest) and hand crossbow (3 classes, rest) pairs.13 unique new
paintings plus4 native-audited Ranger reuse states;9 original image-tool sheets.
292 frozen phone captures,876 fits and12 baseline browser checks pass.
See [review](batch-aa-ranged-preview/REVIEW.md) and
[coverage audit](batch-aa-ranged-preview/coverage-audit.json). No runtime bindings
or publication; live0.9.37 remains unchanged. Activation must preserve live sling
cord/stone and knife bare-hand release, exact family guards and offline delivery.

Remaining source priority:

1. Fighter/Thief shortbow and Fighter longbow class coverage; preserve procedural
   strings, arrows, draw hands and registered nocks. Ranger bows are already painted.
2. Rare scimitar and dwarfhammer class/state variants.
3. Greatsword released-hand states where currently procedural.
4. Named, legendary and Mythic equipment library, audited by actual identity.

The three-weapon pass is complete; the whole AA library remains open.


### AA remaining bow classes — complete locally, pending activation

9 source frames finish Fighter/Thief shortbow and Fighter longbow: rest, half draw
and full draw for each pair. Thief adds3 paintings;6 Fighter frames reuse approved
Ranger registered bytes and measurements after exact native pixel/grip/bounds/
dimension/nock audits. All ordinary shortbow/longbow legal class pairs now have
source coverage.94 frozen captures,282 fixture cases and12 baseline checks pass.
See [review](batch-aa-bows-preview/REVIEW.md) and
[coverage audit](batch-aa-bows-preview/coverage-audit.json). These9 and the preceding
17 ranged frames remain local/unactivated/unpublished; live0.9.37 unchanged.

Current next source priorities supersede the bow gap listed above:

1. Rare scimitar and dwarfhammer class/state variants.
2. Greatsword released-hand states where procedural.
3. Named, legendary and Mythic equipment by actual identity.

Native activation must retain per-family fallback, strings/arrows/draw hands,
Calm flex selection, action lowering and offline delivery. The AA library remains
open beyond these completed ordinary bow class pairs.


### AA rare scimitar and dwarfhammer — complete locally, pending activation

63 source frames cover every legal class pair for these two tier99 weapons:
Fighter/Thief/Ranger/Spellblade scimitar9 each, Spellblade reflected9, and
Fighter/Cleric dwarfhammer9 each.54 unique painted states plus9 exact native-audited
Ranger reuses.208 frozen captures,624 fits,17 fallback guards per width and12
baseline checks pass. See [review](batch-aa-rare-preview/REVIEW.md) and
[coverage audit](batch-aa-rare-preview/coverage-audit.json). All89 local frames
across rare/ranged/bow passes await activation/publication; live0.9.37 unchanged.

Current next source work supersedes the rare priority above:

1. Fighter greatsword released-hand state during cast/read/drink; retain the
   existing two-hand CUT family and real renderer selection.
2. Named, legendary and Mythic equipment library, audited by actual identity.

Activation must preserve explicit Spellblade plain/reflected keys and independent
class/family fallback, then verify real actions, offline delivery and performance.
Completing these two rare families does not complete the whole AA library.


### AA Fighter greatsword released-hand pass — complete locally

9 one-hand CUT states complete source coverage for Fighter greatsword hand
release, including overlapping read/drink actions. Existing9 two-hand frames stay
published and unchanged.130 frozen captures,390 fixture checks (270 new bounds,
96 published two-hand draws,24 other fallbacks),22 guards per width and12 baseline
checks pass. See [review](batch-aa-greatsword-preview/REVIEW.md),
[comparison](batch-aa-greatsword-preview/hand-release-review.png) and
[coverage audit](batch-aa-greatsword-preview/coverage-audit.json). These9 plus89
prior ranged/bow/rare frames remain local/unactivated/unpublished:98 total.
Live0.9.37 remains unchanged. Future activation must switch both hand variants as
one18-state family and verify native actions, failures, offline and performance.

Current next painting work: named, legendary and Mythic equipment by actual
identity, preserving class/hand/reflection variants. This supersedes the
greatsword gap above; the entire AA library is still open. Action hands, bow
strings/arrows and moving projectiles intentionally remain procedural.


### AA named held pass1 — Penitent source complete locally

18 exact `relic_penitent` frames cover Fighter/Cleric9 CUT states each, with
three pale-gold prayer beads and the small cross, compact linked chain/iron ball
and class-specific hands. Actual base flail/u:penitent items route to the named
sprite and pass canEquip.68 frozen captures/204 fixture checks,17 exact guards
per width, state/dice neutrality and12 baseline browser checks pass. See
[review](batch-aa-penitent-preview/REVIEW.md),
[identity comparison](batch-aa-penitent-preview/identity-review.png) and
[coverage](batch-aa-penitent-preview/coverage-audit.json). No activation/publication;
these18 plus98 earlier frames total116 pending. Live0.9.37 stays unchanged.

The [named identity/class inventory](batch-aa-penitent-preview/named-library-audit.json)
records47 named identities,31 weapon/shield held candidates,1 with held source
(Penitent),30 without held source and0 delivered named held/carried families.
Inventory/portrait/worn art and carried source sheets are separate. Legal class
sets use relicUsableBy, including Mythic ownership, not only the base item.
Reconcile with `node art/creatures/audit-named-equipment.mjs`; verify using
`node art/creatures/audit-named-equipment.mjs --check`. Do not strip named prefixes
or count ordinary art as named coverage. Other identities require native pose
audits before generation and separate runtime/offline/family-failure gates.

Next source order:

1. Dawnbringer — Fighter/Cleric temple mace with its named sunburst head.
2. The Ogre's Toll — Fighter axe with its own construction and tally marks.
3. Vashti's Needles and remaining named blade/staff/bow/spear/carried families,
   preserving exact legal classes, hand counts, reflections and moving parts.

This starts the named library; it does not finish all31 held candidates.


### AA activation — release 0.9.38


AA ranged, bows, rare weapons, released-hand greatsword and Penitent are activated
for release 0.9.38 (build 53, offline cache deepdelve-v113). The 116 new held
frames cover every legal sling/throwing-knife/hand-crossbow pair, missing bow
classes, scimitar/dwarfhammer classes, Spellblade plain/reflected scimitars,
Fighter greatsword hand release and exact Fighter/Cleric relic_penitent poses.
The catalog now contains 405 held frames and 744 shipped paintings plus 3 icons;
all 460 previous common delivery files retain identical bytes. New delivery adds
2,027,593 compressed bytes across 116 PNGs, matching reviewed source exports.

See [the activation review](batch-aa-runtime116/REVIEW.md) for native
actions, family failures, offline delivery and release checks. Fifty sessions at
390px/320px exercise 25 real equipment variants, 164 actions, Calm and 50 offline
Continue reloads with all 405 held frames cached. The 742 captures and 50 galleries
use native updates and loaders; setup supplies equipment/resources and a durable
target, so they do not establish unassisted combat or quest completion. Earlier
source-only notes describe historical stages, superseded by this activation.

The named inventory now has one delivered held family (Penitent), with 30 of 31
named weapon/shield candidates still awaiting held source. Next painting order:
Dawnbringer for Fighter/Cleric, then The Ogre's Toll and remaining named families.
Action hands, bow strings/arrows and moving projectiles remain procedural.

## Batch AB — all named equipment source complete (25 October 2026)

All 30 remaining named weapon/shield candidates now have reviewed source art: 397 exact class/state files (381 held, 16 carried), 73 legal class families, and 347 unique paintings plus 50 verified Ranger reuses. Together with active Penitent, all 31 candidates have source coverage. The other 16 worn/inventory identities and the existing 47 relic portraits remain separate categories.

See [Batch AB review](batch-ab-named-preview/REVIEW.md) and [library contact sheet](batch-ab-named-preview/named-library-contact.png). Source fitting covers both phone widths and 4,746 checks. This supersedes earlier notes naming Dawnbringer or another named held family as the next painting gap. **Next: activate the 381 held and 16 carried AB states**, verify native actions, fallback/loading, offline caches and performance, then publish when requested. AB is currently local source art; live v0.9.38 is unchanged.

## Named equipment activated — v0.9.39

All 30 remaining named weapon/shield candidates now bind to gameplay: 381 held weapon states and 16 carried shield/focus states. Every one of the 31 named weapon/shield identities, including Penitent, has a painted runtime surface. Exact class, identity, pose, hand count and Spellblade reflections are preserved; unsupported or failed images keep their procedural fallback. Bows retain live strings, arrows and drawing hands.

The common delivery now contains 973 files (786 held states and 21 carried states among them), with all 576 prior common exports unchanged. There are 1,141 shipped paintings plus three icons. The 16 worn/inventory named identities and the 47 relic portraits remain separate surfaces. This activation supersedes Batch AB's historical source-only status.

See [native activation review](batch-ab-runtime/REVIEW.md), [source review](batch-ab-named-preview/REVIEW.md) and [delivery inventory](runtime-delivery.json).


## Batch AC — ordinary caster source complete (25 October 2026)

Seven exact carried frames cover Mage spellbook/crystal_orb/orb_storms, Cleric
holy_symbol/silver_symbol/reliquary, and Spellblade wayfarer_lantern. Native
canEquip/spriteFor references confirm seven legal pairs and reject all42 other
public/hidden class combinations. Six foci use open palms; the lantern keeps its
closed carry handle, blue flame and measured bottom-rim mark.

See [review](batch-ac-casters-preview/REVIEW.md), [brief](REQUEST-batch-ac-casters.md)
and [alpha comparison](batch-ac-casters-preview/alpha-review.png). Seven exports,
98 source-preview captures,294 three-height fitting cases,70 exact identity/class
guards per width and12 existing equipment tests pass. Full game and dice state
stay unchanged during fitting. These are frozen source proxies, not native
activation/action/offline evidence. Current public0.9.39 is unchanged.

Delivery remains pending with native class/equip/action, independent failure,
offline and release checks. AD shield backs and AE action hands subsequently
completed their source passes below. No new named weapon/shield painting gap is implied.


## Batch AD — remaining ordinary shield sources complete (25 October 2026)

The35-pair actual canEquip/catalog audit finds12 legal ordinary shield pairs.
Five already have active P/Y source/delivery; seven missing pairs now have new
reviewed source: Fighter/Cleric/Druid bucklers, Fighter/Cleric tower shields and
Fighter/Cleric Quill Shields. Named AB shields and local AC caster foci stay
separate. See [brief](REQUEST-batch-ad-shields.md),
[audit](batch-ad-shields-preview/ordinary-shield-audit.json) and
[review](batch-ad-shields-preview/REVIEW.md).

AD has112 frozen source-preview captures and336 three-height fitting checks,
with exact class/id guards, shared item scale across classes and full Game/Dice/Odds
neutrality. This is local source art, not runtime activation or native action /
offline evidence. The five prior ordinary shield frames and all named art are
unchanged; public0.9.39 is unchanged. AC and AD total14 pending carried frames.

AE fists, casting/read/drink hands and Wild Shape bear claws are now source complete; see the AE/AF completion below. Next activation: AC+AD with native
equip/actions, independent failure, offline and full release validation.

## Batches AE and AF — source complete (25 October 2026)

AE provides 24 exact empty-hand bindings (21 new paintings and three Ranger reuses). AF provides 142 small-item sources (135 new paintings and seven approved reuses): 140 live keys and two reserves. See [AE review](batch-ae-hands-preview/REVIEW.md) and [AF review](batch-af-items-preview/REVIEW.md) for repairs, coverage and integration limits. Both phone widths passed source fixtures and 28 existing browser regressions. AC/AD’s 14 carried sources remain pending activation alongside AE/AF; public v0.9.39 remains unchanged.

AG and AH subsequently completed their source painting below. Next delivery: integrate pending sources with native-action, regional fitting, rarity-wrapper, independent failure, offline and release checks.

## AG and AH — regional source painting complete (25 October 2026)

[Combined source review](batch-ag-ah-preview/REVIEW.md): 25 atlases, 405 selections. AG covers 96 bindings for twelve regions (84 new selected paintings plus twelve shared approved R gate reuses). AH covers 240 regional secondary material cells and all 69 decoration slots across thirteen regions. Originals, rejected gate/arch repairs, selected painted arches, native guides, exact crops and diagnostics are preserved.

240 AG and 618 AH frozen phone captures cover both widths; 864 AH shade levels are checked per width. All 13 contacts and 12 native repeat panels were visually reviewed, with representative phone galleries; the existing 8 regional/cache browser regressions passed. These are source previews, not activation.

**Delivery gates remain:** retain exact native arch openings (painted candidates differ 15–17 native pixels); resolve shared grey gate masonry against regional edges/coloured locks; check adjoining wall/door/decoration courses, repeat joins and temporal torch registration. Preserve native terrain, animation, light/collision rules, fallback and lazy caches. No blanket promotion of generated candidates.

The current painting roadmap through AH has source coverage. Next is coordinated AC–AH integration and native verification, followed by separately authorised publication. Public v0.9.39 remains unchanged.

## AC–AH activated — 0.9.40 (25 October 2026)

[Native runtime delivery review](batch-ac-ah-runtime/REVIEW.md). All pending AC–AH selections are integrated:14 carried frames,24 empty-hand frames,134 new live small-item files and 405 regional selections. Runtime delivery now has 1,550 files; all 973 previous files are unchanged. Rarity outlines, seeded appearances, separate large relic portraits, native openings/locks, gate edges and fixed torch brackets are preserved through cached composition and independent demand loading. The generic key and Tooth source remain intentional reserves.

Source reports above preserve their historical production limits; the native delivery report supersedes their activation-pending status. Exact native mask/lock/gate-edge fitting is now verified in the runtime. Source repeat/region material appearance was reviewed in native scenes; no new topology or light source was added. Next work is ordinary visual quality follow-up from play, rather than an automatic next atlas batch.

## First visual polish follow-up — 25 October 2026

The [local follow-up review](../../docs/visual/2026-10-25-art-polish/README.md) checks existing regional/equipment/item galleries and fresh running-game/settled-portrait views at both phone widths. No new atlas or repaint is justified by the sampled views. The item capture tool now uses the valid Calm preference and waits for portrait decode/animation completion; historical dim mid-fade captures remain unchanged. This is a bounded first review, not a sign-off of every gameplay state. Mobile layout and ending/share-card follow-ups remain open. The review/tool correction is included in release0.9.42; its release commit and CI publication are authoritative.

## Mobile layout follow-up — 0.9.42

The V/W enlarged-text title overlap, crowded shop header/controls and split Journal labels are addressed in the0.9.42 CSS pass, with [native before/after evidence](../../docs/visual/2026-10-25-mobile-layouts/README.md) and regression checks. This does not commission more art. Normal-size styling, gameplay rules and source paintings are unchanged. Release publication follows the required CI checks; ending/share-card keeper captions and outcome symbols remain the next presentation follow-up.


### Fallen hero portraits — 26 October 2026
Seven class-specific death portraits now replace the living face on death screens
and death share cards, retaining each hero’s existing gear and mastery frame.
Victories keep living portraits. Sources and selected anatomical repairs are in
`art/portraits/fallen/`; [review and validation](../../docs/visual/2026-10-26-fallen-portraits/README.md).
Prepared for release0.9.43; publication follows the required CI checks. The separate keeper-caption
and outcome-symbol share-card follow-ups remain open.


### Share-card polish — 26 October 2026
Completed locally for 0.9.44: cards derive the actual keeper caption and chosen ending,
uses the existing Heart/quench/dais paintings, and selects canonical painted
killer and companion cutouts with bounded loading and independent fallbacks.
This addresses W’s code-audit findings without commissioning new art.
The final combined release passed all 925 distinct Chromium cases without failure,
751 rule checks and the paired isolated performance budget. Earlier variable
performance samples are retained in the final validation record. Publication is
authorized; CI and the release publisher remain required. [Review and recorded rechecks](../../docs/visual/2026-10-26-share-cards/README.md).


### Epic Heart refresh — 26 October 2026
The approved volcanic core replaces the collectible’s red jewel and the dais’s
round orb. Both paintings keep native surfaces, with matching loading/failure
silhouettes. Historical AF/K source reviews remain unchanged; explicit delivery
overrides select the replacements. This joins the share-card polish in0.9.44.
[Native captures and release validation](../../docs/visual/2026-10-26-epic-heart/README.md).

### Visual audit phase 1 — combat readability
Native crowd/attack/spell captures identified overlapping receipts from aligned
enemies at different depths. Their text layout is corrected for release0.9.45;
no repaint is justified by this sample. [Review](../../docs/visual/2026-10-26-phase1-combat/README.md).
Phases2/3 cover regional consistency and small-phone clarity next.

### Visual audit phase 2 — regional consistency
Reviewed all13 palette selections at320/390px and60 representative structure
views; all4 regional mask/lock/torch/failure regression checks passed. No new
confirmed rendering/art defect in this bounded sample. [Review](../../docs/visual/2026-10-26-phase2-regions/README.md).

### Visual audit phase 3 — small-phone clarity
Reviewed enlarged native title/trader/Journal at320/390/740px and settled item
portraits/movement at320/390px. All19 access/layout cases passed. No additional
confirmed runtime/art defect in these samples. [Review](../../docs/visual/2026-10-26-phase3-mobile/README.md).
The three-phase audit found and fixed aligned crowd receipt overlap in phase1;
phases2/3 add bounded evidence without a new atlas or gameplay change.

### Keeper and victory presentation audit — 26 October 2026
Reviewed all three keepers and Take/Quench/Keep at320/390px:84 captures,59
focused browser checks passed. No confirmed defect requiring runtime/art changes
in this bounded sample. Controlled combat frames and native ending sessions are
explicitly distinguished in the [review](../../docs/visual/2026-10-26-boss-audit/README.md).
This review-only publication leaves the verified v0.9.45 game bytes unchanged.

### Rare equipment motion audit — 26 October 2026
84 native sessions cover28 Heartroot/named-carried/bow class pairs at320/390/740px:
306 actions,1,254 captures and24 successful released-drive/restoration overlaps.
All30 focused browser cases passed, including6 unchanged Heartroot repeats and
4,746 named renderer/action fitting fixtures. No new confirmed runtime/art defect.
The [review](../../docs/visual/2026-10-26-equipment-audit/README.md) distinguishes
fresh Chromium evidence from historical Safari results and records coverage limits.

### Installed-game / slow-loading art audit — 27 October 2026
Eight real same-origin upgrade profiles from v0.9.43/v0.9.44 to v0.9.45 passed,
including interrupted core installation and retry at320/390px. All four v43
profiles replaced the old Heart/dais bytes with the current paintings offline.
All36 focused browser cases passed; each project decoded all1,550 painted catalog
files offline. No new confirmed defect. [Review and limits](../../docs/visual/2026-10-26-installed-art-audit/README.md).

### Sliding door surround correction — 27 October 2026
A reported defect translated the full framed painting with the moving slab.
The renderer now uses cached leaf-only art for closed/sliding doors and gates;
fixed world jambs supply the masonry. No source repaint or opening-rule change.
All17 focused browser checks, three native animations and four real installed
upgrade/retry profiles passed; paired performance and751 rules passed. Earlier
performance/fixture failures are retained in the [review](../../docs/visual/2026-10-27-door-panels/README.md).
Prepared for v0.9.46, subject to required CI and release publication.

### Moving scenery and interaction follow-up — 27 October 2026
Native review found three further door continuity defects: opening erased cracks,
keyed unlocks lost their lock colour, and burned remnants reverted to clean wood.
The v0.9.47 correction preserves those surfaces through the existing animation.
24 native interaction sessions, 72 controlled side views, 15 native trap sessions,
three lever-action sessions and two installed offline profiles provide bounded
evidence; no further confirmed chest/secret-wall/lever/trap art defect was found.
No new painting or atlas is commissioned. [Review, scope and release checks](../../docs/visual/2026-10-27-interactions/README.md).
Publication remains subject to the required CI and release publisher.

### Lighting and material transitions — 27 October 2026
The v0.9.48 candidate blends floor/ceiling torchlight across tile edges and keeps
weak torches from dimming the hero's foot light. Native movement/elemental,
regional material and installed-offline evidence is recorded in the
[lighting review](../../docs/visual/2026-10-27-lighting/README.md). Original
paintings and game rules are preserved; no new atlas is commissioned. The
review retains negative diagnostics and the marginal performance failure beside
the paired budget results. Required CI and release publication remain gates.

### Combat effects polish — 27 October 2026
The v0.9.49 candidate bounds painted fire/frost bursts to a torso radius, draws
spell effects below damage receipts and protects incoming-attack warnings.
78 native combat sequences at320/390/740px,12 additional native death-style
sequences and8 actions in two fresh installed offline profiles are recorded in
the [combat effects review](../../docs/visual/2026-10-27-combat-effects/README.md).
All seven existing death styles retain their approved creature paintings and
native motion. No new painting or atlas is commissioned. Publication remains
subject to the full browser, rules, isolated performance, CI and release gates.

### Rendering headroom — 27 October 2026
The v0.9.50 candidate reuses the hero's constant floor lighting across each
projected row. Torch interpolation, shadows and painting bytes stay intact.
No new painting or atlas is commissioned. Native movement, elemental/offline
verification, exact pixel comparison and the full release gates are tracked in
the [rendering review](../../docs/verification/2026-10-27-render-headroom/README.md).

## Remaining procedural object conversions — 27 October 2026

These are additional authored surfaces, not missing bindings for approved art.
Do not regenerate completed creature, class, item or region libraries.

| Order | Batch | Current caller | Proposed work and acceptance gates |
|---|---|---|---|
| 1 | AI — ordinary amber lantern | `renderer.js: drawLantern`; `motion.js` selects it on a dark floor | Review the native cage/handle at 320/390px and short landscape, with free hand, shield and two-hand kits. Paint a transparent body if the comparison supports it. Keep amber flame/glow live, attachment/sway/Calm placement unchanged, and the blue Spellblade lantern separate. One independent demand-loaded body may suffice; audit before choosing an atlas. |
| 2 | AJ — reading scroll | `spellfx.js: drawReading` | Review actual reads across existing scroll kinds. The small Pack scroll is already painted; this proposal is its larger open reading surface. Reuse that art only if its construction fits; otherwise author an open sheet. Keep existing painted class hands, colored writing, burn clipping/embers, spell release and duration. Do not add new read poses or reveal unidentified scroll effects. |

For each: capture native references, review source/registration, then integrate
through independent loading/failure fallback and offline entries; verify native
actions, Calm, short views and installed reloads; run unchanged release checks
and publish the completed phase. Neither batch has generated source or runtime
activation at the time of the 27 October inventory. AI's later implementation
is recorded below; AJ's later implementation is recorded after it. No runtime defect was confirmed by the
coverage inventory alone.

Keep the following procedural unless a specific reviewed defect justifies work:

- Bow strings/arrows, sling whirl/stone, thrown missiles and travel paths: moving
  geometry follows actual grips, endpoints and existing release times.
- Lightning, force/holy/root/ward/heal/swarm shapes, trap cues and status effects:
  Q's fire/frost contact paintings are integrated; these other families are
  intentional dynamic drawings, previously reviewed in X and the combat pass.
- Blood/ash/oil/ice/water patches, corpse/debris motion, door cracks/char/fire,
  lighting, exact arch edges and colored locks: native geometry/composition
  preserves gameplay cues and already painted base surfaces.
- Damage text, incoming warnings, map symbols and interface icons remain
  functional text/vector layers. AAA2 adds a neutral painted Pack stand from
  `art/ui/aaa2-equipment/`; its vector fallback, selection regions and slot
  connectors remain live. It is an independent UI image, not a creature atlas.

`key` and `amulet_tooth` stay reserves: playable keys route to five painted
color-specific keys, and seeded jewel appearances remain painted through
identification. The legacy `fountain_hint` sprite has no current caller outside
its data declaration; regional fountains already have painted surfaces. These
are not a new production backlog.

## Batch AI — ordinary amber lantern (28 October 2026)

One compact empty iron frame is integrated locally for v0.9.51. The selected
image-tool repair shortens an unsuitable tall original; both sources and exact
prompts remain in `generation-batch-ai.json`. Uniform crop/resize/translation
preserves transparent windows and ring without scripted painting/masking.
The renderer retains its original animated glass/flame/glow, position and
Calm behavior behind the body, with independent demand loading and complete
procedural fallback. The blue Wayfarer lantern is separate.

Common delivery adds one overlay PNG (1,551 files total), with all1,550 previous
files unchanged. Native movement/turn, fitting, loading/failure, offline and
release evidence is tracked in the [review](../../docs/visual/2026-10-28-amber-lantern/README.md).
Publication remains subject to the existing full Chromium, rules, isolated
performance and CI/release gates. Next painting proposal is AJ's open reading
scroll; no further creature or regional atlas is commissioned.

### Batch AJ — native reading parchment (28 October 2026)

Implemented for v0.9.52: one blank open vellum painting, independently loaded
only during reading. The original five writing lines, spell colours, burn clip,
embers, flourishes, class hands and 1,000ms duration remain live and unchanged.
The small Pack scroll remains its existing painting. The wide source is retained
as rejected provenance; the taller selected source uses uniform registration.
See [native review and release checks](../../docs/visual/2026-10-28-reading-scroll/README.md).
The AI/AJ proposals are integrated; no further physical-object atlas is required
by this inventory. Dynamic effects and UI symbols remain procedural by design.

## Optional surface textures — 30 October 2026

The owner requested the next procedural-to-painted pass. These extend texture
detail on existing surfaces; they do not replace live geometry or introduce
new effects. Earlier X/coverage decisions remain the baseline, not missing art.

| Order | Batch | Surface | Scope and gates |
|---|---|---|---|
| 1 — implemented v0.9.64; performance recovery v0.9.65 | AK | Blood and cold ash floor detail | Review the existing flat ellipse fills at320/390px. Author two muted, top-down transparent textures matching the monster paintings. Retain exact projection, ellipse clipping, colour distinctions, lighting/fog, delayed landing, satellite splashes, floor-before-wall ordering and independent failure fallback. Cache decoded/shaded pictures outside frames. Verify native views, Calm, offline, unchanged dice and the original performance budget before activation. |
| 2 — audit next | AL | Oil, ice and water detail | Compare wet surfaces in native play before commissioning. Preserve oil sheen, water glints, ice/hazard identity, field boundaries, expiry and Calm behavior. No static glint or new light baked into art. |
| 3 — audit candidate | AM | Additional spell contact textures | Review existing holy/force/lightning impacts at their actual hit times. A bounded contact texture may add material detail; keep live paths, targets, warning visibility and all effect clocks. Do not repaint integrated fire/frost families. |
| 4 — audit candidate | AN | Healing and ward surface accents | Review subtle painted accents within existing live shapes. Preserve class/spell colours, readable creatures, Calm and original costs/durations. Generate only after a native comparison supports it. |

Projectiles, strings, spell trajectories, weather, warning/damage text, map
symbols, functional icons and all failed/loading-picture fallbacks stay live.
AL–AN are review candidates, not promises that every effect needs a painting.
