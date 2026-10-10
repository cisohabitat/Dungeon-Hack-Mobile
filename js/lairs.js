// The named champions' fights, given the shape the lich's and the Warlord's
// have: an opening the champion leads with, warned of as any trick is; a turn
// at two thirds of its life, when it changes the ground the fight is on (oil
// spilt for the hero's fire, flames kicked across the floor, water welling up
// to carry lightning, or its kin come to its side); and a last stand below a
// third, when it fights on in a fury, quicker and harder. The champions' data
// is in data.js (MONSTERS, each with `named`); foes.js asks here at its wake
// and at each wound.
//
// And the Heartforged's own turn grows a ground to match: at two thirds its
// hall's floor cracks, and the cracks flare as a smouldering floor's do.
// Wired near the end of game.js, borrowing what it needs through K.
import { Dice } from './rng.js';
import { MONSTERS } from './data.js';
import { Sound } from './sound.js';

/**
 * Each champion's fight: what it says as it leads with its trick, how its
 * ground changes at two thirds (`turn`: oil, fire, water or kin, with `kin`
 * the kind and how many that come), and what it says as it makes its last stand.
 */
const FIGHTS = {
  grisk: { opener: 'Grisk snatches up his war-horn before you can reach him!', turn: 'oil', turnSay: 'Grisk kicks over a cask of lamp oil, and it spreads round his feet. "Burn, then!"',
    last: 'Grisk throws his crown aside and fights like a cornered rat!' },
  vessra: { opener: 'The Web-Mother draws back to spit before you are near!', turn: 'kin', kin: ['spider', 1], turnSay: 'The Web-Mother shrieks, and one of her brood comes scuttling down a thread!',
    last: 'The Web-Mother rears up on her hind legs, and strikes in a frenzy!' },
  ushgar: { opener: 'Ushgar lowers his head the moment he sees you!', turn: 'fire', turnSay: 'Ushgar kicks the war-fire over, and burning coals scatter across the floor!',
    last: 'Ushgar roars, foam on his tusks, and comes on heedless of his wounds!' },
  morrow: { opener: 'Morrow reaches for you with a numbing claw before you have your guard up!', turn: 'kin', kin: ['zombie', 1], turnSay: 'Morrow calls to the feast, and one of the half-eaten dead gets up from the table!',
    last: 'Morrow howls, its jaws unhinged, and falls on you in a starving fury!' },
  orla: { opener: 'Orla glides toward you, one cold hand already reaching!', turn: 'kin', kin: ['skeleton', 1], turnSay: 'Orla\'s hymn rises, and the bones of one of her order climb out of the floor to keep her!',
    last: 'Orla\'s hymn breaks into a scream, and she comes at you in a whirl of cold!' },
  gorrum: { opener: 'Gorrum swings before you are in reach, to break your nerve!', turn: 'water', turnSay: 'Gorrum stamps, the floor cracks, and black water wells up round you both!',
    last: 'Gorrum bellows, and fights on with a fury nothing should have left in it!' },
  skarrow: { opener: 'Skarrow fills her lungs the moment she sees you!', turn: 'fire', turnSay: 'Skarrow lashes her tail through her hoard, and burning gold sprays across the floor!',
    last: 'Skarrow rears, her scales blazing, and fights on in a fury of tooth and fire!' },
  vaelith: { opener: 'Vaelith raises her hands, and the shadows at her feet begin to spin!', turn: 'kin', kin: ['drow_warrior', 1], turnSay: 'Vaelith calls a name, and another warrior steps out of the dark to guard her!',
    last: 'Vaelith tears the veil from her face, and fights with her goddess\'s fury!' },
  hissra: { opener: 'Hissra coils her tail the moment you come near!', turn: 'water', turnSay: 'Hissra slaps the stones with her tail, and the marsh-water floods in round you!',
    last: 'Hissra hisses, her crest raised, and lashes out in a frenzy!' },
  durgrim: { opener: 'Durgrim begins his working the moment he sees you!', turn: 'fire', turnSay: 'Durgrim brings his hammer down on the forge, and burning slag scatters across the floor!',
    last: 'Durgrim\'s eyes go red as his forge, and he swings with a fury fit to split stone!' },
};
/** How much quicker a champion's last stand makes it, and how much harder it hits. */
// (a fifth quicker, a point surer and two harder took ten points off the fighter's and the
// cleric's wins on Normal, most of it on the second champion's floor)
const FURY_SPEED = 0.85, FURY_HIT = 0, FURY_DMG = 1;
/** How many cracks the Heartforged's floor opens at its turn. */
const FORGE_CRACKS = 4;

/** @param {any} K */
export function makeLairs(K) {
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  /** Open floor squares about a point, nearest first, never the hero's own nor anything's. */
  function around(m, reach, free = true) {
    const p = K.P(), out = [];
    for (let r = 1; r <= reach; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = m.x + dx, y = m.y + dy;
      if (!K.passable(x, y) || K.tile(x, y) !== K.T.FLOOR || (x === p.x && y === p.y)) continue;
      if (free && (K.monsterAt(x, y) || K.npcAt(x, y) || K.companionAt(x, y))) continue;
      out.push([x, y]);
    }
    return out;
  }

  /** It wakes: it leads with its own trick, warned of as ever, the first chance it gets. */
  function opener(m, mb) {
    const f = FIGHTS[m.id];
    if (!f) return;
    m.moveReady = 0; m.blows = 9; m.opener = true;
    K.log(f.opener, 'bad');
  }
  /** Whether the champion may lead with its trick now, though the trick would usually wait (the Goblin King's horn, before he is hurt). */
  const leads = m => !!m.opener;
  /** Its trick has begun: the opening is spent. */
  function led(m) { m.opener = false; }

  /** A wound: at two thirds it turns the ground; below a third, its last stand. */
  function hurt(m, mb) {
    const f = FIGHTS[m.id];
    if (!f || m.hp <= 0) return;
    if (!m.turned && m.hp < m.maxHp * 2 / 3) { m.turned = true; turn(m, mb, f); }
    if (!m.fury && m.hp < m.maxHp / 3) {
      m.fury = true;
      K.log(f.last, 'bad');
      K.floatText(m, 'fury!', '#ff6040');
      Sound.play('dread');
      K.fx.shakeAmp = 4; K.fx.shakeMs = 400; K.fx.shakeUntil = K.realNow + 400;
      K.learn(m.id, 'trick');
    }
  }
  function turn(m, mb, f) {
    K.log(f.turnSay, 'bad');
    K.learn(m.id, 'trick');
    const L = K.lvl();
    if (f.turn === 'oil') {
      // round its own feet: the hero's fire will find it there
      K.elements.spill(m.x, m.y);
    } else if (f.turn === 'fire') {
      // a scatter of flames round it, never on the hero's own square
      const spots = around(m, 2, false);
      for (let i = 0; i < 3 && spots.length; i++) {
        const [x, y] = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
        K.elements.flame(x, y);
      }
      Sound.play('cast', K.heard(m, { spell: 'burning_hands' }));
    } else if (f.turn === 'water') {
      // water standing round them both: lightning runs through it, cold freezes it
      const p = K.P();
      const spots = [[m.x, m.y], [p.x, p.y], ...around(m, 2, false), ...DIRS.map(([dx, dy]) => [p.x + dx, p.y + dy])];
      L.dressing = L.dressing || [];
      for (const [x, y] of spots) {
        if (!K.passable(x, y) || L.dressing.some(d => d.k === 'puddle' && d.x === x && d.y === y)) continue;
        L.dressing.push({ x, y, k: 'puddle', ox: 0, oy: 0, r: 0.42 });
      }
    } else if (f.turn === 'kin' && f.kin) {
      const [kind, n] = f.kin, b = MONSTERS[kind], spots = around(m, 3);
      for (let i = 0; i < n && spots.length; i++) {
        const [x, y] = spots.shift();
        const o = K.newMonster(kind, x, y, Dice.dice(b.hp[0], b.hp[1], b.hp[2]) + Math.floor((K.G.depth - 1) / 2));
        o.awake = true;
      }
      Sound.play('raise', K.heard(m));
    }
  }

  /** What a champion's last stand makes of its numbers. */
  function furyOf(s) { return { ...s, speed: Math.round(s.speed * FURY_SPEED), hit: s.hit + FURY_HIT, dmg: [s.dmg[0], s.dmg[1], s.dmg[2] + FURY_DMG] }; }

  /**
   * The Heartforged's turn: its hall's floor cracks open round it, and the
   * cracks heat and flare as a smouldering floor's do, cold sealing them a while.
   */
  function forgeCracks(m) {
    const L = K.lvl(), spots = around(m, 4);
    L.vents = L.vents || [];
    for (let i = 0; i < FORGE_CRACKS && spots.length; i++) {
      const [x, y] = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
      if (L.vents.some(v => Math.abs(v.x - x) + Math.abs(v.y - y) <= 1)) continue;
      L.vents.push({ x, y, next: 0, heat: 0, sealedUntil: 0 });
    }
    L.forgeVents = true;
    K.log('The floor of the forge splits open round the Heartforged, and the cracks begin to glow!', 'bad');
  }

  return { FIGHTS, opener, leads, led, hurt, furyOf, forgeCracks };
}
