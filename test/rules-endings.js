// Rule checks for the three endings (ENDINGS in data.js): the kept smith on the
// floor before the last, what he gives, the choice at the Heart that it opens,
// and how each ending is told, kept in the Hall and counted. Run from rules.js
// with its helpers lent in.
module.exports = async function endingChecks(h) {
  const { test, newContext, evenStats, OPTS, meetAndChoose } = h;
  const FOUR = { ...OPTS, levels: 4, permadeath: true, difficulty: 'normal' };

  /** A fresh delve, the hero on its last floor with its keeper down and the Heart at their feet. */
  const atTheHeart = async (seed, ready = () => {}) => {
    const ctx = await newContext(); const { Game } = ctx;
    Game.newGame({ name: 'E', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed, opts: FOUR });
    ready(Game);
    const L = Game.level(), p = Game.player(), k = `${p.x},${p.y}`, heart = { t: 'artifact', q: 1, e: 0 };
    (L.items[k] = L.items[k] || []).push(heart);
    return { ctx, Game, heart, L, k };
  };

  await test('the kept smith waits on the floor before the last of a delve of four floors or more, and never in the deck', async () => {
    const out = [];
    const { encounterPlan } = await import('../js/encounters.js');
    for (const levels of [2, 4, 6, 8, 12, 16]) for (let s = 0; s < 6; s++) {
      const plan = encounterPlan('smith-' + s, levels), where = plan.map((ids, d) => (ids || []).filter(id => id === 'smith').length ? d : 0).filter(Boolean);
      const want = levels >= 4 ? [levels - 1] : [];
      if (JSON.stringify(where) !== JSON.stringify(want)) out.push(`${levels} floors: the smith on floors ${where}, not ${want}`);
      if (plan.some(ids => (ids || []).includes('heart'))) out.push(`${levels} floors: the Heart's choice was dealt`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('the kept smith gives one thing: his quench, or the way the smiths stayed', async () => {
    const out = [];
    for (const [i, want] of [[0, 'quench'], [1, 'way'], [2, 'nothing']]) {
      const ctx = await newContext(); const { Game } = ctx;
      Game.newGame({ name: 'S', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'smith-gift', opts: FOUR });
      const p = Game.player();
      meetAndChoose(ctx, 'smith', i); Game.closeEncounter();
      const has = p.inv.some(it => it.t === 'quench'), way = !!(Game.state().threads || {}).smithway;
      if ((want === 'quench') !== has || (want === 'way') !== way) out.push(`choice ${i}: quench ${has}, the way ${way}`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('with nothing to choose between, the Heart is carried up as ever; with the means, the hero is asked and may walk away from it', async () => {
    const out = [];
    {
      const { Game, heart } = await atTheHeart('end-plain');
      Game.takeItem(heart);
      if (Game.state().status !== 'won' || Game.state().ending !== 'take' || Game.currentEncounter()) out.push(`no means: ${Game.state().status}, ${Game.state().ending}`);
    }
    {
      const { Game, heart, L, k } = await atTheHeart('end-asked', G => G.player().inv.push({ t: 'quench', q: 1, e: 0 }));
      Game.takeItem(heart);
      const cur = Game.currentEncounter();
      if (!cur || !cur.def.heart || Game.state().status !== 'playing') out.push('with the quench, lifting the Heart did not ask');
      if (!(L.items[k] || []).includes(heart)) out.push('the Heart left the floor before a choice was made');
      const o = Game.encounterOptions();
      if (o[0].blocked || !o[1].blocked || o[2].blocked) out.push(`with the quench alone: ${JSON.stringify(o.map(x => x.blocked))}`);
      // walked away: still there, and asked again
      Game.closeEncounter();
      Game.takeItem(heart);
      if (!Game.currentEncounter() || !(L.items[k] || []).includes(heart)) out.push('walked away from, the Heart was not there to come back to');
    }
    // the kept smith's way, or the Pale One's bargain, opens keeping it
    for (const thread of ['smithway', 'bargain']) {
      const { Game, heart } = await atTheHeart('end-' + thread, G => { (G.state().threads = G.state().threads || {})[thread] = 1; });
      Game.takeItem(heart);
      const o = Game.encounterOptions();
      if (!Game.currentEncounter() || !o[0].blocked || o[1].blocked) out.push(`with ${thread}: ${JSON.stringify(o.map(x => x.blocked))}`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('each ending is told its own way, kept in the Hall, earns its feat, and scores the same', async () => {
    const out = [];
    const scores = {};
    for (const [ending, i, ready] of [['take', 2, G => G.player().inv.push({ t: 'quench', q: 1, e: 0 })], ['quench', 0, G => G.player().inv.push({ t: 'quench', q: 1, e: 0 })], ['keep', 1, G => { G.state().threads = { smithway: 1 }; }]]) {
      const { ctx, Game, heart } = await atTheHeart('end-told', ready);
      const from = Game.state().log.length;
      Game.takeItem(heart);
      Game.chooseEncounter(i);
      const G = Game.state(), said = G.log.slice(from).map(e => e.m).join(' '), epi = Game.epilogue(true).join(' ');
      if (G.status !== 'won' || G.ending !== ending) { out.push(`${ending}: ${G.status}, ${G.ending}`); continue; }
      const { ENDINGS, FEATS } = ctx;
      if (!said.includes(ENDINGS[ending].lift[0]) || !said.includes(ENDINGS[ending].out)) out.push(`${ending}: the log said ${said}`);
      if (!epi.includes(ENDINGS[ending].epi[0].replace('{name}', 'E')) || !/Heart of the Mountain/.test(epi)) out.push(`${ending}: the story after said ${epi}`);
      const carried = Game.player().inv.some(it => it.t === 'artifact'), quench = Game.player().inv.some(it => it.t === 'quench');
      if (carried !== (ending !== 'quench') || (ending === 'quench' && quench)) out.push(`${ending}: carrying the Heart ${carried}, the quench ${quench}`);
      const entry = Game.hall().find(e => e.name === 'E');
      if (!entry || entry.ending !== ending) out.push(`${ending}: the Hall kept ${entry && entry.ending}`);
      scores[ending] = entry && entry.score;
      const feats = ctx.Progress.load().feats, want = { take: [], quench: ['quenched'], keep: ['kept'] }[ending];
      if (['quenched', 'kept'].some(f => !!feats[f] !== want.includes(f))) out.push(`${ending}: feats ${JSON.stringify(feats)}`);
      if (!FEATS.quenched || !FEATS.kept) out.push('the endings have no feats');
    }
    if (new Set(Object.values(scores)).size !== 1) out.push(`the endings scored ${JSON.stringify(scores)}`);
    return out.length ? out.join('; ') : true;
  });

  await test('Wick hears how a won delve ended', async () => {
    const ctx = await newContext(); const { Progress } = ctx;
    const fates = [];
    for (const ending of ['take', 'quench', 'keep']) {
      Progress.metWick({ name: 'W', cls: 'mage', run: 'r-' + ending });
      Progress.wickHears('r-' + ending, true, 4, '', ending);
      fates.push(Progress.wick().last.fate);
    }
    return JSON.stringify(fates) === '["won","quenched","kept"]' || `Wick heard ${fates}`;
  });
};
