# Batch J encounter art review — 24 October 2026

Four new transparent source sheets contain 14 static compositions. Three additional
recruitment cells reuse reviewed Batch F rest poses. Exports include 17 individual
256px WebPs and five grouped atlases (J1a/J1b 512x512; J2a/J2b/J3 768x256).
This publication contains source/review assets; no runtime integration is included.

Exact prompts, input references, original generated paths, repairs, selected
sources, source rectangles and authored anchors are recorded in
[the manifest](../generation-batch-j.json). Generated with `image_gen.imagegen`
(model not disclosed). No painting, anatomy changes or recolouring is scripted.

## Identity and source review

Active procedural identity references come from `Assets.sprites`, not bestiary
portraits. The approved Goblin/Ogre/Warlord paintings and revised Batch I traders
supply style: mature angular anatomy, recessed eyes, worn materials and directional
shading. Initial and corrected sheets remain intact. J1a/J1b/J2a spacing repairs
separate cell boundaries and restore the Ogre club's complete top. The Wisp's
face was softened into shadow hollows in swirling light rather than a glossy mask.

| Group | Reviewed identity and scene details |
|---|---|
| J1a | Forge-Spirit above black anvil/rock; gaunt navy/gold Last Delver warming a hand at bone fire; cold blue trailing Wisp; cuffed adult Prisoner with two attached wall-ring chains |
| J1b | Blue formal-coated moustached Duellist Ghost with feathered hat, gripped rapier and mist lower body; grey Lampfolk cradling a completely cold lamp with pack/staff beside him; dusty white-bearded dwarf Smith holding hammer above cold anvil/blade; seated green-coated skeletal Mapmaker with empty sockets, satchel, three map rolls and pointing finger |
| J2a | Injured seated green Goblin holding wound and offering knife; thin brown Mule with four legs, halter/rope and slipped pack/pot/bedroll; approved Ogre with both eyes shut, held club over shoulder and coin piles |
| J2b | Standing Goblin with low knife beside rough TO sign; low curled brown Hound with red collar/tag, head on paws and one ear up; closed padlocked iron Cage with Goblin inside, fingers around front bars and face clear |
| J3 reuse | `hireling` uses Batch F Sellsword; `exile` uses Renegade; `stray_healer` uses Mender. Each reuses zero-based cell6, named `sit` by the existing pose API. This is a rest pose; Sellsword/Renegade need not literally sit. |

All original and selected source cells, 17 active individual references, four
reference group sheets, all 17 exported cells, five grouped atlases and contact
sheet were visually inspected. Review checks full silhouettes, grips, connected
gear, expected anatomy, cage occlusion/open transparency and cold lamp state.
Sleep is conveyed by closed eyes/posture; comic Z lettering is omitted. No
post-choice outcomes, released captive, open cage, new companions or combat
animations are baked into the art. Hound and Cage cannot simply reuse full
companion cells: their curled framing/containment is part of the scene.

## Crops and scene registration

Each generated cell has an explicit authored source rectangle in the manifest;
separate elements such as wall rings, sign, fire and anvil are retained together.
The exporter keeps visible alpha above 32 plus a 3px antialias rim, excluding very
faint generator haze elsewhere in the rectangle. It uses uniform scaling only.
`source_anchor` coordinates are relative to the source rectangle; target anchors
are within the 256px export. Ground compositions register their whole scene base
at row236, without inferring feet from sitting figures. The curled Hound retains
its low composition (maximum 96px height), not an enlarged standing-dog silhouette.
Wisp and Ghost use measured floating core/torso anchors; their tails do not define
a foot baseline. Visible alpha retains at least 12px clearance on every edge.
Existing Batch F rest cells preserve their authored registration.

`measurements.json` records source file hashes, crop rectangles, alpha bounds,
anchors, scale, offsets and final WebP hashes. Individual/group exports are
review assets, not changes to the existing asset loader.

## Mapping and preview checks

`js/motion.js` selects `ENCOUNTERS[n.id].sprite` for each encounter NPC, with
scale 0.85/yOff 0. All 18 existing encounter IDs using these 17 keys are exercised:
`voice` and `bargain` intentionally share ONE Wisp. `js/props.js` delegates the
three recruitment props directly to companion `sit` drawers. Static scene
exports add no action poses or title-specific Wisp variants.

The preview records 72 near/far dungeon captures (1/3 tiles, 390px/320px) and 36
unanswered encounter-card captures. It asserts actual sprite selection, position,
scale and yOff before world-cell substitution, then uses the existing renderer.
For each real encounter card it waits for the opening fade, then verifies the current procedural art binding,
expected title and unchanged definition choice labels, and checks `result:null`.
Only then does it replace the card image URL for review. All 108 captures and four
overviews were visually reviewed; no page/console errors were observed.

The harness freezes game updates after setup and manually positions one preview
NPC. After each card it clears unanswered encounter setup state and dismisses
the overlay, without selecting an outcome. It does not claim to prove complete
encounter resolution, rewards, recruitment transitions, generation eligibility,
or untouched run-history state. Narrative choices and hidden effects are unchanged
in source code; no gameplay modules are edited.

## Reproduce and integration limits

```
node art/creatures/reference-batch-j.cjs
python3 art/creatures/export-batch-j.py --check
node art/creatures/preview-batch-j.cjs
```

Reference/preview tools need Playwright and Chromium (`CHROMIUM_PATH` override).
Reference-group assembly and export require Pillow. Export checking reproduces
all 17 cells, five grouped atlases, contact sheet and measurements exactly.

The current painted creature loader expects 768x768 nine-pose sheets and does not
bind these static props. Future integration needs static decoding/binding,
per-key fallbacks, lazy loading/offline caching, and encounter-card URL handling
(`Assets.sprites.url` is currently a getter). It must preserve shared aliases,
source anchors, scene placement, unresolved state and existing light/fog rules.
The preview applies standard cached black washes to static paintings; it does
not establish exact procedural emissive masks or additional world light sources.
Neither frozen substitutions nor card URL overrides prove real loading, fallback,
offline support, dynamic emission, animation or end-to-end outcome behaviour.

Runtime integration remains pending.
