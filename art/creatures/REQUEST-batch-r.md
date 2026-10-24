# Batch R — architecture source and state audit

Match gritty painted monsters and Batch O Grey Halls stone. Audit thirteen themes
and all existing architecture before commissioning. Produce a reusable baseline
kit of eight paintings: neutral plank door, neutral cell gate, cylindrical pillar
surface, up/down flat stair faces, up/down recessed stair backs and an open arch.
Other themes retain their original region-specific architecture until coordinated
material matching; this batch does not claim thirteen painted regional kits.

Use existing frontal 64px texture layouts as references. R1: three opaque square
panels, door/cell gate/pillar. R2: 2x2 opaque square panels, flat up/flat down,
recessed up/recessed down. R3: one square masonry arch with transparent opening.
Keep six door planks/two iron bands/right ring, eight cell bars/two crossbars/right
neutral lock, and full-width pillar capital/plinth. No isolated pillar silhouette:
the renderer supplies column geometry. Stair backs retain perspective and clear
up/down distinction; no physical new lights or routes. Arch uses the existing
narrow outer masonry and broad rounded opening, not a new freestanding doorway.
No creature anchors, padding or scene ground plane on these architecture textures.

Five key colours brass/silver/gold/iron/bone and their two existing lock families
remain procedural. Preserve exact colour/state bindings; generated decorative
locks are not authoritative replacement locks. Keep regional door/stair overlays,
cracked/burning door states, sliding texture sampling, secret-wall equivalence,
recess sides, navigation and collision. Paint no replacement regional states merely
to fill sheets. Source alpha cannot establish exact renderer arch geometry;
measure its mask against the live reference and retain procedural arch whenever
mismatched. No script painting, masking, recolouring or seam synthesis.

Review native64 and detail256 exports, source references, opening alpha and phone
booth substitutions. Archive prompts, sources/repairs, exact crops and hashes.
Source publication and runtime integration are separate tasks. Native/offline,
regional matching and performance remain integration gates.
