# Monster atlas brief library

Canonical planning file for all pending painted dungeon monster atlases.
Prepared 22 October 2026 against main `a6472543f4ee5469447c652e0a90b16f06a920fc`.

**Status:** Batch A's ten creatures generated, corrected and integrated on 23 October 2026.
Batch B is generated, repaired, visually reviewed and integrated; Batch C is generated, repaired, visually reviewed and integrated locally; Batch D is generated, repaired and integrated locally.
The runtime supports 53 painted identities, with unmatched Mimic and keeper variants procedural.
Variant requirements may require
more than one atlas for an entry, especially Shade and Mimic.

## Work after Batch D

See [ATLAS-ROADMAP.md](ATLAS-ROADMAP.md) for proposed Batches E–K: class Shades,
companions, barrel Mimic, boss variants, traders and encounter sheets. Start with
Spellblade Shade. Batch E sources and six preview atlases are now generated,
repaired and visually reviewed; see [the Batch E review](batch-e-preview/REVIEW.md).
Runtime integration is pending. Batch F companion sheets and Mender heal extension
are generated, repaired and reviewed; see [Batch F review](batch-f-preview/REVIEW.md).
Batch F review assets are published; runtime integration is pending.
Batch G barrel Mimic is generated, repaired and reviewed locally; see
[Batch G review](batch-g-preview/REVIEW.md). Integration/publication are pending;
Batches H–K remain planned.

## Requesting work later

Say **“Generate batch A from art/creatures/ATLAS-BRIEFS.md”**, or choose
individual entries, for example **“Generate briefs 21–25”** or **“Generate Orla
and Durgrim from the atlas brief library.”** A generation request authorises
creation and review of the requested art; use the stated publishing instructions
for integration. Keep the status current as each atlas is actually completed.

| Batch | Brief numbers | Scope | Current status |
|---|---|---|---|
| A | 1–10 | Rat through Ogre | Generated, revised and integrated |
| B | 11–20 | Troll through Cutpurse | Generated, repaired, reviewed and integrated |
| C | 21–30 | Remaining ordinary creatures and three keepers | Generated, reviewed and integrated locally |
| D | 31–40 | Shade and nine unpainted named champions | Generated, repaired and integrated locally |

Batch A generation succeeded with `image_gen.imagegen` on 22 October 2026.
Actual prompts, references and repair requests are preserved in
`generation-batch-a.json`; originals remain under `art/creatures/`.
Review exports and integrated dungeon captures are under `batch-a-preview/`;
matching shipped atlases are under `img/creatures/`. See its `REVIEW.md` for completed checks and limitations.

## Complete pending index

| Brief | Batch | Kind | Identity reference |
|---|---|---|---|
| 1 | A | `rat` | `img/bestiary/rat.webp` |
| 2 | A | `bat` | `img/bestiary/bat.webp` |
| 3 | A | `spider` | `img/bestiary/spider.webp` |
| 4 | A | `goblin` | `img/bestiary/goblin.webp` |
| 5 | A | `skeleton` | `img/bestiary/skeleton.webp` |
| 6 | A | `zombie` | `img/bestiary/zombie.webp` |
| 7 | A | `orc` | `img/bestiary/orc.webp` |
| 8 | A | `ghoul` | `img/bestiary/ghoul.webp` |
| 9 | A | `wraith` | `img/bestiary/wraith.webp` |
| 10 | A | `ogre` | `img/bestiary/ogre.webp` |
| 11 | B | `troll` | `img/bestiary/troll.webp` |
| 12 | B | `minotaur` | `img/bestiary/minotaur.webp` |
| 13 | B | `kobold` | `img/bestiary/kobold.webp` |
| 14 | B | `archer` | `img/bestiary/archer.webp` |
| 15 | B | `basilisk` | `img/bestiary/basilisk.webp` |
| 16 | B | `acolyte` | `img/bestiary/acolyte.webp` |
| 17 | B | `moth` | `img/bestiary/moth.webp` |
| 18 | B | `thornhog` | `img/bestiary/thornhog.webp` |
| 19 | B | `imp` | `img/bestiary/imp.webp` |
| 20 | B | `cutpurse` | `img/bestiary/cutpurse.webp` |
| 21 | C | `lookout` | `img/bestiary/lookout.webp` |
| 22 | C | `hexer` | `img/bestiary/hexer.webp` |
| 23 | C | `pikeman` | `img/bestiary/pikeman.webp` |
| 24 | C | `quillback` | `img/bestiary/quillback.webp` |
| 25 | C | `drowned` | `img/bestiary/drowned.webp` |
| 26 | C | `emberling` | `img/bestiary/emberling.webp` |
| 27 | C | `mimic` | `img/bestiary/mimic.webp` |
| 28 | C | `lich` | `img/bosses/lich.webp` |
| 29 | C | `heartforged` | `img/bosses/heartforged.webp` |
| 30 | C | `warlord` | `img/bosses/warlord.webp` |
| 31 | D | `shade` | `img/bestiary/shade.webp` |
| 32 | D | `grisk` | `img/bestiary/grisk.webp` |
| 33 | D | `vessra` | `img/bestiary/vessra.webp` |
| 34 | D | `ushgar` | `img/bestiary/ushgar.webp` |
| 35 | D | `morrow` | `img/bestiary/morrow.webp` |
| 36 | D | `orla` | `img/bestiary/orla.webp` |
| 37 | D | `gorrum` | `img/bestiary/gorrum.webp` |
| 38 | D | `vaelith` | `img/bestiary/vaelith.webp` |
| 39 | D | `hissra` | `img/bestiary/hissra.webp` |
| 40 | D | `durgrim` | `img/bestiary/durgrim.webp` |

## Shared art direction

Create one atlas per creature, with exactly nine complete figures in a 3×3 grid.
All heads and torsos face the player. Quadruped bodies recede behind the head;
small limb rotations must not turn a figure into a side profile. Keep the same
individual, proportions, materials and equipment throughout its atlas.

Match the established painted fantasy style: natural material detail, strong
silhouettes, warm amber light from upper left and a restrained cool right rim.
Faces and attack shapes must remain readable after reduction to 256px cells.
Do not bake dungeon scenery, fog, contact shadows or a ground plane into sprites.
The existing renderer supplies the environment, shading and warnings.

Use a transparent background and wide empty gutters. Keep all ears, tails,
wingtips, claws and weapon tips inside their own cells. Avoid detached debris,
loose particles and broad glows that obstruct extraction or hide anatomy.
Hold equipment through a continuous arm–wrist–closed grip–handle–weapon chain.
Never mirror a pose to obtain the opposite step: equipment stays in the same hand.
Anatomical right is the viewer's left.

## Cell order and movement

| Cell | Key | Direction |
|---|---|---|
| Top left | `idle` | Neutral frontal stance; clear face and silhouette. |
| Top centre | `stepA` | Right leg/forepaw leads; bat uses its first wingbeat phase. |
| Top right | `stepB` | Left leg/forepaw leads; bat uses the opposite wingbeat phase. |
| Middle left | `windup` | Readable preparation for the creature's existing attack. |
| Middle centre | `strike` | Forward attack at its fullest reach, facing the viewer. |
| Middle right | `recover` | Distinct return towards idle; equipment remains connected. |
| Bottom left | `special` | Existing special preparation where supported; otherwise a reserve threat pose. |
| Bottom centre | `hurt` | Brief recoil with the identity and limbs intact. |
| Bottom right | `blink` | Idle with closed eyes where anatomically appropriate; see exceptions below. |

Keep grounded figures on a consistent visible foot baseline. Wraith uses the
lowest solid robe fringe as its registration anchor; bat uses a stable body
centre and clearance, so wingbeats do not make its torso jump. Neither receives
feet or ground contact to satisfy registration.

Among batch A's ten creatures, only Wraith currently has a distinct `special` object.
Other reserve cells do not authorise new abilities or a new runtime pose.
Inspect the actual `POSES` objects before binding any cell; blink support is
derived from existing anatomy and must not be forced. Existing wind-up fallback,
motion timing, attack warnings and Calm view behaviour stay unchanged.


## Binding and variant safeguards

- Ordinary atlas names use their creature kind. Named champions use their own
  identity, not the base monster’s atlas or a generic tint. Resolve the exact
  `CHAMPION_OF`/elite object and its existing poses before binding.
- Skarrow is already painted and is excluded from the pending champion batch.
- Shade has class-specific gear. A default knight atlas alone is incomplete
  coverage; keep every unmatched class kit procedural until its own set is ready.
- Mimic concealment and barrel forms remain valid; never reveal painted teeth
  before discovery or silently replace a barrel with a chest.
- Boss phases may change visible handling. Preserve current phase behaviour and
  keep unmatched variants procedural; do not claim a neutral nine-pose atlas
  covers every phase without reviewing actual renderer selection.
- Eye-free, insect, skeletal and rocky creatures must not acquire invented eyelids
  just to fill the ninth cell. Unused cells stay unused when no pose object exists.
- Portrait scenery and attendants are references for context, not part of a
  dungeon sprite. Do not bake throne rooms, guards, hoards or web backgrounds in.

## Batch A — first ten creatures, integrated

## 1. Giant Rat

**Kind:** `rat`. **Reference:** `img/bestiary/rat.webp`. **Status:** generated and visually reviewed; preview in `batch-a-preview/rat.webp`, runtime integrated.

**Identity:** coarse brown fur, round pink ears, amber eyes, whiskered rodent
muzzle, yellow incisors, pink paws and one long bare pink tail. Four legs.
Keep it a rat rather than a wolf, boar or humanoid.

**Poses:** idle crouch with both front paws visible; Step A advances its right
forepaw and opposite hind leg; Step B swaps that diagonal pair. Wind-up lowers
the head and gathers the hindquarters; strike extends into a frontal biting
lunge; recover settles back onto the paws. Reserve threat bares its incisors.
Hurt rocks the shoulders back; blink closes its eyes without changing its muzzle.

**Reject:** side-on body, missing rear legs, duplicate tail, canine teeth replacing
incisors, detached whisker clumps or a tail crossing another cell.

## 2. Cave Bat

**Kind:** `bat`. **Reference:** `img/bestiary/bat.webp`. **Status:** generated and visually reviewed; preview in `batch-a-preview/bat.webp`, runtime integrated.

**Identity:** brown furry torso, enormous ears, fanged muzzle and warm leathery
wings. Two wings attached to its arms and two small hind feet. No extra human arms.

**Poses:** idle hovers facing forward with wings open; Step A lifts the wings;
Step B lowers them while the head and torso remain at a consistent height.
Wind-up draws the wing arms back and opens the mouth; strike reaches forward
with a bite; recover opens the wings to brake. Reserve threat spreads them wide.
Hurt curls the wings inward; blink closes both eyes in the neutral hover.

**Reject:** bird feathers, four wings, disconnected membranes, wingtip clipping,
side-on flight or huge body shifts between wingbeat frames.

## 3. Cave Spider

**Kind:** `spider`. **Reference:** `img/bestiary/spider.webp`. **Status:** generated and visually reviewed; preview in `batch-a-preview/spider.webp`, runtime integrated.

**Identity:** dark violet cave spider, clustered red eyes, red abdomen marking,
eight jointed walking legs, two small pedipalps and paired fangs. Keep the
abdomen behind the frontal face, with room to read all four leg pairs.

**Poses:** idle crouches evenly; steps alternate coordinated leg groups without
changing leg count. Wind-up raises the front body and draws the fangs back;
strike drives the face and fangs forward; recover lowers the body again.
Reserve threat spreads the front legs and parts the fangs, without a detached
web projectile. Hurt recoils through bent joints. Final idle variation subtly
changes the pedipalps; do not invent mammalian eyelids on spider eyes.

**Reject:** six or ten walking legs, scorpion tail, humanoid face, merged leg
roots, unreadable tangled silhouettes or a newly invented web-casting action.

## 4. Goblin

**Kind:** `goblin`. **Reference:** `img/bestiary/goblin.webp`. **Status:** generated and visually reviewed; preview in `batch-a-preview/goblin.webp`, runtime integrated.

**Identity:** small green pointed-eared humanoid, yellow eyes, hooked nose,
worn brown leather and ragged clothing. One knife held in its anatomical right
hand, on the viewer's left. No crown, banner or companion kit.

**Poses:** idle holds the knife low; steps alternate legs with modest shoulder
countermotion. Wind-up draws the knife arm back and raises the free hand;
strike thrusts the connected knife towards the viewer; recover withdraws it.
Reserve threat crouches defensively with its knife visible. Hurt pulls the
chest back; blink closes the eyes while keeping the neutral knife position.

**Reject:** floating blade, grip separated from wrist, knife changing hands,
extra fingers, side-facing head or Grisk's crown and cloak.

## 5. Skeleton

**Kind:** `skeleton`. **Reference:** `img/bestiary/skeleton.webp`. **Status:** generated and visually reviewed; preview in `batch-a-preview/skeleton.webp`, runtime integrated.

**Identity:** bone soldier in a rusty iron helmet and remnants of mail, carrying
a rusty straight sword in the right hand and a round wooden shield on the left.
Keep recognisable ribs, pelvis, knees and bone hands. No living flesh.

**Poses:** idle guards with sword and shield separate from the torso; steps
alternate legs while gear stays on its original side. Wind-up lifts the sword;
strike delivers a forward cut; recover returns the weapon towards guard.
Reserve threat braces behind the shield. Hurt bends back through the spine,
without scattering bones. Final idle variation tilts the skull slightly;
empty sockets do not acquire eyelids or glowing eyes absent from the reference.

**Reject:** broken sword grip, unattached shield, extra arm, missing lower leg,
fleshy face or a new resurrection animation bound to the reserve cell.

## 6. Zombie

**Kind:** `zombie`. **Reference:** `img/bestiary/zombie.webp`. **Status:** skin/lighting and blink revised and reviewed; preview in `batch-a-preview/zombie.webp`, runtime integrated.

**Identity:** pale decaying humanoid with sparse matted hair, clouded eyes and
ragged brown clothing. Heavy, slack posture; two arms and two legs. No weapon.

**Poses:** idle reaches one hand forward; steps alternate dragging legs, keeping
both feet attached. Wind-up brings both hands back towards the chest; strike
reaches into a frontal grab; recover lets the arms sink towards idle. Reserve
threat leans forward with its mouth open. Hurt folds the shoulders back;
blink briefly narrows or closes the existing eyes.

**Reject:** extra hands, disconnected fingers, acrobatic movement, skeletal
instead of fleshy limbs, or gore that conceals arm and neck connections.

## 7. Orc

**Kind:** `orc`. **Reference:** `img/bestiary/orc.webp`. **Status:** generated and visually reviewed; preview in `batch-a-preview/orc.webp`, runtime integrated.

**Identity:** muscular green tusked warrior, black scalp lock, worn leather and
iron armour, with one heavy axe held in its right hand. Larger and more solid
than Goblin. No chief's horned helmet, red war paint or skull ornaments.

**Poses:** idle holds the axe ready beside the torso; steps alternate legs while
the axe remains in the same hand. Wind-up draws the connected axe above the
right shoulder; strike cuts forward; recover follows through and begins the
return. Reserve threat braces for a charge without adding motion effects.
Hurt turns the shoulders slightly back while the head remains frontal;
blink closes its eyes without changing the tusks or brow.

**Reject:** floating axe head, broken shaft, changing hands, a blade through the
face, duplicate weapon or Ushgar's champion identity.

## 8. Ghoul

**Kind:** `ghoul`. **Reference:** `img/bestiary/ghoul.webp`. **Status:** generated and visually reviewed; preview in `batch-a-preview/ghoul.webp`, runtime integrated.

**Identity:** gaunt pale humanoid, needle teeth, sparse lank hair, long clawed
hands and ragged loincloth. Human ear shapes; no large pointed goblin ears.
Keep its lean, hungry silhouette distinct from Zombie's heavy shamble.

**Poses:** idle crouches on two legs with both hands low; steps alternate bent
legs. Wind-up pulls the shoulders and long hands back; strike thrusts the jaw
and claws forwards; recover sinks back into the crouch. Reserve threat parts
the hands and bares the teeth. Hurt retracts the chest; blink closes the eyes
without hiding the face in a new hood or mane.

**Reject:** extra limbs, claws detached from fingers, goblin anatomy, an ogre
belly or Morrow's finger-bone crown and thighbone.

## 9. Wraith

**Kind:** `wraith`. **Reference:** `img/bestiary/wraith.webp`. **Status:** generated and visually reviewed; preview in `batch-a-preview/wraith.webp`, runtime integrated.

**Identity:** tattered purple hood and robes around a visible spectral skull and
cold glowing eyes. Two spectral arms; no physical legs or feet. Preserve the
skull's readability through the spectral material.

**Poses:** idle floats over a consistent robe-fringe anchor; steps use opposite
cloth and arm drift without changing its hover height. Wind-up gathers one
hand towards the chest; strike reaches forward with a cold touch; recover
draws the arm back. Special raises both hands around a compact cold glow as
preparation for its existing chill. Hurt folds the shoulders and hood back.
Final idle variation dims the eye lights slightly; it does not grow eyelids.

**Reject:** missing skull, opaque smoke hiding the arms, physical feet,
background fog, detached glow particles or Abbess Orla's empty face and wimple.

## 10. Ogre

**Kind:** `ogre`. **Reference:** `img/bestiary/ogre.webp`. **Status:** generated and visually reviewed; preview in `batch-a-preview/ogre.webp`, runtime integrated.

**Identity:** huge brown-skinned, broad, bare-chested humanoid with a heavy belly,
small balding head, hide belt/loincloth and a thick wooden club with rough knots
or embedded spikes. Club held in the right hand. Two arms and two legs.

**Poses:** idle carries the club low; steps alternate heavy legs with restrained
body sway. Wind-up raises the club over the right shoulder with the gripping
arm fully connected; strike brings it forward and down; recover lowers it
towards idle. Reserve threat spreads its stance without acquiring a second
weapon. Hurt rocks its chest backwards; blink closes the eyes in neutral stance.

**Reject:** extra forearm, detached club, shaft passing through the fist without
a grip, green moss-covered troll features, tiny body or clipped raised weapon.


## Batch B — following ten pending creatures

## 11. Troll

**Kind:** `troll`. **Reference:** `img/bestiary/troll.webp`. **Status:** generated, repaired and visually reviewed; atlas in `batch-b-preview/troll.webp`, integrated and cached offline.

**Identity:** large green troll, long mossy hair, hooked nose, long arms and
heavy claws. Hunched but unmistakably humanoid, with two arms and two legs.
Natural moss lies on the body rather than becoming background foliage.

**Nine poses:**

1. Idle: shoulders hunched, long arms hanging, frontal hooked face visible.
2. Step A: right leg leads; opposite arm advances slightly.
3. Step B: left leg leads, without swapping scars or moss placement.
4. Wind-up: draw a clawed arm back; keep the wrist and fingers readable.
5. Strike: frontal claw sweep with modest torso twist, head facing the viewer.
6. Recover: retract the striking arm and settle into the hunch.
7. Reserve threat: spread both clawed hands and bare the teeth.
8. Hurt: shoulders recoil while planted feet remain connected.
9. Blink: neutral stance with eyes briefly closed.

**Reject:** Ogre's wooden club, extra arms, foliage hiding joints, a side-facing
head, or Gorrum's long white beard and skull necklace. Regeneration does not
require a new spell animation.

## 12. Minotaur

**Kind:** `minotaur`. **Reference:** `img/bestiary/minotaur.webp`. **Status:** generated, repaired and visually reviewed; atlas in `batch-b-preview/minotaur.webp`, integrated and cached offline.

**Identity:** muscular brown bull-headed warrior, swept horns, nose ring,
leather/iron fittings, cloven hooves and one double-headed axe. Hold its shaft
with both hands, separated along the same continuous haft.

**Nine poses:** idle with axe diagonal and face clear; right-hoof step;
left-hoof step; two-handed raised wind-up; powerful forward axe cut; connected
follow-through returning towards guard; reserve charge brace with lowered
shoulders and visible eyes; chest recoil with the axe retained; neutral blink.

**Reject:** a human face with horns, antlers, missing nose ring, human feet,
two separate axes, disconnected blades, hands on different shafts or horn and
axe tips clipped at the cell boundary. Charge keeps its existing wind-up fallback.

## 13. Kobold Trapper

**Kind:** `kobold`. **Reference:** `img/bestiary/kobold.webp`. **Status:** generated, repaired and visually reviewed; atlas in `batch-b-preview/kobold.webp`, integrated and cached offline.

**Identity:** small rust-red reptilian scavenger with a proper snout, amber
eyes, one tail, rough leather hood/kit, trapping supplies and a short spear.
Keep the spear as established equipment; its ordinary ranged attack still
throws darts. Do not turn it into a spear-thrower or bowman.

**Nine poses:** idle holds the spear in the left hand with a dart accessible to
the right; right-foot step; left-foot step; right arm draws a dart back while
the left retains the spear; right hand releases the dart towards the viewer,
without a painted projectile in flight; right hand returns to the belt;
reserve trap-setting crouch with hands visible; hurt retracts the shoulders;
neutral reptilian blink.

**Reject:** human mouth replacing the snout, green Lizardfolk identity, turtle
shield, extra tail, spear changing hands, a disconnected dart grip or a newly
spawned floor trap. The reserve pose remains unused unless an existing object
supports it.

## 14. Goblin Archer

**Kind:** `archer`. **Reference:** `img/bestiary/archer.webp`. **Status:** generated, repaired and visually reviewed; atlas in `batch-b-preview/archer.webp`, integrated and cached offline.

**Identity:** green goblin bowman with leather hood, quiver and simple wooden
bow. Bow in anatomical left hand (viewer right); right hand draws the string.
Keep two arms, a continuous bow stave and both string-to-tip connections.

**Nine poses:** idle holds the undrawn bow at the side; right-foot step;
left-foot step; wind-up draws a nocked arrow while keeping the face frontal;
strike releases the string and opens the drawing fingers; recover relaxes
the drawing arm; special prepares the existing fire arrow with a small warm
tip glow; hurt lowers the bow with the grip intact; neutral blink.

**Construction:** the arrow passes the rest above the bow grip, with its nock
on the string in drawn poses. After release, no arrow remains glued to the
string. Leave projectile travel and fire effects to the game. The drawing
hand, string and nock must agree in each frame, even in frontal foreshortening.

**Reject:** side-on torso, crossed wrists, two bows, free-floating string,
arrow through the fist, string in front of the bow tips or a detached quiver.

## 15. Basilisk

**Kind:** `basilisk`. **Reference:** `img/bestiary/basilisk.webp`. **Status:** generated, repaired and visually reviewed; atlas in `batch-b-preview/basilisk.webp`, integrated and cached offline.

**Identity:** low brown reptile with stony scales, amber eyes, a spined back
and one substantial tail. Preserve the existing multi-legged creature rather
than defaulting to a dragon: plan three leg pairs with readable roots and
appropriate rear-leg occlusion. No wings, fire throat or Cave Wyrm horns.

**Nine poses:** idle crouches with a frontal wedge-shaped snout; steps alternate
coordinated leg groups; wind-up lowers the jaw and draws the head back; strike
bites forward; recover closes the jaw and settles; special raises the head and
spreads its plated crown around a direct amber-green stare; hurt withdraws the
head; neutral reptilian blink.

**Reject:** side profile, missing leg pairs, tail becoming a separate snake,
an eye covered by plates, huge baked gaze beams or spikes severed from the body.
Do not change the actual gaze warning, range, visibility or effect to fit art.

## 16. Dark Acolyte

**Kind:** `acolyte`. **Reference:** `img/bestiary/acolyte.webp`. **Status:** generated, repaired and visually reviewed; atlas in `batch-b-preview/acolyte.webp`, integrated and cached offline.

**Identity:** gaunt living human in a black hood and dark robes, a visible human
face, violet magic and a bone-topped wooden staff. Staff in the left hand
(viewer right), free right hand casting. Bone top remains physically joined
to the shaft; keep small charms attached to their cords.

**Nine poses:** idle rests the staff beside the body; alternate right and left
steps below a consistent robe hem; wind-up gathers compact violet light in the
right palm; strike extends that hand towards the viewer; recover retracts it;
special raises the staff in preparation for existing mending; hurt recoils with
both arms attached; blink closes the visible human eyes under the hood.

**Reject:** Lich skull, royal crown, elf ears, bright purple replacement robes,
detached staff top, a floating casting hand or a large spell cloud hiding joints.
The existing spell effects retain their own colours and timing.

## 17. Glimmer Moth

**Kind:** `moth`. **Reference:** `img/bestiary/moth.webp`. **Status:** generated, repaired and visually reviewed; atlas in `batch-b-preview/moth.webp`, integrated and cached offline.

**Identity:** pale golden cave moth, fuzzy segmented body, patterned wings,
feathered antennae and dark insect eyes. Two forewings plus two hindwings,
six legs, two antennae. Wing eye-spots are markings, not extra heads or eyes.

**Nine poses:** neutral frontal hover; raised wingbeat phase; lowered wingbeat
phase; wind-up angles the wings back; strike beats forward; recover reopens
them; special spreads the patterned wings in a bright dazzle preparation;
hurt folds them inward; final idle variation adjusts antennae without eyelids.

**Registration:** hold the torso centre stable through wingbeats, with room
for all four wing lobes. Keep the wings' gold material visible under the flare;
use only compact local highlights, leaving the actual dazzle to the renderer.

**Reject:** butterfly replacement colours, two missing hindwings, four antennae,
bird feathers, giant particle halos, clipped wingtips or a body that jumps
vertically between wingbeat frames. Do not add a new blink object for this cell.

## 18. Thornhog

**Kind:** `thornhog`. **Reference:** `img/bestiary/thornhog.webp`. **Status:** generated, repaired and visually reviewed; atlas in `batch-b-preview/thornhog.webp`, integrated and cached offline.

**Identity:** small brown boar, short legs, blunt pig snout, small ears and a
mantle of quills rooted in its back. Four legs. Keep its pig silhouette distinct
from the larger bear-like Quillback, with a low body and short neck.

**Nine poses:** neutral frontal crouch with all four leg roots accounted for;
right diagonal step; left diagonal step; wind-up tucks the head and bunches the
shoulders; strike drives its snout forward; recover settles back; special raises
the existing quill mantle; hurt rocks the chest back; neutral blink.

**Reject:** bear muzzle or rounded bear paws, detached floating quills, extra
legs, armour plates replacing quills, huge invented tusks or side-on body.
Quills remain rooted in the same mantle across poses, not newly fired projectiles.

## 19. Gutter Imp

**Kind:** `imp`. **Reference:** `img/bestiary/imp.webp`. **Status:** generated, repaired and visually reviewed; atlas in `batch-b-preview/imp.webp`, integrated and cached offline.

**Identity:** small red-brown imp with curled horns, pointed ears, leathery
wings and one barbed tail. Two arms, two legs and two wings, with distinguishable
wing roots behind the shoulders. Keep its grin and eyes visible from the front.

**Nine poses:** grounded crouch with wings partly open; right-foot step;
left-foot step; wind-up draws claws back and opens the jaw; strike claws/bites
forward; recover crouches again; special gathers its limbs with a restrained
translucent edge in preparation for existing blink; hurt retracts the chest;
neutral blink with eyes shut.

**Reject:** extra arms masquerading as wings, duplicate tail, disconnected horns,
invented trident, permanent fire aura or a side-facing face. The portrait's
small smoking cup is incidental; do not introduce a held tool or new attack.
Teleport location, disappearance and travel effects stay with existing gameplay.

## 20. Goblin Cutpurse

**Kind:** `cutpurse`. **Reference:** `img/bestiary/cutpurse.webp`. **Status:** generated, repaired and visually reviewed; atlas in `batch-b-preview/cutpurse.webp`, integrated and cached offline.

**Identity:** hooded green goblin thief in dark leather, short knife and stolen
purse. Knife in anatomical right hand (viewer left); purse hangs on the left
belt or is held by the free left hand. Keep its face visible within the hood.

**Nine poses:** idle crouches with knife low; right-foot step; left-foot step;
wind-up draws the knife arm back; strike makes a short frontal knife thrust;
recover draws it close again; special extends the free hand to snatch while
the knife stays controlled; hurt pulls the shoulders back with gear retained;
neutral blink under the hood.

**Reject:** knife swapping hands, purse hovering beside the body, a third hand
to carry loot, a mask replacing the visible mouth, royal crown or companion
goblin kit. Do not paint stolen gold in flight or change real snatch behaviour.


## Batch C — remaining creatures and keepers

## 21. Goblin Lookout

**Kind:** `lookout`. **Reference:** `img/bestiary/lookout.webp`. **Status:** generated, repaired and visually reviewed; atlas in `batch-c-preview/`, integrated locally with variant safeguards.

**Identity:** Green goblin sentry, rough shoulder cape and a bone whistle on a cord; a short knife remains in the right hand. No large banner. Match the current portrait and procedural whistle hand.

| Cell | Pose direction |
|---|---|
| `idle` | Alert frontal stance, knife low and whistle resting at chest. |
| `stepA` | Right leg leads. |
| `stepB` | Left leg leads without swapping equipment. |
| `windup` | Draw knife arm back. |
| `strike` | Short frontal knife strike. |
| `recover` | Retract knife to the low guard. |
| `special` | Raise the whistle to the mouth with the free left hand. |
| `hurt` | Shoulders recoil, whistle and knife retained. |
| `blink` | Neutral eyes closed. |

**Reject / preserve:** No detached whistle, third hand, banner replacing the cape, knife swapping hands or baked sound rings.

## 22. Goblin Hexer

**Kind:** `hexer`. **Reference:** `img/bestiary/hexer.webp`. **Status:** generated, repaired and visually reviewed; atlas in `batch-c-preview/`, integrated locally with variant safeguards.

**Identity:** Green goblin witch in dark violet cloth, skull cap and bone-charm staff. Hold staff in left hand, cast with right; retain the visible hooked goblin face and attached charms.

| Cell | Pose direction |
|---|---|
| `idle` | Staff planted beside the body, free palm relaxed. |
| `stepA` | Right leg leads under the robe. |
| `stepB` | Left leg leads under the robe. |
| `windup` | Gather compact violet light in the free hand. |
| `strike` | Extend casting hand towards the viewer. |
| `recover` | Withdraw palm while retaining staff grip. |
| `special` | Raise free hand and bone charms for the existing hex preparation. |
| `hurt` | Hunch backwards with both hands attached. |
| `blink` | Close visible eyes under the skull cap. |

**Reject / preserve:** No human Acolyte face, disconnected staff skull, detached palm, new curse projectile or oversized magic hiding the joints.

## 23. Goblin Pikeman

**Kind:** `pikeman`. **Reference:** `img/bestiary/pikeman.webp`. **Status:** generated, repaired and visually reviewed; atlas in `batch-c-preview/`, integrated locally with variant safeguards.

**Identity:** Green goblin infantry, dented iron helmet, quilted coat, worn armour and one long pike. Both hands visibly grip the same continuous shaft; keep hands in consistent front/rear positions.

| Cell | Pose direction |
|---|---|
| `idle` | Pike diagonal beside the face, full tip visible. |
| `stepA` | Right leg leads with shaft steady. |
| `stepB` | Left leg leads with hand order unchanged. |
| `windup` | Draw the shaft back without changing hand order. |
| `strike` | Thrust straight towards the viewer using readable foreshortening. |
| `recover` | Withdraw the connected pike. |
| `special` | Brace with the pike aimed forward for the existing thrust preparation. |
| `hurt` | Torso recoils while retaining both grips. |
| `blink` | Neutral eyes closed beneath helmet. |

**Reject / preserve:** No detached spearhead, hands gripping different shafts, duplicate pike, tip clipping, pole through the face or extra arm. Do not shorten real attack reach to fit art.

## 24. Quillback

**Kind:** `quillback`. **Reference:** `img/bestiary/quillback.webp`. **Status:** generated, repaired and visually reviewed; atlas in `batch-c-preview/`, integrated locally with variant safeguards.

**Identity:** Large brown bear-like quilled beast, rounded ears, dark muzzle and broad paws. Four legs; a dense mantle of rooted quills. Distinct from the small pig-like Thornhog; no boar tusks.

| Cell | Pose direction |
|---|---|
| `idle` | Frontal bear crouch with readable rear haunches. |
| `stepA` | Right forepaw and opposite hind leg lead. |
| `stepB` | Opposite diagonal pair leads. |
| `windup` | Gather shoulders and pull one front paw back. |
| `strike` | Drive forward with jaws and forequarters. |
| `recover` | Settle onto all four paws. |
| `special` | Raise the attached quill mantle for existing bristle. |
| `hurt` | Rock the shoulders back without shedding quills. |
| `blink` | Neutral eyes closed. |

**Reject / preserve:** No pig snout, boar tusks, detached quill projectiles, extra paws, clipped mantle or side-facing body.

## 25. Drowned One

**Kind:** `drowned`. **Reference:** `img/bestiary/drowned.webp`. **Status:** generated, repaired and visually reviewed; atlas in `batch-c-preview/`, integrated locally with variant safeguards.

**Identity:** Waterlogged humanoid corpse with weeds attached to ragged dripping clothes. Two arms and two legs; slack face and heavy wet hair. Show a complete body for the revealed monster, not a permanent pool hiding its legs.

| Cell | Pose direction |
|---|---|
| `idle` | Revealed frontal corpse with both reaching hands visible. |
| `stepA` | Right dragging leg leads. |
| `stepB` | Left dragging leg leads. |
| `windup` | Draw shoulders and hands back. |
| `strike` | Reach forward with both hands for the existing grab. |
| `recover` | Let the arms fall towards idle. |
| `special` | Reserve rising/reaching threat, no painted pool. |
| `hurt` | Shoulders recoil, weeds attached to clothing. |
| `blink` | Subtle neutral eye closure if the existing anatomy supports it. |

**Reject / preserve:** No background water plane, missing submerged lower body, floating weed cloud, extra hand or new rise animation overriding concealment. Keep sunk/ripple behaviour in existing rendering.

## 26. Emberling

**Kind:** `emberling`. **Reference:** `img/bestiary/emberling.webp`. **Status:** generated, repaired and visually reviewed; atlas in `batch-c-preview/`, integrated locally with variant safeguards.

**Identity:** Small black basalt creature with orange fissures, glowing furnace core and a rocky face. Two arms and two legs with visibly connected stone joints; rock must retain dark material between fissures.

| Cell | Pose direction |
|---|---|
| `idle` | Compact frontal rock stance with local orange glow. |
| `stepA` | Right stone foot leads. |
| `stepB` | Left stone foot leads. |
| `windup` | Draw rocky arms back as fissures brighten slightly. |
| `strike` | Short forward rocky-arm blow. |
| `recover` | Settle arms and return fissure brightness. |
| `special` | Reserve contained flare preparation. |
| `hurt` | Recoil without detached boulders. |
| `blink` | Idle variation of fissure brightness; no invented fleshy eyelids. |

**Reject / preserve:** No floating rock limbs, oversized fire silhouette, white core erasing anatomy, new lava ground, detached embers or new special pose binding.

## 27. Mimic

**Kind:** `mimic`. **Reference:** `img/bestiary/mimic.webp`. **Status:** generated, repaired and visually reviewed; atlas in `batch-c-preview/`, integrated locally with variant safeguards.

**Identity:** Toothed wooden chest with metal bands, hinged lid, continuous gum line and long tongue attached inside the mouth. Chest is the bestiary identity; the game also has a valid barrel disguise that must remain supported.

| Cell | Pose direction |
|---|---|
| `idle` | Frontal revealed chest, lid slightly open. |
| `stepA` | Subtle rightward body weight shift. |
| `stepB` | Opposite weight shift, hinges stay on the same side. |
| `windup` | Hinge lid back and draw tongue inward. |
| `strike` | Lunge mouth and attached tongue forward. |
| `recover` | Retract tongue and settle lid. |
| `special` | Reserve gape threat. |
| `hurt` | Recoil as one hinged body. |
| `blink` | Idle variation of jaw gap; do not invent eyes or eyelids absent from the reference. |

**Reject / preserve:** No detached lid, floating tongue, human legs, changed hinge location or attack art shown before discovery. Generate a matching barrel-form set before substituting that variant, or keep its procedural art.

## 28. Dread Lich

**Kind:** `lich`. **Reference:** `img/bosses/lich.webp`. **Status:** generated, repaired and visually reviewed; atlas in `batch-c-preview/`, integrated locally with variant safeguards.

**Identity:** Undead skull in a dark hood and robes, gold crown and aged gold fittings. Two skeletal arms; skull and crown remain visible. Match the current keeper/bestiary painting, preserving the existing cold spell light even where the portrait has violet accents.

| Cell | Pose direction |
|---|---|
| `idle` | Frontal regal float with skeletal hands relaxed. |
| `stepA` | Rightward robe drift with stable torso. |
| `stepB` | Opposite robe drift with stable torso. |
| `windup` | Gather cold light close to a skeletal palm. |
| `strike` | Extend that connected hand towards the player. |
| `recover` | Withdraw hand beneath robe edge. |
| `special` | Raise both arms for the existing nova preparation. |
| `hurt` | Hood and shoulders recoil while crown stays attached. |
| `blink` | Neutral eye-light variation, no fleshy lids. |

**Reject / preserve:** No living wizard face, hidden skull, detached crown or new throne/background. Keep existing guards, phase changes, torch extinction and spell effects in game code; do not invent extra atlas-driven phases.

## 29. Heartforged

**Kind:** `heartforged`. **Reference:** `img/bosses/heartforged.webp`. **Status:** generated, repaired and visually reviewed; atlas in `batch-c-preview/`, integrated locally with variant safeguards.

**Identity:** Dark iron furnace guardian with articulated limbs, glowing chest furnace and one heavy smith hammer. Preserve iron mass, rivets and furnace grille from the current boss painting. Both gauntlets grip the same hammer shaft where a two-handed pose requires it.

| Cell | Pose direction |
|---|---|
| `idle` | Heavy frontal planted stance, hammer low across body. |
| `stepA` | Right metal foot leads. |
| `stepB` | Left metal foot leads. |
| `windup` | Lift hammer through connected shoulders and elbows. |
| `strike` | Drive hammer forward and down without losing either required grip. |
| `recover` | Lower hammer towards idle. |
| `special` | Reserve planted stamp brace with chest glow contained. |
| `hurt` | Armoured torso recoils as one articulated machine. |
| `blink` | Idle furnace/grille variation; no eyelids. |

**Reject / preserve:** No floating hammer head, molten featureless torso, disconnected plate limbs or detached chest. Preserve furnace-opening phases, spawned Emberlings and fire-line effects; no new special object merely to use this cell.

## 30. Goblin Warlord

**Kind:** `warlord`. **Reference:** `img/bosses/warlord.webp`. **Status:** generated, repaired and visually reviewed; atlas in `batch-c-preview/`, integrated locally with variant safeguards.

**Identity:** Large olive goblin king with hammered-gold crown, dark leather, fur, red cloak and war drum at the hip. Keep his existing cleaver and drum attachments; distinguish his real gold crown from Grisk’s bucket-and-spoon crown.

| Cell | Pose direction |
|---|---|
| `idle` | Frontal king stance with cleaver in right hand and drum strapped at hip. |
| `stepA` | Right leg leads. |
| `stepB` | Left leg leads without swapping drum side. |
| `windup` | Raise the cleaver through a closed grip. |
| `strike` | Frontal cleaver cut. |
| `recover` | Lower the cleaver towards guard. |
| `special` | Reserve drum preparation with free hand near the strapped drum. |
| `hurt` | Chest recoil while crown and drum remain attached. |
| `blink` | Neutral eyes closed. |

**Reject / preserve:** No floating drum, third hand to play it, detached blade or Grisk crown. Later spear/throne behaviour must retain its real equipment and phase handling; keep procedural phase variants until equivalent paintings are approved.


## Batch D — Shade and named champions

## 31. Shade

**Kind:** `shade`. **Reference:** `img/bestiary/shade.webp`. **Status:** generated, repaired and visually reviewed; integrated locally with class/variant safeguards.

**Identity:** Cold blue spectral fallen knight in armour with sword and shield for the default identity. Keep a readable helmet/face opening, connected gear and restrained translucent edges. This default must not replace the existing fallen hero’s class-specific equipment.

| Cell | Pose direction |
|---|---|
| `idle` | Frontal spectral guard, right-hand sword and left-hand shield. |
| `stepA` | Opposite robe/armour drift with stable torso. |
| `stepB` | Return drift, equipment stays on its side. |
| `windup` | Draw weapon arm back. |
| `strike` | Forward connected sword strike. |
| `recover` | Return to guard. |
| `special` | Reserve spectral brace. |
| `hurt` | Upper body recoils, gear retained. |
| `blink` | Neutral eye-light or helm variation without invented living features. |

**Reject / preserve:** No universal sword-and-shield substitution for caster, ranged or other class variants. Inspect SHADE_GEAR and actual renderer selection: prepare separate approved sets per existing class kit, or leave those kits procedural. Preserve saved identity and equipment; no ghost opacity that hides grips.

## 32. Grisk — Goblin King

**Kind:** `grisk`. **Reference:** `img/bestiary/grisk.webp`. **Status:** generated, repaired and visually reviewed; integrated locally with class/variant safeguards.

**Identity:** Green goblin king, dented bucket crown with bent spoons, ragged red cloak, junk belt and short knife. More important than a common goblin, but not the gold-crowned Warlord. Keep spoons physically fixed to the crown.

| Cell | Pose direction |
|---|---|
| `idle` | Frontal improvised royal stance, knife low. |
| `stepA` | Right leg leads. |
| `stepB` | Left leg leads. |
| `windup` | Draw knife back while crown stays upright. |
| `strike` | Frontal knife thrust. |
| `recover` | Withdraw knife. |
| `special` | Reserve rally threat with free hand raised. |
| `hurt` | Recoil with bucket crown retained. |
| `blink` | Neutral goblin blink. |

**Reject / preserve:** No gold replacement crown, missing spoon tips, floating knife or newly spawned guards in the atlas. Bind its own champion objects, never a generic goblin tint.

## 33. Vessra — Web-Mother

**Kind:** `vessra`. **Reference:** `img/bestiary/vessra.webp`. **Status:** generated, repaired and visually reviewed; integrated locally with class/variant safeguards.

**Identity:** Elder spider queen, broad body with pale abdomen marking and attached hanging silk. Eight jointed walking legs, two pedipalps and paired fangs. Front-facing head; abdomen recedes behind, with pale marking readable where visible.

| Cell | Pose direction |
|---|---|
| `idle` | Low frontal queen stance. |
| `stepA` | Advance one coordinated leg group. |
| `stepB` | Advance the opposite group. |
| `windup` | Raise forebody and draw fangs back. |
| `strike` | Bite forward through connected neck/body. |
| `recover` | Settle forebody. |
| `special` | Reserve silk-threat posture without a projectile. |
| `hurt` | Bend joints and recoil without losing legs. |
| `blink` | Idle palp or silk variation, no eyelids. |

**Reject / preserve:** No six-legged insect, extra legs mistaken for silk, detached web backdrop or ordinary spider’s red abdomen marking. Existing web ability keeps its current fallback and timing; champion art remains separate.

## 34. Ushgar — Orc Warchief

**Kind:** `ushgar`. **Reference:** `img/bestiary/ushgar.webp`. **Status:** generated, repaired and visually reviewed; integrated locally with class/variant safeguards.

**Identity:** Green orc chief, horned iron helmet, red face paint, fur and skull ornaments, with his heavy axe. Keep horn roots and skull straps attached. Larger authority and richer equipment than an ordinary Orc.

| Cell | Pose direction |
|---|---|
| `idle` | Frontal axe-ready stance. |
| `stepA` | Right leg leads. |
| `stepB` | Left leg leads. |
| `windup` | Lift axe above right shoulder. |
| `strike` | Cut forward with connected axe grip. |
| `recover` | Follow through and return. |
| `special` | Reserve charge brace. |
| `hurt` | Recoil while keeping helmet and axe attached. |
| `blink` | Neutral blink beneath helmet. |

**Reject / preserve:** No generic Orc recolour, missing red paint, helmet horns emerging from skin, detached axe head, companion drums or new charge motion authored by atlas timing.

## 35. Morrow — Ghoul Lord

**Kind:** `morrow`. **Reference:** `img/bestiary/morrow.webp`. **Status:** generated, repaired and visually reviewed; integrated locally with class/variant safeguards.

**Identity:** Yellow-grey elder ghoul with a heavy belly, finger-bone crown and a thighbone held across its jaws. Long clawed arms and ragged clothing. Keep it recognisably different from the ordinary gaunt Ghoul.

| Cell | Pose direction |
|---|---|
| `idle` | Frontal hungry crouch with jaw-held bone visible. |
| `stepA` | Right leg leads. |
| `stepB` | Left leg leads. |
| `windup` | Draw clawed hands back, bone stays between jaws. |
| `strike` | Reach both claws forward rather than dropping the identifying bone for a bite. |
| `recover` | Withdraw hands to the belly. |
| `special` | Reserve teeth-baring threat around the retained bone. |
| `hurt` | Shoulders recoil with crown and bone attached. |
| `blink` | Neutral eye closure. |

**Reject / preserve:** No ordinary thin Ghoul silhouette, bone floating in front of the face, extra jaw or missing crown. Do not create a new paralysis action or substitute ordinary ghoul art for its champion objects.

## 36. Orla — Hollow Abbess

**Kind:** `orla`. **Reference:** `img/bestiary/orla.webp`. **Status:** generated, repaired and visually reviewed; integrated locally with class/variant safeguards.

**Identity:** Grey spectral habit, white wimple, completely empty black face opening, prayer beads in connected hands and a cracked halo behind the hood. No skull, eyes, nose, mouth or feet.

| Cell | Pose direction |
|---|---|
| `idle` | Frontal prayer hover with beads visibly held. |
| `stepA` | Gentle rightward habit drift. |
| `stepB` | Opposite habit drift with stable hood. |
| `windup` | Draw one hand back, beads retained by the other. |
| `strike` | Reach one spectral hand towards the viewer. |
| `recover` | Return towards prayer. |
| `special` | Lift connected hands and beads for existing draining preparation. |
| `hurt` | Hood and shoulders recoil, face remains empty. |
| `blink` | Idle halo/bead variation, never a blink with eyes. |

**Reject / preserve:** No Wraith skull, glowing eye sockets, living nun face, unbroken halo, floating beads or face revealed during hurt. Keep halo crack and wimple consistent in every frame; map only existing champion pose objects.

## 37. Gorrum — Troll-Father

**Kind:** `gorrum`. **Reference:** `img/bestiary/gorrum.webp`. **Status:** generated, repaired and visually reviewed; integrated locally with class/variant safeguards.

**Identity:** Ancient grey-green troll, long white moss beard and mane, heavy hooked features and skull necklace. Two long arms and two legs. Keep beard rooted beneath the jaw and necklace fixed to its cord.

| Cell | Pose direction |
|---|---|
| `idle` | Frontal ancient troll hunch. |
| `stepA` | Right leg leads. |
| `stepB` | Left leg leads. |
| `windup` | Draw long clawed arm back. |
| `strike` | Heavy frontal claw strike. |
| `recover` | Lower arm into hunch. |
| `special` | Reserve looming threat. |
| `hurt` | Shoulders recoil without beard detaching. |
| `blink` | Neutral slow blink. |

**Reject / preserve:** No ordinary green-haired Troll substitute, wooden club, clipped beard, skulls floating without a necklace, extra hands or regeneration effect baked into the body.

## 38. Vaelith — High Priestess

**Kind:** `vaelith`. **Reference:** `img/bestiary/vaelith.webp`. **Status:** generated, repaired and visually reviewed; integrated locally with class/variant safeguards.

**Identity:** Ash-skinned elf priestess, long white hair, silver spider crown and black/wine-red robes with silver fittings. Preserve the current painting’s staff and frontal face; connected left-hand staff grip and free right casting hand.

| Cell | Pose direction |
|---|---|
| `idle` | Frontal composed priestess stance. |
| `stepA` | Right leg leads beneath robe. |
| `stepB` | Left leg leads beneath robe. |
| `windup` | Gather restrained shadow light in free palm. |
| `strike` | Extend casting hand forward, staff retained. |
| `recover` | Retract palm. |
| `special` | Raise hand and staff for existing mending chant. |
| `hurt` | Upper body recoils, crown remains fixed. |
| `blink` | Neutral eye closure. |

**Reject / preserve:** No generic violet-robed Drow Mage replacement, gold crown, missing spider motif, detached staff ornament or background altar. Bind drow_mage.elite.vaelith and its supported poses explicitly; retain shadow lash and healing behaviour.

## 39. Hissra — Marsh-Mother

**Kind:** `hissra`. **Reference:** `img/bestiary/hissra.webp`. **Status:** generated, repaired and visually reviewed; integrated locally with class/variant safeguards.

**Identity:** Dark green elder lizard, white crest, tooth collar and reed mantle. Proper projecting reptilian snout, one heavy tail, spear in right hand and turtle-shell shield in left consistent with her inherited warrior kit.

| Cell | Pose direction |
|---|---|
| `idle` | Frontal elder warrior guard. |
| `stepA` | Right leg leads. |
| `stepB` | Left leg leads. |
| `windup` | Draw spear back. |
| `strike` | Forward spear thrust through a continuous grip. |
| `recover` | Retract spear to guard. |
| `special` | Coil tail for the existing sweep preparation while face stays frontal. |
| `hurt` | Chest recoils with crest and collar attached. |
| `blink` | Neutral reptilian blink. |

**Reject / preserve:** No orange young-warrior crest, human mouth, generic Shaman kit, detached tail, shield without grip or missing white crest. Bind lizardfolk.elite.hissra separately and preserve her existing sweep geometry.

## 40. Durgrim — Forge-Thane

**Kind:** `durgrim`. **Reference:** `img/bestiary/durgrim.webp`. **Status:** generated, repaired and visually reviewed; integrated locally with class/variant safeguards.

**Identity:** Grey dwarf with long white beard bound in copper rings, iron crown, forge-scorched red cloak, smith apron and heavy smith hammer. Keep the block head and shaft joined; right-hand grip stays closed throughout.

| Cell | Pose direction |
|---|---|
| `idle` | Frontal smith-thane stance, hammer low. |
| `stepA` | Right leg leads. |
| `stepB` | Left leg leads. |
| `windup` | Lift hammer above right shoulder. |
| `strike` | Bring hammer forward and down. |
| `recover` | Lower hammer towards idle. |
| `special` | Brace for existing enlargement working without painting a larger body. |
| `hurt` | Shoulders recoil with crown and hammer retained. |
| `blink` | Neutral eyes closed beneath brow. |

**Reject / preserve:** No ordinary dark-bearded Grey Dwarf substitute, gold crown, detached copper rings, floating hammer or permanent enlarged scale baked into one frame. Bind grey_dwarf.elite.durgrim explicitly; existing rendering supplies size changes.


## Production and review

1. Generate and preserve one original PNG at `art/creatures/<kind>.png`.
   Record the actual tool, date, prompt and reference files. Do not claim image
   generation or approval until the files exist and have been inspected.
2. Inspect all nine source poses for frontal presentation, identity, connected
   limbs and grips, alternate steps and complete edges. Correct failures through
   the image-generation tool; keep any separate replacement frame as provenance.
3. Register nine transparent 256×256 cells into one 768×768 WebP per creature at
   `img/creatures/<kind>.webp`, using reproducible extraction. Grounded visible
   feet end on pixel row 236; retain at least 12px of visible-alpha clearance at
   the other edges. For floating creatures, measure appropriate body anchors
   and margins explicitly rather than stretching or shifting each pose by eye.
4. Inspect the exported atlases at native cell size, together with the sources.
   Verify alpha, pose order, consistent body registration and no clipped details.
   Only then record their hashes in `art/review.json` and provenance in
   `SOURCES.md` and the generation manifest.
5. Extend the existing lazy loader and offline cache, retaining per-species
   fallback on load failure. Keep named champions and companions on their own
   art. No new gameplay, timing, scale, visibility or save fields.
6. Exercise supported poses, lighting, elite tints, warnings, Calm view,
   occlusion, dice invariance, atlas failure isolation and native offline reload
   at both phone sizes. Inspect actual dungeon draws, not just isolated sheets.
7. Prepare release metadata only for the completed integration. Run required
   regression and performance checks, including CI WebKit, before publication.
   This presentation-only batch does not require balance simulations unless
   implementation changes gameplay outcomes.

## Preview deliverables

- A labelled contact sheet showing all ten neutral poses at comparable scale.
- All ten complete nine-pose sheets, so alternating leads and attacks can be
  checked before integration.
- Actual dungeon previews of each creature's idle and attack preparation at
  390px, with fitting and warning checks at 320px.
- A brief review record listing any repaired frames and remaining limitations.

## Already live — reference inventory

These thirteen atlases are complete on the stated base revision. Do not regenerate
or replace them merely because this library is used. Their source and production
records remain in `SOURCES.md`, `generation.json`, `generation-batch.json` and
`art/review.json`.

| Kind | Shipped atlas | Identity to preserve |
|---|---|---|
| `drow_warrior` | `img/creatures/drow_warrior.webp` | Ash-grey elf with white hair, black armour and two held curved blades. |
| `hound` | `img/creatures/hound.webp` | Lean charcoal hound, canine muzzle and ears, violet eyes and blink wisps. |
| `wyrm` | `img/creatures/wyrm.webp` | Wingless rust-red drake with heavy body, long reptilian jaw and curled horns. |
| `lizardfolk` | `img/creatures/lizardfolk.webp` | Green reptilian warrior, orange crest, spear, turtle-shell shield and heavy tail. |
| `dwarf_arbalest` | `img/creatures/dwarf_arbalest.webp` | Grey dwarf with dark beard, iron helmet and large crossbow. |
| `slime` | `img/creatures/slime.webp` | Faceless green gel mound, glossy lobes, bubbles and airborne droplets. |
| `rustmaw` | `img/creatures/rustmaw.webp` | Rust-brown armoured beetle, enormous mandibles and feathered antennae. |
| `skarrow` | `img/creatures/skarrow.webp` | Ash-brown elder wyrm with third horn, facial scar, clouded eye and hoard. |
| `drow_mage` | `img/creatures/drow_mage.webp` | Ash-grey white-haired elf in violet robes with violet fire. |
| `grey_dwarf` | `img/creatures/grey_dwarf.webp` | Broad grey dwarf with dark braided beard, copper fittings and a block-headed hammer. |
| `lizard_shaman` | `img/creatures/lizard_shaman.webp` | Green reptilian shaman with orange crest, reed cloak, bone charms and staff. |
| `eyeless` | `img/creatures/eyeless.webp` | Pale long-limbed hunter with smooth blind head, needle teeth and claws; no ears or eye sockets. |
| `puffcap` | `img/creatures/puffcap.webp` | Pale rounded fungus with scabbed skin, gills, stubby roots and spores; no skull face. |
