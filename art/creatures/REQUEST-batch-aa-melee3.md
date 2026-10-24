# AA ordinary melee — third source pass: remaining dagger classes

Source/review only. Preserve the unpublished second pass and all shipped0.9.35
art. Cover Fighter/Ranger/Druid/Spellblade dagger,9 CUT frames each,36 registered
class frames. Three new painted families (27 unique poses): Ranger reuses Fighter
only after all9 native PNGs, grips and object bounds are proved identical. Keep
separate exact class bindings for later activation; no wildcard class replacement.
Thief dagger is already active; Mage dagger is reviewed in the pending second
pass. This completes source coverage of all six legal dagger classes, not the
whole AA library. Cleric cannot equip a dagger and receives no dagger atlas.

One right hand, two=false, ordinary dagger only; no left/off-hand/thrust/enchant,
reflected/lit or named blade substitution. Existing nine CUT directions at
0/.08/.16/.24/.32/.42/.52/.68/.84 and recovery1. Cast/read/drink reuse rest;
Fighter casting is a presentation stress case, not a new class ability.

Keep compact plain dagger construction. Fighter/Ranger grey gauntlet/cuff and
brown sleeve; Druid brown glove/green cuff/brown sleeve; Spellblade charcoal
hand/slate cuff/dark cloth with fine silver crossing seams and a muted blue cuff
mark. No blade runes, invented glowing light, bear claws or costume recolours by
script. Gritty mature monster-compatible painting, true RGBA3x3 grids, complete
fingers/prop/sleeve ends with target8% transparent gutters. Author grips/object
bounds and register256px cells with>=12px alpha>32 clearance, uniform family
scale and object height<=64px. Scripts only crop/resize/translate/layout pixels.

Review every source/export, all CUT/Calm/recovery/read/drink/cast states at390/320,
and160/360/464 buffer heights. Preserve class/item-qualified capture names and
protected existing Thief/Mage/foci/named variants. Source proxies are not native
activation, offline, failure or performance evidence. Update the roadmap; later
runtime integration/publication require their own native/full release gates.
