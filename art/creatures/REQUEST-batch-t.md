# Batch T — first-person source kit

Audit all18 ordinary supported base weapon keys across seven class palettes plus
fist/cast hands (140 guide captures). This is a visual availability/palette audit,
not proof every weapon is legal for every class. P's Rune shield rear sources and
all inventory/relic art remain separate. S is preserved as an unpublished draft.

Commission16 baseline frames: Fighter longsword nine live cut poses (rest,
drawback, windup, strike, cut, sweep, through, recover, return); Mage staff four
actual grip variants (rest-two, drive-two, rest-one, channel-one); Ranger longbow
three supported bends (rest, bowdraw, bowfull). Other classes/weapons, fists,
casting hands, Wild Shape, reflected/named gear remain procedural follow-ups.
This is not a full held-library repaint or a new motion system.

Use direct held pose references and gritty painted monster materials. Transparent
background; complete isolated equipment, connected realistic hand/grip and sleeve
ends, >=12px source clearance, no scenes/text/cell borders. Preserve same object
proportions across a family and exactly referenced weapon angles/handedness.
Right sword arm extends lower-right; Mage staff uses bare pale hands and violet
cuff/sleeve, two hands only where requested; bow has ONE left hand/arm extending
lower-left, grey glove/cuff and brown sleeve from existing Ranger fallback palette.
Bow source has no string, arrow or drawing right hand: renderer supplies those live.
No new gems/runes, extra guards, blades, fingers, rings or world lights.

Native review exports256 RGBA use authored per-cell grip/object bounds and bow
nock points. One shared family scale retains object dimensions; sleeves may leave
screen, objects must fit existing heldPlacement. Review melee/recovery timings,
staff cast grip changes, bow .72 release, live string/nocks, Calm and160/360/464
view heights. Retain exact class/key/pose fallback for every uncovered case.
No shipped loader/offline/rules changes. Original source/prompts/repairs preserved;
export scripts only crop/uniformly resize/register, never paint or rotate poses.

Review finding: through-pose sleeve has3px source-sheet clearance but remains
complete and separated. All registered exports satisfy >=12px clearance. Preserve
this raw-source spacing exception in provenance; do not crop or repaint the sleeve
with scripts.
