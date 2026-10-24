# Batch J — static encounter figures and compositions

Build 14 new static scenes in four source groups, with existing monster/revised
trader painting style: weathered adult anatomy, recessed eyes, muted materials,
directional shading. No cute cartoon rendering. Keep source and every repair,
exact prompts/reference paths and original output paths. True transparent alpha.

- J1a (2x2): Forge-Spirit above soot-black anvil/rock pedestal; gaunt Last Delver
  in blue/gold coat hunched beside a small bone fire; one cold blue trailing Wisp;
  exhausted Prisoner in beige rags with raised shackled wrists and wall rings.
- J1b (2x2): blue formal-coated Duellist Ghost with feathered hat/rapier/mist legs;
  hunched grey Lampfolk cradling COLD lamp, pack beside him; dusty white-bearded
  dwarf Kept Smith with raised hammer and cold anvil/blade; seated skeletal
  Mapmaker in green coat, satchel/maps in lap and one pointing finger.
- J2a (3x1): seated injured green Goblin offering knife and holding wound; thin
  four-legged Mule with lowered head, halter/rope and slipped packs/pot/bedroll;
  approved Ogre identity with CLOSED eyes, resting club and small coin piles.
  Do not bake comic sleep letters into the painting.
- J2b (3x1): armed standing Goblin beside crude TO sign; low curled thin brown
  Hound with red collar/tag and head on paws; closed padlocked iron Cage with
  green Goblin inside, hands wrapping bars and unobscured face.

J3 reuse: hireling/exile/stray_healer delegate to companion `sit` poses. Reuse
reviewed Batch F sellsword/renegade/mender cell six (zero-based). `sit` is the
supported rest pose name; do not claim each source is literally seated. Stray's
curled scene and Cage's containment/occlusion require distinct compositions.
Shared wisp serves all existing encounter IDs; do not create title variants.

Use explicit source rectangles and authored scene anchors; do not extract a
scene as one connected creature (fire/anvil, sign/goblin and rings may separate).
Floating wisps/ghosts use measured torso anchors. Retain low curled-hound framing,
complete gear, clear alpha and 12px exported clearance. Preserve all encounter
state, choice text and hidden results. No runtime bindings or offline changes.

Review all reference/source/export cells and near/far dungeon substitutions at
390px/320px using existing renderer, positions and scale 0.85. Audit sprite
mapping, shared aliases and encounter choices without resolving any outcomes.
Document fallback/loading/integration limits and keep publication separate.
