# Batch D review — 23 October 2026

Ten identities: default knight Shade, Grisk, Vessra, Ushgar, Morrow, Orla,
Gorrum, Vaelith, Hissra and Durgrim. Original sources and every tool repair are
preserved in `generation-batch-d.json`; the tool did not disclose its model.

## Selected repairs

- Shade: replaces physical legs/boots with a hovering spectral surcoat and mist;
  keeps the armoured helm, blue eye light and connected sword/shield grips.
- Grisk: restored spoon-crown clearance, retaining his bucket rather than the
  Warlord's gold crown. Opposite steps keep the knife on the same side.
- Morrow: restored finger-bone crown/toe clearance; every pose retains the
  jaw-held thighbone, heavy belly and claw attacks.
- Orla: restored halo clearance and a consistent missing wedge on its upper
  right. Every face opening remains empty, including hurt and idle variation.
- Gorrum and Durgrim: corrected the repeated leading leg in Step B; white
  beards, attached ornaments and equipment remain with their own champion.
- Vaelith: restored crown/staff tips and made opposite boot leads readable;
  keeps the silver spider crown, wine-red robes and left-hand staff.
- Hissra: restored spear clearance, opposite leads and frontal snout/eye contact;
  retains the white crest, spear, shell shield and one connected tail.
- Vessra and Ushgar use their original sheets: eight connected spider legs and
  pale abdomen marking; helmet-rooted horns, face paint and a gripped axe.

The selected complete repair sheets supply coherent palettes across all nine
cells; originals remain as provenance. The exporter does not paint or recolour.

## Registration and runtime boundaries

Each creature uses one uniform scale across its nine 256px cells and at least
12px of visible-alpha clearance. Grounded visible alpha ends on row236. Shade
and Orla use recorded torso anchors, preserving the floating body across robe
changes instead of aligning variable fringe tips to an invented floor.

All nine cells remain reviewable in each complete sheet. Existing runtime poses
are the only ones bound: the floating Shade and Orla have no walking objects,
and most champions have no special object, so existing wind-up fallbacks remain.
Only the default/fighter Shade uses the knight painting. Thief, Mage, Cleric,
Ranger, Druid and Spellblade Shades retain class-specific procedural gear.
The renderer also guards the interval before those gear objects finish loading.
Named champions select their own `base.elite[id]` pictures, retaining existing
scale changes (including Durgrim), warnings, opacity, motion and combat timing.
No rules, random rolls, targeting, visibility, saves or spawn plans change.

`python3 art/creatures/export-batch-d.py --check` reproduces review and shipped
bytes, measurements and labelled neutral/walking/action sheets.
`node art/creatures/preview-batch-d.cjs` captures supported poses using the real
runtime loader and renderer at 390px and 320px, asserting attack warnings.
Validation results are recorded separately in `integration-checks.md`.
