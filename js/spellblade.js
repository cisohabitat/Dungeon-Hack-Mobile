// The hidden Spellblade's magic. Every clock belongs to the saved run;
// the device unlock never participates in combat, generation or replay.
/** Derived limits are shared with save validation; learning never adds saved power fields.
 * @param {import('./types.js').Player} p */
export function wayfarerMagic(p) {
  const talent = id => p.cls === 'spellblade' && (p.talents || []).includes(id);
  const lesson = id => p.cls === 'spellblade' && (p.boons || []).includes(id);
  return {
    hit: Number(talent('wf_deep_cut')),
    edge: 2 + Math.floor(p.level / 4) + Number(talent('wf_deep_cut')) + Number(lesson('wf_ember')),
    edgeMs: (talent('wf_long_edge') ? 60000 : 30000) + (lesson('wf_glass') ? 5000 : 0),
    guard: 6 + Math.floor(p.level / 2) + Number(lesson('wf_oath')),
    guardMs: talent('wf_patient_guard') ? 3500 : 2200,
    step: talent('wf_long_step') ? 3 : 2,
    stepGuard: talent('wf_step_guard') ? 3 + Math.floor(p.level / 4) : 0,
    returned: talent('wf_requital') ? 5 : 3,
    returnMs: lesson('wf_echo') ? 7000 : 5000,
  };
}
/** @param {import('./types.js').Kit} K */
export function makeSpellblade(K) {
  const active = key => {
    const p = K.P(), e = p.effects[key];
    return p.cls === 'spellblade' && e && e.until > K.G.t ? e : null;
  };
  function destination() {
    const p = K.P(), L = K.lvl(), [dx, dy] = K.DIRS[p.dir];
    let end = null;
    const reach = wayfarerMagic(p).step;
    for (let i = 1; i <= reach; i++) {
      const x = p.x + dx * i, y = p.y + dy * i;
      if (x < 0 || y < 0 || x >= L.w || y >= L.h || !L.explored[y * L.w + x]
        || L.tiles[y * L.w + x] !== K.T.FLOOR || !K.passable(x, y) || K.monsterAt(x, y)
        || K.npcAt(x, y) || K.propAt(x, y) || K.companion.at(x, y)) break;
      end = { x, y };
      // Never skip a trap or a stair's ordinary tile interaction.
      if (L.traps?.[K.key(x, y)] || L.snares?.[K.key(x, y)]) break;
    }
    return end;
  }
  function reason(sp) {
    const p = K.P();
    if (sp.kind === 'edge') {
      if (!p.eq.weapon || K.weapon().range || K.weapon().blunt) return 'Runic Edge needs a sword or dagger in your right hand.';
      const edge = active('runicEdge');
      if (edge?.src === sp.id && edge.amount >= wayfarerMagic(p).edge) return 'That rune already burns along your blade.';
    }
    if (sp.kind === 'step') {
      if (p.grabbed && (!p.grabbed.until || p.grabbed.until > K.G.t)) return 'Break free of the creature before stepping.';
      if (p.webbed > K.G.t) return 'The web holds you here. Burn or break free before stepping.';
      if (!destination()) return 'No clear, explored ground lies ahead for Lantern Step.';
    }
    if (sp.kind === 'spellguard' && active('spellguard')) return 'Your Spellguard is already raised.';
    return null;
  }
  function cast(sp) {
    const p = K.P();
    const magic = wayfarerMagic(p);
    if (sp.kind === 'edge') p.effects.runicEdge = { amount: magic.edge, until: K.G.t + magic.edgeMs, src: sp.id };
    if (sp.kind === 'spellguard') p.effects.spellguard = { amount: magic.guard, until: K.G.t + magic.guardMs, src: sp.id };
    if (sp.kind === 'step') {
      const end = destination();
      p.x = end.x; p.y = end.y;
      // A travelling ward is raised before the destination's ordinary trap check.
      // Never replace an active guard; stepping cannot refresh its lifetime.
      if (magic.stepGuard && !active('spellguard')) p.effects.spellguard = { amount: magic.stepGuard, until: K.G.t + 1200, src: 'spellguard' };
      K.snapCam(); K.distFieldAt = -1e9; K.checkTile();
    }
    K.log(`You cast ${sp.name}.`, 'good');
  }
  function blow(m, atRange) {
    const p = K.P();
    if (p.cls !== 'spellblade' || atRange || !p.eq.weapon || K.weapon().range || K.weapon().blunt) return 0;
    const e = active('runicEdge'), rip = active('runicReturn');
    let n = rip ? rip.amount : 0;
    if (rip) delete p.effects.runicReturn;
    if (e) {
      const element = { runic_fire: 'fire', runic_frost: 'cold', runic_storm: 'lightning' }[e.src];
      n += K.elemental(m, e.amount, element);
      K.floatText(m, element, element === 'fire' ? '#ffb060' : '#a8e0ff');
    }
    return n;
  }
  function guard(dmg, inside) {
    const e = active('spellguard');
    if (!e || inside || dmg <= 0) return dmg;
    delete K.P().effects.spellguard;
    const took = Math.min(dmg, e.amount);
    const magic = wayfarerMagic(K.P());
    K.P().effects.runicReturn = { amount: magic.returned, until: K.G.t + magic.returnMs, src: 'spellguard' };
    K.log(`Your Spellguard catches ${took}. Your next sword strike carries its light.`, 'good');
    return dmg - took;
  }
  // Deepward adds nothing through floor eight; deeper floors gain a bounded
  // ward in place of a path's gear.
  const armour = () => K.P().cls === 'spellblade' && K.P().eq.shield?.t === 'wayfarer_lantern'
    ? Math.min(4, Math.max(0, Math.ceil((K.G.depth - 8) / 2))) : 0;
  function aim() {
    const p = K.P();
    return active('runicEdge') && p.eq.weapon && !K.weapon().range && !K.weapon().blunt ? wayfarerMagic(p).hit : 0;
  }
  function desc(sp) {
    if (K.P().cls !== 'spellblade' || !['edge', 'step', 'spellguard'].includes(sp.kind)) return null;
    const m = wayfarerMagic(K.P());
    if (sp.kind === 'edge') return `Your sword or dagger deals ${m.edge} extra ${sp.id === 'runic_fire' ? 'fire' : sp.id === 'runic_frost' ? 'cold' : 'lightning'} damage per landed hit for ${m.edgeMs / 1000} seconds. Only one rune can burn at a time.${m.hit ? ' The runed blade also gains +1 to hit.' : ''}`;
    if (sp.kind === 'step') return `Slip up to ${m.step} clear, explored floor squares ahead. Walls, occupants and traps stop the crossing; landing triggers traps as usual.${m.stepGuard ? ` Raises a ${m.stepGuard}-damage, 1.2-second Spellguard if none is active.` : ''}`;
    if (sp.kind === 'spellguard') return `For ${m.guardMs / 1000} seconds, catch up to ${m.guard} damage from one hit. Your next landed blade hit within ${m.returnMs / 1000} seconds deals ${m.returned} extra damage. Poison and hunger pass through.`;
    return null;
  }
  return { reason, cast, blow, guard, armour, desc, aim };
}
