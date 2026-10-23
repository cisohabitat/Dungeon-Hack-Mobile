# Batch C review — 23 October 2026

Ten identities: Goblin Lookout, Goblin Hexer, Goblin Pikeman, Quillback,
Drowned One, Emberling, chest Mimic, Dread Lich, Heartforged and Goblin Warlord.
Original PNGs and every tool repair are preserved in `generation-batch-c.json`.
The image tool did not disclose its model. Source sheets and all ninety final
256px cells were visually inspected against the existing bestiary/keeper
portraits for frontal identity, connected anatomy/equipment and clear edges.

## Selected repairs

- Lookout: two early attempts repeated the leading leg. The next isolated edit
  corrected it; a final complete-sheet edit matched the palette and restored one
  whistle at the chest, or at the mouth in the whistle pose. Intermediate sources
  remain as provenance; the coherent final sheet supplies all nine cells.
- Hexer: selected the full corrected sheet with opposite walking leads; staff
  stays in the left hand, casting palm in the right.
- Heartforged and Warlord: only corrected top-right walking cells replace their
  originals. Both hammer grips, and the cleaver/drum sides, remain consistent.
- Mimic: selected the frontal chest correction with a continuous hinged lid and
  attached tongue, replacing the original changing side views.
- Lich: revised crown/robe clearance and cold-blue spell light. Source middle-right
  is the gathering wind-up; source middle-left is the lowered-hand recovery.
  Reordering preserves the same casting hand across gather, strike and recovery.

## Export and runtime boundaries

`python3 art/creatures/export-batch-c.py --check` reproduces review and shipped
atlases, labelled neutral/walking/action sheets and measured registration.
Grounded visible alpha ends on row236 with at least 12px clearance. Each creature
uses one uniform scale; Lich uses recorded torso anchors for floating robes.
Unused reserve/blink/drift cells do not create runtime pose objects or abilities.
The floating Lich has no walking pose objects, so runtime previews omit those
cells while the complete atlas retains them for review.

Chest Mimics are painted only after revelation. Barrel/default Mimics remain
procedural, and disguised ones retain their actual chest/barrel scenery.
Submerged Drowned retain their ripple. Keeper phases after the first, and the
Warlord's throne and spear throws, retain procedural pictures. These limitations
are intentional; this batch does not claim painted coverage of those variants.
Named champions and companions retain their own identities.

`node art/creatures/preview-batch-c.cjs` captures supported poses through the real
runtime loader, shipped images and dungeon renderer at 390px and 320px. The
setup marks keeper introductions as already spoken so they cannot cover the
reviewed sprite. Attack and special warnings are asserted in each capture.

Local regression results are recorded in `integration-checks.md`. Publication
and CI WebKit verification are separate from these local review artifacts.
This is presentation-only: no gameplay, targeting, timing, scale or save changes,
so balance simulations are not required.
