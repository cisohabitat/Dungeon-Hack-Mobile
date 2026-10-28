// Play by controller: the Gamepad API's standard layout, read once a frame.
// In the dungeon the pad plays as the keys do (the same held-to-repeat steps,
// through ui.js); everywhere else, on every screen and in every overlay, it
// moves a focus ring from button to button by where they sit, A presses the
// one ringed and B goes back. Nothing is read until a pad has been seen, so a
// phone without one pays nothing for it. A factory in the K pattern, wired at
// the end of ui.js.

// the standard layout's buttons (an Xbox pad's names; a PlayStation pad's cross is A)
const A = 0, B = 1, X = 2, Y = 3, LB = 4, RB = 5, LT = 6, RT = 7, VIEW = 8, MENU = 9, LS = 10, RS = 11, UP = 12, DOWN = 13, LEFT = 14, RIGHT = 15;
const DEAD = 0.5;              // how far a stick is pushed before it counts as a press
const REPEAT_AFTER = 380, REPEAT_EVERY = 110;   // a direction held moves the ring on, as a held key does
// a row pinned to the foot of a scrolling page (the new hero's Back and Descend): it is the page's end,
// whatever scrolls past behind it, so the ring goes down into it only from the last thing on the page
const PINNED = '.create-foot';
// An href on a decorative SVG image does not make it a controller stop.
const FOCUSABLE = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/**
 * @param {{
 *   where: () => 'play'|'ui'|'wait',
 *   root: (bar: boolean) => HTMLElement|null,
 *   press: (act: string) => void, release: (act: string) => void, tap: (act: string) => void,
 *   open: (name: string) => void, back: () => void, menu: () => void,
 *   woke: () => void,
 * }} K
 */
export function makePad(K) {
  let seen = false;              // a pad has been plugged in or pressed
  /** @type {Record<string, boolean>} */
  let was = {};                  // last frame's presses, by name
  /** @type {Record<string, number>} */
  const nextRepeat = {};
  let bar = false;               // in the dungeon, the ring is on the buttons along the bottom
  /** @type {HTMLElement|null} */
  let lastRoot = null;
  let lastIndex = 0;

  window.addEventListener('gamepadconnected', () => { seen = true; });
  // a touch or a click puts the ring away again: it is for whoever is steering by pad
  window.addEventListener('pointerdown', () => { document.body.classList.remove('pad'); bar = false; }, { capture: true });

  /** This frame's presses, every pad at once, the sticks read as the d-pad. */
  function read() {
    /** @type {Record<string, boolean>} */
    const now = {};
    let pads = [];
    try { pads = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean); } catch (e) { pads = []; }
    for (const p of pads) {
      p.buttons.forEach((b, i) => { if (b && (b.pressed || b.value > 0.5)) now[i] = true; });
      const [lx = 0, ly = 0, , ry = 0] = p.axes || [];
      if (ly < -DEAD) now.up = true; if (ly > DEAD) now.down = true;
      if (lx < -DEAD) now.left = true; if (lx > DEAD) now.right = true;
      if (ry < -DEAD) now.scrollUp = true; if (ry > DEAD) now.scrollDown = true;
    }
    if (now[UP]) now.up = true; if (now[DOWN]) now.down = true;
    if (now[LEFT]) now.left = true; if (now[RIGHT]) now.right = true;
    return now;
  }

  /** What can take the ring inside el: shown, enabled, and not behind an open overlay. */
  function stops(el) {
    if (!el) return [];
    return /** @type {HTMLElement[]} */ (Array.from(el.querySelectorAll(FOCUSABLE))).filter(e => {
      if (/** @type {any} */ (e).disabled || e.closest('[inert], [hidden]')) return false;
      // Closed details can retain layout boxes for content that cannot take
      // focus. Only their first direct summary remains a controller stop.
      for (let parent = e.parentElement; parent; parent = parent.parentElement) {
        if (parent.tagName !== 'DETAILS' || parent.hasAttribute('open')) continue;
        const summary = Array.from(parent.children).find(child => child.tagName === 'SUMMARY');
        if (!summary?.contains(e)) return false;
      }
      if (!e.getClientRects().length) return false;
      const s = getComputedStyle(e);
      return s.visibility !== 'hidden' && s.display !== 'none';
    });
  }
  /** Ring el, scrolled into sight. */
  function ring(el) {
    document.body.classList.add('pad');
    /** @type {any} */ (el).focus({ focusVisible: true });
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  /** Where the ring starts on a screen: the button it is mostly for, else the first. */
  function start(root, list) {
    const main = list.find(e => e.classList.contains('primary')) || list[0];
    if (main) ring(main);
  }
  /** Keep the ring inside what is showing: on to the next screen, or back where it was after a list is drawn again. */
  function settle(root) {
    const list = stops(root), cur = /** @type {HTMLElement} */ (document.activeElement);
    const i = list.indexOf(cur);
    if (i >= 0) { lastIndex = i; lastRoot = root; return list; }
    if (!list.length) return list;
    if (root === lastRoot) ring(list[Math.min(lastIndex, list.length - 1)]);
    else start(root, list);
    lastRoot = root;
    return list;
  }

  /** The ring moved one way: to the nearest stop that lies that way, nearest in line first. */
  function step(root, dir) {
    const list = settle(root), cur = /** @type {HTMLElement} */ (document.activeElement);
    if (!list.includes(cur)) return;
    const r = cur.getBoundingClientRect();
    const across = dir === 'left' || dir === 'right';
    let best = null, bestScore = Infinity;
    const pool = dir === 'down' && !cur.closest(PINNED) && list.some(e => !e.closest(PINNED) && e.getBoundingClientRect().top >= r.bottom - 4)
      ? list.filter(e => !e.closest(PINNED)) : list;
    for (const e of pool) {
      if (e === cur || e.contains(cur) || cur.contains(e)) continue;
      const q = e.getBoundingClientRect();
      // edge to edge, not centre to centre: a wide card beside a small button
      // has its middle far to the right of it, and is still not to its right
      const along = dir === 'down' ? q.top - r.bottom : dir === 'up' ? r.top - q.bottom : dir === 'right' ? q.left - r.right : r.left - q.right;
      if (along < -4) continue;
      // in line in the other direction counts for most; then the nearer middle
      const off = across ? Math.max(0, q.top - r.bottom, r.top - q.bottom) : Math.max(0, q.left - r.right, r.left - q.right);
      const drift = across ? Math.abs((q.top + q.bottom) - (r.top + r.bottom)) / 2 : Math.abs((q.left + q.right) - (r.left + r.right)) / 2;
      const score = Math.max(0, along) + off * 4 + drift * 0.1;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    if (best) ring(best);
  }

  /** A list to pick from steps to its next choice (by), round past the end, passing over any not yet earned. */
  function choose(sel, by) {
    const n = sel.options.length;
    for (let j = 1; j <= n; j++) {
      const i = by > 0 ? (sel.selectedIndex + j) % n : (sel.selectedIndex - j + n) % n;
      if (sel.options[i].disabled) continue;
      sel.selectedIndex = i;
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
  }
  /** What A does to whatever is ringed. */
  function pressRinged(root) {
    // with nothing ringed yet, the first press only shows where the ring is
    if (!root.contains(document.activeElement) || !document.body.classList.contains('pad')) {
      const list = settle(root), cur = /** @type {HTMLElement} */ (document.activeElement);
      // Touch or keyboard may already have focused a valid stop. Show its ring
      // even when settle had no reason to move it, then let the next A select it.
      if (list.includes(cur)) ring(cur);
      return false;
    }
    const list = settle(root), cur = /** @type {HTMLElement} */ (document.activeElement);
    if (!list.includes(cur)) return false;
    // a box to type in is ready once ringed (a Steam Deck brings up its keyboard)
    if (cur instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit'].includes(cur.type)) return true;
    if (cur instanceof HTMLTextAreaElement) return true;
    // left and right are for moving on, so A steps a list's choice (and LB and RB go back and on)
    if (cur instanceof HTMLSelectElement) { choose(cur, 1); return true; }
    cur.click();
    return true;
  }

  /** Whether a press is new this frame, or a held direction due to move on again. */
  function fresh(now, name, t, repeats) {
    if (!now[name]) { delete nextRepeat[name]; return false; }
    if (!was[name]) { nextRepeat[name] = t + REPEAT_AFTER; return true; }
    if (repeats && t >= (nextRepeat[name] || Infinity)) { nextRepeat[name] = t + REPEAT_EVERY; return true; }
    return false;
  }

  // in the dungeon: held as the keys are held, or pressed once
  const HELD = { up: 'forward', down: 'back', left: 'left', right: 'right', [LB]: 'strafeL', [RB]: 'strafeR', [A]: 'attack' };
  const TAPS = { [X]: 'use', [Y]: 'cast', [B]: 'take', [LT]: 'quaff', [RT]: 'read', [RS]: 'rest' };

  /** Read the pad and act on it: called once a frame from the main loop. */
  function poll(t) {
    if (!seen) return;
    const now = read();
    const any = Object.keys(now).some(k => now[k] && !was[k]);
    if (any) K.woke();
    const where = K.where();
    if (where !== 'play') bar = false;
    // leaving play with a direction still held (the hero dead or victorious under a pushed
    // stick), the release is sent now: it was never sent, and the next hero walked on its own
    if (where !== 'play' || bar) for (const [k, act] of Object.entries(HELD)) if (was[k]) K.release(act);
    if (where === 'play' && !bar) {
      for (const [k, act] of Object.entries(HELD)) {
        if (now[k] && !was[k]) K.press(act);
        else if (!now[k] && was[k]) K.release(act);
      }
      for (const [k, act] of Object.entries(TAPS)) if (now[k] && !was[k]) K.tap(act);
      if (now[LS] && !was[LS]) K.open('log');
      if (now[MENU] && !was[MENU]) K.menu();
      // the buttons along the bottom (the pack, the map, the hero...) take the ring
      if (now[VIEW] && !was[VIEW]) { bar = true; for (const k of Object.values(HELD)) K.release(k); const root = K.root(true); if (root) start(root, stops(root)); }
    } else if (where === 'ui' || (where === 'play' && bar)) {
      const root = K.root(bar);
      if (root) {
        // the screen just come up, or the overlay just opened, has the ring from the first
        // (only when the ring has been lost: a full look over the screen every frame would cost a slow phone)
        if (document.body.classList.contains('pad') && !root.contains(document.activeElement)) settle(root);
        for (const d of ['up', 'down', 'left', 'right']) if (fresh(now, d, t, true)) step(root, d);
        if (fresh(now, A, t, false)) { pressRinged(root); if (bar) bar = false; }
        if (fresh(now, B, t, false) || (bar && fresh(now, VIEW, t, false))) {
          if (bar) { bar = false; const f = /** @type {HTMLElement} */ (document.activeElement); if (f && f.blur) f.blur(); }
          else K.back();
        }
        const sel = document.activeElement;
        if (sel instanceof HTMLSelectElement && root.contains(sel)) { if (fresh(now, LB, t, true)) choose(sel, -1); if (fresh(now, RB, t, true)) choose(sel, 1); }
        if (now[MENU] && !was[MENU]) K.menu();
        // the right stick scrolls a long page or list
        const scroller = root.querySelector('.ov-body') || root;
        if (now.scrollUp) scroller.scrollBy(0, -16);
        if (now.scrollDown) scroller.scrollBy(0, 16);
      }
    }
    was = now;
  }

  return { poll, seen: () => seen, inBar: () => bar };
}
