// A class's own Mythic: a different bargain, not another enchantment step.
const MYTHIC_POWERS = {
  last_gate: 'Last Gate: an ordinary close blow loses 2 damage, stored for your next close hit within five seconds (up to 3). Armour class −1.',
  mercy_oath: 'Mercy\'s Oath: healing spells mend a quarter more. Damaging spells cost 1 extra spell point.',
  bloodstar: 'Bloodstar: damaging spells deal a fifth more, but cost 2 life when cast. You cannot cast them with 2 life or less; wards cannot pay the price.',
  nightglass: 'Nightglass: close strikes deal 2 extra damage, or 6 from the shadows. Armour class −1.',
  horizon: 'Horizon: arrows deal 4 extra damage, but drawing this bow takes 15% longer.',
  elderseed: 'Elderseed: the bear\'s hide takes 4 more damage, and Entangle lasts a second longer. Healing spells mend a fifth less.',
};
const MYTHICS = {
  last_gate: { t: 'shield', e: 1, name: 'the Last Gate', powers: ['last_gate'], value: 520, mythic: 'fighter', beyond: true,
    lore: 'The last shield carried out of a fallen hold. Its face is split, and the split will not close. It keeps a little of every blow, to give back through the other hand.' },
  mercys_oath: { t: 'holy_symbol', e: 0, name: 'Mercy\'s Oath', powers: ['mercy_oath'], value: 520, mythic: 'cleric', beyond: true,
    lore: 'A lamp held open by two silver hands. The priest who made it vowed that no prayer would be wasted on a wound. The god agreed, and charged more for every prayer spoken in anger.' },
  bloodstar: { t: 'crystal_orb', e: 0, name: 'the Bloodstar', powers: ['bloodstar'], value: 520, mythic: 'mage', beyond: true,
    lore: 'A red star caught in clear glass. It burns brighter for a drop of its bearer\'s blood. The glass is whole; the blood finds its way inside all the same.' },
  nightglass: { t: 'amulet_mind', e: 0, name: 'Nightglass', powers: ['nightglass'], value: 520, mythic: 'thief', beyond: true,
    lore: 'A shard of a mirror that never showed a face. Through it, the gaps in another creature\'s guard are plain. Through those same gaps, the creature sees you.' },
  horizon: { t: 'longbow', e: 1, name: 'Horizon', powers: ['horizon'], value: 520, mythic: 'ranger', beyond: true,
    lore: 'A bow of white ash with iron at the tips. It takes a steady pull and will not be hurried. When the string is loosed, the passage seems a little shorter.' },
  elderseed: { t: 'amulet_ward', e: 0, name: 'the Elderseed', powers: ['elderseed'], value: 520, mythic: 'druid', beyond: true,
    lore: 'An acorn from the first oak to grow above the mountain. It remembers bark, roots and claws more clearly than flesh. What it strengthens in the beast, it takes from the healer.' },
};
const MYTHIC_CHOICE = {
  label: 'Face the lamp\'s trial for a Mythic',
  outcome: { text: 'The flame bends towards the bowl. Iron feet strike the floor: an ogre steps out of the dark to keep the lamp\'s last gift. The lamp\'s other aid is spent. Defeat it to claim the piece made for your class.', effects: [{ mythic: 1 }] },
};
const MYTHIC_OFFER = 'A single Mythic can be earned here instead of the lamp\'s usual aid: defeat an extra ogre, without a free heal. The item has a class power and a drawback. Only one Mythic may be worn at a time.';
export { MYTHICS, MYTHIC_POWERS, MYTHIC_CHOICE, MYTHIC_OFFER };
