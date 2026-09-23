'use strict';
// Loads the game's ES modules into Node with the handful of browser globals they
// expect. Each call can return a fresh copy of the mutable modules, because the
// game keeps its state inside module closures and tests must not share it.
const path = require('path');
const { pathToFileURL } = require('url');

const JS = path.join(__dirname, '..', 'js');
let counter = 0;

/** The browser surface the game touches outside the canvas. */
function installGlobals() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear(),
  };
  if (!('navigator' in globalThis)) {
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  }
  // Sprites are canvas-backed; nothing headless needs the pixels, only the shape.
  globalThis.__deepdelveHeadless = true;
  return store;
}

/**
 * Import the game modules. `fresh` re-evaluates the stateful ones so that a test
 * or a simulated run starts from nothing.
 * @param {{fresh?: boolean}} [opts]
 */
async function loadGame(opts = {}) {
  const store = installGlobals();
  const bust = opts.fresh === false ? '' : `?n=${++counter}`;
  const url = name => pathToFileURL(path.join(JS, name)).href;
  // data and rng hold no mutable game state, so they can be shared
  const data = await import(url('data.js'));
  const rng = await import(url('rng.js'));
  const creatures = await import(url('creatures.js'));   // pure: parts and the painter
  const dungeon = await import(url('dungeon.js') + bust);
  const game = await import(url('game.js') + bust);
  return {
    Game: game.Game,
    Dungeon: dungeon.Dungeon,
    Rng: rng.Rng,
    Dice: rng.Dice,          // the live combat dice, so a benchmark can seed them
    store,
    CREATURES: creatures.CREATURES, PROPS: creatures.PROPS, FLOATING: creatures.FLOATING, paintParts: creatures.paintParts,
    ENCOUNTERS: (await import(url('encounters.js'))).ENCOUNTERS,
    ...data,
  };
}

module.exports = { loadGame, installGlobals };
