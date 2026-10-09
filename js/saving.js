// Saving and loading a run, and the save codes that carry a hero from one
// device to another. What it borrows from the game comes through K, read live,
// so a load that swaps the whole state is seen at once.
import { CLASSES, ITEMS, MAX_LEVEL, PATH_LEVEL } from './data.js';
import { Dungeon } from './dungeon.js';
import { Progress } from './progress.js';
import { relicPlan } from './relics.js';
import { decodeSave, encodeSave } from './savecode.js';

/** @param {any} K */
export function makeSaving(K) {
  const JEWEL_SLOTS = K.JEWEL_SLOTS;
  const SAVE_KEY = K.SAVE_KEY;
  const companion = K.companion;
  const encs = K.encs;
  const fx = K.fx;
  const prelude = K.prelude;
  const buildLooks = (/** @type {any[]} */ ...a) => K.buildLooks(...a);
  const caskLevel = (/** @type {any[]} */ ...a) => K.caskLevel(...a);
  const clearFx = (/** @type {any[]} */ ...a) => K.clearFx(...a);
  const emit = (/** @type {any[]} */ ...a) => K.emit(...a);
  const freshStats = (/** @type {any[]} */ ...a) => K.freshStats(...a);
  const log = (/** @type {any[]} */ ...a) => K.log(...a);
  const offerCapstone = (/** @type {any[]} */ ...a) => K.offerCapstone(...a);
  const offerPath = (/** @type {any[]} */ ...a) => K.offerPath(...a);
  const pruneRemains = (/** @type {any[]} */ ...a) => K.pruneRemains(...a);
  const refreshSp = (/** @type {any[]} */ ...a) => K.refreshSp(...a);
  const runKey = (/** @type {any[]} */ ...a) => K.runKey(...a);
  const runKeyOf = (/** @type {any[]} */ ...a) => K.runKeyOf(...a);
  const snapCam = (/** @type {any[]} */ ...a) => K.snapCam(...a);
  const stepAside = (/** @type {any[]} */ ...a) => K.stepAside(...a);
  const stockLampOil = (/** @type {any[]} */ ...a) => K.stockLampOil(...a);
  const win = (/** @type {any[]} */ ...a) => K.win(...a);

  // ---------- save / load ----------
  function save(auto) {
    if (!K.G || K.G.status !== 'playing') return false;
    for (const d in K.G.levels) pruneRemains(K.G.levels[d]);
    // how far along its run this is, by the game's own clock, which stands
    // still while the page is put away: a save made switching apps is no further
    if (K.G.opts.permadeath) noteRun(runKey(), K.G.t);
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(K.G));
      if (!auto) log('Game saved.', 'info');
      return true;
    } catch (e) {
      log('Could not save: ' + e.message, 'bad');
      return false;
    }
  }
  function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
  function load() {
    prelude.cancel();
    K.queuedAttack = false;
    let s = null;
    try { s = localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
    if (!s) return false;
    // a save that cannot be read leaves the game that was running as it was
    const before = K.G;
    try {
      const data = JSON.parse(s);
      if (!data || !data.player || !data.levels) return false;
      K.G = data;
      // an encounter left open belonged to the game that was running, not the one loaded
      encs.clear();
      K.G.status = 'playing';
      K.G.forkPending = false;   // saved with the divided stair's question open: it is asked again at the stair
      K.G.player.xp = Math.round(K.G.player.xp || 0);   // a shade's fraction of a point, from before it was rounded
      for (const dpt in K.G.levels) {
        if (!K.G.levels[dpt].features) K.G.levels[dpt].features = {};
        if (!K.G.levels[dpt].lights) K.G.levels[dpt].lights = [];
        if (!K.G.levels[dpt].npcs) K.G.levels[dpt].npcs = [];
        // a first floor saved before the way in came down has its stair up under fallen rock now, as told
        { const F = K.G.levels[dpt]; if (+dpt === 1 && F.stairsUp && !F.caved) F.caved = [F.stairsUp.y * F.w + F.stairsUp.x]; }
        // a floor saved before there was dressing gets some now (what was already
        // taken or dropped there is kept clear, so it may differ from a new floor's)
        // (and never under the hero's feet, wherever they stood when it was saved)
        if (!K.G.levels[dpt].dressing) {
          const hereNow = Number(dpt) === K.G.depth ? K.G.player : null;
          K.G.levels[dpt].dressing = Dungeon.dress(K.G.levels[dpt], K.G.seed).filter(d => !(hereNow && d.x === hereNow.x && d.y === hereNow.y));
          // (its barrels hold oil as a floor made now would)
          caskLevel(K.G.levels[dpt], Number(dpt));
        }
        stockLampOil(K.G.levels[dpt], Number(dpt));
        stepAside(K.G.levels[dpt]);
      }
      // a run saved on the climb out, from when the Heart had to be carried to
      // the surface, is won: the Heart was already in hand
      const wasEscaping = !!K.G.escaping;
      for (const k of ['escaping', 'escapeStart', 'nextHunt', 'hunts', 'escapeMs']) delete K.G[k];
      if (!K.G.journal) K.G.journal = [];
      if (K.G.logSeq == null) K.G.logSeq = K.G.log ? K.G.log.length : 0;
      if (K.G.player.eq.offhand === undefined) K.G.player.eq.offhand = null;
      // a run from before rings and amulets: the slots, and a look for each
      for (const s of [...JEWEL_SLOTS, 'cloak']) if (K.G.player.eq[s] === undefined) K.G.player.eq[s] = null;
      // A focus's make never counted for armour; older saves may still carry one.
      for (const it of [...K.G.player.inv, K.G.player.eq.shield]) if (it && ITEMS[it.t]?.focus) it.e = 0;
      refreshSp(K.G.player);   // spell points by today's rules, robes and all, not the rules it was saved under
      // a hero from before paths is offered one at their next level; one who
      // has no next level to reach is offered it now
      if (K.G.player.level >= MAX_LEVEL && K.G.player.level >= PATH_LEVEL && !K.G.player.path) offerPath();
      // and a save from before capstones, already at the top, is offered its path's
      else if (K.G.player.level >= MAX_LEVEL && K.G.player.path && !K.G.player.capstone) offerCapstone();
      if (K.G.looks) { const all = buildLooks(K.G.seed); for (const id in all) if (!K.G.looks[id]) K.G.looks[id] = all[id]; }
      if (!K.G.pendingBoons) K.G.pendingBoons = [];
      // a save without the counter for monsters that arrive mid-run would start it
      // again and hand a newcomer the number of one already here: grips, openings
      // and mends find a monster by its number, so two alike take each other's
      if (K.G.nextUid == null) {
        let most = 0;
        for (const dpt in K.G.levels) for (const m of K.G.levels[dpt].monsters || []) if (m.uid >= 900000) most = Math.max(most, m.uid - 900000);
        K.G.nextUid = most;
      }
      if (!K.G.player.bg) K.G.player.bg = 'oathbroken';
      if (!K.G.looks) K.G.looks = buildLooks(K.G.seed);
      // a run from before relics finds them on the floors it has yet to see
      if (!K.G.relics) K.G.relics = { ...relicPlan(K.G.seed, K.G.player.cls, K.G.opts.levels), offered: 0, found: [] };
      // a run from before the codex adds what it found (a test run, nothing)
      if (!K.G.tested) for (const id of K.G.relics.found) Progress.noteRelic(id);
      // a run from before the end screen kept its numbers counts from here on
      K.G.stats = { ...freshStats(), ...K.G.stats };
      if (!K.G.known) { K.G.known = {}; for (const id in ITEMS) K.G.known[id] = 1; }
      // a line held for its moment by the old page's clock would never show on this one
      for (const e of K.G.log || []) delete e.at;
      for (const dpt in K.G.levels) for (const m of K.G.levels[dpt].monsters) {
        // a moment's grace for anything about to act, but a foe held longer (snared,
        // staggered by a bash, frozen, coughing) stays held as long as it was
        m.nextAct = Math.max(m.nextAct || 0, K.G.t + 800); m.rx = m.x; m.ry = m.y; m.moveT1 = 0; m.flashUntil = 0; m.volley = null;
        // the page's clock starts again at nothing: a flash or a held life bar timed by the old one would hang on for good
        m.flashAt = 0; delete m.hpShown;
        // a blow being drawn back is still coming after a reload, or quitting to the
        // title would be a way out of every warned crush: it keeps its warning, and
        // the same moment's grace as everything else
        if (m.windup) { m.windup.at += 800; m.windup.until += 800; m.nextAct = m.windup.until; }
      }
      K.lastBlocked = -1e9; K.queuedAttack = false; K.queuedMove = null;
      companion.loaded();
      snapCam();
      K.distFieldAt = -1e9;
      clearFx();
      log('Game loaded.', 'info');
      // a hero who died and was loaded again lives: they are no longer below to be
      // met (a second death remembers them afresh)
      const fell = Progress.fallen();
      if (fell && fell.run === runKey()) Progress.layToRest(fell.run);
      emit('level');
      // the clock only runs on the game screen, and a load can come before it has
      if (wasEscaping) { K.realNow = performance.now(); fx.heartAt = K.realNow; win(); }
      return true;
    } catch (e) { K.G = before; return false; }
  }
  // ---------- save codes ----------
  // A permadeath run cannot be taken back with a code: this device remembers
  // how far along each such run it has saved, and which have ended, and will
  // not load a code for one that is over or older than what it has played.
  // (Another device knows nothing of it: the guard is this device's own.)
  const RUNS_KEY = 'deepdelve.runs';
  /** @returns {Record<string, number|'ended'>} */
  function runsSeen() { try { return JSON.parse(localStorage.getItem(RUNS_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function noteRun(key, v) {
    try {
      const all = runsSeen();
      if (all[key] === 'ended' || (typeof all[key] === 'number' && typeof v === 'number' && v < all[key])) return;
      delete all[key]; all[key] = v;
      // the oldest runs are let go: only the last few dozen can still be in anyone's hands
      const keys = Object.keys(all);
      for (const k of keys.slice(0, Math.max(0, keys.length - 60))) delete all[k];
      localStorage.setItem(RUNS_KEY, JSON.stringify(all));
    } catch (e) { /* private browsing */ }
  }
  /** The running hero as a code to carry to another device (saved first, so it is now). */
  async function saveCode() {
    if (!save(true)) return null;
    return encodeSave(JSON.stringify(K.G));
  }
  /** Take up the hero a code holds, in place of any saved here. @returns {Promise<{ok: boolean, why?: string}>} */
  async function loadCode(text) {
    let data;
    try { data = JSON.parse(await decodeSave(text)); } catch (e) { return { ok: false, why: e instanceof SyntaxError ? 'That code is not whole: it may have been cut short when it was copied.' : e.message }; }
    if (!data || !data.player || !data.levels || !CLASSES[data.player.cls]) return { ok: false, why: 'That code does not hold a hero.' };
    // a code comes from somewhere else: what the page writes out as markup is
    // made safe first (a log line's class, the numbers the Hall shows)
    for (const e of Array.isArray(data.log) ? data.log : []) if (e && !['good', 'bad', 'info'].includes(e.c)) e.c = '';
    for (const k of ['hp', 'maxHp', 'sp', 'maxSp', 'level', 'xp', 'gold', 'kills', 'deepest']) if (k in data.player) data.player[k] = Number(data.player[k]) || 0;
    data.depth = Number(data.depth) || 1; data.t = Number(data.t) || 0;
    const key = runKeyOf(data), seen = runsSeen()[key];
    if (data.opts && data.opts.permadeath) {
      if (seen === 'ended') return { ok: false, why: `${data.player.name}'s delve has already ended on this device, and a permadeath run cannot be taken back.` };
      if (typeof seen === 'number' && (Number(data.t) || 0) < seen) return { ok: false, why: `This device has already played ${data.player.name} further than this code, and a permadeath run cannot be taken back.` };
    }
    let before = null;
    try { before = localStorage.getItem(SAVE_KEY); localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { return { ok: false, why: 'This browser will not keep a saved game.' }; }
    if (!load()) {
      try { if (before) localStorage.setItem(SAVE_KEY, before); else localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
      return { ok: false, why: 'That code would not load.' };
    }
    if (K.G.opts.permadeath) noteRun(key, K.G.t);
    return { ok: true };
  }
  function saveSummary() {
    try {
      const s = localStorage.getItem(SAVE_KEY);
      if (!s) return null;
      const g = JSON.parse(s);
      return { name: g.player.name, cls: CLASSES[g.player.cls].name, level: g.player.level, depth: g.depth, seed: g.seed, daily: (g.opts && g.opts.daily) || '', dailyKind: (g.opts && g.opts.dailyKind) || 'main' };
    } catch (e) { return null; }
  }


  return { hasSave, load, loadCode, noteRun, save, saveCode, saveSummary };
}
