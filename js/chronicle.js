// How a run ends and is remembered: the win and the death, the run in numbers,
// and the bestiary, which keeps what the hero learned of each kind of monster
// across runs. What it borrows from the game comes through K, read live.
import { BACKGROUNDS, BESTIARY, ITEMS, JOURNAL, MONSTERS, ROUTES } from './data.js';
import { Progress } from './progress.js';
import { Sound } from './sound.js';

/** @param {any} K */
export function makeChronicle(K) {
  const HALL_KEY = K.HALL_KEY;
  const LAST_KEY = K.LAST_KEY;
  const SAVE_KEY = K.SAVE_KEY;
  const companion = K.companion;
  const fx = K.fx;
  const wild = K.wild;
  const P = (/** @type {any[]} */ ...a) => K.P(...a);
  const cap = (/** @type {any[]} */ ...a) => K.cap(...a);
  const emit = (/** @type {any[]} */ ...a) => K.emit(...a);
  const isQuick = (/** @type {any[]} */ ...a) => K.isQuick(...a);
  const itemName = (/** @type {any[]} */ ...a) => K.itemName(...a);
  const killerPhrase = (/** @type {any[]} */ ...a) => K.killerPhrase(...a);
  const liveLine = (/** @type {any[]} */ ...a) => K.liveLine(...a);
  const log = (/** @type {any[]} */ ...a) => K.log(...a);
  const mstat = (/** @type {any[]} */ ...a) => K.mstat(...a);
  const noteRun = (/** @type {any[]} */ ...a) => K.noteRun(...a);
  const runKey = (/** @type {any[]} */ ...a) => K.runKey(...a);
  const the = (/** @type {any[]} */ ...a) => K.the(...a);

  // ---------- the end ----------
  // Lifting the Heart ends the run. Its light pours out over the walls, runs up
  // through the stone and carries the hero out with it: the view floods gold
  // for a moment before the victory screen, so the ending is seen, not just read.
  const FINALE_MS = 2600;
  function claimHeart() {
    P().inv.push({ t: 'artifact', q: 1, e: 0 });   // unique: never blocked by the pack limit
    log('You lift the Heart of the Mountain. Its light pours out between your fingers, over the walls, up through the stone.', 'good');
    fx.heartAt = K.realNow;
    fx.shakeAmp = 3; fx.shakeMs = 1600; fx.shakeUntil = K.realNow + 1600;
    Sound.play('heart');
    win();
  }
  function win() {
    K.G.status = 'won';
    log('The light carries you up out of the mountain and into the day. The Heart is yours.', 'good');
    Sound.play('win');
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    if (K.G.opts.permadeath) noteRun(runKey(), 'ended');
    recordHero(true);
    emit('won');
  }
  /** How long the Heart's light has left to fill the view before the victory screen. */
  function finaleLeft() { return fx.heartAt >= 0 ? Math.max(0, fx.heartAt + FINALE_MS - K.realNow) : 0; }
  // Gold spent well shows in everything else; gold hoarded counts for nothing.
  // claiming the Heart is worth half the run again: a flat bonus alone left a
  // win barely ahead of a death on the last floor (22,146 against 20,562)
  function score(p, depth, won) { const run = p.xp * 2 + p.deepest * 100; return won ? Math.round(run * 1.5) + 2000 : run; }
  // Only one page is buried per floor, so a short dungeon holds fewer than the
  // archive knows about. Count what this delve can actually yield, not the lot.
  function pagesInDungeon() { return Math.min(K.G && K.G.opts ? K.G.opts.levels : JOURNAL.length, JOURNAL.length); }
  // How the story closes, in the voice of the life that brought you here.
  /** What became of the companion, for the epilogue's list of what the valley tells. */
  function companionFate(c, won) {
    const here = c.depth === K.G.depth, n = c.name;
    if (c.kind === 'goblin') {
      if (c.fallen) return `a goblin called ${n} is buried on floor ${c.fallen} of the Deepdelve, with a bent wire in its fist`;
      if (won) return here ? `a goblin called ${n} came out into the daylight with them, blinked at it, and has been opening the valley's locks ever since` : `a goblin called ${n} was seen at the mouth of the Deepdelve a month later, with a sack that clinked`;
      return here && c.mode === 'follow' ? `a goblin called ${n} slipped away into the dark with their purse, which is only what goblins do` : `a goblin called ${n} is still down there somewhere, picking locks for nobody`;
    }
    if (c.kind === 'wolf') {
      if (c.fallen) return `a grey wolf called ${n} lies under a cairn on floor ${c.fallen} of the Deepdelve, and the valley's dogs will not go near it`;
      if (won) return here ? `a grey wolf called ${n} came out of the mountain with them, and is seen at the edge of the valley's woods on still nights` : `a grey wolf called ${n} was heard howling at the mouth of the Deepdelve for three nights, and then was gone`;
      return here && c.mode === 'follow' ? `a grey wolf called ${n} stood over them to the last, and went back into the dark` : `a grey wolf called ${n} is said to walk the deep floors still`;
    }
    if (c.kind === 'mender') {
      if (c.fallen) return `a healer called ${n} lies on floor ${c.fallen} of the Deepdelve, with the satchel for a pillow and nobody left to mend them`;
      if (won) return here ? `a healer called ${n} walked out of the mountain beside them, and has stitched up half the valley since` : `a healer called ${n} came up out of the Deepdelve a week after them, with a full satchel and a long story`;
      return here && c.mode === 'follow' ? `a healer called ${n} closed their eyes, and went on down alone to find someone who could still be mended` : `a healer called ${n} waited on the floor below where they were told, tending their own scrapes, until the herbs ran out`;
    }
    if (c.kind === 'renegade') {
      if (c.avenged && won && here) return `a dark elf called ${n}, who saw the High Priestess of their people fall, walked out of the mountain at their side and has never once looked back down it`;
      if (c.avenged && !c.fallen) return won ? `a dark elf called ${n}, who saw the High Priestess of their people fall, came up out of the Deepdelve a night after them, and was gone again before dawn` : `a dark elf called ${n}, who saw the High Priestess of their people fall, went on down alone, for the debt was paid and the dark was theirs again`;
      if (c.avenged && c.fallen) return `a dark elf called ${n} lies on floor ${c.fallen} of the Deepdelve, the two blades crossed on their breast, having seen the High Priestess fall first`;
      if (c.fallen) return `a dark elf called ${n} lies on floor ${c.fallen} of the Deepdelve, the two blades crossed on their breast, further from home than any of their people had gone`;
      if (won) return here ? `a dark elf called ${n} came up into the daylight with them, hooded against it, and keeps to the valley's woods and the night` : `a dark elf called ${n} came up out of the Deepdelve a night after them, and was gone again before dawn`;
      return here && c.mode === 'follow' ? `a dark elf called ${n} stood over them to the last, and went back down into the dark, where nobody would have them` : `a dark elf called ${n} waited where they were told on the floor below, and is waiting still`;
    }
    if (c.kind === 'sellsword') {
      if (c.fallen) return `a sellsword called ${n} lies on floor ${c.fallen} of the Deepdelve with the sword across their chest, paid in full`;
      if (won) return here ? `a sellsword called ${n} walked out of the mountain at their side, drank the valley dry that night, and still tells it better than they do` : `a sellsword called ${n} came up a day after them, bloodied, and asked for the rest of the pay`;
      return here && c.mode === 'follow' ? `a sellsword called ${n} carried them up out of the dark, and would not take a coin for it` : `a sellsword called ${n} waited where they were told on the floor below until the food ran out, and then came up cursing`;
    }
    if (c.fallen) return `a hound called ${n} lies buried on floor ${c.fallen} of the Deepdelve, and they do not talk about it`;
    if (won) return here ? `a brown hound called ${n} sleeps by their fire, and will not be parted from them` : `a brown hound called ${n} came up out of the Deepdelve a week after them, thin as a rake, and will not be parted from them again`;
    return here && c.mode === 'follow' ? `a brown hound called ${n} stood over them to the last, and came up out of the dark alone` : `a brown hound called ${n} was found at the foot of the stair, waiting`;
  }
  function epilogue(won) {
    const p = P();
    const bg = BACKGROUNDS[p.bg] || BACKGROUNDS.oathbroken;
    const read = K.G.journal ? K.G.journal.length : 0;
    const lines = [];
    if (won) {
      lines.push(`${p.name} came up out of the Deepdelve carrying the Heart of the Mountain, which is a sentence nobody in the valley has been able to write for three winters.`);
      lines.push(bg.epi);
      if (K.G.route && ROUTES[K.G.route]) lines.push(ROUTES[K.G.route].epi);   // the road taken at the divided stair
      const total = pagesInDungeon();
      lines.push(read >= total
        ? 'They also carried out every page the earlier crews left behind, so the valley will finally learn what became of them.'
        : `They left ${total - read} of the earlier crews' pages down there in the dark. Someone else will have to go back for those.`);
    }
    // the choices that followed them down
    const t = K.G.threads || {};
    const told = [];
    if (t.captive) told.push('a man they cut out of goblin chains tells the story in the valley taverns, and gets the details wrong in their favour');
    if (t.guide) told.push('a guildsman they dug out of the rubble keeps their chalk map on his wall');
    if (t.crew) told.push('the third crew lies buried where they fell, because someone stopped to do it');
    if (t.lamp) told.push('the Lampfolk still tell of a sun-walker who stopped in the dark to light a lamp');
    if (t.robbed) told.push('the Lampfolk have a name for them, and do not say it kindly');
    if (t.spared) told.push('somewhere in the dark a goblin with a scar tells its tribe about the one who let it live');
    if (t.oathPaid) told.push('they carried a weeping knight\'s blade out of the dark, though they never learned what its task had been');
    if (t.eggPaid) told.push('a wyrm followed them down for the egg they smashed');
    if (t.tollowedPaid) told.push('the goblins of the upper halls still curse the one who would not pay their toll');
    if (K.G.companion) told.push(companionFate(K.G.companion, won));
    if (t.bargain) told.push(won ? 'they never speak of the pale thing in the narrow passage, or what it cost them at the end' : 'whatever they bargained with in the narrow passage was paid in full');
    if (!won) {
      lines.push(p.deepest >= 4
        ? `${p.name} got as far as floor ${p.deepest} of the Deepdelve, which is further than the fourth crew managed.`
        : `${p.name} fell on floor ${K.G.depth} of the Deepdelve, in the shallow halls where it takes most of those who try.`);
      lines.push(bg.epi);
      lines.push(read > 0
        ? `They were carrying ${read} of the earlier crews' pages when they fell. In time someone will find those too, along with a new name for the roster.`
        : 'They carried nothing out and left nothing behind but another name for the roster.');
    }
    if (told.length) lines.push(cap(told.join('; ')) + '.');
    // a shade laid to rest on the way down
    if (K.G.rested) lines.push(`On the way down they found ${K.G.rested}, who had gone before them, and laid them to rest.`);
    // the fallen are remembered (Progress.fallen), and the next delve will say so
    // (a test run leaves no bones: recordFallen passes it by)
    if (!won && !K.G.opts.daily && !K.G.tested) lines.push(`${p.name} will not lie quiet. A later delve will find their bones where they fell, and something keeping watch over them.`);
    return lines;
  }
  function recordHero(won) {
    const p = P();
    // a test run (endless life, spell points or gold) is written nowhere
    if (K.G.tested) { K.G.earned = won ? { tested: true } : null; return; }
    try { localStorage.setItem(LAST_KEY, JSON.stringify({ name: p.name, cls: p.cls, depth: K.G.depth, levels: K.G.opts.levels || 8, won, killer: won ? '' : killerPhrase(), date: Date.now() })); } catch (e) { /* private browsing */ }
    // trophies first, so a first win is told on the victory screen
    // only a win on one life counts: a run that could be reloaded proves less
    // (a quick delve's win goes in the Hall, but earns no trophy: those wait for four floors or more)
    if (won && K.G.opts.permadeath && !isQuick()) K.G.earned = Progress.recordWin(p.cls, K.G.opts.difficulty || 'normal', { path: p.path, vows: K.G.opts.vows, levels: K.G.opts.levels, route: K.G.route,
      jobs: (K.G.stats && K.G.stats.bounties) || 0, veteran: !!(companion.here() && companion.rank() >= 2), shapes: (K.G.stats && K.G.stats.shapes) || 0 });
    else if (won) K.G.earned = { reloadable: true };
    /** @type {Record<string, any>} */
    const entry = { name: p.name, cls: p.cls, level: p.level, renown: p.renown || 0, depth: K.G.depth, gold: p.gold, xp: p.xp, kills: p.kills, won, seed: K.G.seed, date: Date.now(), score: score(p, K.G.depth, won),
      difficulty: K.G.opts.difficulty || 'normal', permadeath: !!K.G.opts.permadeath, levels: K.G.opts.levels || 8, ...(K.G.route ? { route: K.G.route } : {}), ...(K.G.opts.daily ? { daily: K.G.opts.daily, ...(K.G.opts.dailyKind ? { dailyKind: K.G.opts.dailyKind } : {}) } : {}) };
    // the named champions it cut down, by name, for the Hall's line
    const slain = Object.keys(runStats().kills).filter(id => MONSTERS[id] && MONSTERS[id].named).map(id => MONSTERS[id].named.called);
    if (slain.length) entry.named = slain;
    if (p.path) entry.path = p.path;       // "Level 9 Fighter, Knight"
    if (Array.isArray(K.G.opts.vows) && K.G.opts.vows.length) entry.vows = K.G.opts.vows.slice();
    // One run, one line: a hero who falls, loads the last save and falls again
    // was written in once per death. The run is known by when it began (a save
    // from before that was kept goes by its seed and hero), and its last end
    // replaces the one before.
    entry.run = runKey();
    if (K.G.rested) entry.rested = K.G.rested;   // an earlier hero's shade laid to rest
    try {
      const list = hall().filter(h => h.run !== entry.run);
      list.push(entry);
      list.sort((a, b) => b.score - a.score);
      localStorage.setItem(HALL_KEY, JSON.stringify(list.slice(0, 20)));
    } catch (e) { /* ignore */ }
  }
  /** The last run ended (not a test run), for the title. @returns {{name: string, cls: string, depth: number, levels: number, won: boolean, killer: string, date: number}|null} */
  function lastRun() {
    try { return JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); } catch (e) { return null; }
  }
  // the pack sorted by what a thing is: what you fight with first, what you use up after
  const SORT_KINDS = ['weapon', 'armor', 'shield', 'cloak', 'ring', 'amulet', 'charm', 'heal', 'potion', 'scroll', 'flask', 'oil', 'buff', 'food', 'key', 'page', 'quest', 'gem'];
  function sortPack() {
    const p = P(), rank = it => { const k = SORT_KINDS.indexOf(ITEMS[it.t].kind); return k < 0 ? SORT_KINDS.length : k; };
    // (a stable sort: like with like keeps the order it had)
    p.inv = p.inv.map((it, i) => ({ it, i })).sort((a, b) => rank(a.it) - rank(b.it) || itemName(a.it).localeCompare(itemName(b.it)) || a.i - b.i).map(o => o.it);
    emit('stats');
  }
  // ---------- the run in numbers ----------
  // What the end screen tells about the run: who was killed, the best blow,
  // where it hurt. Only ever written to, never read by the rules, so nothing
  // here can change how a fight goes. The hooks elsewhere are one line each.
  /** @returns {import('./types.js').RunStats} */
  function freshStats() {
    return { dealt: 0, taken: 0, healed: 0, best: null, worst: null, kills: {}, spells: {}, hurtOn: {}, potions: 0, scrolls: 0, meals: 0, gold: 0 };
  }
  /** This run's stats; a save from before they were kept starts them at nothing. */
  function runStats() {
    if (!K.G.stats) K.G.stats = freshStats();
    return K.G.stats;
  }
  /** A blow the hero landed, and what it was struck with. */
  /** @param {number} [hpBefore]  what the one struck had left, so a blow past death counts only what it took */
  function noteDealt(m, dmg, tag, hpBefore = m.hp) {
    // the hound's bite is the hound's: it made neither the hero's best blow nor their tally
    // (nor is a fire some monster lit)
    if (tag === 'companion' || tag === 'blaze') return;
    const s = runStats(), p = P();
    // a blow counts for what it took: a crushing roll on a one-point rat is one point
    dmg = Math.min(dmg, Math.max(0, hpBefore));
    s.dealt += dmg;
    if (s.best && dmg <= s.best.dmg) return;
    // the first blow to reach a number keeps the record, so a tie does not rename it
    const how = K.castingName ? cap(K.castingName)
      : tag === 'offhand' ? (p.eq.offhand ? the(p.eq.offhand) : 'your off hand')
      : tag === 'thorns' ? 'your barbs' : tag === 'burning' || tag === 'blaze' ? 'fire' : tag === 'venom' ? 'poison' : tag === 'snare' ? 'your snare' : tag === 'rockfall' ? 'falling rock' : tag === 'bleed' ? 'your claws\' wounds'
      : wild.shaped(p) ? 'a bear\'s claws' : p.eq.weapon ? the(p.eq.weapon) : 'your bare hands';
    s.best = { dmg, to: mstat(m).name, id: m.id, how, depth: K.G.depth };
  }
  /** Damage the hero took, from a monster or from anything else. */
  function noteTaken(dmg, from, cause) {
    const s = runStats();
    s.taken += dmg;
    s.hurtOn[K.G.depth] = (s.hurtOn[K.G.depth] || 0) + dmg;
    if (!s.worst || dmg > s.worst.dmg) s.worst = { dmg, from: from ? mstat(from).name : '', id: from ? from.id : '', cause: from ? '' : cause || '', depth: K.G.depth };
  }
  function noteKill(m) { const k = runStats().kills; k[m.id] = (k[m.id] || 0) + 1; }
  function noteSpell(sp) { const c = runStats().spells; c[sp.id] = (c[sp.id] || 0) + 1; }
  function noteHealed(n) { runStats().healed += n; }
  function noteGold(n) { runStats().gold += n; }
  /** Something eaten, drunk or read. */
  function noteUsed(kind) {
    const s = runStats();
    if (kind === 'potion') s.potions++; else if (kind === 'scroll') s.scrolls++; else if (kind === 'food') s.meals++;
  }

  // ---------- bestiary ----------
  // What the hero has learned about each kind of monster, kept across runs
  // like the Hall of Heroes. Meeting one shows its picture and nature; the
  // first kill shows its numbers; its trick is written down once seen (or
  // after a few kills), and the answer once the hero has beaten the trick.
  const BESTIARY_KEY = 'deepdelve.bestiary';
  const TRICK_KILLS = 3, ANSWER_KILLS = 5;
  /** @returns {Record<string, {met: number, kills: number, deaths: number, trick?: number, answer?: number, el?: Record<string, string>}>} */
  // read back only when what is stored has changed: a regrowing troll notes
  // itself every second, and parsing and checking the whole book each time
  // was work for nothing
  let beastRaw = null, beastBook = null;
  function bestiary() {
    let raw = null;
    try { raw = localStorage.getItem(BESTIARY_KEY); } catch (e) { /* private browsing */ }
    if (beastBook && raw === beastRaw) return beastBook;
    let v = {};
    try { v = JSON.parse(raw || '{}'); } catch (e) { /* start afresh */ }
    if (!v || typeof v !== 'object' || Array.isArray(v)) v = {};
    // whatever was stored, each record comes back as numbers, never a crash
    const out = {};
    for (const id in v) {
      if (!MONSTERS[id]) continue;
      const r = v[id] && typeof v[id] === 'object' ? v[id] : {};
      const n = x => Math.max(0, Math.floor(Number(x) || 0));
      // what fire, cold and lightning were found to do to it, and nothing else
      const el = {};
      if (r.el && typeof r.el === 'object') for (const k of ['fire', 'cold', 'lightning']) if (r.el[k] === 'weak' || r.el[k] === 'resist') el[k] = r.el[k];
      out[id] = { met: n(r.met), kills: n(r.kills), deaths: n(r.deaths), ...(r.trick ? { trick: 1 } : {}), ...(r.answer ? { answer: 1 } : {}), ...(r.sr ? { sr: 1 } : {}), ...(r.stout ? { stout: 1 } : {}), ...(Object.keys(el).length ? { el } : {}) };
    }
    beastRaw = raw; beastBook = out;
    return out;
  }
  /**
   * One creature's line in a bestiary note, in words: "Goblin added, and you
   * learned how tough it is". Read as a list of labels ("Goblin: new entry,
   * its strength") it looked like a scrap of the game's own bookkeeping.
   * @param {string} name @param {string[]} list
   */
  function beastNote(name, list) {
    const said = { 'new entry': '', 'its strength': 'how tough it is' };
    const learned = list.filter(x => x !== 'new entry').map(x => x in said ? said[x] : /^(weak|resists)/.test(x) ? `it ${x.startsWith('weak') ? 'is ' : ''}${x}` : x);
    const and = learned.length > 1 ? `${learned.slice(0, -1).join(', ')} and ${learned[learned.length - 1]}` : learned[0];
    return list.includes('new entry') ? `${name} added${and ? `, and you learned ${and}` : ''}` : `${name}, you learned ${and}`;
  }
  /** Note something learned about a kind of monster, and say so when it is new.
   * `met` also counts a first meeting, so a trick seen at first sight is one line. */
  function learn(id, what, met) {
    if (!MONSTERS[id]) return;
    const all = bestiary(), mb = MONSTERS[id], name = mb.named ? `${mb.named.called}, the ${mb.name}` : mb.name, lore = BESTIARY[id] || {};
    const r = all[id] || (all[id] = { met: 0, kills: 0, deaths: 0 });
    const news = [];
    if (met && what !== 'met') { if (!r.met) news.push('new entry'); r.met++; }
    if (what === 'met') { if (!r.met) news.push('new entry'); r.met++; }
    else if (what === 'kill') {
      if (!r.met) news.push('new entry');
      r.met = Math.max(1, r.met);
      r.kills++;
      if (r.kills === 1) news.push('its strength');
      if (r.kills >= TRICK_KILLS && lore.trick && !r.trick) { r.trick = 1; news.push('its trick'); }
      if (r.kills >= ANSWER_KILLS && lore.answer && !r.answer) { r.answer = 1; news.push('how to beat it'); }
    }
    else if (what === 'trick') { if (lore.trick && !r.trick) { r.trick = 1; news.push('its trick'); } }
    else if (what === 'answer') {
      if (lore.answer && !r.answer) { if (!r.trick) news.push('its trick'); r.answer = 1; r.trick = 1; news.push('how to beat it'); }
    }
    else if (what === 'death') r.deaths++;
    else if (what === 'spellres') { if (!r.sr) { r.sr = 1; news.push('shrugs off spells'); } }
    else if (what === 'stout') { if (!r.stout) { r.stout = 1; news.push('poison does not take'); } }
    else if (what.startsWith('element:')) {
      const [, el, how] = what.split(':');
      r.el = r.el || {};
      if (!r.el[el]) { r.el[el] = how; news.push(how === 'weak' ? `weak to ${el}` : `resists ${el}`); }
    }
    // a trick seen or beaten again is nothing new, and a troll regrows every second
    if ((what === 'trick' || what === 'answer') && !news.length && !met) return;
    try { const raw = JSON.stringify(all); localStorage.setItem(BESTIARY_KEY, raw); beastRaw = raw; beastBook = all; } catch (e) { /* ignore */ }
    if (news.length && K.G && K.G.status === 'playing') {
      // notes that follow one another share one quiet line instead of three loud ones
      const last = liveLine();
      const notes = last && last.notes ? { ...last.notes } : {};
      notes[name] = [...new Set([...(notes[name] || []), ...news])];
      if (last && last.notes) { last.gone = true; last.m = ''; }
      K.G.log.push({ m: 'Bestiary: ' + Object.entries(notes).map(([n, l]) => beastNote(n, l)).join('; ') + '.', c: 'note', notes });
      K.G.logSeq = (K.G.logSeq || 0) + 1;
    }
  }
  /** The first meeting with this particular monster, this run. */
  function meet(m, also) {
    if (!K.G.met) K.G.met = {};
    const fresh = !K.G.met[m.uid];
    K.G.met[m.uid] = 1;
    if (also) learn(m.id, also, fresh);
    else if (fresh) learn(m.id, 'met');
  }
  function hall() {
    try { return JSON.parse(localStorage.getItem(HALL_KEY) || '[]'); } catch (e) { return []; }
  }

  return { bestiary, claimHeart, epilogue, finaleLeft, freshStats, hall, lastRun, learn, meet, noteDealt, noteGold, noteHealed, noteKill, noteSpell, noteTaken, noteUsed, pagesInDungeon, recordHero, runStats, score, sortPack, win };
}
