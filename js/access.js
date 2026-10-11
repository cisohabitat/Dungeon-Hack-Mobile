// What the game does for a player who cannot rely on seeing it the usual way:
// the log read aloud by a screen reader as each line shows, the view put into
// words when the hero moves or turns, the bars' numbers named, and the colours
// a colour-blind player can tell apart. A factory in the K pattern, wired at the
// end of ui.js; it keys off the changes ui.js already watches (a new log line,
// the minimap's signature), never the frame, so a phone pays nothing for it.
import { MONSTERS } from './data.js';
import { Dungeon } from './dungeon.js';
import { Game } from './game.js';
import { $ } from './uikit.js';

const COMPASS = ['north', 'east', 'south', 'west'];
const NUMBER = ['', 'One', 'Two', 'Three', 'Four', 'Five'];
const SAID_MAX = 20;          // the reader's own log keeps the last few lines, not the whole delve
const PALETTE = 'deepdelve.palette';
const HAND = 'deepdelve.hand';     // (the old 'right' and 'left' stand as they were)

/**
 * @param {{
 *   store: (k: string, v?: string|null) => string|null,
 *   applyPalette: (name: string) => void,
 * }} K
 */
export function makeAccess(K) {
  /** @type {WeakSet<object>} the log lines already read out */
  let said = new WeakSet();
  /** @type {any} the run they were read out for */
  let saidFor = null;

  /** Read out every log line that has shown since the last look (a held-back line waits until it shows). */
  function readLog() {
    const G = Game.state(), el = $('#sr-log');
    if (!G || !el) return;
    // a new run starts its own reading, from its first line
    if (saidFor !== G) { said = new WeakSet(); saidFor = G; el.textContent = ''; }
    const now = performance.now();
    const fresh = G.log.filter(e => !e.gone && !(e.at > now) && !said.has(e));
    if (!fresh.length) return;
    // a burst (a fireball through a crowd) is read as its last few lines, not a backlog
    for (const e of fresh) said.add(e);
    // something new is happening: what lies ahead may have changed with it (a creature come up the corridor)
    describeView();
    for (const e of fresh.slice(-5)) {
      const line = document.createElement('p');
      line.textContent = String(e.m);
      el.appendChild(line);
    }
    while (el.childElementCount > SAID_MAX) el.removeChild(/** @type {Element} */ (el.firstElementChild));
  }

  /** What lies ahead of the hero, in words: the first thing down the line they face, up to five squares. */
  function viewWords() {
    const G = Game.state();
    if (!G || !G.levels) return 'The dungeon view.';
    const L = Game.level(), p = Game.player(), T = Dungeon.T, [dx, dy] = Dungeon.DIRS[p.dir];
    const facing = `Facing ${COMPASS[p.dir]}.`;
    for (let d = 1; d <= 5; d++) {
      const x = p.x + dx * d, y = p.y + dy * d;
      const m = L.monsters.find(q => q.x === x && q.y === y && q.hp > 0 && L.explored[y * L.w + x]);
      const where = d === 1 ? 'Right in front of you' : `${NUMBER[d]} squares ahead`;
      if (m) return `${facing} ${where}: ${(MONSTERS[m.id] && MONSTERS[m.id].name) || 'something'}${m.awake ? ', awake' : ', asleep'}.`;
      const t = L.tiles[y * L.w + x];
      const thing = t === T.WALL || t === T.SECRET || t === T.TORCH ? 'a wall' : t === T.DOOR ? 'a closed door' : t === T.DOOR_LOCKED ? 'a locked door'
        : t === T.STAIRS_DOWN ? 'the stairs down' : t === T.STAIRS_UP ? 'the stairs up' : t === T.FOUNTAIN ? 'a fountain' : '';
      if (thing) return d === 1 ? `${facing} ${where}: ${thing}.` : `${facing} Open floor, then ${thing} ${NUMBER[d].toLowerCase()} squares ahead.`;
    }
    return `${facing} Open floor stretches ahead.`;
  }
  /** Put the view into words again (the minimap calls this when the hero has moved, turned, or the floor has changed). */
  function describeView() {
    const v = $('#view');
    if (v) v.setAttribute('aria-label', `The dungeon. ${viewWords()}`);
  }

  /** The bars' numbers, named for a reader (a filled width says nothing to one). */
  const barSaid = {};
  function nameBar(id, words) {
    if (barSaid[id] === words) return;
    barSaid[id] = words;
    const bar = $('#' + id);
    if (bar && bar.parentElement) bar.parentElement.setAttribute('aria-label', words);
  }

  /** Which colours: the standard, or the colour-blind safe set (Menu > Colours). */
  const palette = () => (K.store(PALETTE) === 'safe' ? 'safe' : 'standard');
  function setPalette(name) {
    K.store(PALETTE, name === 'safe' ? 'safe' : null);
    K.applyPalette(palette());
  }

  /**
   * Which hand plays: the controls on the right or the left, or one-handed with
   * every control a fight needs under one thumb (Menu > Controls). One-handed
   * stacks the actions over the pad on the thumb's side and brings the quick
   * drink down from the top of the screen to sit with them (style.css, body.onehand).
   */
  const HANDS = ['right', 'left', 'one-right', 'one-left'];
  const HAND_WORDS = { right: 'right-handed', left: 'left-handed', 'one-right': 'one-handed, right thumb', 'one-left': 'one-handed, left thumb' };
  const hand = () => { const h = K.store(HAND); return HANDS.includes(h) ? h : 'right'; };
  /** @type {{parent: Node, next: Node|null}|null} where the quick drink sits when it is not with the thumb */
  let quaffHome = null;
  function applyHand() {
    const h = hand(), one = h.startsWith('one');
    document.body.classList.toggle('lefty', h.endsWith('left'));
    document.body.classList.toggle('onehand', one);
    const q = $('#hud-quaff'), actions = $('.controls .actions');
    if (!q || !actions) return;
    if (one && q.parentNode !== actions) { quaffHome = quaffHome || { parent: /** @type {Node} */ (q.parentNode), next: q.nextSibling }; actions.appendChild(q); }
    else if (!one && quaffHome && q.parentNode === actions) quaffHome.parent.insertBefore(q, quaffHome.next);
  }
  function nextHand() { K.store(HAND, HANDS[(HANDS.indexOf(hand()) + 1) % HANDS.length]); applyHand(); }

  return { readLog, describeView, viewWords, nameBar, palette, setPalette, hand, handWords: () => HAND_WORDS[hand()], applyHand, nextHand };
}
