// Saves are data from another device, not trusted game objects. Check their
// shape before loading can allocate a floor or change the running hero.
import { CLASSES, ITEMS, MONSTERS, STAT_NAMES, MAX_LEVEL, RENOWN_XP, XP_TABLE } from './data.js';
import { SAVE_BYTES } from './savecode.js';

const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const own = (table, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key);
const integer = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;
const invalid = () => { throw new Error('That save does not hold a valid dungeon.'); };

/** Reject excessive nesting/fanout before JSON.parse allocates the object tree. */
export function parseSave(text) {
  if (typeof text !== 'string' || text.length > SAVE_BYTES) invalid();
  let quoted = false, escaped = false, depth = 0, nodes = 1;
  for (const c of text) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === '{' || c === '[') { if (++depth > 64 || ++nodes > 2000000) invalid(); }
    else if (c === '}' || c === ']') depth--;
    else if (c === ',' && ++nodes > 2000000) invalid();
  }
  return checkSave(JSON.parse(text));
}

/** Validate boundaries, not balance: legitimate heroes retain their exact numbers. */
export function checkSave(data) {
  const stack = [[data, 0]];
  let nodes = 0;
  while (stack.length) {
    const [value, depth] = stack.pop();
    if (++nodes > 2000000 || depth > 64) invalid();
    if (typeof value === 'number' && !Number.isFinite(value)) invalid();
    if (typeof value === 'string' && value.length > 262144) invalid();
    if (!value || typeof value !== 'object') continue;
    for (const key of Object.keys(value)) {
      if (key === 'prototype' || Object.prototype.hasOwnProperty.call(Object.prototype, key)) invalid();
      stack.push([value[key], depth + 1]);
    }
  }
  if (!object(data) || !object(data.player) || !object(data.opts) || !object(data.levels)) invalid();
  if (data.opts.puzzles !== undefined && typeof data.opts.puzzles !== 'boolean') invalid();
  const p = data.player;
  if (!own(CLASSES, p.cls) || typeof p.name !== 'string' || p.name.length > 256 || typeof data.seed !== 'string' || data.seed.length > 1024) invalid();
  if (!integer(data.depth, 1, 32) || !integer(data.opts.levels, 1, 32) || !Number.isFinite(data.t) || data.t < 0) invalid();
  if (!object(p.stats) || !object(p.eq) || !Array.isArray(p.inv) || p.inv.length > 10000) invalid();
  for (const key of Object.keys(STAT_NAMES)) if (!Number.isFinite(p.stats[key])) invalid();
  for (const key of ['hp', 'maxHp', 'sp', 'maxSp', 'level', 'xp', 'food', 'gold', 'kills', 'steps', 'deepest', 'x', 'y', 'dir']) {
    if (p[key] !== undefined && !Number.isFinite(p[key])) invalid();
  }
  // Level/renown catch-up loops run on the next kill. A finite but enormous
  // imported XP value must not ask the browser to process billions of ranks.
  const rank = p.renown || 0;
  if (!integer(p.level, 1, MAX_LEVEL) || !integer(rank, 0, 1e9) || p.xp < 0
    || p.xp > XP_TABLE[MAX_LEVEL - 1] + (rank + 1000) * RENOWN_XP) invalid();
  for (const key of ['boons', 'talents', 'renownTaken']) {
    if (p[key] !== undefined && (!Array.isArray(p[key]) || p[key].length > 10000 || p[key].some(v => typeof v !== 'string'))) invalid();
  }
  const item = it => { if (!object(it) || !own(ITEMS, it.t) || !Number.isFinite(it.q)) invalid(); };
  p.inv.forEach(item);
  for (const it of Object.values(p.eq)) if (it !== null) item(it);
  const floors = Object.entries(data.levels);
  if (!floors.length || floors.length > 32 || !Object.prototype.hasOwnProperty.call(data.levels, data.depth)) invalid();
  for (const [key, floor] of floors) {
    if (!/^[1-9]\d*$/.test(key) || !integer(Number(key), 1, 32) || !object(floor)) invalid();
    if (!integer(floor.w, 3, 128) || !integer(floor.h, 3, 128)) invalid();
    if (!Array.isArray(floor.tiles) || floor.tiles.length !== floor.w * floor.h || !floor.tiles.every(n => integer(n, 0, 255))) invalid();
    if (floor.rooms !== undefined) {
      if (!Array.isArray(floor.rooms) || floor.rooms.length > 10000) invalid();
      for (const room of floor.rooms) {
        if (!object(room) || !integer(room.x, 0, floor.w - 1) || !integer(room.y, 0, floor.h - 1)
          || !integer(room.w, 1, floor.w - room.x) || !integer(room.h, 1, floor.h - room.y)) invalid();
      }
    }
    if (floor.puzzle !== undefined) {
      const q = floor.puzzle;
      if (!object(q) || !integer(q.x, 0, floor.w - 1) || !integer(q.y, 0, floor.h - 1)
        || !['runes', 'torches', 'seals'].includes(q.kind) || typeof q.solved !== 'boolean'
        || !Array.isArray(q.order) || q.order.length !== 4 || new Set(q.order).size !== 4 || !q.order.every(n => integer(n, 0, 3))
        || !integer(q.target, 1, 14) || !Array.isArray(q.input) || q.input.length > 4 || !q.input.every(n => integer(n, 0, 3))
        || !Array.isArray(q.lit) || q.lit.length !== 4 || !q.lit.every(n => typeof n === 'boolean')
        || (q.seen !== undefined && typeof q.seen !== 'boolean')
        || (q.feedback !== undefined && !['wrong', 'reset', 'solved'].includes(q.feedback))) invalid();
    }
    if (!Array.isArray(floor.monsters) || floor.monsters.length > 10000) invalid();
    for (const m of floor.monsters) if (!object(m) || !own(MONSTERS, m.id) || !Number.isFinite(m.x) || !Number.isFinite(m.y)) invalid();
  }
  const floor = data.levels[data.depth];
  if (!integer(p.x, 0, floor.w - 1) || !integer(p.y, 0, floor.h - 1) || !integer(p.dir, 0, 3)) invalid();
  if (data.log !== undefined && (!Array.isArray(data.log) || data.log.length > 10000
    || data.log.some(e => !object(e) || typeof e.m !== 'string' || e.m.length > 16384 || typeof e.c !== 'string' || e.c.length > 64))) invalid();
  return data;
}
