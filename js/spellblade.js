// The hidden Spellblade's magic. Every clock belongs to the saved run;
// the device unlock never participates in combat, generation or replay.
/** @param {import('./types.js').Kit} K */
export function makeSpellblade(K) {
  const active = key => {
    const p = K.P(), e = p.effects[key];
    return p.cls === 'spellblade' && e && e.until > K.G.t ? e : null;
  };
  function destination() {
    const p = K.P(), L = K.lvl(), [dx, dy] = K.DIRS[p.dir];
    let end = null;
    for (let i = 1; i <= 2; i++) {
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
      if (edge?.src === sp.id && edge.amount >= 2 + Math.floor(p.level / 4)) return 'That rune already burns along your blade.';
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
    if (sp.kind === 'edge') p.effects.runicEdge = { amount: 2 + Math.floor(p.level / 4), until: K.G.t + 30000, src: sp.id };
    if (sp.kind === 'spellguard') p.effects.spellguard = { amount: 6 + Math.floor(p.level / 2), until: K.G.t + 2200, src: sp.id };
    if (sp.kind === 'step') {
      const end = destination();
      p.x = end.x; p.y = end.y;
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
    K.P().effects.runicReturn = { amount: 3, until: K.G.t + 5000, src: 'spellguard' };
    K.log(`Your Spellguard catches ${took}. Your next sword strike carries its light.`, 'good');
    return dmg - took;
  }
  // The lantern remembers the deeper halls. The ordinary eight-floor delve
  // keeps its balance; long delves gain a bounded ward in place of a path's gear.
  const armour = () => K.P().cls === 'spellblade' && K.P().eq.shield?.t === 'wayfarer_lantern'
    ? Math.min(4, Math.max(0, Math.ceil((K.G.depth - 8) / 2))) : 0;
  return { reason, cast, blow, guard, armour };
}
