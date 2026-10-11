// Rule checks for the choices met on the way (the Pale One, the guildsman, the Lampfolk, the Lever Door, the mule), names, the floor twists, the divided stair and its roads, remains, barrels, the ranger and Snare.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function roadsChecks(h) {
  const { OPTS, evenStats, newContext, start, seedDice, markLog, linesSince, test, wearRelic, beside, run, shopAhead, talent, goDown, winHere, downTo, meetAndChoose } = h;

await test('the Pale One\'s strength lasts the run, and the lich is the stronger for it; the epilogue remembers', async () => {
  const out = [];
  const lichHp = async take => {
    const ctx = await start('fighter', 'bargain', { levels: 4 });
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    const hit0 = Game.toHit();
    if (take) {
      meetAndChoose(ctx, 'bargain', 0);
      if (Game.toHit() !== hit0 + 1) out.push('the bargain did not add to hit');
    }
    for (let d = 2; d <= 4; d++) { Game.level().monsters.length = 0; Game.descend(); }
    const lich = Game.level().monsters.find(m => ctx.MONSTERS[m.id].boss);
    const said = G.log.slice(-8).map(e => e.m).join(' ');
    if (take && !/Pale One/.test(said)) out.push('the last floor said nothing of the bargain');
    if (take && !Game.epilogue(false).some(l => /narrow passage/.test(l))) out.push('the epilogue forgot the bargain');
    return lich ? lich.maxHp : 0;
  };
  const plain = await lichHp(false), dealt = await lichHp(true);
  if (!(dealt > plain * 1.2)) out.push(`the lich had ${dealt} life after the bargain, ${plain} without`);
  return out.length ? out.join('; ') : true;
});

await test('the guildsman you dug out marks the next floor; the captive you freed puts in a word with traders below; the crew you buried sings you onto the last floor', async () => {
  const out = [];
  const ctx = await start('fighter', 'threads', { levels: 4 });
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.stats.str = 30; p.stats.cha = 30; p.hp = p.maxHp = 999;
  // a natural one fails any check, however strong: meet him again until the dice allow it
  for (let i = 0; i < 6 && !(G.threads && G.threads.guide); i++) meetAndChoose(ctx, 'buried', 0);
  if (!G.threads || !G.threads.guide) out.push(`digging him out left no thread: ${JSON.stringify(G.threads)}`);
  const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [] };
  const before = Game.buyPrice(shop, { t: 'longsword', q: 1, e: 0 });
  for (let i = 0; i < 6 && !G.threads.captive; i++) meetAndChoose(ctx, 'prisoner', 2);
  if (Game.buyPrice(shop, { t: 'longsword', q: 1, e: 0 }) !== before) out.push('a trader on the captive\'s own floor had already heard');
  G.threads.crew = 1;
  Game.level().monsters.length = 0; Game.descend();
  if (!Game.level().explored.every(v => v)) out.push('the next floor was not marked');
  if (!(Game.buyPrice(shop, { t: 'longsword', q: 1, e: 0 }) < before)) out.push('a trader below did not ask less');
  Game.level().monsters.length = 0; Game.descend();
  if (!Game.level().explored.some(v => !v)) out.push('the guildsman marked a second floor too');
  Game.level().monsters.length = 0; Game.descend();
  if (!(p.effects.crew_hit && p.effects.crew_hit.amount === 2)) out.push('the buried crew did not sing on the last floor');
  const epi = Game.epilogue(true).join(' ');
  for (const w of ['goblin chains', 'rubble', 'third crew']) if (!epi.includes(w)) out.push(`the epilogue forgot ${w}`);
  if (!Game.threadNotes().length) out.push('the hero sheet has nothing to say');
  return out.length ? out.join('; ') : true;
});

await test('every choice of every encounter can be taken, passed and failed, and says what it did', async () => {
  const { ENCOUNTERS } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'encounters.js')).href);
  const ctx = await start('fighter', 'every-choice', { levels: 8 });
  const { Game } = ctx; const p = Game.player();
  const seen = new Set();
  for (const [id, e] of Object.entries(ENCOUNTERS)) {
    // (the Heart's choice ends the run: rules-endings.js takes each of its choices)
    if (e.heart) continue;
    for (let i = 0; i < e.choices.length; i++) {
      // a strong hero and a hopeless one by turns, until both sides of a check
      // have come up (a hopeless hero still passes one time in four or five)
      for (let t = 0; t < 40; t++) {
        if (t >= 2 && (!e.choices[i].check || (seen.has(`${id}/${i}/true`) && seen.has(`${id}/${i}/false`)))) break;
        for (const k in p.stats) p.stats[k] = t % 2 ? 3 : 30;
        p.hp = p.maxHp = 999; p.gold = 99999; p.food = 100; p.inv.length = 0;
        // (one companion at a time: one won at an earlier encounter would bar the hiring)
        Game.state().companion = null;
        let r;
        try { r = meetAndChoose(ctx, id, i); } catch (err) { return `${id} choice ${i}: ${err.message}`; }
        Game.closeEncounter();
        if (!r || typeof r.text !== 'string' || !r.lines.every(l => typeof l === 'string' && l.length)) return `${id} choice ${i} gave no clear result`;
        if (r.check) seen.add(`${id}/${i}/${r.check.pass}`);
      }
    }
  }
  // every checked choice was seen to pass and to fail
  for (const [id, e] of Object.entries(ENCOUNTERS)) e.choices.forEach((ch, i) => {
    if (ch.check && !(seen.has(`${id}/${i}/true`) && seen.has(`${id}/${i}/false`))) seen.add('missing ' + id + '/' + i);
  });
  const missing = [...seen].filter(k => k.startsWith('missing'));
  return !missing.length || missing.join(', ');
});

await test('a Lampfolk\'s lamp relit is thanked by the next Lampfolk trader below, once; one robbed in the dark makes their traders dearer', async () => {
  const out = [];
  const kind = { t: 'longsword', q: 1, e: 0 };
  // the kindness
  {
    const ctx = await start('fighter', 'lamp-kind', { levels: 5 });
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.stats.dex = 30; p.hp = p.maxHp = 999;
    for (let i = 0; i < 6 && !(G.threads && G.threads.lamp); i++) { meetAndChoose(ctx, 'lampfolk', 0); Game.closeEncounter(); }
    if (!G.threads || !G.threads.lamp) return 'relighting the lamp left no thread';
    const draughts = () => (p.inv.find(it => it.t === 'potion_heal') || { q: 0 }).q;
    const had = draughts();
    shopAhead(ctx); Game.closeShop();
    if (draughts() !== had) out.push('a trader on the same floor already thanked you');
    Game.level().monsters.length = 0; Game.descend();
    shopAhead(ctx); Game.closeShop();
    if (draughts() !== had + 1) out.push(`the trader below gave ${draughts() - had} draughts, not one`);
    shopAhead(ctx); Game.closeShop();
    if (draughts() !== had + 1) out.push('a second trader thanked you again');
    if (!Game.threadNotes().some(n => /Lampfolk/.test(n))) out.push('the hero sheet forgot the lamp');
    if (!Game.epilogue(true).join(' ').includes('light a lamp')) out.push('the epilogue forgot the lamp');
  }
  // one sworn to no draughts is thanked with a scroll
  {
    const ctx = await start('fighter', 'lamp-vow', { levels: 5 });
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    G.opts.vows = ['unaided'];
    G.threads = { lamp: 1 };
    Game.level().monsters.length = 0; Game.descend();
    const had = p.inv.filter(it => it.t === 'potion_heal').length;
    shopAhead(ctx); Game.closeShop();
    if (!p.inv.some(it => it.t === 'scroll_heal')) out.push('one sworn unaided was not given the scroll');
    if (p.inv.filter(it => it.t === 'potion_heal').length !== had) out.push('one sworn unaided was given a draught');
  }
  // the theft
  {
    const ctx = await start('thief', 'lamp-rob', { levels: 5 });
    const { Game } = ctx; const G = Game.state();
    Game.player().hp = Game.player().maxHp = 999;
    const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [] };
    const before = Game.buyPrice(shop, kind);
    // caught or not, the Lampfolk hear of it
    meetAndChoose(ctx, 'lampfolk', 3); Game.closeEncounter();
    if (!G.threads || !G.threads.robbed) return 'robbing the Lampfolk left no thread';
    if (Game.buyPrice(shop, kind) !== before) out.push('a trader on the same floor already knew');
    Game.level().monsters.length = 0; Game.descend();
    const dear = Game.buyPrice(shop, kind);
    if (!(dear > before)) out.push(`a Lampfolk trader below asked ${dear}, not more than ${before}`);
    Game.level().twist = 'market';
    if (Game.buyPrice(shop, kind) !== before) out.push('a goblin pedlar cared about the Lampfolk');
    Game.level().twist = null;
    if (!Game.threadNotes().some(n => /robbed/.test(n))) out.push('the hero sheet forgot the theft');
  }
  return out.length ? out.join('; ') : true;
});

await test('the Lever Door: worked out, a vault of gold and gear; heaved open, less, and the floor hears; a wrong order or a wrench hurts', async () => {
  const out = [];
  const ctx = await start('mage', 'levers', { levels: 8 });
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 999;
  while (G.depth < 4) { Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts'); }
  // worked out by a sharp mind (a natural 1 fails anything: tried a few times)
  p.stats.int = 30;
  let r = null;
  for (let i = 0; i < 6 && !(r && r.check.pass); i++) { const g0 = p.gold; r = meetAndChoose(ctx, 'levers', 0); Game.closeEncounter(); if (r.check.pass && p.gold - g0 < 12 * G.depth) out.push(`the vault held ${p.gold - g0} gold, not ${12 * G.depth}`); }
  if (!r.check.pass) out.push('a sharp mind never worked out the levers');
  // heaved: the floor wakes
  p.stats.str = 30;
  const L = Game.level();
  r = null;
  for (let i = 0; i < 6 && !(r && r.check.pass); i++) {
    L.monsters.length = 0;
    r = meetAndChoose(ctx, 'levers', 1);
    Game.closeEncounter();
  }
  if (!r.check.pass) out.push('great strength never heaved the door');
  else if (!r.lines.some(l => /is awake/.test(l))) out.push('heaving the door was not heard');
  // failing either hurts
  p.stats.int = 1; p.stats.str = 1;
  for (const i of [0, 1]) {
    let hurt = false;
    for (let k = 0; k < 6 && !hurt; k++) { p.hp = 999; const rr = meetAndChoose(ctx, 'levers', i); Game.closeEncounter(); if (!rr.check.pass) hurt = p.hp < 999; }
    if (!hurt) out.push(`failing choice ${i} at the lever door did no harm`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a lost mule: led on, the next trader below knows it and pays once; stripped, gold and gear now; followed, the floor learnt or an hour lost', async () => {
  const out = [];
  const ctx = await start('fighter', 'mule', { levels: 8 });
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 999;
  while (G.depth < 3) { Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts'); }
  meetAndChoose(ctx, 'mule', 0); Game.closeEncounter();
  if (!G.threads || G.threads.mule !== 3) return `leading the mule on left the thread ${JSON.stringify(G.threads)}`;
  if (!Game.threadNotes().some(n => /mule/.test(n))) out.push('the hero sheet forgot the mule');
  let g0 = p.gold;
  shopAhead(ctx); Game.closeShop();
  if (p.gold !== g0) out.push('a trader on the same floor paid for the mule');
  Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts');
  g0 = p.gold;
  shopAhead(ctx); Game.closeShop();
  if (p.gold - g0 !== 18 * G.depth) out.push(`the trader below paid ${p.gold - g0}, not ${18 * G.depth}`);
  g0 = p.gold;
  shopAhead(ctx); Game.closeShop();
  if (p.gold !== g0) out.push('a second trader paid again');
  if (!Game.threadNotes().some(n => /paid you/.test(n))) out.push('the hero sheet did not say the mule was paid for');
  // stripped
  g0 = p.gold;
  meetAndChoose(ctx, 'mule', 1); Game.closeEncounter();
  // (the one thing worth having may be a purse of its own)
  if (p.gold - g0 < 5 * G.depth) out.push(`stripping the mule gave ${p.gold - g0} gold, not ${5 * G.depth}`);
  // followed by one who reads it well: the floor is learnt; badly, food is lost
  p.stats.wis = 30;
  let r = null;
  for (let i = 0; i < 6 && !(r && r.check.pass); i++) { r = meetAndChoose(ctx, 'mule', 2); Game.closeEncounter(); }
  const L = Game.level();
  if (!r.check.pass) out.push('a wise hero never followed the mule');
  else if (L.seen && !Array.from(L.seen).some(Boolean)) out.push('following the mule learnt nothing of the floor');
  p.stats.wis = 1; p.food = 80;
  let lost = false;
  for (let i = 0; i < 6 && !lost; i++) { const f0 = p.food; r = meetAndChoose(ctx, 'mule', 2); Game.closeEncounter(); if (!r.check.pass) lost = p.food < f0; }
  if (!lost) out.push('losing the mule cost no food');
  return out.length ? out.join('; ') : true;
});

await test('Self-Taught puts its two points where the player says, and nowhere until they do', async () => {
  const ctx = await start('fighter', 'spread');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  G.pendingBoons = [['spread', 'vigor', 'keen']]; G.pendingLevels = [3];
  const str = p.stats.str, con = p.stats.con, dex = p.stats.dex;
  if (Game.chooseBoon('spread') !== false) return 'Self-Taught was taken with nowhere to put its points';
  if (Game.chooseBoon('spread', ['str', 'luck']) !== false) return 'Self-Taught took a score that does not exist';
  if (!Game.chooseBoon('spread', ['str', 'con'])) return 'Self-Taught was refused two good scores';
  if (p.stats.str !== str + 1 || p.stats.con !== con + 1) return `scores went ${str}->${p.stats.str}, ${con}->${p.stats.con}`;
  G.pendingBoons = [['spread', 'vigor', 'keen']]; G.pendingLevels = [5];
  Game.chooseBoon('spread', ['dex', 'dex']);
  return p.stats.dex === dex + 2 || `both points on Dexterity made it ${p.stats.dex}, not ${dex + 2}`;
});

await test('review fixes: no rest beside a smoked foe; a hero\'s scores are their own; the crew\'s song outlasts the lamp', async () => {
  const out = [];
  // Smoke, then Rest: the foe is still there
  const t = await start('thief', 'smoke-rest');
  { const { Game } = t; const p = Game.player(); p.hp = 3;
    beside(t, 'goblin', { nextAct: Game.state().t + 1e9 });
    Game.useAbility();
    if (Game.rest() !== false || p.hp !== 3) out.push('a thief rested beside a foe lost in smoke');
    if (Game.restLabel() !== 'Foes near') out.push(`the Rest button said ${Game.restLabel()} beside a smoked foe`); }
  // the hero's scores are a copy of what was chosen
  const c = await newContext();
  { const stats = { str: 15, dex: 10, con: 14, int: 10, wis: 10, cha: 8 };
    c.Game.newGame({ name: 'S', cls: 'fighter', bg: 'ashborn', stats, seed: 'copy', opts: { ...OPTS } });
    if (c.Game.player().stats === stats || stats.con !== 14) out.push('the hero shares its scores with the create screen'); }
  // the crew's +2 and the lamp's +3 together
  const f = await start('fighter', 'crew-lamp', { levels: 3 });
  { const { Game } = f; const G = Game.state(); G.threads = { crew: 1 };
    Game.level().monsters.length = 0; Game.descend(); Game.level().monsters.length = 0; Game.descend();
    const before = Game.effect('hit');
    Game.player().gold = 5000;
    meetAndChoose(f, 'vigil', 1);
    if (Game.effect('hit') !== before + 3) out.push(`with the crew's song and the lamp, +${Game.effect('hit')} to hit, not ${before + 3}`); }
  return out.length ? out.join('; ') : true;
});

await test('the log calls a named champion by its name, not its title, except where the name is given', async () => {
  const ctx = await start('fighter', 'named-names');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.perkHit = 60;
  const m = beside(ctx, 'ushgar', { hp: 999, maxHp: 999, spoke: true, nextAct: 1e12 });
  const mark = markLog(G);
  for (let i = 0; i < 4; i++) { G.t = p.nextAttack; Game.input('attack'); }
  const said = linesSince(G, mark);
  if (said.some(l => /the Orc Warchief/i.test(l) && !/Ushgar,? the Orc Warchief/.test(l))) return `still called by title: ${said.join(' | ')}`;
  return said.some(l => /Ushgar/.test(l)) || `never named: ${said.join(' | ')}`;
});

await test('keys of one colour share a pack slot, and each still opens one door', async () => {
  const ctx = await start('fighter', 'keys-stack');
  const { Game, Dungeon } = ctx; const p = Game.player(), L = Game.level();
  const before = p.inv.length;
  for (const c of ['silver', 'silver', 'silver', 'gold']) Game.giveItem ? Game.giveItem({ t: 'key', q: 1, color: c }) : null;
  if (!Game.giveItem) return 'giveItem is not exposed';
  const silver = p.inv.filter(i => i.t === 'key' && i.color === 'silver');
  if (silver.length !== 1 || silver[0].q !== 3) return `silver keys: ${JSON.stringify(silver)}`;
  if (p.inv.length !== before + 2) return `four keys took ${p.inv.length - before} slots`;
  // one of the three opens a silver door, and two are left
  const [dx, dy] = Dungeon.DIRS[p.dir], x = p.x + dx, y = p.y + dy;
  L.tiles[y * L.w + x] = Dungeon.T.DOOR_LOCKED; L.locks[x + ',' + y] = 'silver'; L.monsters.length = 0;
  Game.input('forward');
  if (L.tiles[y * L.w + x] !== Dungeon.T.DOOR_OPEN) return 'the door did not open';
  return silver[0].q === 2 || `left with ${silver[0].q} silver keys`;
});

await test('a random name often suits the background, and never repeats the one before', async () => {
  const { heroName, BG_NAMES } = await start('fighter', 'names');
  let own = 0;
  for (let i = 0; i < 400; i++) {
    const n = heroName('tombwise', 'Vesper');
    if (n === 'Vesper') return 'the name just given came again';
    if (BG_NAMES.tombwise.includes(n)) own++;
  }
  return (own > 120 && own < 280) || `${own} of 400 names were the Tombwise's own`;
});

await test('a hero made with no name is given one from the list, not "Adventurer"', async () => {
  const { Game, ALL_HERO_NAMES: HERO_NAMES } = await start('fighter', 'no-name');
  Game.newGame({ name: '   ', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'no-name', opts: { ...OPTS } });
  const name = Game.player().name;
  return (HERO_NAMES || []).includes(name) || `the nameless hero was called ${name}`;
});

await test('floor twists: dealt by the seed to middle floors only, never two running nor on a champion\'s floor', async () => {
  const { Dungeon } = await start('fighter', 'twist-plan');
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const seed = 'tw' + i, plan = Dungeon.twistPlan(seed, 8), named = Dungeon.namedPlan(seed, 8);
    if (JSON.stringify(plan) !== JSON.stringify(Dungeon.twistPlan(seed, 8))) return `seed ${seed} dealt two plans`;
    for (const d of Object.keys(plan).map(Number)) {
      seen.add(plan[d]);
      // (a smouldering floor is a deep one: the last quarter, never the deepest)
      if (plan[d] === 'smouldering' ? d < 6 || d > 7 : d < 2 || d > 6) return `seed ${seed} put ${plan[d]} on floor ${d}`;
      if (named[d]) return `seed ${seed} put ${plan[d]} on ${named[d]}'s floor`;
      if (plan[d + 1]) return `seed ${seed} twisted floors ${d} and ${d + 1}`;
    }
  }
  return seen.size === 7 || `only ${[...seen].join(', ')} were ever dealt`;
});

await test('each floor twist does what it says, and is told on arriving', async () => {
  const out = [];
  const find = async kind => {
    const { Dungeon } = await start('fighter', 'twist-find');
    for (let i = 0; i < 400; i++) { const plan = Dungeon.twistPlan('twist' + i, 8); const d = Object.keys(plan).find(k => plan[k] === kind); if (d) return { seed: 'twist' + i, d: Number(d) }; }
    return null;
  };
  for (const kind of ['dark', 'flooded', 'restless', 'market', 'tremors', 'smouldering']) {
    const at = await find(kind);
    if (!at) { out.push(`no seed dealt ${kind}`); continue; }
    const ctx = await start('fighter', at.seed, { levels: 8 });
    const { Game, MONSTERS } = ctx; const G = Game.state();
    Game.player().hp = Game.player().maxHp = 9999;
    const mark = markLog(G);
    downTo(ctx, at.d);
    const L = Game.level();
    if (L.twist !== kind) { out.push(`floor ${at.d} of ${at.seed} is ${L.twist}, not ${kind}`); continue; }
    if (!linesSince(G, mark).some(l => l.includes(ctx.TWISTS[kind].arrive))) out.push(`arriving on a ${kind} floor said nothing of it`);
    if (kind === 'dark') {
      // (a floor's rooms are worth torches by the floor they cover, as dungeon.js counts them)
      let area = 0; for (let i = 0; i < L.w * L.h; i++) if (L.roomId[i] >= 0) area++;
      const full = Math.round(Math.max(L.rooms.length, Math.round(area / ctx.Dungeon.ROOM_WORTH)) * 0.9) + 4;
      if (L.lights.length > Math.round(full * 0.25)) out.push(`a dark floor kept ${L.lights.length} torches of ${full}`);
    }
    if (kind === 'flooded') {
      const m = L.monsters.find(x => !MONSTERS[x.id].boss && !x.elite);
      if (m && Game.mstat(m).speed !== Math.round(MONSTERS[m.id].speed * 1.25)) out.push(`a ${m.id} in the water acts every ${Game.mstat(m).speed}ms, drawn at ${MONSTERS[m.id].speed}`);
    }
    if (kind === 'restless') {
      // (each creature rises on a roll, so one floor of seven can fall short: counted over three)
      let dead = 0, all = 0;
      for (let i = 0, n = 0; i < 400 && n < 3; i++) {
        const seed = 'twist' + i, d = Object.keys(ctx.Dungeon.twistPlan(seed, 8)).find(k => ctx.Dungeon.twistPlan(seed, 8)[k] === 'restless');
        if (!d) continue;
        n++;
        const c2 = seed === at.seed ? ctx : await start('fighter', seed, { levels: 8 });
        if (c2 !== ctx) { c2.Game.player().hp = c2.Game.player().maxHp = 9999; downTo(c2, Number(d)); }
        const plain = c2.Game.level().monsters.filter(x => !MONSTERS[x.id].named && !x.pack);
        dead += plain.filter(x => MONSTERS[x.id].undead).length; all += plain.length;
      }
      if (all >= 12 && dead < all * 0.4) out.push(`only ${dead} of ${all} creatures on three restless floors are undead`);
    }
    if (kind === 'tremors') {
      // (in a few seconds of arriving the ground has shuddered once)
      run(Game, G, 9000);
      if (!L.quake || L.quake.next <= G.t || !linesSince(G, mark).some(l => /ground shudders/.test(l))) out.push('a floor of tremors never shuddered');
    }
    if (kind === 'market') {
      const shop = L.npcs.find(n => n.id === 'merchant');
      if (!shop) out.push('a goblin market had no trader');
      else if (shop.markup > 1.66) out.push(`the market trader marks up ${shop.markup.toFixed(2)}`);
    }
  }
  return out.length ? out.join('; ') : true;
});

await test('the stair divides a third of the way down: stepping onto it asks, and the road taken shapes the floors until the last two', async () => {
  const out = [];
  const { Dungeon, MONSTERS, ROUTES } = await newContext();
  const spans = [4, 6, 8, 12].map(n => JSON.stringify(Dungeon.routeSpan(n))).join(' ');
  if (spans !== 'null {"fork":2,"from":3,"to":4} {"fork":3,"from":4,"to":6} {"fork":4,"from":5,"to":10}') out.push(`route spans ${spans}`);
  // stepping onto the stair at the fork asks rather than going down
  const ctx = await start('fighter', 'fork', { levels: 8 });
  const { Game } = ctx; const G = Game.state();
  Game.player().hp = Game.player().maxHp = 9999;
  downTo(ctx, 2); goDown(Object.assign(ctx, { road: 'none' }));
  if (G.depth !== 3) return `walked to ${G.depth}`;
  const L3 = Game.level(), p = Game.player(), s = L3.stairsDown;
  const k = [0, 1, 2, 3].find(k => { const [dx, dy] = Dungeon.DIRS[k]; return L3.tiles[(s.y - dy) * L3.w + s.x - dx] === Dungeon.T.FLOOR; });
  const [dx, dy] = Dungeon.DIRS[k];
  p.x = s.x - dx; p.y = s.y - dy; p.dir = k; L3.monsters.length = 0;
  Game.input('use');
  if (G.depth !== 3 || !Game.forkPending()) out.push(`stepping onto the divided stair went to ${G.depth}, pending ${Game.forkPending()}`);
  Game.leaveFork();
  if (Game.forkPending() || Game.route()) out.push('staying put still left a choice pending or a road taken');
  Game.input('use');
  if (!Game.chooseRoute('warrens') || G.depth !== 4 || Game.route() !== 'warrens') out.push(`choosing the Warrens went to ${G.depth} by ${Game.route()}`);
  const L4 = Game.level();
  if (L4.route !== 'warrens' || L4.theme !== ROUTES.warrens.theme) out.push(`floor 4 is ${L4.route}, theme ${L4.theme}`);
  if (!L4.npcs.some(n => n.id === ROUTES.warrens.encounter)) out.push('the Warrens\' own encounter was not on its first floor');
  if (Game.chooseRoute('crypts')) out.push('a second road was taken');
  // the last two floors follow no road
  const gen = (d, route) => Dungeon.generate('fork-lean', d, { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true, route });
  if (gen(7, 'crypts').route || gen(3, 'crypts').route) out.push('a floor outside the road\'s span followed it');
  // the creatures lean the road's way
  const share = (route, kin) => { let n = 0, of = 0; for (let i = 0; i < 12; i++) for (const d of [4, 5, 6]) for (const m of Dungeon.generate('lean' + i, d, { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true, route }).monsters) { if (MONSTERS[m.id].named) continue; of++; if (kin.includes(m.id)) n++; } return n / of; };
  const ck = ROUTES.crypts.kin;
  if (!(share('crypts', ck) > share('warrens', ck) + 0.2)) out.push(`crypt-kin: ${share('crypts', ck).toFixed(2)} in the Crypts, ${share('warrens', ck).toFixed(2)} in the Warrens`);
  // a champion on a road's floor is one of its own, where one suits
  for (let i = 0; i < 20; i++) {
    for (const road of ['crypts', 'warrens']) {
      const plan = Dungeon.namedPlan('champ' + i, 8, road);
      for (const d of Object.keys(plan).map(Number)) if (d >= 4 && d <= 6 && !ROUTES[road].champions.includes(plan[d])) out.push(`${plan[d]} held floor ${d} of the ${road}`);
    }
  }
  // descend() on its own takes the road the seed leans to, the same each time
  const a = await start('fighter', 'fork-default', { levels: 8 }), b = await start('fighter', 'fork-default', { levels: 8 });
  for (const c of [a, b]) { for (let d = 1; d < 4; d++) { c.Game.level().monsters.length = 0; c.Game.descend(); } }
  if (!a.Game.route() || a.Game.route() !== b.Game.route()) out.push(`descend() took ${a.Game.route()} and ${b.Game.route()}`);
  return out.length ? [...new Set(out)].slice(0, 6).join('; ') : true;
});

await test('a smouldering floor holds the Cinder Ring, and no other floor or trader does; worn, fire on the floor does not burn, and an emberling\'s flare and the Heartforged\'s stamp do half', async () => {
  const out = [];
  const ctx = await newContext();
  const { Game, Dungeon, RELICS, twistRelic, relicPlan } = ctx;
  const id = twistRelic('smouldering');
  if (!id || RELICS[id].twist !== 'smouldering') return 'no relic for a smouldering floor';
  // a seed whose eight floors have a smouldering one
  let seed = '', at = 0;
  for (let i = 0; i < 400 && !at; i++) { const plan = Dungeon.twistPlan(`cinder-${i}`, 8); const d = Number(Object.keys(plan).find(k => plan[k] === 'smouldering') || 0); if (d > 0) { seed = `cinder-${i}`; at = d; } }
  if (!at) return 'no seed of 400 had a smouldering floor';
  Game.newGame({ name: 'C', cls: 'thief', bg: 'oathbroken', stats: { ...evenStats }, seed, opts: { ...OPTS, levels: 8 } });
  const G = Game.state();
  const holds = () => Object.values(Game.level().items).flat().filter(it => it.u === id).length;
  while (G.depth < at) { if (holds()) out.push(`floor ${G.depth} held the Cinder Ring`); Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts'); }
  if (Game.level().twist !== 'smouldering') return `floor ${at} is ${Game.level().twist}, not smouldering`;
  if (holds() !== 1) out.push(`the smouldering floor held ${holds()} Cinder Rings`);
  // never planned for a floor or a trader
  for (let i = 0; i < 30; i++) for (const cls of ['fighter', 'mage', 'thief', 'druid']) {
    const plan = relicPlan('rp' + i, cls, 12);
    if ([...Object.values(plan.floor), ...plan.shop].includes(id)) out.push(`${id} was planned for seed rp${i}`);
  }
  // worn: standing in fire on the floor does no harm, where without it it does
  const p = Game.player();
  p.hp = p.maxHp = 999;
  const L = Game.level();
  L.monsters.length = 0; L.npcs = [];
  const burnFor = ms => { const hp = p.hp; for (let t = 0; t < ms; t += 25) { L.fields = L.fields || {}; L.fields[`${p.x},${p.y}`] = { k: 'fire', fuel: 'vent', until: G.t + 5000, spread: G.t + 1e9, burn: Math.min((L.fields[`${p.x},${p.y}`] || {}).burn || G.t, G.t + 200), gen: 9, wild: true }; Game.update(G.t + 25, 25); } return hp - p.hp; };
  const bare = burnFor(3000);
  if (!(bare > 0)) out.push('without the ring, fire on the floor did no harm');
  wearRelic(ctx, id);
  if (!Game.hasPower('emberwalk')) out.push('the Cinder Ring worn gave no Ember-walker');
  p.hp = 999;
  const ringed = burnFor(3000);
  if (ringed) out.push(`with the ring, fire on the floor did ${ringed}`);
  // an emberling's flare and the Heartforged's stamp, beside the hero: half as much with the ring as without
  const [dx, dy] = Dungeon.DIRS[p.dir];
  const blowOf = (id, move, n) => {
    let total = 0;
    seedDice(ctx, 'cinder-' + move);
    for (let i = 0; i < n; i++) {
      L.fields = {}; L.monsters.length = 0; p.hp = 999; G.blowGate = 0;
      L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
      L.monsters.push({ uid: 300 + i, id, x: p.x + dx, y: p.y + dy, hp: 9999, maxHp: 9999, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0, spoke: true, windup: { kind: 'move', move, at: G.t, until: G.t } });
      const hp = p.hp;
      Game.update(G.t + 25, 25);
      total += hp - p.hp;
    }
    return total / n;
  };
  for (const [id, move] of [['emberling', 'flare'], ['heartforged', 'stamp']]) {
    const worn = blowOf(id, move, 40);
    const ring = p.eq.ring && p.eq.ring.u === id ? 'ring' : p.eq.ring2 && p.eq.ring2.u === id ? 'ring2' : (p.eq.ring && p.eq.ring.u ? 'ring' : 'ring2');
    const was = p.eq[ring]; p.eq[ring] = null;
    const bareBlow = blowOf(id, move, 40);
    p.eq[ring] = was;
    const r = worn / Math.max(1, bareBlow);
    if (!(r > 0.3 && r < 0.75)) out.push(`a ${move} did ${worn.toFixed(1)} with the ring and ${bareBlow.toFixed(1)} without`);
  }
  return out.length ? [...new Set(out)].slice(0, 6).join('; ') : true;
});

await test('each road\'s last floor holds a relic found nowhere else, which anyone can wear', async () => {
  const out = [];
  for (const road of ['crypts', 'warrens']) {
    const ctx = await newContext();
    const { Game, RELICS, routeRelic, relicPlan } = ctx;
    Game.newGame({ name: 'R', cls: 'mage', bg: 'oathbroken', stats: { ...evenStats }, seed: 'road-relic', opts: { ...OPTS, levels: 8 } });
    const G = Game.state(), id = routeRelic(road);
    if (!id || RELICS[id].route !== road) { out.push(`no relic for the ${road}`); continue; }
    const holds = () => Object.values(Game.level().items).flat().filter(it => it.u === id).length;
    for (let d = 1; d < 3; d++) { if (holds()) out.push(`floor ${G.depth} held ${id} before the road`); Game.level().monsters.length = 0; Game.descend(); }
    if (!Game.chooseRoute(road)) { out.push(`could not take the ${road}`); continue; }
    while (G.depth < 6) { if (holds()) out.push(`floor ${G.depth} of the ${road} held its relic early`); Game.level().monsters.length = 0; Game.descend(); }
    if (holds() !== 1) { out.push(`the ${road}'s last floor held ${holds()} of ${id}`); continue; }
    // a mage picks it up and wears it: its make is known, and its own power counts
    const L = Game.level(), k = Object.keys(L.items).find(k => L.items[k].some(it => it.u === id)), it = L.items[k].find(x => x.u === id);
    const p = Game.player(); [p.x, p.y] = k.split(',').map(Number);
    Game.takeItem(it);
    if (!Game.equip(p.inv.find(x => x.u === id))) out.push(`a mage could not wear ${id}`);
    if (!Game.isKnown(RELICS[id].t)) out.push(`${id} left its make unknown`);
    if (!RELICS[id].powers.every(k => Game.hasPower(k))) out.push(`${id} worn gave none of ${RELICS[id].powers}`);
    Game.level().monsters.length = 0; Game.descend();
    if (holds()) out.push('the floor past the road held it too');
    // never in the relics a run hands out on its floors or at its traders
    for (let i = 0; i < 30; i++) for (const cls of ['fighter', 'mage', 'thief']) {
      const plan = relicPlan('rp' + i, cls, 12);
      if ([...Object.values(plan.floor), ...plan.shop].includes(id)) out.push(`${id} was planned for seed rp${i}`);
    }
  }
  return out.length ? [...new Set(out)].slice(0, 6).join('; ') : true;
});

await test('a floor is dressed the same whether made now or dressed on loading an old save; the roads and the last floor wear their own walls', async () => {
  const out = [];
  const ctx = await start('fighter', 'dress-save', { levels: 8 });
  const { Game, Dungeon, THEMES, ROUTES } = ctx;
  const L = Game.level(), made = JSON.stringify(L.dressing);
  if (!L.dressing || !L.dressing.length) out.push('floor 1 has no dressing');
  // a save from before there was dressing: the same comes back on loading
  delete L.dressing;
  Game.save(true);
  if (!Game.load()) return 'load returned false';
  if (JSON.stringify(Game.level().dressing) !== made) out.push('an old save was dressed differently on loading');
  // but nothing is dressed under the hero's feet, wherever they stood when it was saved
  {
    const L2 = Game.level(), p = Game.player(), spot = L2.dressing.find(d => d.k !== 'puddle');
    if (spot) {
      p.x = spot.x; p.y = spot.y;
      delete L2.dressing;
      Game.save(true); Game.load();
      const q = Game.player();
      if (Game.level().dressing.some(d => d.x === q.x && d.y === q.y)) out.push('an old save was dressed under the hero');
    }
  }
  // the ordinary themes take turns; the roads and the last floor have their own
  const FINAL = THEMES.findIndex(t => t.final);
  for (let d = 1; d <= 8; d++) {
    const t = Dungeon.generate('themes', d, { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true }).theme;
    if (d === 8 ? t !== FINAL : (t >= FINAL || THEMES[t].road)) out.push(`floor ${d} of a road-less run wore ${THEMES[t].name}`);
  }
  for (const road of ['crypts', 'warrens']) {
    const t = Dungeon.generate('themes', 5, { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true, route: road }).theme;
    if (THEMES[t].road !== road || t !== ROUTES[road].theme) out.push(`floor 5 down the ${road} wore ${THEMES[t].name}`);
  }
  return out.length ? out.join('; ') : true;
});

await test('the fallen leave remains a while: bones from the bony, a husk from the rest, nothing from a wraith', async () => {
  const out = [];
  for (const [id, want] of [['goblin', 'remains_husk'], ['skeleton', 'remains_bones'], ['wraith', null]]) {
    const ctx = await start('fighter', 'remains-' + id);
    const { Game } = ctx; const G = Game.state(), p = Game.player();
    p.perkHit = 60;
    const m = beside(ctx, id, { hp: 1, maxHp: 1 });
    for (let i = 0; i < 6 && Game.level().monsters.includes(m); i++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }
    if (Game.level().monsters.includes(m)) { out.push(`the ${id} would not die`); continue; }
    const left = (Game.level().remains || []).filter(r => r.until > G.t);
    if (want ? left.length !== 1 || left[0].k !== want : left.length) out.push(`a ${id} left ${JSON.stringify(left.map(r => r.k))}`);
    // and they are gone in time
    // and they are gone in time, from the save too
    if (want) { G.t += 300000; Game.save(true); if ((Game.level().remains || []).length) out.push(`a ${id}'s remains were still kept after their time`); }
  }
  return out.length ? out.join('; ') : true;
});

await test('a barrel, crate or urn breaks to a blow with nothing to fight in front, and holds the same whatever reloads', async () => {
  const out = [];
  const found = [];
  for (const k of ['crate', 'crate', 'urn']) {
    const ctx = await start('fighter', 'smash-it');
    const { Game, Dungeon } = ctx;
    // the second crate is the first again, after a save and a reload of the same run
    if (found.length === 1) { Game.save(true); Game.load(); }
    const G = Game.state(), p = Game.player(), L = Game.level();
    L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir], x = p.x + dx, y = p.y + dy;
    if (L.tiles[y * L.w + x] !== Dungeon.T.FLOOR) return 'no floor in front of the hero on this seed';
    delete L.items[x + ',' + y];
    L.dressing.push({ x, y, k, ox: 0, oy: 0 });
    const at = markLog(G);
    G.t = Math.max(G.t, p.nextAttack); Game.input('attack');
    if (L.dressing.some(d => d.x === x && d.y === y && d.k === k)) { out.push(`the ${k} did not break`); continue; }
    const said = linesSince(G, at).join(' ');
    if (!/splinters|shatters|give way/.test(said)) out.push(`breaking the ${k} said "${said}"`);
    found.push(k + ':' + JSON.stringify(L.items[x + ',' + y] || []));
  }
  // the same square on the same seed holds the same, crate or urn, reloaded or not
  if (found[0] !== found[1]) out.push(`a crate held ${found[0]} once and ${found[1]} the next time`);
  // a monster in front takes the blow, and the crate behind it stands
  const ctx = await start('fighter', 'smash-it');
  const { Game, Dungeon } = ctx; const G = Game.state(), p = Game.player(), L = Game.level();
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.dressing.push({ x: p.x + dx, y: p.y + dy, k: 'barrel', ox: 0, oy: 0 });
  const m = beside(ctx, 'goblin', { hp: 999, maxHp: 999 });
  p.perkHit = 60;
  // (a natural 1 misses whatever the odds: swung a few times)
  for (let i = 0; i < 4 && m.hp === 999; i++) { G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('attack'); }
  if (m.hp === 999) out.push('the goblin in front was not struck');
  if (!L.dressing.some(d => d.k === 'barrel' && d.x === p.x + dx)) out.push('the barrel under the goblin broke instead');
  return out.length ? out.join('; ') : true;
});

await test('walking into a barrel kicks it over, and the Use button breaks one ahead, saying Break', async () => {
  const out = [];
  for (const how of ['walk', 'use']) {
    const ctx = await start('fighter', 'kick-it');
    const { Game, Dungeon } = ctx; const G = Game.state(), p = Game.player(), L = Game.level();
    L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir], x = p.x + dx, y = p.y + dy;
    if (L.tiles[y * L.w + x] !== Dungeon.T.FLOOR) return 'no floor in front of the hero on this seed';
    delete L.items[x + ',' + y];
    L.dressing.push({ x, y, k: 'barrel', ox: 0, oy: 0 });
    if (how === 'use' && Game.useLabel() !== 'Break') out.push(`facing a barrel the button said ${Game.useLabel()}`);
    const from = [p.x, p.y];
    G.t = Math.max(G.t, p.nextAttack);
    Game.input(how === 'walk' ? 'forward' : 'use');
    if (L.dressing.some(d => d.x === x && d.y === y && d.k === 'barrel')) out.push(`${how}ing did not break the barrel`);
    if (p.x !== from[0] || p.y !== from[1]) out.push(`${how}ing into the barrel moved the hero onto its square`);
    if (!(L.remains || []).some(r => r.k === 'remains_staves')) out.push(`${how}ing left no staves behind`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a win by a road is a feat of that road; the Hall line names it', async () => {
  const ctx = await newContext();
  const { Game } = ctx;
  Game.newGame({ name: 'R', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'road-win', opts: { ...OPTS, permadeath: true, difficulty: 'normal', levels: 8 } });
  for (let d = 1; d < 4; d++) { Game.level().monsters.length = 0; Game.descend(); }
  const road = Game.route();
  winHere(Game);
  if (JSON.stringify(Game.earned().firstFeats) !== JSON.stringify([road])) return `a win by the ${road} earned ${JSON.stringify(Game.earned())}`;
  return Game.hall()[0].route === road || `the Hall kept ${Game.hall()[0].route}`;
});

await test('a ranger: a bow and Dexterity, Steady Aim at two squares or more (one more from three on a short Normal delve, not on Hard), and the bow talents', async () => {
  const out = [];
  const ctx = await start('ranger', 'ranger-kit');
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  if (!p.eq.weapon || p.eq.weapon.t !== 'shortbow') out.push(`a ranger starts with ${p.eq.weapon && p.eq.weapon.t}`);
  // Dexterity lands the blow, not Strength
  p.stats.str = 3; p.stats.dex = 18;
  const hitHigh = Game.toHit(); p.stats.dex = 10; const hitLow = Game.toHit(); p.stats.dex = 18;
  if (hitHigh - hitLow !== 4) out.push(`Dexterity 18 against 10 moved a ranger's to-hit by ${hitHigh - hitLow}`);
  // Steady Aim: the same arrows, adjacent and three squares off
  const [dx, dy] = Dungeon.DIRS[p.dir];
  for (const k of [1, 2, 3]) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = Dungeon.T.FLOOR;
  const volleyOf = dist => {
    seedDice(ctx, 'aim');
    const m = beside(ctx, 'ogre', { hp: 99999, maxHp: 99999, nextAct: G.t + 1e12 });
    m.x = p.x + dx * dist; m.y = p.y + dy * dist; p.perkHit = 60;
    let dealt = 0;
    for (let i = 0; i < 30; i++) { const hp = m.hp; G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); dealt += hp - m.hp; }
    return dealt / 30;
  };
  // (on a short delve on Normal, as here, Steady Aim is two; on Hard one: see below)
  const near = volleyOf(1), far = volleyOf(3);
  if (Math.abs(far - near - 2) > 0.01) out.push(`arrows from three squares did ${far.toFixed(2)} a shot, from beside it ${near.toFixed(2)}`);
  G.opts.difficulty = 'hard';
  const nearH = volleyOf(1), farH = volleyOf(3);
  if (Math.abs(farH - nearH - 1) > 0.01) out.push(`on Hard, arrows from three squares did ${farH.toFixed(2)} a shot, from beside it ${nearH.toFixed(2)}`);
  G.opts.difficulty = 'normal';
  // talents: two squares further and a sixth quicker
  p.perkHit = 0;
  const hitAfter = Game.toHit();
  const range0 = Game.weapon().range, speed0 = Game.weapon().speed;
  talent(ctx, 'eagle_eye'); talent(ctx, 'swift_quiver');
  if (Game.weapon().range !== range0 + 2) out.push(`Eagle Eye took the bow from ${range0} to ${Game.weapon().range}`);
  if (Math.abs(Game.weapon().speed - speed0 * 5 / 6) > 1) out.push(`Swift Quiver took a shot from ${speed0}ms to ${Game.weapon().speed}`);
  p.perkHit = 0;
  // (the practice took long enough to make the hero hungry: compare with to-hit after it)
  if (Game.toHit() !== hitAfter + 1) out.push(`Eagle Eye took to-hit from ${hitAfter} to ${Game.toHit()}`);
  return out.length ? out.join('; ') : true;
});

await test('Snare catches the first foe down the corridor and breaks its blow; a Warden\'s bites; nothing ahead costs nothing', async () => {
  const out = [];
  const ctx = await start('ranger', 'snare');
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  p.hp = p.maxHp = 999;
  const [dx, dy] = Dungeon.DIRS[p.dir];
  for (const k of [1, 2, 3, 4]) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = Dungeon.T.FLOOR;
  L.monsters.length = 0;
  if (Game.useAbility() !== false || Game.castLabel() !== 'Snare') out.push(`a snare at nothing was ${Game.castLabel()}`);
  const m = beside(ctx, 'orc', { nextAct: G.t, windup: { kind: 'melee', at: G.t, until: G.t + 500 } });
  m.x = p.x + dx * 3; m.y = p.y + dy * 3;
  const t0 = G.t;
  if (!Game.useAbility()) return 'Snare was refused with an orc three squares off';
  if (m.windup) out.push('the snared orc kept its blow drawn back');
  if (m.nextAct - t0 < 2500) out.push(`the snared orc moves again in ${m.nextAct - t0}ms`);
  if (!/^Snare \d+s$/.test(Game.castLabel())) out.push(`after a Snare the button says ${Game.castLabel()}`);
  // a Warden's cord bites
  const c2 = await start('ranger', 'snare-warden');
  const q = c2.Game.player(), L2 = c2.Game.level(); q.path = 'warden';
  const [ex, ey] = c2.Dungeon.DIRS[q.dir];
  for (const k of [1, 2]) L2.tiles[(q.y + ey * k) * L2.w + q.x + ex * k] = c2.Dungeon.T.FLOOR;
  const w = beside(c2, 'orc', { hp: 500, maxHp: 500, nextAct: c2.Game.state().t + 1e9 });
  const ac0 = c2.Game.playerAC(); q.path = null; const acNo = c2.Game.playerAC(); q.path = 'warden';
  if (ac0 !== acNo + 1) out.push(`a Warden's armour class is ${ac0}, without the path ${acNo}`);
  c2.Game.useAbility();
  if (!(w.hp < 500)) out.push('a Warden\'s snare did not bite');
  return out.length ? out.join('; ') : true;
});

await test('two rings of one kind do not add up: the better counts', async () => {
  const ctx = await start('fighter', 'rings-no-stack');
  const { Game } = ctx; const p = Game.player();
  const ac0 = Game.playerAC();
  const a = { t: 'ring_protect', q: 1, e: 2 }, b = { t: 'ring_protect', q: 1, e: 1 };
  p.inv.push(a, b); Game.equip(a, true); Game.equip(b, true);
  if (p.eq.ring !== a || p.eq.ring2 !== b) return 'both rings did not go on';
  if (Game.playerAC() !== ac0 + 3) return `two Rings of Protection (+2, +1) made armour ${ac0} into ${Game.playerAC()}, want ${ac0 + 3} (the better one)`;
  return true;
});
};
