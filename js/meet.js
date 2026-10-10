// The encounters' engine: a choice the dungeon puts to you (the choices
// themselves are in encounters.js). While one is open the game waits, as it
// does for the trader, and the prop that started it is gone once it has been
// answered. What it borrows from the game comes through K, as the monsters',
// the traders' and the companion's do.
import { d, Dice } from './rng.js';
import { ITEMS, MONSTERS } from './data.js';
import { Sound } from './sound.js';
import { Dungeon } from './dungeon.js';
import { ENCOUNTERS, encounterDc } from './encounters.js';

/** @param {any} K */
// a deep forge takes a piece one step past the traders' (theirs stop at +3)
const HONE_MOST = 4;

export function makeEncounters(K) {
  /** The encounter open just now, if one is: its prop, its choices, and what came of the one made. */
  let encounter = null;
  function openEncounter(n) {
    const def = ENCOUNTERS[n.id];
    if (!def) return false;
    encounter = { npc: n, def, result: null };
    Sound.play('door');
    K.emit('encounter');
    return true;
  }
  const GOBLIN_FINGERS = 2;
  function knack(check) {
    const p = K.P();
    let n = 0;
    for (const [c, bg, v] of (check.knack || [])) if ((c && p.cls === c) || (bg && p.bg === bg)) n += v;
    return n + goblinFingers(check);
  }
  /** A freed goblin at your side has clever fingers for anything quick and fiddly at an encounter: +2 on its Dexterity checks. */
  function goblinFingers(check) {
    const p = K.P(), c = K.companion.here();
    return check.stat === 'dex' && c && c.kind === 'goblin' && Math.abs(c.x - p.x) + Math.abs(c.y - p.y) <= 3 ? GOBLIN_FINGERS : 0;
  }
  function costOf(choice) {
    const c = choice.cost;
    if (!c) return null;
    if (c.goldPerDepth) return { gold: c.goldPerDepth * K.G.depth, text: `${c.goldPerDepth * K.G.depth} gold` };
    if (c.hurtFrac) { const n = Math.ceil(K.P().maxHp * c.hurtFrac); return { hp: n, text: `${n} hit points` }; }
    // a meal from the pack if there is one (a hero carrying rations is not too poor to share)
    if (c.food) { const meal = K.P().inv.find(it => ITEMS[it.t].kind === 'food'); return meal ? { meal, text: `${/^[aeiou]/i.test(ITEMS[meal.t].name) ? 'an' : 'a'} ${ITEMS[meal.t].name.toLowerCase()} from your pack` } : { food: c.food, text: `${c.food} food` }; }
    return null;
  }
  /** What each choice will ask of you, and how likely it is to go well. */
  function encounterOptions() {
    if (!encounter) return [];
    const p = K.P();
    return encounter.def.choices.map((ch, i) => {
      const cost = costOf(ch);
      let blocked = null;
      if (cost && cost.gold && p.gold < cost.gold) blocked = `You need ${cost.gold} gold.`;
      if (cost && cost.hp && p.hp <= cost.hp) blocked = 'You are too weak to spare the blood.';
      // (and not the last of it: sharing it all left the hero starving)
      if (cost && cost.food && p.food <= cost.food) blocked = 'You have too little food to share.';
      // a choice that would bring a second companion, while one stands with you, is not on offer
      const c = K.G.companion;
      if (ch.alone && c && !c.fallen) blocked = `${c.name} is with you: there is no room for another.`;
      // and none at all for one sworn to go alone, rather than taking their price and then refusing them
      if (K.vowed('alone') && JSON.stringify(ch).includes('"companion":')) blocked = 'You swore to go alone.';
      const o = { i, label: ch.label, cost: cost ? cost.text : null, blocked };
      if (ch.check) {
        const dc = encounterDc(ch.check, K.G.depth), bonus = knack(ch.check);
        // (whose help it is, so the choice can say: your own training, or the goblin's fingers)
        const fingers = goblinFingers(ch.check);
        Object.assign(o, { stat: ch.check.stat, statName: K.STAT_WORD[ch.check.stat], dc, bonus: K.checkBonus(ch.check.stat, bonus),
          chance: K.checkChance(ch.check.stat, dc, bonus), knack: bonus, helper: fingers ? K.G.companion.name : null, trained: bonus - fingers > 0 });
      }
      return o;
    });
  }
  function chooseEncounter(i) {
    if (!encounter || encounter.result) return null;
    const { def, npc } = encounter, p = K.P(), L = K.lvl();
    const ch = def.choices[i];
    if (!ch) return null;
    const opt = encounterOptions()[i];
    if (opt.blocked) { K.log(opt.blocked, 'bad'); return null; }
    const cost = costOf(ch);
    const lines = [];
    if (cost && cost.gold) { p.gold -= cost.gold; lines.push(`−${cost.gold} gold`); }
    if (cost && cost.hp) { p.hp -= cost.hp; K.fx.damageUntil = K.realNow + 260; lines.push(`−${cost.hp} hit points`); }
    if (cost && cost.food) { p.food -= cost.food; lines.push(`−${cost.food} food`); }
    if (cost && cost.meal) { K.removeOne(cost.meal); K.emit('inv'); lines.push(`−1 ${ITEMS[cost.meal.t].name.toLowerCase()}`); }
    let c = null, outcome = ch.outcome;
    if (ch.check) {
      c = K.statCheck(ch.check.stat, encounterDc(ch.check, K.G.depth), knack(ch.check));
      outcome = c.pass ? ch.pass : ch.fail;
    }
    // answered: the prop goes, and this encounter will not come again
    L.npcs = (L.npcs || []).filter(n => n !== npc);
    (K.G.metEncounters = K.G.metEncounters || []).push(npc.id);
    K.log(`${def.title}: ${outcome.text}${c ? c.note : ''}`, c ? (c.pass ? 'good' : 'bad') : 'info');
    lines.push(...applyEffects(outcome.effects, def));
    encounter.result = { label: ch.label, text: outcome.text, check: c, lines };
    K.checkLevelUp();
    K.emit('encounter'); K.emit('inv'); K.emit('stats');
    return encounter.result;
  }
  function closeEncounter() { encounter = null; }
  // Carry out what an outcome says, and say back what happened, line by line.
  function applyEffects(effects, def) {
    const p = K.P(), L = K.lvl(), out = [];
    // named after it is taken, so gold says what the purse really gained (a trickster's is a quarter more)
    const pickUp = it => { (L.items[K.key(p.x, p.y)] = L.items[K.key(p.x, p.y)] || []).push(it); K.pickupAll(); return K.itemName(it); };
    for (const e of effects) {
      if (e.map) { L.explored.fill(1); out.push('You know the layout of this floor.'); }
      // told where the floor's traps are: they show on the map, and a hero who knows steps round them
      if (e.traps && Object.keys(L.traps || {}).length) { L.trapsKnown = true; out.push('You know where this floor\'s traps are.'); }
      // worth more the deeper it is met: a flat fifty was a fair lesson on
      // the second floor and nothing on the seventh
      if (e.xp) { const xp = Math.round(e.xp * (1 + (K.G.depth - 1) / 3)); p.xp += xp; out.push(`+${xp} experience`); }
      if (e.companion) { const said = K.companion.join(e.companion); if (said) out.push(said); }
      if (e.thread && !K.threads()[e.thread]) {
        K.threads()[e.thread] = K.G.depth;
        if (K.THREAD_SAID[e.thread]) out.push(K.THREAD_SAID[e.thread]);
        // a bargain struck after the last floor was already seen still comes due there
        if (e.thread === 'bargain') for (const lv of Object.values(K.G.levels)) if (lv.isFinal) for (const m of lv.monsters) if (MONSTERS[m.id].boss) { m.maxHp = Math.round(m.maxHp * 1.3); m.hp = Math.round(m.hp * 1.3); }
      }
      if (e.goldPerDepth) {
        const n = e.goldPerDepth * K.G.depth;
        // gold an encounter gives is gold found: a trickster's is a quarter more, as any is
        if (n > 0) { const got = K.tricksterPurse(n); p.gold += got; out.push(`+${got} gold`); }
        else { const took = Math.min(p.gold, -n); p.gold -= took; if (took) out.push(`−${took} gold`); }
      }
      // a deep forge's work: one step better, up to one past the traders' hammers, and a curse burnt out
      if (e.hone) {
        const it = p.eq[e.hone], word = e.hone === 'weapon' ? 'blade' : 'armour';
        // the fire shows a piece for what it is, as it shows a curse
        if (it && it.h) delete it.h;
        if (!it) out.push(`You have no ${e.hone === 'weapon' ? 'weapon' : 'armour'} for it to temper`);
        else if ((it.e || 0) >= HONE_MOST) out.push(`Your ${word} is as fine as fire can make it`);
        else {
          if (it.curse) { delete it.curse; out.push('Its curse burns away'); }
          it.e = (it.e || 0) + 1;
          out.push(`Tempered: ${K.itemName(it)}`);
        }
      }
      // coin handed back (a haggle refused): exactly what was paid, not gold found
      if (e.goldBack) { const n = e.goldBack * K.G.depth; p.gold += n; out.push(`+${n} gold back`); }
      if (e.hurt || e.hurtFrac) {
        const n = e.hurtFrac ? Math.max(1, Math.ceil(p.maxHp * e.hurtFrac)) : Math.max(1, d(...e.hurt));
        K.G.lastAttacker = { name: def.title, dmg: n, bearing: '', encounter: true };
        const was = p.hp;
        K.hurtPlayer(n, null);
        // (a bear's hide may have taken some or all of it)
        out.push(was - p.hp > 0 ? `−${was - p.hp} hit points` : 'Your hide took it all');
      }
      if (e.heal) { const n = e.heal === 'full' ? p.maxHp - p.hp : e.heal; K.healPlayer(n); out.push(e.heal === 'full' ? 'Fully healed' : `+${n} hit points`); }
      if (e.maxHp) {
        const was = p.maxHp;
        p.maxHp = Math.max(10, p.maxHp + e.maxHp);
        p.hp = Math.min(p.maxHp, p.hp + Math.max(0, e.maxHp));
        // said as it came out: a loss that stops at the floor of ten is not the whole loss
        const got = p.maxHp - was;
        if (got) out.push(`${got > 0 ? '+' : '−'}${Math.abs(got)} maximum hit points`);
      }
      if (e.food) { p.food = Math.max(0, Math.min(100, p.food + e.food)); out.push(`${e.food > 0 ? '+' : '−'}${Math.abs(e.food)} food`); }
      if (e.loot != null) out.push(`Found: ${pickUp(Dungeon.rollLoot(Dice, K.G.depth + e.loot))}`);
      if (e.item) out.push(`Found: ${pickUp({ t: e.item.t, q: e.item.q || 1, e: 0 })}`);
      if (e.buff) {
        for (const [stat, n] of e.buff.stats) p.effects['boon_' + stat] = { amount: n, until: K.G.t + e.buff.dur };
        out.push(`Blessed: ${e.buff.stats.map(([s, n]) => `+${n} ${s === 'hit' ? 'to hit' : s === 'ac' ? 'armour' : s}`).join(', ')} for ${Math.round(e.buff.dur / 60000)} minutes`);
      }
      if (e.poison) { const c = K.venomSave('draught', 'the', true); if (c) out.push(c.pass ? `Poison fought off${c.note}` : `Poisoned${c.note}`); }
      if (e.cure && p.poison) { p.poison = null; out.push('Poison cured'); }
      if (e.wake) { for (const m of L.monsters) m.awake = true; out.push('Everything on this floor is awake'); }
      if (e.identifyAll) { for (const id in ITEMS) K.G.known[id] = 1; K.revealAll(); out.push('Every potion, scroll and piece of gear identified'); }
      if (e.uncurse && K.breakCurses()) out.push('Curse broken');
      // (a caster's spell points follow the score at once, not only at the next load)
      if (e.stat) { p.stats[e.stat[0]] += e.stat[1]; K.refreshSp(p); out.push(`${e.stat[1] > 0 ? '+' : '−'}${Math.abs(e.stat[1])} ${K.STAT_WORD[e.stat[0]]}`); }
      if (e.ambush) {
        // what answers is the floor's own kind of danger: above where wraiths
        // walk, the thing that comes out of the dark is a lesser dead one
        const td = Dungeon.tierAt(K.G.depth, K.G.opts.levels || 8), ladder = [e.ambush.id, ...(e.ambush.early || [])];
        // (and on a people's floor, it is their warriors who answer)
        const people = Dungeon.peopleAt(K.G.opts.levels || 8, K.G.depth);
        const kind = people ? Dungeon.PEOPLES[people].kin[0][0] : ladder.find(id => MONSTERS[id].tier[0] <= td + 0.5) || ladder[ladder.length - 1];
        let placed = 0;
        for (let r = 2; r <= 4 && placed < e.ambush.n; r++) {
          for (let dy = -r; dy <= r && placed < e.ambush.n; dy++) for (let dx = -r; dx <= r && placed < e.ambush.n; dx++) {
            if (Math.abs(dx) + Math.abs(dy) !== r) continue;
            const x = p.x + dx, y = p.y + dy;
            if (!K.passable(x, y) || K.monsterAt(x, y) || K.npcAt(x, y) || K.companion.at(x, y)) continue;
            const b = MONSTERS[kind];
            // as sturdy as the rest of the floor: the difficulty and the deep's pressure apply
            K.newMonster(kind, x, y, Dice.dice(b.hp[0], b.hp[1], b.hp[2])).nextAct = K.G.t + 800;
            placed++;
          }
        }
        if (placed) { K.resetDist(); out.push(`${placed > 1 ? placed + ' ' : 'A '}${MONSTERS[kind].name.toLowerCase()}${placed > 1 ? 's' : ''} attack${placed > 1 ? '' : 's'}!`); }
      }
    }
    return out;
  }
  return { openEncounter, encounterOptions, chooseEncounter, closeEncounter, current: () => encounter, clear: () => { encounter = null; } };
}
