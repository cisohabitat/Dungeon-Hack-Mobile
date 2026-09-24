'use strict';
// A whole run, start to finish: four floors down, the lich, and the Heart.
// Everything happens through the game's own inputs, so the stairs, keys,
// traders and the boss are all exercised as a player would meet them.
const { test } = require('@playwright/test');
const { expect, watchForErrors, startGame, clearBoons } = require('../helpers');

// A full campaign is a long real-time run with live dice; give it room. It
// takes about three minutes alone, but beside the other workers on a busy
// machine it has run close to six. The limit is only there to catch a hang.


/**
 * A bot that lives in the page: it explores, fights what is next to it, collects
 * what it walks over, and heads for a goal. Installed once, then driven a step
 * at a time so the test can assert between moves.
 */
const BOT = () => {
  const T = Dungeon.T;
  const solid = (L, i, keysKnown) => {
    const t = L.tiles[i];
    if (t === T.FLOOR || t === T.DOOR_OPEN || t === T.DOOR) return false;
    if (t === T.DOOR_LOCKED) return !keysKnown;
    return true;
  };
  /** Distances from a square, over ground the player could actually cross. */
  const field = (L, sx, sy, keysKnown) => {
    const dist = new Int32Array(L.w * L.h).fill(-1);
    const npcs = new Set((L.npcs || []).map(n => n.y * L.w + n.x));
    const q = [sy * L.w + sx];
    dist[q[0]] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % L.w, y = (i / L.w) | 0;
      for (const [dx, dy] of Dungeon.DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
        const ni = ny * L.w + nx;
        if (dist[ni] >= 0 || npcs.has(ni) || solid(L, ni, keysKnown)) continue;
        dist[ni] = dist[i] + 1;
        q.push(ni);
      }
    }
    return dist;
  };
  window.__bot = {
    field,
    /** One step toward a target square. Returns false when there is no route. */
    stepToward(tx, ty, keysKnown) {
      const L = Game.level(), p = Game.player();
      const dist = field(L, tx, ty, keysKnown);
      let best = null, bd = dist[p.y * L.w + p.x];
      if (bd < 0) return false;
      for (let k = 0; k < 4; k++) {
        const [dx, dy] = Dungeon.DIRS[k];
        const nx = p.x + dx, ny = p.y + dy;
        if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
        if (nx === tx && ny === ty) { best = k; bd = -1; break; }
        const dd = dist[ny * L.w + nx];
        if (dd >= 0 && dd < bd) { bd = dd; best = k; }
      }
      if (best === null) return false;
      p.dir = best;
      Game.input('forward');
      return true;
    },
    /** The nearest square worth walking to: loot first, then anything unseen. */
    nextErrand(keysKnown) {
      const L = Game.level(), p = Game.player();
      const dist = field(L, p.x, p.y, keysKnown);
      let best = null, bestD = Infinity;
      const consider = (x, y, bias) => {
        const d = dist[y * L.w + x];
        if (d > 0 && d + bias < bestD) { bestD = d + bias; best = { x, y }; }
      };
      for (const k in L.items) {
        if (!L.items[k].length) continue;
        const [x, y] = k.split(',').map(Number);
        consider(x, y, 0);
      }
      for (let i = 0; i < L.tiles.length; i++) {
        if (L.explored[i] || solid(L, i, keysKnown)) continue;
        consider(i % L.w, (i / L.w) | 0, 20);
      }
      return best;
    },
    adjacentMonster() {
      const L = Game.level(), p = Game.player();
      for (let k = 0; k < 4; k++) {
        const [dx, dy] = Dungeon.DIRS[k];
        const m = L.monsters.find(mm => mm.x === p.x + dx && mm.y === p.y + dy);
        if (m) return { dir: k, uid: m.uid };
      }
      return null;
    },
  };
};

/**
 * Play until `done()` is true or the budget runs out. Fights, heals, shops and
 * takes level-up choices the way a player would.
 */
async function play(page, opts) {
  const { goal, budget = 1200, log = [] } = opts;
  for (let tick = 0; tick < budget; tick++) {
    const state = await page.evaluate(async ({ goal }) => {
      const G = Game.state();
      if (!G || G.status !== 'playing') return { status: G ? G.status : 'gone' };
      const p = Game.player(), L = Game.level();

      // a level-up choice blocks everything until it is made
      if (Game.pendingBoons()) { Game.chooseBoon(Game.pendingBoons()[0]); return { acted: 'boon' }; }

      // an encounter walked into by accident: this run is checking the route,
      // not the encounters, so it takes the way out and moves on
      if (Game.currentEncounter()) {
        if (!Game.currentEncounter().result) {
          const opts = Game.encounterOptions();
          Game.chooseEncounter(opts[opts.length - 1].i);
        }
        Game.closeEncounter();
        return { acted: 'encounter' };
      }

      // the trader: sell nothing, buy what keeps us alive
      if (Game.currentShop()) {
        const s = Game.currentShop();
        let bought = 0;
        for (const it of s.stock.slice()) {
          if (!['potion_heal', 'potion_xheal', 'ration'].includes(it.t)) continue;
          while (it.q > 0 && p.gold >= Game.buyPrice(s, it) && p.inv.length < 18 && Game.buy(it)) bought++;
        }
        Game.closeShop();
        return { acted: 'shop', bought };
      }

      // stay alive
      const heal = p.inv.find(i => i.t === 'potion_heal' || i.t === 'potion_xheal');
      if (p.hp < p.maxHp * 0.4 && heal && !Game.wasteReason(heal)) { Game.useItem(heal); return { acted: 'drink' }; }
      const food = p.inv.find(i => ITEMS[i.t] && ITEMS[i.t].kind === 'food');
      if (p.food < 25 && food && !Game.wasteReason(food)) { Game.useItem(food); return { acted: 'eat' }; }

      const near = window.__bot.adjacentMonster();
      if (near) {
        p.dir = near.dir;
        Game.input('attack');
        await new Promise(r => setTimeout(r, 90));
        return { acted: 'fight' };
      }
      if (p.hp < p.maxHp * 0.6 && Game.rest()) return { acted: 'rest' };

      // where are we headed?
      const keysHeld = p.inv.some(i => i.t === 'key');
      let target = null;
      if (goal === 'down') target = L.stairsDown;
      else if (goal === 'up') target = L.stairsUp;
      // the Heart will not come loose while the lich stands: go for the lich first
      else if (goal === 'artifact' && L.monsters.some(m => m.id === 'lich')) {
        const lich = L.monsters.find(m => m.id === 'lich');
        target = { x: lich.x, y: lich.y };
      }
      else if (goal === 'artifact' || goal === 'page') {
        const want = goal === 'artifact' ? 'artifact' : 'page';
        for (const k in L.items) if (L.items[k].some(i => i.t === want)) {
          const [x, y] = k.split(',').map(Number);
          target = { x, y };
        }
      }
      if (target && window.__bot.stepToward(target.x, target.y, keysHeld)) {
        await new Promise(r => setTimeout(r, 200));
        return { acted: 'travel', depth: G.depth };
      }
      // blocked: go find keys, loot, or unseen ground
      const errand = window.__bot.nextErrand(keysHeld);
      if (errand && window.__bot.stepToward(errand.x, errand.y, keysHeld)) {
        await new Promise(r => setTimeout(r, 200));
        return { acted: 'explore', depth: G.depth };
      }
      // truly stuck: try the other key assumption before giving up
      if (target && window.__bot.stepToward(target.x, target.y, true)) {
        await new Promise(r => setTimeout(r, 200));
        return { acted: 'force', depth: G.depth };
      }
      return { acted: 'stuck', depth: G.depth };
    }, { goal });

    if (state.status && state.status !== 'playing') return state;
    if (state.acted) log.push(state.acted);
    const finished = await page.evaluate(opts.doneFn);
    if (finished) return { done: true };
  }
  return { timeout: true };
}
module.exports = { BOT, play };
