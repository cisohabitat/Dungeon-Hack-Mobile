// Combinations: the places where two of the game's things meet and make more
// than either alone, a talent with a relic, an oil with a monster, an element
// with the place, a legend with its path. Each is named the first time it
// happens in a run, counted every time after, and kept in the journal from
// one delve to the next once found, as the bestiary keeps a creature.
//
// The rules themselves live where they always did (elements.js, combat.js,
// legends.js and the rest); each only says here that it happened, through
// note(id). The end of a run names its build from the ones it leaned on most.
// Wired near the end of game.js, borrowing what it needs through K.

/**
 * Every combination, in the order the journal shows them: its name, and one
 * line on what it is, in the player's terms. `hint` is what an unfound one
 * says, so the journal points the way without giving it all away.
 */
const COMBOS = {
  conduction: { name: 'Conduction', text: 'Lightning cast into water runs through it to everything standing there.', hint: 'Lightning, and water.' },
  flash_freeze: { name: 'Flash Freeze', text: 'Cold cast into water freezes it round your foes and holds them fast.', hint: 'Cold, and water.' },
  cold_seal: { name: 'Sealed Crack', text: 'Cold crusts a smouldering crack over, so it cannot flare for a while.', hint: 'Cold, where the floor smoulders.' },
  quench: { name: 'Quenched', text: 'Cold dulls an emberling\'s glow before it can flare.', hint: 'Cold, against a thing of embers.' },
  oil_fire: { name: 'Sheet of Flame', text: 'Fire set to spilt oil goes up all at once.', hint: 'Fire, and lamp oil.' },
  brushfire: { name: 'Brushfire', text: 'Fire set to an overgrown floor\'s moss runs across it.', hint: 'Fire, where the moss is thick.' },
  door_fire: { name: 'Burning Door', text: 'Fire set to a wooden door burns it down to an open doorway.', hint: 'Fire, and a door.' },
  web_burn: { name: 'Burnt Free', text: 'Fire shrivels a web that holds you.', hint: 'Fire, when a web has you.' },
  trolls_bane: { name: 'Troll\'s Bane', text: 'Fire on your blade stops a troll\'s wounds closing.', hint: 'Fire on a blade, against what regrows.' },
  silver_dead: { name: 'Silver and Bone', text: 'Silver Wash on your blade bites into the undead.', hint: 'An oil, against the dead.' },
  broken_off: { name: 'Broken Off', text: 'A Bash breaks off a blow or a trick a foe was drawing back.', hint: 'A fighter\'s Bash, at the right moment.' },
  through_the_pack: { name: 'Through the Pack', text: 'Cleave carries a blow on into the one behind the front of a group.', hint: 'A fighter\'s talent, against many at once.' },
  held_for_the_pack: { name: 'Held for the Pack', text: 'Your companion savages a foe your roots hold still.', hint: 'A druid\'s roots, and a friend.' },
  smoke_strike: { name: 'Out of the Smoke', text: 'A foe that has lost you in your Smoke takes a strike from the shadows.', hint: 'A thief\'s Smoke, and a blade.' },
  shadow_step: { name: 'Shadow Step', text: 'A sidestep puts your next blow in the shadows.', hint: 'A thief\'s talent for stepping aside.' },
  nightwalk: { name: 'The Nightwalk', text: 'Whisper and Shadowskin worn together deepen a strike from the shadows.', hint: 'Two relics made for the dark, worn together.' },
  snared_prey: { name: 'Snared Prey', text: 'A Warden\'s blows bite deeper into a foe held by the Snare.', hint: 'A Warden, and a Snare.' },
  icebound_prey: { name: 'Icebound Prey', text: 'A Warden\'s blows bite deeper into a foe held fast in ice.', hint: 'A Warden, and water frozen round a foe.' },
  dawn_order: { name: 'Order of the Dawn', text: 'Dawnbringer and the Sisters\' Buckler worn together burn the undead.', hint: 'Two relics of a temple order, worn together.' },
  shatter: { name: 'Shatter', text: 'A foe held back by your cold dies brittle under the Rimebound Grimoire, and breaks, chilling those beside it.', hint: 'A Frostweaver\'s legend.' },
  pyre: { name: 'Pyre', text: 'A foe dying in flames bursts under Cinderheart, and scorches those beside it.', hint: 'A Pyromancer\'s legend.' },
  chain_pyre: { name: 'Chain of Pyres', text: 'One bursting foe burns the next to death, and that one bursts too.', hint: 'A Pyromancer\'s legend, among many foes.' },
  shield_wall: { name: 'The Wall Holds', text: 'The Bastion catches a blow whole on a Knight\'s shield, and readies the Bash.', hint: 'A Knight\'s legend.' },
  red_feast: { name: 'Red Feast', text: 'Red Harvest and Bloodlust both feed on the one kill.', hint: 'A Berserker\'s legend, and a capstone.' },
  dawnfire: { name: 'Dawnfire', text: 'Silver Wash on the Sunhammer: the dead burn as they are cut.', hint: 'A Templar\'s legend, and an oil.' },
  pack_and_root: { name: 'Pack and Root', text: 'Your companion fells a foe, and Heartroot mends you for it.', hint: 'A Grovewarden\'s legend, and a friend.' },
  jest: { name: 'The Fool\'s Opening', text: 'Motley turns a blow you slip aside from into an opening.', hint: 'A Trickster\'s legend.' },
  unbroken_shadow: { name: 'Unbroken Shadow', text: 'A kill from the shadows, then another, never stepping out of them.', hint: 'An Assassin\'s legend.' },
  skewer: { name: 'Skewer', text: 'Farstrider\'s arrow kills, and flies on into the next.', hint: 'A Sharpshooter\'s legend.' },
  tightening_cord: { name: 'Tightening Cord', text: 'Thornbinder pulls a snare tighter with every blow.', hint: 'A Warden\'s legend, and a Snare.' },
  feeding_frenzy: { name: 'Feeding Frenzy', text: 'The bear\'s kills feed it and keep it, under the Moonbound Torc.', hint: 'A Shapeshifter\'s legend.' },
  ward_of_light: { name: 'Ward of Light', text: 'Healing kept by the Lantern of Mercy takes a blow for you.', hint: 'A Healer\'s legend.' },
};

/** @param {any} K */
function makeCombos(K) {
  /** This run's combinations and how often each came about. */
  const run = () => { const G = K.G; if (!G.combos) G.combos = {}; return G.combos; };
  /**
   * A combination came about. The first time in a run it is named in the log
   * and over whatever it happened to (a creature, if there was one), and the
   * journal keeps it; after that it is only counted.
   * @param {string} id @param {any} [at]  the creature it happened to, if any
   */
  function note(id, at) {
    const c = COMBOS[id], G = K.G;
    if (!c || !G || G.status !== 'playing') return;
    const seen = run();
    seen[id] = (seen[id] || 0) + 1;
    if (seen[id] > 1) return;
    const fresh = K.noteCombo(id);
    K.log(`${c.name}! ${c.text}${fresh ? ' (Kept in your journal.)' : ''}`, 'good');
    if (at && at.rx !== undefined) K.floatText(at, c.name.toLowerCase(), '#ffd88a');
  }
  /** The run's combinations, most used first: [id, count]. */
  const used = () => Object.entries(run()).filter(([id]) => COMBOS[id]).sort((a, b) => b[1] - a[1]);
  /**
   * The run's build, in a line: the path, the legend if one was carried, and
   * the one or two combinations it leaned on most.
   */
  function buildLine() {
    const G = K.G, p = K.P(), path = K.pathOf(p), cls = K.className(p.cls);
    const legend = K.legendCarried();
    const top = used().slice(0, 2).map(([id]) => COMBOS[id].name);
    let line = path ? `${path.name}` : `${cls}, on no path`;
    if (legend) line += ` bearing ${legend}`;
    if (top.length) line += `, fighting by ${top.join(' and ')}`;
    void G;
    return line;
  }
  return { note, used, buildLine };
}

export { COMBOS, makeCombos };
