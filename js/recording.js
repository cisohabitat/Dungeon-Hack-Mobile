// A bounded, local record of calls at the game's public boundary. The rules
// themselves keep their old clocks and dice; replay supplies those calls again.
import { BUILD_ID } from './release.js';

export const RECORD_LIMIT = 1500000;
export const RECORD_METHODS = ['update', 'tick', 'renderState', 'input', 'beginPrelude', 'skipPrelude',
  'equip', 'unequip', 'useItem', 'dropItem', 'takeItem', 'sortPack', 'castSpell', 'useAbility',
  'chooseBoon', 'chooseRoute', 'leaveFork', 'chooseEncounter', 'closeEncounter', 'closeShop',
  'buy', 'sell', 'sellJunk', 'buyService', 'study', 'giveCharm', 'claimHeart', 'rest', 'quickScroll',
  'toggleRolls', 'save', 'log', 'runFinds', 'hurtPlayer', 'descend', 'giveItem', 'setWorn'];
const clone = v => v === undefined ? null : JSON.parse(JSON.stringify(v));

/** A stable outcome print, excluding the renderer's explored squares and the record itself. */
export function recordingPrint(state) {
  const clean = v => Array.isArray(v) ? v.map(clean) : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().filter(k => k !== 'recording' && k !== 'explored').map(k => [k, clean(v[k])])) : v;
  const text = JSON.stringify(clean(state));
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}

/** Keep only the game memories needed to construct the same starting hero and world. */
export function recordingStore() {
  const out = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('deepdelve.') && !['deepdelve.save', 'deepdelve.replay'].includes(k)) out[k] = localStorage.getItem(k);
    }
  } catch { /* recording remains possible when storage is unavailable */ }
  return out;
}

// Item arguments must point to the live pack, equipment or shop, not a detached
// JSON copy. Most calls contain strings and numbers and never need this walk.
function reference(root, target, path = [], seen = new Set()) {
  if (root === target) return path;
  if (!root || typeof root !== 'object' || seen.has(root)) return null;
  seen.add(root);
  for (const k of Object.keys(root)) {
    if (k === 'recording') continue;
    const found = reference(root[k], target, [...path, k], seen);
    if (found) return found;
  }
  return null;
}
function encode(v, state) {
  if (v === undefined) return { missing: true };
  if (v && typeof v === 'object') {
    const path = reference(state, v);
    if (path) return { ref: path };
    if (Array.isArray(v)) return v.map(x => encode(x, state));
    return { value: clone(v) };
  }
  return v;
}
function decode(v, state) {
  if (v && v.missing) return undefined;
  if (v && v.ref) return v.ref.reduce((at, k) => at?.[k], state);
  if (v && typeof v === 'object' && 'value' in v) return clone(v.value);
  return Array.isArray(v) ? v.map(x => decode(x, state)) : v;
}

/**
 * @template T
 * @param {T} target
 * @param {{now: () => number, rolls: () => boolean, restore: (header: any) => void}} runtime
 * @returns {T & {recordRuns: (on: boolean) => void, recording: () => any, recordingReason: () => string, startReplay: (data: any) => void, replayCall: (event: any[]) => any}}
 */
export function recordGame(target, runtime) {
  // Preserve the public API's inferred types while decorating its functions.
  const api = /** @type {any} */ (target);
  let enabled = !globalThis['__deepdelveHeadless'], replaying = false, record = null, depth = 0;
  const stopped = why => { if (record) record.unavailable = why; };
  function append(event) {
    if (!record || record.unavailable || record.final) return;
    const n = JSON.stringify(event).length + 1;
    if (record.size + n > RECORD_LIMIT) { stopped('This run exceeded the local recording limit.'); return; }
    record.events.push(event); record.size += n;
  }
  function finish() {
    if (!record || record.final || record.unavailable || api.state()?.status === 'playing') return;
    if (api.tested()) { stopped('Runs with testing aids cannot be replayed.'); return; }
    record.final = { print: recordingPrint(api.state()), status: api.state().status, time: api.state().t };
  }
  const start = api.newGame;
  api.newGame = function (cfg) {
    const header = enabled && !replaying ? { cfg: clone(cfg), at: runtime.now(), rolls: runtime.rolls(), store: recordingStore() } : null;
    record = null;
    const result = start(cfg);
    if (header) {
      header.cfg.name = api.player().name;
      header.created = api.state().created;
      record = { format: 1, build: BUILD_ID, header, events: [], size: JSON.stringify(header).length };
      api.state().recording = record;
      if (record.size > RECORD_LIMIT) stopped('The starting memories exceeded the local recording limit.');
    }
    return result;
  };
  for (const [id, name] of RECORD_METHODS.entries()) {
    const call = api[name];
    if (typeof call !== 'function') continue;
    api[name] = function (...args) {
      if (replaying || !record || !enabled || depth) return call(...args);
      if (name === 'beginPrelude' && !args.length) args = [performance.now()];
      if (name === 'skipPrelude' && !args.length) args = [runtime.now() || performance.now()];
      if (!record.unavailable && !record.final) {
        // A view immediately after this frame needs no second timestamp entry.
        const last = record.events.at(-1);
        if (name === 'renderState' && last && (last[0] === 0 || last[0] === 1) && last[1] === args[0]) {
          const before = JSON.stringify(last).length;
          last[3] = 1;
          record.size += JSON.stringify(last).length - before;
          if (record.size > RECORD_LIMIT) stopped('This run exceeded the local recording limit.');
        }
        else append([id, ...args.map(v => encode(v, api.state()))]);
      }
      depth++;
      try { return call(...args); } finally { depth--; finish(); }
    };
  }
  const load = api.load;
  api.load = function () {
    if (replaying) return load();
    let saved;
    try { saved = JSON.parse(localStorage.getItem('deepdelve.save')); } catch { /* an unreadable save still uses the ordinary error path */ }
    const at = runtime.now();
    const result = load();
    record = result && enabled ? api.state().recording || null : record;
    if (result && record) {
      if (record.format !== 1 || record.build !== BUILD_ID) stopped('This run began in another game build.');
      delete saved.recording;
      append([-1, saved, at]);
      api.state().recording = record;
    }
    return result;
  };
  const saveCode = api.saveCode;
  api.saveCode = function () {
    if (record && !replaying) append([RECORD_METHODS.indexOf('save'), true]);
    return saveCode();
  };
  const loadCode = api.loadCode;
  api.loadCode = async function (text) {
    const result = await loadCode(text);
    // Imported saves do not carry a trusted starting context on this device.
    if (result.ok) { record = null; delete api.state().recording; }
    return result;
  };
  const setTesting = api.setTesting;
  api.setTesting = function (...args) {
    const result = setTesting(...args);
    if (api.tested()) stopped('Runs with testing aids cannot be replayed.');
    return result;
  };
  api.recordRuns = on => { enabled = !!on; };
  api.recording = () => { finish(); return record && !record.unavailable && record.final ? clone(record) : null; };
  api.recordingReason = () => record?.unavailable || 'A recording is not available for this run.';
  api.startReplay = data => {
    if (!data || data.format !== 1 || data.build !== BUILD_ID || !data.final || data.unavailable || !Array.isArray(data.events) || JSON.stringify(data).length > RECORD_LIMIT + 2000) throw new Error('This recording is incomplete or belongs to another game build.');
    replaying = true; record = null;
    runtime.restore(clone(data.header));
  };
  api.replayCall = event => {
    if (!replaying) throw new Error('No replay is open.');
    if (event[0] === -1) {
      api.tick(event[2]);
      localStorage.setItem('deepdelve.save', JSON.stringify(event[1]));
      if (!load()) throw new Error('The recorded save could not be resumed.');
    } else {
      const name = RECORD_METHODS[event[0]];
      if (!name || typeof api[name] !== 'function') throw new Error('Unknown recorded action.');
      if (event[0] <= 1) {
        api[name](event[1], event[2]);
        if (event[3]) return api.renderState(event[1]);
      } else return api[name](...event.slice(1).map(v => decode(v, api.state())));
    }
  };
  return api;
}

/** A replay page gets a private Storage-shaped map before importing any rules. */
export function replayStorage(data) {
  const entries = Object.entries(data.header.store || {}).filter(([k, v]) => k.startsWith('deepdelve.') && typeof v === 'string');
  const map = new Map(entries);
  for (const key of ['sound', 'music', 'narration', 'samples', 'reports']) map.set(`deepdelve.${key}`, 'off');
  map.set('deepdelve.hapticsOff', '1');
  return {
    get length() { return map.size; }, key: i => [...map.keys()][i] ?? null,
    getItem: k => map.has(k) ? map.get(k) : null,
    setItem: (k, v) => { map.set(String(k), String(v)); },
    removeItem: k => { map.delete(k); }, clear: () => map.clear(),
  };
}

/** Replay the same stream in a browser or the bot harness, then verify its end. */
export function replayHeadless(api, data) {
  api.startReplay(data);
  for (const event of data.events) { api.replayCall(event); api.takeEvents(); }
  return verifyReplay(api, data);
}
export function verifyReplay(api, data) {
  if (recordingPrint(api.state()) !== data.final.print) throw new Error('This replay did not reproduce the recorded outcome.');
  return { status: api.state().status, time: api.state().t, depth: api.state().depth, kills: api.player().kills };
}
