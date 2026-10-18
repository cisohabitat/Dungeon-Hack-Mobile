import { ITEMS } from './data.js';
import { RELICS, RELIC_POWERS } from './relics.js';
import { MYTHICS, MYTHIC_CHOICE, MYTHIC_OFFER, MYTHIC_PREPARE, MYTHIC_STARTED, MYTHIC_CANCEL } from './mythicdata.js';

const mythicFor = cls => Object.keys(MYTHICS).find(id => MYTHICS[id].mythic === cls);
/** @param {import('./types.js').Kit} K */
export function makeMythics(K) {
  const has = power => { const id = power === 'mercy_oath' ? 'mercys_oath' : power; return K.P().cls === MYTHICS[id]?.mythic && Object.values(K.P().eq).some(it => it?.u === id) && K.hasPower(power); };
  function reason(it, slot = ITEMS[it.t].kind) {
    const r = it.u && RELICS[it.u];
    if (!r?.mythic) return null;
    if (r.mythic !== K.P().cls) return 'That Mythic was made for another class.';
    if (Object.entries(K.P().eq).some(([s, x]) => s !== slot && x && x.u && RELICS[x.u]?.mythic)) return 'Only one Mythic may be worn at a time.';
    return null;
  }
  function offer(npc, def) {
    const G = K.G, L = K.lvl(), id = mythicFor(K.P().cls);
    if (npc.id !== 'vigil' || G.depth !== G.opts.levels || !L.isFinal || G.opts.levels < 8 || G.opts.daily || G.opts.weekly || L.mythicTrial || G.relics?.found.includes(id)) return def;
    return { ...def, text: `${def.text}\n\n${MYTHIC_OFFER}\n${RELICS[id].name}: ${Object.values(RELICS[id].powers).map(p => RELIC_POWERS[p]).join(' ')}`,
      choices: [...def.choices.slice(0, -1), MYTHIC_CHOICE, def.choices.at(-1)] };
  }
  function preparation(def) { return { ...def, text: MYTHIC_PREPARE, choices: [...def.choices.slice(0, -1), MYTHIC_CANCEL, def.choices.at(-1)] }; }
  function blocked(npc) {
    const L = K.lvl();
    if (!npc || L.mythicTrial || L.monsters.some(m => m.x === npc.x && m.y === npc.y && m.hp > 0) || K.companionAt(npc.x, npc.y)) return 'There is no room for the guardian here.';
    return null;
  }
  function begin(npc) {
    const G = K.G, L = K.lvl();
    if (npc.id !== 'vigil' || G.depth !== G.opts.levels || !L.isFinal || L.mythicTrial || G.opts.daily || G.opts.weekly || G.opts.levels < 8) return;
    L.mythicTrial = 'active';
    const m = K.newMonster('ogre', npc.x, npc.y, 36);
    m.mythicGuard = true; m.nextAct = G.t + 1800;
    K.log(MYTHIC_STARTED, 'info');
    return MYTHIC_STARTED;
  }
  function felled(m) {
    const L = K.lvl();
    if (!m.mythicGuard || L.mythicTrial !== 'active') return;
    L.mythicTrial = 'won';
    const id = mythicFor(K.P().cls), k = K.key(m.x, m.y);
    (L.items[k] ||= []).push(K.relicItem(id));
    K.log(`The lamp's last gift is yours: ${RELICS[id].name}. Its bargain is written on it.`, 'good');
    K.floatText(m, 'Mythic!', '#e2bcff');
  }
  function guard(dmg) {
    if (!has('last_gate') || dmg <= 0) return dmg;
    const p = K.P(), old = p.mythicChargeUntil > K.G.t ? p.mythicCharge || 0 : 0;
    p.mythicCharge = Math.min(3, old + Math.min(2, dmg)); p.mythicChargeUntil = K.G.t + 5000;
    return Math.max(0, dmg - 2);
  }
  function blow(atRange, sneak) {
    if (atRange) return has('horizon') ? 4 : 0;
    const p = K.P(); let n = has('nightglass') ? (sneak ? 6 : 2) : 0;
    if (has('last_gate') && p.mythicChargeUntil > K.G.t) { n += p.mythicCharge || 0; delete p.mythicCharge; delete p.mythicChargeUntil; }
    return n;
  }
  const armour = () => has('last_gate') || has('nightglass') ? -1 : 0;
  const pace = it => it?.u === 'horizon' && K.P().cls === 'ranger' ? 1.15 : 1;
  const healing = n => Math.round(n * (has('mercy_oath') ? 1.25 : has('elderseed') ? 0.8 : 1));
  const spellCost = sp => has('mercy_oath') && sp.kind === 'bolt' ? 1 : 0;
  const spellBlocked = sp => has('bloodstar') && sp.kind === 'bolt' && K.P().hp <= 2 ? 'The Bloodstar needs 2 life; you have too little to spare.' : null;
  const spellDamage = (n, amplified = has('bloodstar')) => amplified ? Math.round(n * 1.2) : n;
  function cast(sp) { const amplified = has('bloodstar') && sp.kind === 'bolt'; if (amplified) K.hurtPlayer(2, 'The Bloodstar drinks 2 of your life.', null, 'bloodstar'); return amplified; }
  function equipment() { if (!has('last_gate')) { delete K.P().mythicCharge; delete K.P().mythicChargeUntil; } }
  const hide = () => has('elderseed') ? 4 : 0;
  const roots = () => has('elderseed') ? 1000 : 0;
  function tick() { if (Object.values(K.P().eq).some(it => it && it.u && MYTHICS[it.u]?.mythic === K.P().cls)) { const st = K.runStats(); st.mythicTicks = (st.mythicTicks || 0) + 1; } }
  return { tick, offer, preparation, blocked, begin, felled, reason, guard, blow, armour, pace, healing, spellCost, spellBlocked, spellDamage, cast, equipment, hide, roots };
}
export { mythicFor };
