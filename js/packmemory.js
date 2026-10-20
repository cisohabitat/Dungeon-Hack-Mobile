// Device-local presentation memory. Never add UI flags to carried items or saves.
import { Game } from './game.js';

/** @param {(key:string, value?:string)=>any} store */
export function makePackMemory(store) {
  const key = 'deepdelve.packFinds';
  const runId = () => JSON.stringify([Game.state().created, Game.state().seed, Game.player().name]);
  let run = '', counts = new Map(), unread = new Set();
  const identity = it => JSON.stringify([it.t, it.u || '', it.e || 0, it.px || '', it.pw || '', it.color || '', it.name || '']);
  const inventory = () => [...Game.player().inv, ...Object.values(Game.player().eq)].filter(Boolean);
  const snapshot = () => {
    const next = new Map();
    for (const it of inventory()) { const id = identity(it); next.set(id, (next.get(id) || 0) + (it.q || 1)); }
    return next;
  };
  const save = () => store(key, JSON.stringify({ run, counts: [...counts], unread: [...unread] }));
  function reset() {
    run = runId(); counts = snapshot(); unread = new Set();
    try {
      const data = JSON.parse(store(key) || 'null');
      const valid = data && data.run === run && Array.isArray(data.counts) && data.counts.length <= 28
        && data.counts.every(x => Array.isArray(x) && x.length === 2 && typeof x[0] === 'string' && x[0].length <= 1024 && Number.isFinite(x[1]) && x[1] >= 0 && x[1] <= 100000)
        && Array.isArray(data.unread) && data.unread.length <= 28 && data.unread.every(x => typeof x === 'string' && x.length <= 1024);
      if (valid) { counts = new Map(data.counts); unread = new Set(data.unread); }
    } catch (_) { /* A damaged UI preference never prevents opening the pack. */ }
    sync();
  }
  function sync() {
    if (!Game.state()) return;
    if (run !== runId()) { reset(); return; }
    const next = snapshot();
    for (const [id, amount] of next) if (amount > (counts.get(id) || 0)) unread.add(id);
    for (const id of unread) if (!next.has(id)) unread.delete(id);
    counts = next; save();
  }
  function inspect(it) { sync(); unread.delete(identity(it)); save(); }
  return { reset, sync, inspect, isNew: it => unread.has(identity(it)) };
}
