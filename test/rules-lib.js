'use strict';
// The helpers the rule checks share: a fresh game world, a hero started in one, the dice seeded,
// the log read by count, a monster set beside the hero, and the rest that more than one of the
// rules-*.js files leans on. Each file takes them as one object (`h`) from the worker rules.js
// forks; a helper only one file uses stays at the top of that file. The ONLY filter and the
// failure count live in `test`, so every file counts the same way.
const { loadGame } = require('./harness');

const OPTS = { levels: 4, size: 'small', monsters: 'few', treasure: 'normal', lockedDoors: false, traps: false, permadeath: false };
// flat scores, so a background's effect is the only thing that can move a number
const evenStats = { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 };

const modules = [];
/** A fresh game world. Each call is isolated from every other. */
async function newContext() {
  const m = await loadGame();
  // The first floor's grace (its creatures held off until the hero's first step or blow,
  // or a few seconds) is for a hero arriving, not for a test that sets one beside a foe
  // and counts what the foe does: every hero made here arrives with it already spent.
  // (The grace's own test loads the game itself, past this.)
  const newGame = m.Game.newGame;
  m.Game.newGame = cfg => { const G = newGame(cfg); G.graceUntil = 0; return G; };
  modules.push(m);
  return m;
}
/** The ITEMS table from whichever world a test is using. */
function ITEMS_FOR_TEST(game) { return modules[modules.length - 1].ITEMS; }
async function start(cls, seed, opts) {
  const ctx = await newContext();
  ctx.Game.newGame({ name: 'Test', cls, stats: ctx.Game.rollStats(), seed, opts: Object.assign({}, OPTS, opts) });
  return ctx;
}

// A test that counts what the dice did over many tries passes or fails by
// luck unless the dice are the same every run: seed the live combat dice from
// a name, as the benchmark does.
const seedDice = (ctx, key) => { ctx.Dice.s = new ctx.Rng('rules|' + key).s; };
// The bare Math.random rolls too (a monster's wandering, a trick's odds, a
// wind-up's length): a test that counts over many turns and compares two
// halves seeds both, as the bench does (test/playtest.js), or its bar sits
// inside the noise and it fails one run in twenty. Returns what gives
// Math.random back; a test calls it once it has its counts.
const seedAll = (ctx, key) => {
  seedDice(ctx, key);
  const was = ctx.Odds.s;
  ctx.Odds.s = new ctx.Rng('rules|' + key + '|odds').s;
  return () => { ctx.Odds.s = was; };
};

// Lines logged since a mark, read by count rather than position. The log is
// capped at eighty, so once full its length stops moving and a slice from the
// old length returns nothing at all: the same fault the message box had.
const markLog = G => G.logSeq;
// A line said again straight after itself is folded into one, "(×3)": count it as said three times
const timesSaid = l => Number((l.match(/\(\u00d7(\d+)\)$/) || [])[1]) || 1;
const countSaid = (lines, re) => lines.filter(l => re.test(l)).reduce((n, l) => n + timesSaid(l), 0);
// The combat rolls are hidden until a player asks for them: a test that reads them turns them on
const rollsOn = Game => { if (!Game.rollsShown()) Game.toggleRolls(); };
const linesSince = (G, mark) => {
  const n = G.logSeq - mark;
  return n > 0 ? G.log.slice(-Math.min(n, G.log.length)).map(e => e.m) : [];
};

/** Self-Taught's two points, both on a score it has not yet given any to (two a score, a run). */
function spreadPicks(Game) {
  const t = Game.player().taught || {};
  const k = ['con', 'str', 'dex', 'wis', 'int', 'cha'].find(x => !t[x]);
  return [k, k];
}

// The data tables (data.js) are one module for every world in a process, and a few checks put a
// foe's entry back changed (an ogre that cannot miss, an orc that cannot hit) and do not restore it.
// In one process the order hid that; shared out over several it showed. So each check gets the
// tables as they were loaded: a snapshot taken with the first world, put back after every check.
let tables = null;
const snapshotTables = async () => {
  const data = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'data.js')).href);
  tables = Object.entries(data).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v)).map(([k, v]) => [v, { ...v }]);
};
const restoreTables = () => {
  for (const [live, was] of tables) {
    for (const k of Object.keys(live)) if (!(k in was)) delete live[k];
    Object.assign(live, was);
  }
};

let failures = 0, ran = 0;
async function test(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  ran++;
  if (!tables) await snapshotTables();
  try {
    const r = await fn();
    restoreTables();
    if (r === true) return;
    failures++;
    console.error('FAIL:', name, r === false ? '' : '-> ' + r);
  } catch (e) {
    restoreTables();
    failures++;
    console.error('THROW:', name, '-', e.message);
  }
}

/** Put a relic in the pack and wear it. */
function wearRelic(ctx, id, slot) {
  const r = ctx.RELICS[id], p = ctx.Game.player();
  const it = { t: r.t, q: 1, e: r.e, u: id };
  p.inv.push(it);
  if (!ctx.Game.equip(it, true, slot)) throw new Error(`could not equip ${id}`);
  return it;
}
/** A goblin with company, standing in front of the hero. */
function groupAhead(ctx, id, members, hp = 6) {
  const { Game, Dungeon } = ctx;
  const p = Game.player(), L = Game.level(), G = Game.state();
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.monsters.length = 0;
  const m = { uid: 70, id, x: p.x + dx, y: p.y + dy, hp, maxHp: hp, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0,
    pack: Array.from({ length: members - 1 }, () => ({ hp, maxHp: hp })) };
  L.monsters.push(m);
  return m;
}
/** A monster beside the hero, awake and ready to act now. */
function beside(ctx, id, extra = {}) {
  const { Game, Dungeon } = ctx;
  const p = Game.player(), L = Game.level(), G = Game.state();
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.monsters.length = 0;
  const m = { uid: 90, id, x: p.x + dx, y: p.y + dy, hp: 999, maxHp: 999, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0, ...extra };
  L.monsters.push(m);
  return m;
}
/**
 * Run fn with the odds pinned to v (a trick's chance, a wander: what the game once asked
 * Math.random for). The odds are the run's own now, one stream shared by every world
 * (rng.js is loaded once), so the pin is on that stream; the dice roll as they will.
 */
async function pinned(v, fn) {
  const { Odds } = await newContext();
  const real = Odds.next;
  Odds.next = () => v;
  try { return await fn(); } finally { Odds.next = real; }
}
/** A monster straight ahead at a distance, down a cleared corridor. */
function ahead(ctx, id, dist, extra = {}) {
  const { Game, Dungeon } = ctx;
  const p = Game.player(), L = Game.level(), G = Game.state();
  const [dx, dy] = Dungeon.DIRS[p.dir];
  for (let i = 1; i <= dist; i++) L.tiles[(p.y + dy * i) * L.w + p.x + dx * i] = Dungeon.T.FLOOR;
  L.monsters.length = 0;
  const m = { uid: 95, id, x: p.x + dx * dist, y: p.y + dy * dist, hp: 999, maxHp: 999, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0, ...extra };
  L.monsters.push(m);
  return m;
}
/** Make the square behind the hero open floor. */
function clearBehind(ctx) {
  const { Game, Dungeon } = ctx;
  const p = Game.player(), L = Game.level();
  const [dx, dy] = Dungeon.DIRS[(p.dir + 2) % 4];
  L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
}
/** Carry the hero a square back (away from what faces them), or to the side. */
function shift(ctx, how) {
  const { Game, Dungeon } = ctx;
  const p = Game.player(), L = Game.level();
  const [dx, dy] = Dungeon.DIRS[how === 'back' ? (p.dir + 2) % 4 : (p.dir + 1) % 4];
  L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
  p.x += dx; p.y += dy;
}
const run = (Game, G, ms) => { for (let t = 0; t < ms; t += 25) Game.update(G.t + 25, 25); };
/** Let a monster beside the hero act until it begins the named trick. */
function untilTrick(ctx, m, mv) {
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  for (let i = 0; i < 800; i++) {
    Game.update(G.t + 25, 25);
    if (m.windup && m.windup.move === mv) return true;
    p.hp = p.maxHp; p.held = 0;
  }
  return false;
}
/** Stand in front of a fresh, empty-shelved trader and walk into it. */
const shopAhead = ctx => {
  const { Game, Dungeon } = ctx, p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
  L.monsters.length = 0; L.npcs.length = 0;
  L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
  L.npcs.push({ id: 'merchant', x: p.x + dx, y: p.y + dy, markup: 2, stock: [], greeted: false });
  Game.update(Game.state().t + 400, 400);
  Game.input('forward');
  return !!Game.currentShop();
};
/** Take the job the trader ahead offers; the shop is closed after. */
function takeJob(ctx) {
  const { Game } = ctx;
  if (!shopAhead(ctx)) return 'the shop did not open';
  const row = Game.shopServices().find(s => s.id === 'bounty');
  if (!row || row.why || row.price !== 0) return `the job row: ${JSON.stringify(row)}`;
  if (!Game.buyService('bounty') || !Game.bounty()) return 'the job was not taken';
  Game.closeShop();
  return '';
}
const downOne = ctx => { const { Game } = ctx; Game.level().monsters.length = 0; Game.descend(); };
/** Give the hero a talent, as if chosen. */
const talent = (ctx, id) => { const p = ctx.Game.player(); p.talents = (p.talents || []).concat(id); };
/** A lich beside the hero, in a room with a torch on its wall. */
function lichRoom(ctx, extra = {}) {
  const { Game, Dungeon } = ctx;
  const p = Game.player(), L = Game.level(), T = Dungeon.T;
  const m = beside(ctx, 'lich', { hp: 120, maxHp: 120, nextAct: 1e12, spoke: true, ...extra });
  // a torch on the nearest wall of its room, and its light
  const r = (L.rooms || []).find(r => m.x >= r.x && m.x < r.x + r.w && m.y >= r.y && m.y < r.y + r.h) || { x: m.x - 6, y: m.y - 6, w: 13, h: 13 };
  let torch = null;
  for (let x = r.x; x < r.x + r.w && !torch; x++) if (L.tiles[(r.y - 1) * L.w + x] === T.WALL) torch = [x, r.y - 1];
  // its light on the floor in front of it, as the dungeon lays them
  if (torch) { L.tiles[torch[1] * L.w + torch[0]] = T.TORCH; L.lights = (L.lights || []).concat([{ x: torch[0], y: torch[1] + 1 }]); }
  return { m, torch };
}
/** Strike the lich until its life falls under the mark. */
function woundTo(ctx, m, below) {
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.perkHit = 60;
  m.hp = Math.floor(below) + 1;
  for (let i = 0; i < 40 && m.hp >= below && Game.level().monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); }
}
/** Walk down the stairs to the next floor, as the game would. */
function goDown(ctx) {
  const { Game, Dungeon } = ctx;
  const L = Game.level(), p = Game.player(), s = L.stairsDown;
  const k = [0, 1, 2, 3].find(k => { const [dx, dy] = Dungeon.DIRS[k]; return L.tiles[(s.y - dy) * L.w + s.x - dx] === Dungeon.T.FLOOR; });
  const [dx, dy] = Dungeon.DIRS[k];
  p.x = s.x - dx; p.y = s.y - dy; p.dir = k; delete L.items[p.x + ',' + p.y];
  L.monsters.length = 0;
  Game.input('use');
  // at the divided stair, the path first if the hero has none (the roads part after it), then a
  // road (the Crypts unless the test says)
  if (Game.isPathOffer(Game.pendingBoons())) Game.chooseBoon(Game.pendingBoons()[0]);
  if (Game.forkPending()) Game.chooseRoute(ctx.road || 'crypts');
}
/** Every sound played while `fn` runs. */
async function listenTo(ctx, fn) {
  const got = [];
  ctx.Sound.listen((name, v) => got.push({ name, ...v }));
  try { await fn(); } finally { ctx.Sound.listen(null); }
  return got;
}
/** Lift the Heart where the hero stands: the run is won on the spot. */
function winHere(Game) {
  const p = Game.player(), L = Game.level(), k = `${p.x},${p.y}`;
  const heart = { t: 'artifact', q: 1, e: 0 };
  (L.items[k] = L.items[k] || []).push(heart);
  Game.takeItem(heart);
  // a hero with another ending open to them is asked: these checks carry it up
  const cur = Game.currentEncounter && Game.currentEncounter();
  if (cur && cur.def.heart) Game.chooseEncounter(cur.def.choices.length - 1);
  return Game.state().status === 'won';
}
/** Walk down the stairs until the hero stands on floor `depth`, as the game would. */
function downTo(ctx, depth) {
  const { Game, Dungeon } = ctx;
  const G = Game.state();
  while (G.depth < depth) {
    const L = Game.level(), p = Game.player(), s = L.stairsDown;
    const k = [0, 1, 2, 3].find(k => { const [dx, dy] = Dungeon.DIRS[k]; return L.tiles[(s.y - dy) * L.w + s.x - dx] === Dungeon.T.FLOOR; });
    const [dx, dy] = Dungeon.DIRS[k];
    p.x = s.x - dx; p.y = s.y - dy; p.dir = k; delete L.items[p.x + ',' + p.y];
    Game.input('use');
    if (Game.isPathOffer(Game.pendingBoons())) Game.chooseBoon(Game.pendingBoons()[0]);
    if (Game.forkPending()) Game.chooseRoute(ctx.road || 'crypts');
  }
}
/** Set the hero on a path, as if chosen, with flat scores so the path is the only difference between two heroes. */
const walk = (ctx, id) => { const p = ctx.Game.player(); p.path = id; Object.assign(p.stats, evenStats); };
/** Run the world for ms, counting each line said that matches each pattern, as it comes (a folded line counts once more). */
function tallyLines(Game, G, ms, patterns) {
  const n = patterns.map(() => 0);
  for (let t = 0; t < ms; t += 25) {
    const mark = markLog(G);
    Game.update(G.t + 25, 25);
    for (const l of linesSince(G, mark)) patterns.forEach((re, i) => { if (re.test(l)) n[i]++; });
  }
  return n;
}
/** Meet this encounter in front of the hero and take choice i. */
function meetAndChoose(ctx, id, i) {
  const { Game, Dungeon } = ctx; const p = Game.player(), L = Game.level();
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR; L.monsters.length = 0;
  L.npcs = [{ id, kind: 'encounter', x: p.x + dx, y: p.y + dy }];
  Game.input('use');
  if (!Game.currentEncounter()) throw new Error(`${id} did not open`);
  return Game.chooseEncounter(i);
}
/** Let a goblin beside the hero kill them. */
const fallTo = (ctx, id = 'goblin') => {
  const { Game } = ctx, G = Game.state(), p = Game.player();
  p.hp = 1; p.eq.armor = null;
  beside(ctx, id);
  for (let i = 0; i < 4000 && G.status === 'playing'; i++) Game.update(G.t + 25, 25);
  return G.status === 'dead';
};
/** Win the starving hound over (sharing food never fails). */
const withHound = async (seed, opts = {}) => {
  const ctx = await start('fighter', seed, { levels: 6, ...opts });
  const { Game } = ctx; const p = Game.player();
  p.hp = p.maxHp = 9999; p.food = 100;
  ctx.mealsBefore = p.inv.filter(it => it.t === 'ration' || it.t === 'bread' || it.t === 'meat').reduce((a, it) => a + (it.q || 1), 0);
  meetAndChoose(ctx, 'stray', 0); Game.closeEncounter();
  return ctx;
};
/** Open floor all round the hero, a few squares each way, and nothing else on the floor. */
const clearAround = (ctx, r = 4) => {
  const { Game, Dungeon } = ctx; const p = Game.player(), L = Game.level();
  for (let y = p.y - r; y <= p.y + r; y++) for (let x = p.x - r; x <= p.x + r; x++) if (x > 0 && y > 0 && x < L.w - 1 && y < L.h - 1) L.tiles[y * L.w + x] = Dungeon.T.FLOOR;
  L.monsters.length = 0; L.npcs = []; L.items = {};
};
/** The hound's floor made plain: walls everywhere but what the test lays down. */
const bareFloor = ctx => {
  const L = ctx.Game.level();
  L.monsters.length = 0; L.npcs = []; L.items = {}; L.traps = {}; L.dressing = [];
  L.tiles.fill(ctx.Dungeon.T.WALL);
  return L;
};
const dig = (ctx, x0, y0, x1, y1) => { const L = ctx.Game.level(); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) L.tiles[y * L.w + x] = ctx.Dungeon.T.FLOOR; };
/** A druid of some level with points to spend, ready to cast. */
const druid = async (seed, level = 1, opts) => {
  const ctx = await start('druid', seed, opts);
  const p = ctx.Game.player();
  Object.assign(p.stats, evenStats, { wis: 16 });
  p.level = level; p.sp = 999; p.hp = p.maxHp = 200;
  return ctx;
};
/** A hero facing a clear three-wide passage, with a helper to put creatures in it. */
const arena = async (cls, seed) => {
  const ctx = await start(cls, seed);
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  p.hp = p.maxHp = 9999; p.sp = p.maxSp = 999; p.level = 9;
  const [dx, dy] = Dungeon.DIRS[p.dir], [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
  for (let k = -1; k <= 6; k++) for (let j = -1; j <= 1; j++) {
    const x = p.x + dx * k + sx * j, y = p.y + dy * k + sy * j;
    if (x > 0 && y > 0 && x < L.w - 1 && y < L.h - 1) L.tiles[y * L.w + x] = Dungeon.T.FLOOR;
  }
  L.monsters.length = 0; L.dressing = []; L.fields = {}; L.npcs = []; L.items = {};
  let uid = 500;
  const at = (fwd, side = 0) => [p.x + dx * fwd + sx * side, p.y + dy * fwd + sy * side];
  const put = (id, fwd, side = 0, extra = {}) => { const [x, y] = at(fwd, side); const m = { uid: uid++, id, x, y, hp: 999, maxHp: 999, awake: true, nextAct: 1e12, rx: x, ry: y, fromX: x, fromY: y, moveT0: 0, moveT1: 0, flashUntil: 0, ...extra }; L.monsters.push(m); return m; };
  const cast = id => { G.t = Math.max(G.t, p.nextAttack) + 10; const sp = ctx.SPELLS[p.cls].find(s => s.id === id); if (!Game.castSpell(sp)) throw new Error(`${id} would not cast`); };
  return { ctx, Game, Dungeon, p, G, L, at, put, cast };
};

module.exports = {
  loadGame, OPTS, evenStats, newContext, ITEMS_FOR_TEST, start, seedDice, seedAll, markLog, timesSaid, countSaid, rollsOn, linesSince, spreadPicks, wearRelic, groupAhead, beside, pinned, ahead, clearBehind, shift, run, untilTrick, shopAhead, takeJob, downOne, talent, lichRoom, woundTo, goDown, listenTo, winHere, downTo, walk, tallyLines, meetAndChoose, fallTo, withHound, clearAround, bareFloor, dig, druid, arena, test,
  /** What has run in this process so far. */
  counts: () => ({ ran, failures }),
};
