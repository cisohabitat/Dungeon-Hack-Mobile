# AM — spell contact texture audit (31 October 2026)

Retain the existing force, holy and lightning drawings. This review does not
justify a new contact atlas: their small transient marks carry spell identity
without adding an opaque surface over the painted target. AM is complete as
an audit; AN healing/ward accents remain the next review candidate.

## Native evidence

`node docs/visual/2026-10-31-spell-contact-audit/capture.cjs` records actual
Magic Missile, Holy Smite, Lightning Bolt and Call Lightning casts through
`Game.castSpell`. All16 casts damage the target, spend the expected points and
advance the native game clock. The96 canvas frames sample travel/onset, four
post-impact phases and expiry at320/390px in Normal and Calm/safe modes.
Every sampled frame retains at least one renderer-reported warning.

The fixture supplies level10/resources, one durable adjacent Orc with a long
existing melee wind-up, cleared monsters/NPCs and recovery reset between casts.
Updates, renderer, assets, spell functions and clocks are not replaced. Source
hashes are checked before and after capture and retained in
[native/captures.json](native/captures.json). These are controlled action
captures, not UI-input coverage, an unassisted run, a six-target crowd review,
physical-device approval, a listening review or a new performance measurement.
Phase values are observed animation-frame times, not exact atlas boundaries.
Normal and Calm use separate actual casts and therefore different native damage
rolls; the two modes are not a pixel-matched rendering experiment.

Reviewed galleries:

- [390 Normal](native/390-normal-overview.png)
- [390 Calm/safe](native/390-calm-safe-overview.png)
- [320 Normal](native/320-normal-overview.png)
- [320 Calm/safe](native/320-calm-safe-overview.png)

## Decisions

| Family | Observed behavior and decision |
|---|---|
| Force | Magic Missile keeps three target-relative travelling facets and a small outlined diamond contact. Its650ms effect reaches contact halfway through. The mark reads over the white damage flash; a texture has very little visible area/time to add material. Retain the live path and outline. |
| Holy | Holy Smite keeps a pale-gold seal and side strokes around the torso, fading after its0.08 impact phase in a560ms effect. The early damage flash dominates the body; later frames restore the monster. Retain the restrained seal rather than adding another burst over it. |
| Lightning | Both existing spells share a380ms immediate-impact effect: a connected, fixed-seed bolt and a small angular contact. Calm removes the travelling bolt and retains the still local mark. Preserve the connected endpoints and distinct angular identity. |

`arcanefx.js` bounds force/holy base radii to8–28 buffer pixels;
`elementfx.js` caps the lightning contact radius at18. Those radii are geometry,
not proposed texture dimensions. Holy contact considers at most six targets;
force uses the first projected target. Warning rectangles are excluded by the
renderer, with receipts above the spell layer. The existing deterministic
regressions separately verify shapes, fade/expiry, Calm placement, actual costs/
impact timings and warning/receipt pixel protection. Their synthetic render
controls are distinct from the running native captures above.

No generated source, runtime image, loader, offline entry, allocation or gameplay
change is added. Existing painted fire/frost families remain intact. Balance
simulation is unnecessary because this publication changes documentation and
review tooling only. The runtime staysv0.9.68/build83; its existing release tag
must not move to this later documentation commit.

## Validation and publication

See [validation.json](validation.json) for local checks. Publication follows the
repository's documentation-only gates: release tooling and release-screen checks
on both Chromium projects, plus the mandatory exact-commit pre-push `npm test`.
The unchanged full browser/WebKit/performance CI matrix and publication job
remain required; local focused checks are not a substitute for that CI result.
