import { randomSeedWord } from './rng.js';
import { ROUTES, TWISTS, THEMES, PROLOGUE, BACKGROUNDS, MAX_LEVEL, CLASSES, ITEMS, VOWS } from './data.js';
import { Assets } from './assets.js';
import { Telemetry } from './telemetry.js';
import { Dungeon } from './dungeon.js';
import { Renderer } from './renderer.js';
import { Sound } from './sound.js';
import { Music } from './music.js';
import { Game } from './game.js';
import { Daily } from './daily.js';
import { Weekly } from './weekly.js';
import { $, $$, escapeHtml, diffOf, diffLabel, icon } from './uikit.js';
import { renderBestiary, renderCodex, renderCombos, renderHall } from './hall.js';
import { renderPages } from './pagesview.js';
import { makeTips } from './tips.js';
import { makePad } from './pad.js';
import { makeAccess } from './access.js';
import { drawShareCard } from './sharecard.js';
import { makeEndScreen } from './endscreen.js';
import { makeMapView } from './mapview.js';
import { makePack } from './pack.js';
import { makeChoices } from './choices.js';
import { makeShopView } from './shopview.js';
import { makeTitleScene } from './titlescene.js';
import { makeHeroSheet } from './herosheet.js';
import { makeTitleMenu } from './titlemenu.js';
import { makeCreateView } from './createview.js';

// DOM, touch controls, overlays and screens.

const UI = (() => {
  /** Buttons and keys held down, and when each was pressed. */
  const held = new Map();
  // A held button repeats only after this long, like a keyboard: an ordinary
  // tap lasts 100-200ms, and repeating sooner turned one tap into two turns.
  const HOLD_DELAY = 320;
  let overlay = null;
  /** @type {string[]} overlays the game asked for while a choice or a result was on screen */
  let waiting = [];
  let pendingCfg = null;
  let selectedItem = null, selectedSlot = null;
  let logDue = 0;              // when the next line held back for its moment is due
  let logCount = -1, hudSig = '', miniAt = 0, miniSig = '';
  // The HUD's rows are rebuilt when their signature changes; the signature itself is forty
  // parts, so it is taken ten times a second, or at once when an event has come (a blow, a
  // draught, gold) or a screen asks for it. Its rows count in whole seconds: nothing on it
  // can move between one look and the next.
  let hudAt = -1e9, hudDirty = true;
  /** The elements read every frame, looked up once: the page never replaces them. */
  const fixed = new Map();
  const fixedEl = sel => { let e = fixed.get(sel); if (!e) { e = $(sel); if (e) fixed.set(sel, e); } return /** @type {HTMLElement|null} */ (e); };
  let goldWas = 0;               // the gold last shown, so a find can flare the number
  /** What of the hound the status row shows, so the row redraws when it changes. */
  const houndSig = () => { const h = Game.companion(); return h ? `${h.hp}/${h.maxHp}/${h.mode}/${h.depth}/${h.fallen || 0}` : ''; };

  let finaleTimer = 0;
  function showScreen(id) {
    if (id !== 'screen-game') clearTimeout(finaleTimer);   // leaving the run: its victory screen goes with it
    if (id !== 'screen-title') endOpening();
    // a page turned as the screen comes up (not the dungeon's own: it has the arrival)
    if (id !== 'screen-game' && !$('#' + id).classList.contains('active')) Sound.play('page');
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    // the raycaster draws into whichever canvas is on screen
    // (the key art comes up close again and settles, as it does when the title first opens)
    if (id === 'screen-title') { title.t0 = 0; title.last = 0; refreshTitle(); }
    else if (id === 'screen-game') { Renderer.init($('#view')); fitView(); }
    syncHistory();
  }

  // ---------- the title's opening ----------
  // Once a visit the title comes up out of the dark: the scene, then the name,
  // then the rest, about two seconds in all (the timings are in style.css). A
  // tap anywhere ends it at once, and a tap on a button still does what the
  // button does: nobody waits on it. The first tap also starts the music's
  // swell, since a phone lets no sound play before one. None in a calm view.
  const OPENING_MS = 2600;
  let openingTimer = 0;
  function startOpening() {
    if (calmOn()) return;
    $('#screen-title').classList.add('opening');
    openingTimer = window.setTimeout(endOpening, OPENING_MS);
  }
  function endOpening() {
    clearTimeout(openingTimer);
    $('#screen-title').classList.remove('opening');
  }

  // ---------- the phone's back gesture ----------
  // Back (Android's gesture, or the browser's button) closes what is open
  // rather than leaving the game: an overlay closes, and in the dungeon it
  // opens the Menu, pausing, instead of shutting the page mid-fight. Two
  // entries of the page's own history stand for this: 'game' while in the
  // dungeon, and 'overlay' above it while something is open. They are put
  // right a moment after each change, once any switching (one overlay
  // closing as the next opens) has settled.
  // Only entries pushed since the page loaded are ever taken back: a page
  // reloaded keeps its history state, and going back by that would have
  // left the site. A state left over from before a reload is cleared instead.
  let popsToSkip = 0, histQueued = false, pushed = 0;
  const histState = () => (history.state && history.state.dd) || null;
  function syncHistory() {
    if (histQueued || typeof history === 'undefined' || !history.pushState) return;
    histQueued = true;
    Promise.resolve().then(() => {
      histQueued = false;
      try {
        const inGame = $('#screen-game').classList.contains('active');
        if (inGame) {
          if (!histState()) { history.pushState({ dd: 'game' }, ''); pushed++; }
          if (overlay && histState() !== 'overlay') { history.pushState({ dd: 'overlay' }, ''); pushed++; }
          else if (!overlay && histState() === 'overlay') {
            if (pushed > 0) { popsToSkip++; pushed--; history.back(); } else history.replaceState({ dd: 'game' }, '');
          }
        } else if (histState()) {
          if (pushed > 0) { popsToSkip++; history.go(-pushed); pushed = 0; } else history.replaceState(null, '');
        }
      } catch (e) { /* a browser without history: back does what it always did */ }
    });
  }
  /**
   * The page is put away mid-fight (a call, a notification): the world stops
   * with it, but would start again the instant it came back, before the player
   * has found the buttons. Come back to the Menu instead.
   */
  function pauseIfThreatened() {
    if (overlay || !$('#screen-game').classList.contains('active') || Game.mood() === 'quiet') return;
    openOverlay('menu');
  }
  function onBack() {
    if (popsToSkip > 0) { popsToSkip--; syncHistory(); return; }
    if (pushed > 0) pushed--;
    if ($('#screen-game').classList.contains('active')) {
      // (a choice the game is waiting on stays open: closeOverlay knows which)
      if (overlay) closeOverlay(); else openOverlay('menu');
    }
    syncHistory();
  }



  function showPrologue(cfg) {
    pendingCfg = cfg;
    const b = BACKGROUNDS[cfg.bg];
    // the valley's story in full the first time; after that it waits folded
    // away, so the hero's own paragraph and the stair fit on the screen
    const world = PROLOGUE.map(t => `<p>${escapeHtml(t)}</p>`).join('');
    $('#pro-world').innerHTML = store(STORY_READ) === '1' ? `<details class="pro-again"><summary>The story so far</summary>${world}</details>` : world;
    $('#pro-who').textContent = b.name;
    // who is going down, by name and class: a dealt hero (the Daily, Quick Start) was never named before the stair
    $('#pro-class').textContent = `${cfg.name}, a ${CLASSES[cfg.cls] ? CLASSES[cfg.cls].name : cfg.cls}`;
    const face = /** @type {HTMLImageElement} */ ($('#pro-face'));
    face.src = faceOf(cfg.cls); face.alt = `${cfg.name}, the ${CLASSES[cfg.cls] ? CLASSES[cfg.cls].name : cfg.cls}`;
    $('#pro-story').textContent = b.story;
    $('#pro-motive').textContent = b.motive;
    // how this run is kept, said plainly before it starts
    const o = cfg.opts, d = diffOf(o);
    $('#pro-rules').textContent = o.daily
      ? `The ${dailyLabel(o.dailyKind)} for ${Daily.longDate(o.daily)}: the same dungeon and the same hero for everyone today. One life and one try; if you put the game away, Continue brings you back.`
      // (a vow is named with what it asks: the title names them, and a name alone said nothing to someone new)
      : o.weekly ? `The Weekly Challenge for ${Weekly.longWeek(o.weekly)}: the same dungeon and the same hero for everyone this week, sworn to the ${Weekly.modifiers(o.weekly)}. ${(o.vows || []).filter(v => VOWS[v]).map(v => `${VOWS[v].name}: ${VOWS[v].desc}`).join(' ')} One life a try; try as often as you like, and your best stands.`
      : (o.permadeath
        ? 'One life: permadeath is on. The run is saved whenever you put the game away, so you can come back to it, but if you die the save is gone.'
        : 'Permadeath is off: save from the menu, and load it again if you die.') + (d !== 'normal' ? ` Difficulty: ${diffLabel(o)}.` : '');
    showScreen('screen-prologue');
  }
  const STORY_READ = 'deepdelve.storyRead';
  // the way in plays as every new run opens (see prelude.js). A browser driven by
  // the tests starts without it, unless a test asks for it ('on'): it would take
  // the first tap of every test that begins a run
  const PRELUDE = 'deepdelve.prelude';
  const preludeWanted = () => store(PRELUDE) === 'on' || (store(PRELUDE) !== 'off' && !navigator.webdriver);
  function commitGame() {
    store(STORY_READ, '1');
    if (!pendingCfg) return;
    // the day's one try begins here, at the first stair
    if (pendingCfg.opts.daily) Daily.start(pendingCfg.opts.daily, pendingCfg.opts.dailyKind || 'main');
    if (pendingCfg.opts.weekly) Weekly.start(pendingCfg.opts.weekly);
    Game.newGame(pendingCfg);
    pendingCfg = null;
    Game.save(true);
    // (begun before the first look at the HUD, so the first tip waits for it)
    if (preludeWanted()) Game.beginPrelude();
    startPlaying();
  }
  /** A hero straight into the dungeon, no prologue: Quick Start for anyone who has been down before. */
  function startNow(cfg) {
    pendingCfg = cfg; Game.newGame(pendingCfg); pendingCfg = null; Game.save(true);
    if (preludeWanted()) Game.beginPrelude();
    startPlaying();
  }
  function startPlaying() {
    newsSeen();
    held.clear();
    goldWas = Game.player().gold;      // (a new hero's purse is not a find)
    logCount = -1; hudSig = '';
    // a testing aid left on is not carried into a run that still counts, new or
    // taken up again: it would mark it at the first step (a test run keeps its own)
    if (!Game.tested() && testingOn()) { store(TESTING, null); testingNow = null; Game.setTesting(testingSet()); miniSig = ''; }
    // a tip, and a lesson half given, belong to the run they were given in
    resetTips();
    clearOverlays();
    showScreen('screen-game');
    // no spells, no Spells button
    const sb = /** @type {HTMLElement|null} */ (document.querySelector('[data-open="spells"]'));
    if (sb) sb.style.display = CLASSES[Game.player().cls].spells ? '' : 'none';
    refreshLog(); refreshHud(true);
    // a choice left waiting when the game was put away is waiting still
    if (Game.pendingBoons()) openOverlay('boons');
  }

  // ---------- first-moment tips ----------
  // One short tip the first time each thing happens, on this device: shown
  // over the view where the eye already is, never catching a tap, and gone
  // after a few seconds. The menu turns them off, or back on from the start.
  const TIPS_SEEN = 'deepdelve.tipsSeen', TIPS_OFF = 'deepdelve.tipsOff';
  // (their words are in tips.js)
  const TIPS = makeTips({ asideWay, canStep });

  /** The tips that each tell the answer to one trick. */
  const ANSWER_TIPS = ['shot', 'gaze', 'rust', 'claw', 'crush', 'webspit', 'charge', 'horn', 'drum', 'throne', 'drink', 'blink', 'quills', 'guard', 'swell', 'aimed', 'sweep', 'spores', 'drowned', 'eyeless', 'breath', 'firepot', 'firearrow', 'chill', 'storm', 'snare', 'mimic', 'tremors', 'vents', 'flare', 'stamp', 'web', 'webtear', 'opening'];
  let tipFrom = '';                // where the hero stood and faced when the tip came up
  let tipSwing = 0;                // the hero's next swing when the tip came up: it moves when they attack
  let tipHurt = 0;                 // when the hero was last hurt, as the tip came up
  let tipLunges = 0;               // how many lunges had followed the hero, as the tip came up
  let dodgeSettled = false;        // the first blow's outcome is known
  // The first fight on this device is coached. It starts with the first foe's
  // tip and ends once a warning mark has been stepped back from, or not.
  let coaching = false, coachNext = '';
  /** Tips that stay up until what they ask for is done, not for a set time. */
  const HOLD_TIPS = ['face', 'monster', 'dodge', 'dodgeside', 'dodgelunge', 'dodgelungeflank'];
  /** The first fight's steps and their verdicts: no other tip cuts in on them. */
  const COACH_TIPS = [...HOLD_TIPS, 'dodged', 'late', 'lunged'];
  const isDodge = id => id === 'dodge' || id === 'dodgeside' || id === 'dodgelunge' || id === 'dodgelungeflank';
  const HOLD_MAX = 15000;
  let tipsSeen = null, tipAt = 0, tipUntil = 0, tipCheckAt = 0;
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* private browsing */ } return null; };
  function tipsOn() { return store(TIPS_OFF) !== '1'; }
  // Movement under the left thumb and blows under the right suits most; a
  // left-handed player can swap the halves (and, sideways, the whole panel)
  // which hand plays, and one-handed: access.js
  const setHand = () => access.applyHand();
  // Calm view: no shake, no drifting dust, torches that burn steady. Chosen
  // in the menu; until it is, it follows the phone's own ask for less motion.
  // Testing aids: endless life, spell points or gold, and every monster on the
  // map, kept on the device (see Game.setTesting)
  const TESTING = 'deepdelve.testing';
  /** @returns {{hp: boolean, sp: boolean, gold: boolean, eye: boolean}} */
  // (read once and kept: the corner map asks after the eye many times a second)
  let testingNow = null;
  function testingSet() {
    if (!testingNow) try { const t = JSON.parse(store(TESTING) || '{}'); testingNow = { hp: !!t.hp, sp: !!t.sp, gold: !!t.gold, eye: !!t.eye }; } catch (e) { testingNow = { hp: false, sp: false, gold: false, eye: false }; }
    return testingNow;
  }
  const testingOn = () => { const t = testingSet(); return t.hp || t.sp || t.gold || t.eye; };
  function toggleTesting(k) { const t = { ...testingSet() }; t[k] = !t[k]; store(TESTING, JSON.stringify(t)); testingNow = t; Game.setTesting(t); miniSig = ''; renderMenu(); if (Game.state()) refreshHud(true); }
  // A testing aid takes the run out of the Hall for good, and one tap too many
  // could do it by mistake: while the run still counts, the first tap only arms
  // the tool and says what it costs, and a second within a few seconds uses it.
  // (Turning one off asks nothing, nor does a run already marked.)
  const TEST_ARM_MS = 4000;
  let testArmed = null, testArmTimer = 0;
  function disarmTest() {
    clearTimeout(testArmTimer);
    if (testArmed && testArmed.isConnected) { testArmed.classList.remove('armed'); testArmed.textContent = testArmed.dataset.plain || testArmed.textContent; }
    testArmed = null;
  }
  /** @param {HTMLElement} btn @param {() => void} use @param {boolean} [free]  nothing to lose (turning a tool off) */
  function testGate(btn, use, free) {
    if (free || Game.tested() || testArmed === btn) { disarmTest(); $('#m-test-said').textContent = ''; use(); return; }
    disarmTest();
    testArmed = btn;
    btn.dataset.plain = btn.textContent;
    btn.classList.add('armed');
    // (a wide button says what it costs; a narrow one has the line just below it)
    btn.textContent = btn.classList.contains('big') ? 'Tap again: run won\u2019t count' : 'Tap again';
    $('#m-test-said').textContent = 'Tap again to use it. This run will then be a test run, for good: not written in the Hall, no trophy, no bones.';
    testArmTimer = setTimeout(() => { disarmTest(); if (!Game.tested()) $('#m-test-said').textContent = ''; }, TEST_ARM_MS);
  }
  /** What a testing tool just did, said under the tools (the log is behind the Menu). */
  function testSaid() {
    const last = Game.state().log.slice(-1)[0];
    $('#m-test-said').textContent = last ? (last.base || last.m) : '';
    refreshHud(true);
  }
  // combat numbers drawn larger (the menu), kept on the device
  const NUMBERS = 'deepdelve.bignumbers';
  const bigNumbers = () => store(NUMBERS) === '1';
  const CALM = 'deepdelve.calm';
  const HAPTICS_OFF = 'deepdelve.hapticsOff';   // (read by the game's buzz, in game.js)
  function calmOn() {
    const v = store(CALM);
    if (v === '1' || v === '0') return v === '1';
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  /** @param {string} id @param {boolean} [urgent]  a warning that cannot wait: it replaces a tip already showing */
  function showTip(id, urgent) {
    if (!tipsOn()) return false;
    if (!tipsSeen) { try { tipsSeen = JSON.parse(store(TIPS_SEEN) || '[]'); } catch (e) { tipsSeen = []; } }
    if (tipsSeen.includes(id)) return false;
    const el = $('#tip');
    if (!el || (!urgent && performance.now() < tipUntil)) return false;      // one at a time
    tipsSeen.push(id);
    store(TIPS_SEEN, JSON.stringify(tipsSeen));
    const said = TIPS[id];
    el.innerHTML = typeof said === 'function' ? said() : said;
    el.dataset.tip = id;
    el.classList.add('show');
    el.setAttribute('aria-label', 'Tip; tap to dismiss');
    tipAt = performance.now();
    { const p0 = Game.player(); tipFrom = `${p0.x},${p0.y},${p0.dir}`; tipSwing = p0.nextAttack; tipHurt = p0.lastHurt || 0; tipLunges = Game.state().lunges || 0; dodgeSettled = false; }
    // in a fight a tip keeps out of the way sooner
    const L = Game.level(), p = Game.player();
    const fighting = L.monsters.some(m => m.awake && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 3);
    tipUntil = tipAt + (fighting ? 4000 : 7000);
    return true;
  }
  function resetTips() {
    const el = $('#tip');
    if (el) el.classList.remove('show');
    tipUntil = 0; coaching = false; coachNext = ''; tipFrom = ''; tipSwing = 0;
  }
  function markSeen(id) {
    if (seenTip(id)) return;
    tipsSeen.push(id);
    store(TIPS_SEEN, JSON.stringify(tipsSeen));
  }
  /** Which way aside is open, in the d-pad's own arrows: naming a side walled or locked
   *  sent a first hero into a door it then tried to force, with the blow still coming. */
  function asideWay(/** @type {boolean} */ widest) {
    return widest ? 'to the right (→)' : canStep(1) && canStep(3) ? '(← or →)' : canStep(3) ? 'to the left (←)' : 'to the right (→)';
  }
  /** Whether the hero could step that way (0 ahead, 1 right, 2 behind, 3 left): open floor, nothing standing on it. */
  function canStep(turn) {
    const p = Game.player(), L = Game.level(), T = Dungeon.T, [dx, dy] = Dungeon.DIRS[(p.dir + turn) % 4];
    const x = p.x + dx, y = p.y + dy;
    if (x < 0 || y < 0 || x >= L.w || y >= L.h) return false;
    const t = L.tiles[y * L.w + x];
    return (t === T.FLOOR || t === T.DOOR_OPEN) && !L.monsters.some(m => m.x === x && m.y === y);
  }
  function seenTip(id) {
    if (!tipsSeen) { try { tipsSeen = JSON.parse(store(TIPS_SEEN) || '[]'); } catch (e) { tipsSeen = []; } }
    return tipsSeen.includes(id);
  }
  /** The first foe awake and close, or null. */
  function firstFoe() {
    const p = Game.player(), L = Game.level();
    let best = null, bd = 4;
    for (const m of L.monsters) {
      const dd = Math.abs(m.x - p.x) + Math.abs(m.y - p.y);
      if (m.awake && dd < bd) { best = m; bd = dd; }
    }
    return best;
  }
  /** Whether a monster is ahead of the hero, in the view: turning cannot do better for one on a diagonal. */
  function inFront(m) {
    const p = Game.player(), [ax, ay] = Dungeon.DIRS[p.dir], [bx, by] = Dungeon.DIRS[(p.dir + 1) % 4];
    const dx = m.x - p.x, dy = m.y - p.y, ahead = dx * ax + dy * ay;
    return ahead > 0 && Math.abs(dx * bx + dy * by) <= ahead;
  }
  /** A plain blow (not a trick) being drawn back right beside the hero. */
  const blowComing = () => {
    const p = Game.player();
    // (a blow at the hound is not the hero's to dodge)
    return Game.level().monsters.some(m => m.windup && !m.windup.move && m.windup.kind !== 'pet' && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1);
  };
  // a blow still to come down, even at a step's remove: a lunger follows, so
  // the lesson waits for the blow itself before it says how the step went
  const blowPending = () => {
    const p = Game.player();
    return Game.level().monsters.some(m => m.windup && !m.windup.move && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 2);
  };
  // The first time each trick comes, time slows while its answer is read,
  // as it does for the first plain blow: the tip names the trick's own move.
  const TRICK_TIPS = { gaze: 'gaze', rust: 'rust', claw: 'paralyse', crush: 'crush', webspit: 'web', charge: 'charge', horn: 'rally', drink: 'drink', blink: 'blink', quills: 'bristle', guard: 'parry', swell: 'enlarge', aimed: 'aim', sweep: 'sweep', breath: 'breath', firepot: 'firepot', firearrow: 'firearrow', chill: 'chill', storm: 'storm', snare: 'snare', flare: 'flare', stamp: 'stamp' };
  /** Whether an awake puffcap is within reach of a few steps. */
  /** A smouldering floor's crack heating up within so many squares of the hero. */
  const ventNear = n => { const p = Game.player(); return Game.vents().some(v => v.heat > 0 && Math.abs(v.x - p.x) + Math.abs(v.y - p.y) <= n); };
  /** Whether the hero's own square is under a crack's coming flare (their own square is under the view, and cannot be seen). */
  const ventUnder = () => { const p = Game.player(); return Game.vents().some(v => v.area.some(a => a.x === p.x && a.y === p.y)); };
  /** A mimic still shut that has creaked, within four squares. */
  const mimicHeard = () => { const p = Game.player(); return Game.level().monsters.some(m => m.disguised && m.creaked && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 4); };
  const kinNear = (id, n) => { const p = Game.player(); return Game.level().monsters.some(m => m.id === id && m.awake && !m.sunk && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= n); };
  const puffcapNear = n => kinNear('puffcap', n);
  /** How fast the dungeon runs: slowed while the first warning mark, or a trick's first coming, is being answered. */
  function timeScale() {
    const el = $('#tip');
    if (!el || !el.classList.contains('show') || !Game.state() || Game.state().status !== 'playing') return 1;
    const tip = el.dataset.tip || '';
    // the dungeon waits while the very first tip is read: a new hero reading it
    // was once walked up to and killed before taking a step. It goes the moment
    // they move, turn or tap it (or a real warning takes its place)
    if (tip === 'controls') return 0;
    if (coaching && isDodge(tip) && !dodgeSettled && blowComing()) return 0.3;
    // the first arrow waits as the first blow does: its tip arrived with the arrow
    if (tip === 'shot') { const p = Game.player(); if (Game.level().monsters.some(m => m.windup && m.windup.kind === 'shot' && !m.windup.move && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 6)) return 0.3; }
    const mv = TRICK_TIPS[tip];
    if (mv) {
      const p = Game.player();
      if (Game.level().monsters.some(m => m.windup && m.windup.move === mv && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 6)) return 0.3;
    }
    return 1;
  }
  function checkTips() {
    checkTipsNow();
    // what a tip covers of the view, in the picture's own rows, so the
    // renderer keeps bars and warning marks out from under it
    const el = $('#tip'), view = $('#view'), chips = $('#hud-status');
    let rows = 0;
    const v = view ? view.getBoundingClientRect() : null;
    if (el && el.classList.contains('show')) placeTip(el);
    // (a tip lies over the log now, but one long enough to rise into the top of the view still counts)
    if (el && v && v.height > 0 && el.classList.contains('show')) { const t = el.getBoundingClientRect(); if (t.top < v.top + v.height * 0.4) rows = (t.bottom - v.top + 3) / v.height * Renderer.H; }
    // the status chips along the top of the view hide a mark as surely as a tip does
    if (chips && v && v.height > 0 && chips.children.length) {
      const c = chips.getBoundingClientRect();
      if (c.bottom > v.top && c.top < v.top + v.height * 0.5) rows = Math.max(rows, (c.bottom - v.top + 2) / v.height * Renderer.H);
    }
    Renderer.keepTopClear(rows);
  }
  /**
   * A tip lies over the log, its foot just above the newest line so that line
   * can still be read, and as wide as the log's own lines (clear of its button
   * and of whatever hangs at its ends). A long one rises over the floor at the
   * foot of the view, never into the top half, where the fight is.
   * @param {HTMLElement} el
   */
  function placeTip(el) {
    const wrap = el.offsetParent, log = $('#log');
    if (!wrap || !log) return;
    const w = wrap.getBoundingClientRect(), g = log.getBoundingClientRect(), cs = getComputedStyle(log);
    if (!g.height) return;
    // (the newest line may wrap: the whole of it is left in sight)
    const line = parseFloat(cs.lineHeight) || 18, last = log.lastElementChild;
    const foot = Math.min(g.bottom - line - 6, last ? last.getBoundingClientRect().top - 3 : Infinity);
    el.style.left = Math.round(g.left - w.left + parseFloat(cs.paddingLeft) - 4) + 'px';
    el.style.right = Math.round(w.right - g.right + parseFloat(cs.paddingRight) - 4) + 'px';
    el.style.bottom = Math.round(w.bottom - foot) + 'px';
    // (the largest text may take the whole view's height before it must scroll)
    const roof = document.body.classList.contains('big-text') ? w.top + 4 : w.top + w.height * 0.5;
    el.style.maxHeight = Math.max(line * 2, Math.round(foot - roof)) + 'px';
  }
  function checkTipsNow() {
    const now = performance.now();
    const el = $('#tip');
    // what a tip asks for, while it is still to be done
    const G0 = Game.state();
    const wants = el && G0 && G0.status === 'playing' ? {
      face: () => { const m = firstFoe(); return !!m && !inFront(m); },
      monster: () => Game.player().nextAttack === tipSwing && !!firstFoe(),
      dodge: blowPending,
      dodgeside: blowPending,
      dodgelunge: blowPending,
      dodgelungeflank: blowPending,
    }[el.dataset.tip || ''] : null;
    // How the step back went is settled the moment that first blow is done
    // with: stung by it, or moved out from under it. A foe killed, fled or
    // turned by armour mid-swing teaches neither. (Waiting until the tip goes
    // would let the next blow, a second later, answer for the first.)
    if (el && el.classList.contains('show') && isDodge(el.dataset.tip || '') && coaching && !dodgeSettled && wants && !wants()) {
      const p2 = Game.player();
      // a lunge that followed the step is no dodge, even when its roll missed
      coachNext = (Game.state().lunges || 0) > tipLunges ? 'lunged' : (p2.lastHurt || 0) > tipHurt ? 'late' : `${p2.x},${p2.y}` !== tipFrom.split(',').slice(0, 2).join(',') ? 'dodged' : '';
      if (!coachNext) coaching = false;
      dodgeSettled = true;
    }
    // a coached step done goes at once (once read), and the next can come
    // (a warning over a foe that has just died goes at once: there is nothing left to read it about)
    if (el && el.classList.contains('show') && wants && (!wants() || (isDodge(el.dataset.tip || '') && dodgeSettled)) && (now - tipAt > 900 || (isDodge(el.dataset.tip || '') && !firstFoe()))) {
      el.classList.remove('show'); tipUntil = now;
    }
    // (a step done is seen to first: the timer below must not take the tip
    // before the lesson has said how it went)
    const held = wants && HOLD_TIPS.includes(el.dataset.tip || '') && now - tipAt < HOLD_MAX && wants() && !(isDodge(el.dataset.tip || '') && dodgeSettled);
    if (el && el.classList.contains('show') && now > tipUntil && !held) el.classList.remove('show');
    // a tip about the thing in front of you goes when that thing does
    const USE_TIPS = { take: 'Take', stairs: 'Descend', examine: 'Examine', trade: 'Trade' };
    if (el && el.classList.contains('show') && USE_TIPS[el.dataset.tip || ''] && Game.state() && Game.useLabel() !== USE_TIPS[el.dataset.tip || '']) { el.classList.remove('show'); tipUntil = now; }
    // a warning goes when what it warned of does: a wind-up come down, an
    // opening taken or gone. It stays long enough to be read first.
    if (el && el.classList.contains('show') && G0 && G0.status === 'playing') {
      const p0 = Game.player(), L0 = Game.level();
      const near = mv => L0.monsters.some(m => m.windup && m.windup.move && (!mv || m.windup.move === mv) && Math.abs(m.x - p0.x) + Math.abs(m.y - p0.y) <= 6);
      const still = { gaze: () => near('gaze'), rust: () => near('rust'), claw: () => near('paralyse'), crush: () => near('crush'), webspit: () => near('web'), charge: () => near('charge'), horn: () => near('rally'), drum: () => near('drum'), throne: () => L0.monsters.some(m => m.throne), drink: () => near('drink'), blink: () => near('blink'), quills: () => near('bristle'), guard: () => near('parry'), swell: () => near('enlarge'), aimed: () => near('aim'), sweep: () => near('sweep'), spores: () => puffcapNear(3), drowned: () => kinNear('drowned', 3), eyeless: () => kinNear('eyeless', 6), breath: () => near('breath'), firepot: () => near('firepot'), firearrow: () => near('firearrow'), chill: () => near('chill'), storm: () => near('storm'), snare: () => near('snare'), mimic: () => kinNear('mimic', 3) || mimicHeard(), tremors: () => !!(L0.quake && L0.quake.falls.length), vents: () => ventNear(4), flare: () => near('flare'), stamp: () => near('stamp'), web: () => (p0.webbed || 0) > G0.t, webtear: () => (p0.webbed || 0) > G0.t, quickscroll: () => !/** @type {HTMLButtonElement} */ ($('#quick-scroll')).hidden, trick: () => near(''), opening: () => !!(p0.opening && p0.opening.until > G0.t) }[el.dataset.tip || ''];
      const read = el.dataset.tip === 'trick' ? 2500 : 1200;
      if (still && !still() && now - tipAt > read) { el.classList.remove('show'); tipUntil = now; }
    }
    // a tip never outlives the run: not over the fall, nor over the Heart's light
    if (el && Game.state() && Game.state().status !== 'playing') { el.classList.remove('show'); tipUntil = now; coaching = false; coachNext = ''; }
    // the controls tip has done its work once the hero has moved or turned
    if (el && el.classList.contains('show') && el.dataset.tip === 'controls' && G0 && now - tipAt > 1500) {
      const p2 = Game.player();
      if (`${p2.x},${p2.y},${p2.dir}` !== tipFrom) { el.classList.remove('show'); tipUntil = now; }
    }
    // (and none while the way in plays: the controls tip waits for the first floor)
    if (now < tipCheckAt || overlay || !Game.state() || Game.state().status !== 'playing' || Game.preludeOn()) return;
    tipCheckAt = now + 250;
    const p = Game.player(), L = Game.level();
    if (showTip('controls')) return;
    // the first time each new trick comes, say how to answer it: these cannot wait
    const readying = mv => L.monsters.some(m => m.windup && m.windup.move === mv && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 6);
    if (readying('gaze') && showTip('gaze', true)) return;
    if (readying('rust') && showTip('rust', true)) return;
    if (readying('paralyse') && showTip('claw', true)) return;
    if (readying('crush') && showTip('crush', true)) return;
    if (readying('web') && showTip('webspit', true)) return;
    if (readying('charge') && showTip('charge', true)) return;
    if (readying('rally') && showTip('horn', true)) return;
    if (readying('drum') && showTip('drum', true)) return;
    if (L.monsters.some(m => m.throne && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 8) && showTip('throne', true)) return;
    // (not urgent: it waits for a warning already up to have been read)
    if (Game.shaped() && showTip('bear')) return;
    if (readying('drink') && showTip('drink', true)) return;
    if (readying('blink') && showTip('blink', true)) return;
    if (readying('bristle') && showTip('quills', true)) return;
    if (readying('parry') && showTip('guard', true)) return;
    if (readying('enlarge') && showTip('swell', true)) return;
    if (readying('aim') && showTip('aimed', true)) return;
    if (readying('sweep') && showTip('sweep', true)) return;
    if (readying('breath') && showTip('breath', true)) return;
    if (readying('firepot') && showTip('firepot', true)) return;
    if (readying('snare') && showTip('snare', true)) return;
    if (readying('firearrow') && showTip('firearrow', true)) return;
    // a plain arrow drawn down the line: the one blow a step back does not answer
    if (L.monsters.some(m => m.windup && m.windup.kind === 'shot' && !m.windup.move && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 6) && showTip('shot', true)) return;
    if (readying('chill') && showTip('chill', true)) return;
    if (readying('storm') && showTip('storm', true)) return;
    if (L.quake && L.quake.falls.length && showTip('tremors', true)) return;
    if (readying('flare') && showTip('flare', true)) return;
    if (readying('stamp') && showTip('stamp', true)) return;
    if (ventNear(4) && showTip('vents', true)) return;
    // a puffcap has no warning mark: its lesson comes as it comes close (a druid breathes its spores unharmed)
    if (p.cls !== 'druid' && puffcapNear(3) && showTip('spores', true)) return;
    // the elements at work on the place: a fire near, an oil cask beside you, and water to a caster who can use it
    if (Object.keys(L.fields || {}).some(k => L.fields[k].k === 'fire' && (([x, y]) => Math.abs(x - p.x) + Math.abs(y - p.y) <= 5)(k.split(',').map(Number))) && showTip('fire', true)) return;
    // (and as soon as a scene of casks is named, before one has been broken unknowing)
    if (((L.dressing || []).some(q => q.k === 'oilcask' && Math.abs(q.x - p.x) + Math.abs(q.y - p.y) <= 2) || (L.pieces || []).some(pc => pc.named && pc.casks)) && showTip('cask')) return;
    if (L.twist === 'flooded' && Game.knownSpells().some(sp => sp.element === 'lightning' || sp.element === 'cold') && showTip('water')) return;
    // a drowned one risen, or an eyeless awake and near: each told once
    if (kinNear('drowned', 3) && showTip('drowned', true)) return;
    if (kinNear('eyeless', 6) && showTip('eyeless', true)) return;
    // (a mimic's lesson comes as it gives itself away: at its creak, while it is still a barrel)
    if ((kinNear('mimic', 3) || mimicHeard()) && showTip('mimic', true)) return;
    // only a hero with fire to hand is told to burn a web
    if ((p.webbed || 0) > Game.state().t && showTip(Game.knownSpells().some(sp => sp.fire && Game.spellAvailable(sp)) ? 'web' : 'webtear', true)) return;
    if (p.opening && p.opening.until > Game.state().t && showTip('opening', true)) return;
    // the general word on tricks, the first foe's lesson and the scroll
    // button's tip all wait while a trick's own answer is being read:
    // replacing it a quarter second later would teach nothing at all
    const answering = $('#tip') && $('#tip').classList.contains('show') && ANSWER_TIPS.includes($('#tip').dataset.tip || '');
    // nor do they cut into a coached step of the first fight
    const coachUp = !!$('#tip') && $('#tip').classList.contains('show') && COACH_TIPS.includes($('#tip').dataset.tip || '');
    // the first time a scroll is worth reading, say where its button is
    if (!answering && !coachUp && !/** @type {HTMLButtonElement} */ ($('#quick-scroll')).hidden && showTip('quickscroll', true)) return;
    if (!answering && !coachUp && L.monsters.some(m => ((m.windup && m.windup.move) || m.collapsed) && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 5) && showTip('trick', true)) return;
    // the first shade met: who it is, and what laying it to rest is worth
    if (!answering && !coachUp && L.monsters.some(m => m.shade && m.awake && m.spoke && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 6) && showTip('shade', true)) return;
    const close = L.monsters.some(m => m.awake && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 3);
    // the first foe is taught at once, over the controls tip if it is still up:
    // a first goblin used to die before its lesson got a turn. It is walked
    // through: turn to it if it is not ahead, strike it, then step back from
    // its first blow, and say how that went.
    if (close && !answering && !seenTip('monster')) {
      const m = firstFoe();
      // the chevron the tip points to shows only within two squares
      // once begun, the step-back lesson is owed until it is given: a first
      // rat killed before it ever swung leaves it for the next blow to come
      if (m && !inFront(m) && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 2 && showTip('face', true)) { markSeen('lesson:dodge'); return; }
      if (m && inFront(m) && showTip('monster', true)) { markSeen('lesson:dodge'); return; }
    }
    if (!answering) {
      if (coachNext) { const next = coachNext; coachNext = ''; coaching = false; if (showTip(next, true)) return; }
      else if (seenTip('lesson:dodge') && !seenTip('dodge') && !seenTip('dodgeside') && blowComing()) {
        // a wall behind, or a rat that pounces after a step back: say to step
        // aside, if there is room to either side
        const lunger = Game.level().monsters.find(m => m.windup && !m.windup.move && Game.mstat(m).lunge && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1);
        const aside = canStep(1) || canStep(3);
        // out of a lunger's line is sideways to it: a strafe if it is ahead, a step forward or back if it is at your side
        const [fx, fy] = Dungeon.DIRS[p.dir];
        const flank = !!lunger && (lunger.x - p.x) * fx + (lunger.y - p.y) * fy === 0;
        const id = lunger && flank && (canStep(0) || canStep(2)) ? 'dodgelungeflank' : lunger && !flank && aside ? 'dodgelunge' : !canStep(2) && aside ? 'dodgeside' : 'dodge';
        if (showTip(id, true)) {
          coaching = true;
          // a fast foe's first blow can come before the strike was taught:
          // the lesson goes on from here rather than back to it
          markSeen('dodge'); markSeen('dodgeside'); markSeen('dodgelunge'); markSeen('dodgelungeflank'); markSeen('monster'); markSeen('face');
          return;
        }
      }
    }
    // the rest can wait for a quiet moment: a tip about your pack, mid-fight,
    // covers the view just when it matters most. Quiet means nothing awake in
    // throwing distance, no lich about, and no blow taken for five seconds
    const G = Game.state();
    if (close || Game.bossAwake() || G.t - (p.lastHurt || -1e9) < 5000 || L.monsters.some(m => m.awake && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 6)) return;
    const label = Game.useLabel();
    const byLabel = { Take: 'take', Descend: 'stairs', Examine: 'examine', Trade: 'trade' };
    if (byLabel[label] && showTip(byLabel[label])) return;
    if ([...p.inv, ...Object.values(p.eq)].some(it => Game.qualityHidden(it)) && showTip('unknown')) return;
    if (p.hp < p.maxHp * 0.4 && showTip('hurt')) return;
    // the newer things, each told once, at a quiet moment
    if (!p.coating && p.inv.some(it => ITEMS[it.t] && ITEMS[it.t].kind === 'oil') && showTip('oil')) return;
    if (Game.bountyChip() && !(Game.bounty() || {}).done && showTip('job')) return;
    if (Game.companionHere() && Game.companionRank() >= 1 && showTip('blooded')) return;
    if (p.capstone && showTip('mastered')) return;
    // the rolls start hidden: once a few fights have been won, say they can be had
    if (!Game.rollsShown() && p.kills >= 3 && showTip('dice')) return;
  }

  // ---------- HUD ----------
  // What lies under the hero, at the foot of the view: standing on a square
  // hides it, and a dropped handful was nowhere to be seen until you stepped off.
  let feetSig = '';
  function refreshFeet() {
    const here = Game.state() ? Game.floorItems() : [];
    const sig = here.map(it => `${Game.spriteFor(it)}|${Game.itemName(it)}`).join(',');
    if (sig === feetSig) return;
    feetSig = sig;
    const btn = /** @type {HTMLButtonElement} */ ($('#feet'));
    btn.hidden = !here.length;
    if (!here.length) return;
    const shown = here.slice(-5);
    btn.querySelector('.feet-icons').innerHTML = shown.map(it => { const a = Assets.sprites[Game.spriteFor(it)]; return a ? `<img src="${a.url}" alt="">` : ''; }).join('')
      + (here.length > shown.length ? `<em>+${here.length - shown.length}</em>` : '');
    btn.setAttribute('aria-label', `Take what lies here: ${here.map(it => Game.itemName(it)).join(', ')}`);
  }
  // ---------- a floor named as the hero arrives ----------
  // Over the view for a couple of seconds, its number and its name, the first
  // time each floor of a run is seen on this visit (a run continued is told
  // where it stands too). Not while the way in plays: it waits for the floor,
  // and comes up as the dust settles. None in a calm view: the log says it.
  let floorKey = '';
  function showFloorCard(G, L, preluding) {
    const key = `${G.created}:${L.depth}`;
    if (key === floorKey || preluding) return;
    floorKey = key;
    const card = $('#floor-card');
    if (!card || calmOn() || G.status !== 'playing') return;
    $('#floor-card-num').textContent = `Floor ${L.depth} of ${(G.opts && G.opts.levels) || 8}`;
    $('#floor-card-name').textContent = (THEMES[L.theme] || THEMES[0]).name;
    card.classList.remove('show');
    void card.offsetWidth;   // (so the fade starts again on a floor taken quickly after the last)
    card.classList.add('show');
  }
  /** @param {boolean} [now]  rebuild at once, not at the next of the ten looks a second (a screen or a tool that has just changed something) */
  function refreshHud(now) {
    refreshUse();
    refreshFeet();
    checkTips();
    // 'Tap to skip' over the view while the way in plays, where the corner map is: that
    // map is of the first floor, not the passage, so it waits for the floor
    const skip = fixedEl('#prelude-skip'), preluding = Game.preludeOn();
    if (skip && skip.hidden === preluding) {
      skip.hidden = !preluding;
      const mini = fixedEl('#minimap');
      if (mini) mini.style.visibility = preluding ? 'hidden' : '';
    }
    const G = Game.state();
    if (!G) return;
    const p = G.player;
    const L = Game.level();
    showFloorCard(G, L, preluding);
    const at = performance.now();
    if (!now && !hudDirty && at - hudAt < 100) return;
    hudAt = at; hudDirty = false;
    const champ = L.monsters.find(m => m.elite && m.awake && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 6);
    // how long a timed effect has left, in whole seconds, so the row counts down
    const left = until => Math.max(0, Math.ceil((until - G.t) / 1000));
    // a spell's own slot, or a bought blessing's ('boon_ac'), never the two summed
    const secs = k => (p.effects[k] && p.effects[k].until > G.t ? left(p.effects[k].until) : 0);
    // life and spell points as they should show this moment: what a draught
    // gave is on the bars once it is down
    const vit = Game.vitals();
    const sig = [vit.hp, p.maxHp, vit.sp, p.maxSp, p.food, p.gold, G.depth, p.dir, p.level, p.renown || 0, p.poison ? left(p.poison.until) : 0, secs('ac'), secs('hit'), secs('might'), secs('boon_ac'), secs('boon_hit'), p.x, p.y, champ ? champ.uid : 0, p.webbed > G.t, p.held > G.t, !!p.grabbed, p.mirrors || 0, p.riposteUntil > G.t, p.shadowUntil > G.t, secs('crew_hit'), L.press || 0, L.twist || '', p.smokeUntil > G.t ? left(p.smokeUntil) : 0, houndSig(), p.coating ? p.coating.t + p.coating.left : '', Game.bountyChip(), Game.shapeChip(), Game.testingOn() || Game.tested(), underfoot(), L.quake && L.quake.falls.some(f => f.x === p.x && f.y === p.y) ? 'rock' : '', ventUnder() ? 'vent' : ''].join('|');
    if (sig === hudSig) return;
    hudSig = sig;
    $('#hud-name').textContent = p.name;
    $('#hud-cls').textContent = `${CLASSES[p.cls].name} ${p.level}${p.renown ? ` \u2605${p.renown}` : ''}`;
    $('#bar-hp').style.width = Math.max(0, vit.hp / p.maxHp * 100) + '%';
    $('#txt-hp').textContent = `HP ${vit.hp}/${p.maxHp}`;
    const spBar = $('.bar.sp');
    spBar.style.display = p.maxSp ? '' : 'none';
    $('#bar-sp').style.width = (p.maxSp ? vit.sp / p.maxSp * 100 : 0) + '%';
    $('#txt-sp').textContent = `SP ${vit.sp}/${p.maxSp}`;
    $('#bar-food').style.width = p.food + '%';
    $('#txt-food').textContent = p.food > 30 ? 'Fed' : (p.food > 0 ? 'Hungry' : 'Starving');
    access.nameBar('bar-hp', `Life ${vit.hp} of ${p.maxHp}`);
    if (p.maxSp) access.nameBar('bar-sp', `Spell points ${vit.sp} of ${p.maxSp}`);
    access.nameBar('bar-food', $('#txt-food').textContent);
    $('#hud-depth').textContent = `Floor ${G.depth}/${G.opts.levels}`;
    const goldEl = $('#hud-gold');
    if (goldEl.textContent && p.gold > goldWas) { goldEl.classList.remove('flare'); void goldEl.offsetWidth; goldEl.classList.add('flare'); }
    goldWas = p.gold;
    goldEl.textContent = `${p.gold} gold`;
    $('#hud-compass').textContent = ['N', 'E', 'S', 'W'][p.dir];
    const st = [];
    if (p.poison) st.push(`<span class="bad">Poisoned ${left(p.poison.until)}s</span>`);
    // a testing aid on, or once on this run: the run will not count, and this says so
    if (Game.testingOn() || Game.tested()) st.push('<span class="bad" title="A testing aid is on (Menu): this run is not written in the Hall">Test run</span>');
    // a floor readier for a strong hero says so while you are on it
    if (L.twist && TWISTS[L.twist]) st.push(`<span class="${L.twist === 'market' || (L.twist === 'overgrown' && p.cls === 'druid') ? 'good' : 'bad'}" title="${escapeHtml(TWISTS[L.twist].chip)}">${escapeHtml(TWISTS[L.twist].name)}</span>`);
    if ((L.press || 0) > 0) st.push(`<span class="bad" title="You are ahead of most who come this far, and this floor's creatures are readier for it">Foes +${Game.pressSturdier(L)}%</span>`);
    if (p.held > G.t) st.push(`<span class="bad">${p.heldBy === 'down' ? 'Knocked down' : p.heldBy === 'stone' ? 'Stone' : p.heldBy === 'snare' ? 'Snared' : 'Frozen'}</span>`);
    if (p.webbed > G.t) st.push('<span class="bad">Webbed</span>');
    if (p.grabbed) st.push('<span class="bad">Grabbed</span>');
    // what the hero stands in, which the view cannot show under their own feet: a burning
    // arrow looks for oil, and an acolyte's lightning for water
    const under = underfoot();
    // (your own square is under the view: its grit ring cannot be seen, so the row says it)
    if (L.quake && L.quake.falls.some(f => f.x === p.x && f.y === p.y)) st.push('<span class="bad" title="Rock is about to fall on the square you stand on: step off it">Rock falling here!</span>');
    if (ventUnder()) st.push('<span class="bad" title="A crack beside you is about to flare over the square you stand on: step clear">Fire rising here!</span>');
    if (under === 'oil') st.push('<span class="bad" title="Spilt lamp oil under your feet: fire here would catch">Oil underfoot</span>');
    else if (under === 'water') st.push('<span class="bad" title="A puddle under your feet: lightning here would find you">In water</span>');
    if (secs('ac')) st.push(`<span class="good">Shielded ${secs('ac')}s</span>`);
    // a blessing lasts minutes: counted in minutes, so the row does not tick every second
    // a ward (armour) or a blessing (to hit) bought or prayed for; both at once are Warded
    const boon = Math.max(secs('boon_ac'), secs('boon_hit'));
    // (a prayer, not "Blessed": that is the spell's own chip, and both at once read as one twice)
    if (boon) st.push(`<span class="good">${secs('boon_ac') ? 'Warded' : 'Prayer'} ${Math.ceil(boon / 60)}m</span>`);
    if (p.smokeUntil > G.t) st.push(`<span class="good" title="Lost in your smoke: what was near has lost you">In smoke ${left(p.smokeUntil)}s</span>`);
    if (secs('crew_hit')) st.push(`<span class="good" title="The crew you buried march with you: +2 to hit">Crew's song ${Math.ceil(secs('crew_hit') / 60)}m</span>`);
    if (p.mirrors > 0) st.push(`<span class="good">Images \u00d7${Number(p.mirrors)}</span>`);
    if (p.riposteUntil > G.t) st.push('<span class="good">Riposte ready</span>');
    if (p.shadowUntil > G.t && (p.talents || []).includes('shadow_step')) st.push('<span class="good">In shadow</span>');
    // a Berserker's rage is worth seeing grow
    if (Game.berserkerRage() > 0) st.push(`<span class="good" title="Berserker: +${Game.berserkerRage()} damage on every blow${p.hp < p.maxHp / 2 ? ', and a quicker swing' : ''}">Rage +${Game.berserkerRage()}${p.hp < p.maxHp / 2 ? ', frenzied' : ''}</span>`);
    if (secs('hit')) st.push(`<span class="good">Blessed ${secs('hit')}s</span>`);
    if (secs('might')) st.push(`<span class="good">Mighty ${secs('might')}s</span>`);
    // a trader's job, on its floor and once it is done
    if (Game.shapeChip()) st.push(`<span class="good shape">${escapeHtml(Game.shapeChip())}</span>`);
    if (Game.bountyChip()) st.push(`<span class="good bounty" title="${escapeHtml(Game.threadNotes().find(n => n.startsWith('A job')) || '')}">${escapeHtml(Game.bountyChip())}</span>`);
    // a coating counts down by the blows that land, not by the clock
    if (p.coating) st.push(`<span class="good coat" title="The ${escapeHtml(Game.coatingName(p.coating.t))} on your weapon: blows that land before it wears off">${escapeHtml(Game.coatingName(p.coating.t)).replace(/^./, c => c.toUpperCase())} \u00d7${Number(p.coating.left)}</span>`);
    if (p.food === 0) st.push('<span class="bad">Starving</span>');
    if (champ) st.push(`<span class="bad">${escapeHtml(Game.mstat(champ).name)} near</span>`);
    // the companion, when there is something to say: hurt, told to stay, or waiting on another floor
    const hound = Game.companion(), kindWord = Game.companionWord();
    if (hound && !hound.fallen) {
      const who = escapeHtml(hound.name);
      if (hound.depth !== G.depth) st.push(`<span title="Your ${kindWord} waits where you told it to stay">${who} on floor ${Number(hound.depth)}</span>`);
      else if (hound.hp < hound.maxHp || hound.mode === 'stay') st.push(`<span class="${hound.hp < hound.maxHp / 3 ? 'bad' : 'good'}" title="Your ${kindWord}">${who} ${Number(hound.hp)}/${Number(hound.maxHp)}${hound.mode === 'stay' ? ', staying' : ''}</span>`);
    }
    $('#hud-status').innerHTML = st.join('');
  }
  // The Use button names what it will do: a staircase you are facing should
  // say Descend, not leave you to guess that Use means it.
  let useSig = '';
  function refreshUse() {
    refreshCast();
    refreshRest();
    const label = Game.useLabel();
    if (label === useSig) return;
    useSig = label;
    const btn = document.querySelector('[data-tap="use"]');
    if (!btn) return;
    btn.querySelector('small').textContent = label;
    btn.setAttribute('aria-label', label);
    btn.classList.toggle('ctx', label !== 'Use' && label !== 'Search');
  }
  // Rest only ever rests: with something close it dims and says why, and a
  // tap says so in the log. It used to turn into Quaff in a fight, and a
  // player reaching for a rest drank a potion instead.
  let restSig = '';
  function refreshRest() {
    refreshQuaff();
    refreshQuickScroll();
    const label = Game.restLabel();
    if (label === restSig) return;
    restSig = label;
    const btn = document.querySelector('[data-tap="rest"]');
    if (!btn) return;
    const foes = label === 'Foes near';
    // a thinner rest says so in words: "Rest ½" alone told a new player nothing
    const sub = { 'Foes near': 'foes near', 'Rest \u2154': 'two thirds', 'Rest \u00bd': 'half rest', 'Rest \u2153': 'a third', 'Rest \u00bc': 'quarter rest', 'Rest \u2159': 'a sixth', 'No rest': Game.level().isFinal ? 'none left here' : 'find the stairs' }[label];
    if (sub) btn.innerHTML = `${label === 'No rest' ? 'No rest' : 'Rest'}<small>${sub}</small>`;
    else btn.textContent = label;
    btn.classList.toggle('unavail', foes || label === 'No rest');
    btn.setAttribute('aria-label', foes ? 'Rest: not with foes near' : sub ? `${label === 'No rest' ? 'No rest' : 'Rest'}: ${sub}` : label);
  }
  // A caster's Cast button casts, so their quick drink is a bottle of its own
  // beside the life bar: always in the same place, there whenever they carry
  // a healing draught they know, and never standing in for anything else.
  // The scroll worth reading this moment, one tap away, low in the view's left
  // corner: Fire when a foe is ahead for it, Restoration when badly hurt,
  // Teleport when cornered and failing. It is not there the rest of the time.
  const QUICK_SCROLL = { scroll_fire: ['Fire', '#ff7020'], scroll_heal: ['Heal', '#60e080'], scroll_teleport: ['Flee', '#c080ff'],
    oil_fire: ['Coat', '#ff9030'], oil_silver: ['Coat', '#d0dcec'], oil_venom: ['Coat', '#80d050'] };
  let quickSig = '';
  // The boss's bar takes the top rows of the picture (see drawBossBar): while
  // it shows, the status chips and any tip sit just below it rather than on
  // its name. How far down that is depends on the picture's height on screen.
  let barUp = null, barPx = -1;
  const BAR_ROWS = 24;
  function bossBar(on) {
    const wrap = fixedEl('.view-wrap'), view = fixedEl('#view');
    if (!wrap || !view) return;
    const px = on ? Math.ceil(BAR_ROWS / Renderer.H * view.clientHeight) : 0;
    if (on === barUp && px === barPx) return;
    barUp = on; barPx = px;
    wrap.classList.toggle('boss-up', on);
    wrap.style.setProperty('--bar-bottom', px + 'px');
  }
  function helpTab(which) {
    for (const t of $$('[data-htab]')) { const on = t.dataset.htab === which; t.classList.toggle('on', on); t.setAttribute('aria-selected', String(on)); }
    for (const pg of $$('[data-hpage]')) pg.hidden = pg.dataset.hpage !== which;
    $('#screen-help').scrollTop = 0;
  }
  function refreshQuickScroll() {
    const it = Game.quickScroll();
    const sig = it ? `${it.t}|${it.q}` : '';
    if (sig === quickSig) return;
    quickSig = sig;
    const btn = /** @type {HTMLButtonElement} */ ($('#quick-scroll'));
    btn.hidden = !it;
    if (!it) return;
    const [label, color] = QUICK_SCROLL[it.t] || ['Read', '#e0b84a'];
    const art = Assets.sprites[Game.spriteFor(it)];
    /** @type {HTMLImageElement} */ (btn.querySelector('img')).src = art ? art.url : '';
    btn.querySelector('small').textContent = label;
    btn.style.setProperty('--qs', color);
    btn.setAttribute('aria-label', `${ITEMS[it.t].kind === 'oil' ? 'Coat your weapon with the' : 'Read the'} ${Game.itemName({ ...it, q: 1 })}`);
  }
  // below this share of their life the Drink button beats (the view's red pulse starts there too)
  const QUAFF_URGENT = 0.25;
  let quaffSig = '';
  function refreshQuaff() {
    const p = Game.player();
    // a caster's Cast button casts and a fighter's or thief's is their own move, so the bottle is here for everyone
    const drinks = (!!CLASSES[p.cls].spells || !!Game.abilityOf()) && !Game.vowed('unaided');
    const n = drinks ? p.inv.filter(i => (i.t === 'potion_heal' || i.t === 'potion_xheal') && Game.isKnown(i.t)).reduce((k, i) => k + i.q, 0) : 0;
    // nearly dead with a draught to hand, the button beats with the red at the edge of the view
    // (QUAFF_URGENT, as the view's own pulse): heroes went down with four, six, ten in the pack
    // held fast (flat on the floor, stone, frozen) there is no drinking: the button says so rather
    // than beating at a hero who cannot answer it
    const G = Game.state(), held = (p.held || 0) > G.t;
    const vit = Game.vitals(), urgent = !held && n > 0 && G.status === 'playing' && vit.hp > 0 && vit.hp < p.maxHp * QUAFF_URGENT;
    const sig = `${drinks}|${n}|${urgent}|${held}`;
    if (sig === quaffSig) return;
    quaffSig = sig;
    const btn = $('#hud-quaff');
    btn.classList.toggle('urgent', urgent);
    btn.classList.toggle('held', held);
    btn.style.display = drinks ? '' : 'none';
    btn.style.visibility = n ? '' : 'hidden';
    $('#hud-quaff-n').textContent = held ? 'Held' : `Drink \u00d7${n}`;
    btn.setAttribute('aria-label', held ? `Held fast: no drinking until you are free (${n} carried)` : `Quaff a healing draught (${n} carried)`);
  }
  /** Put a named icon in a control (see icon in uikit.js), unless it is there already. @param {Element} btn @param {string} name */
  function setIcon(btn, name) {
    const el = /** @type {HTMLElement|null} */ (btn.querySelector('.ico'));
    if (el && el.dataset.icon !== name) { el.dataset.icon = name; el.innerHTML = icon(name); }
  }
  let castSig = '';
  function refreshCast() {
    const label = Game.castLabel();
    if (label === castSig) return;
    castSig = label;
    const btn = document.querySelector('[data-tap="cast"]');
    if (!btn) return;
    // a fighter's Bash, a thief's Smoke or a ranger's Snare, dim while it comes back, with the seconds left
    const a = Game.abilityOf();
    if (a) {
      const cooling = label !== a.name;
      setIcon(btn, a.id === 'bash' ? 'bash' : a.id === 'snare' ? 'snare' : 'smoke');
      btn.classList.toggle('empty', cooling);
      btn.querySelector('small').textContent = label;
      btn.setAttribute('aria-label', cooling ? `${a.name}: ready in ${label.split(' ')[1]}` : a.id === 'bash' ? 'Bash: break the blow in front of you and set it reeling' : a.id === 'snare' ? 'Snare: catch the first foe down the corridor ahead' : 'Smoke: everything close loses you for a few seconds');
      return;
    }
    // the spell-less quaff instead, and the button dims with nothing known to drink
    const quaffs = label.startsWith('Quaff');
    setIcon(btn, quaffs ? 'flask' : 'cast');
    btn.classList.toggle('empty', label === 'Quaff (none)');
    btn.querySelector('small').textContent = quaffs ? 'Quaff' : label;
    btn.setAttribute('aria-label', label === 'Quaff' ? 'Quaff a healing draught' : quaffs ? 'Quaff: no known healing draught' : `Cast ${label}`);
  }
  function refreshLog() {
    const G = Game.state();
    // count messages ever written, not the length of a capped array
    // a line held back for its moment (a fireball still in the air) shows when it lands
    const now = performance.now();
    if (!G || (G.logSeq === logCount && !(logDue && now >= logDue))) return;
    logCount = G.logSeq;
    const held = G.log.filter(e => e.at > now);
    logDue = held.length ? Math.min(...held.map(e => e.at)) : 0;
    const el = $('#log');
    // a Bestiary note shows while it is the newest line, then gives way to the
    // fight: in the short box it was pushing the blows out (it stays in the history)
    const live = G.log.filter(e => !e.gone && !(e.at > now));
    el.innerHTML = live.filter((e, i) => e.c !== 'note' || i === live.length - 1).slice(-4).map(e => `<div class="${e.c}">${logLine(e.m)}</div>`).join('');
    access.readLog();
    // Lines wrap on a narrow phone, so four of them can overflow the panel.
    // Drop whole old lines rather than leave half of one clipped at the top;
    // the full history is a tap on Log away. The panel stacks from the bottom, so
    // overflow spills off the top where scrollHeight does not count it: ask
    // where the oldest line starts instead.
    el.classList.remove('long');
    const top = el.getBoundingClientRect().top + parseFloat(getComputedStyle(el).paddingTop) - 0.5;
    while (el.children.length > 1 && el.firstElementChild.getBoundingClientRect().top < top) el.removeChild(el.firstElementChild);
    // one message taller than the panel (a shade's arrival runs to five lines)
    // shows from its start, fading at the foot, rather than losing its opening
    // under the view: the rest is in the Log
    if (el.firstElementChild && el.firstElementChild.getBoundingClientRect().top < top) el.classList.add('long');
  }
  // Render exactly as many rows as the box the view was given has room for,
  // so its pixels stay square however tall the phone is.
  function fitView() {
    if (!$('#screen-game').classList.contains('active')) return;
    const box = $('#view').parentElement.getBoundingClientRect();
    if (box.width < 10 || box.height < 10) return;
    const want = Renderer.W * box.height / box.width;
    if (Math.abs(want - Renderer.H) >= 2) Renderer.setHeight(want);
  }
  // The dice come in one fixed shape, so set them apart as a footnote that
  // stays in one piece and drops to its own line when the phone is narrow.
  // It was the tail of the line, which is exactly what an ellipsis cuts.
  function logLine(m) {
    return escapeHtml(m).replace(/ \((d20 [^)]*)\)/, ' <span class="roll">($1)</span>');
  }

  // Small live automap in the corner of the view, 15x15 tiles around the player.
  let miniFaded = false;
  // the docked map shows this many squares each way from the hero
  const DOCK_R = 10;
  /** The docked map's canvas sized to its box in whole squares, sharp on the screen it is on. */
  function fitDock(dock, R) {
    const n = 2 * R + 1, px = Math.max(n, Math.floor(dock.clientWidth * (window.devicePixelRatio || 1) / n) * n);
    if (dock.width !== px) { dock.width = px; dock.height = px; }
    return dock;
  }
  function refreshMinimap(now) {
    if (now - miniAt < 120) return;
    miniAt = now;
    const c = $('#minimap');
    // it steps back, nearly out of sight, while a creature stands under it:
    // a health bar or a warning mark matters more than the map
    const vr = $('#view').getBoundingClientRect(), mr = c.getBoundingClientRect();
    if (vr.width > 0) {
      const sx = Renderer.W / vr.width, sy = Renderer.H / vr.height;
      const fade = Renderer.busy((mr.left - vr.left) * sx - 4, (mr.top - vr.top) * sy - 4, (mr.right - vr.left) * sx + 4, (mr.bottom - vr.top) * sy + 4);
      if (fade !== miniFaded) { miniFaded = fade; c.classList.toggle('faded', fade); }
    }
    const L = Game.level(), p = Game.player();
    const hound = houndHere();
    // (with every monster shown, where each one is: they move while you stand still;
    // and the way in ending, when the room the hero stands in is first seen and
    // marked, or the map kept what it drew while the dust was down: nothing)
    const eye = testingSet().eye;
    const sig = [p.x, p.y, p.dir, L.depth, L.monsters.length, Game.preludeOn() ? 1 : 0, hound ? `${hound.x},${hound.y}` : '', eye ? L.monsters.map(m => `${m.x},${m.y},${m.awake ? 1 : 0}`).join(';') : ''].join(',');
    if (sig === miniSig) return;
    access.describeView();
    // the corner map, where it shows; and on a wide screen the docked map beside the view, a wider stretch of the floor
    const safe = access.palette() === 'safe';
    if (c.getClientRects().length) drawAround(c, 7, { eye, safe, hound });
    const dock = /** @type {HTMLCanvasElement|null} */ ($('#dock-map'));
    if (dock && dock.getClientRects().length) drawAround(fitDock(dock, DOCK_R), DOCK_R, { eye, safe, hound });
    miniSig = sig;
  }

  let journalTab = 'pages';
  function renderJournal() {
    for (const t of $$('[data-jtab]')) { const on = t.dataset.jtab === journalTab; t.classList.toggle('on', on); t.setAttribute('aria-selected', String(on)); }
    if (journalTab === 'beasts') { $('#journal-count').textContent = renderBestiary($('#journal-list')); return; }
    if (journalTab === 'relics') { $('#journal-count').textContent = renderCodex($('#journal-list')); return; }
    if (journalTab === 'combos') { $('#journal-count').textContent = renderCombos($('#journal-list')); return; }
    // the crews' pages, act by act (pagesview.js)
    $('#journal-count').textContent = renderPages($('#journal-list'));
  }
  // ---------- the Hall, the bestiary and the relic codex: see hall.js ----------


  // The history can be narrowed to one kind of line, by the colour each is
  // already told in: the dangers, the good news, and the places and story.
  const LOG_KINDS = [['all', 'All'], ['bad', 'Danger'], ['good', 'Good'], ['info', 'Story']];
  let logKind = 'all';
  function renderLogHistory() {
    const G = Game.state();
    const lines = G.log.filter(e => !e.gone && (logKind === 'all' || e.c === logKind)).reverse();
    $('#log-history').innerHTML = '<div class="log-kinds" role="group" aria-label="Show">' + LOG_KINDS.map(([k, name]) => `<button type="button" class="chip" data-kind="${k}" aria-pressed="${k === logKind}">${name}</button>`).join('') + '</div>'
      + '<div class="log-history">' + (lines.length ? lines.map(e => `<div class="${e.c}">${logLine(e.m)}</div>`).join('') : '<p class="dim small">Nothing of that kind yet.</p>') + '</div>';
    for (const b of $$('#log-history .log-kinds [data-kind]')) b.addEventListener('click', () => { logKind = /** @type {HTMLElement} */ (b).dataset.kind || 'all'; renderLogHistory(); });
  }
  // ---------- overlays ----------
  // A level-up choice or an encounter holds the screen until it is dealt
  // with: what the game asks for meanwhile (another choice, a shop) waits its
  // turn rather than covering it, and what the player taps for is ignored.
  const GAME_ASKS = ['boons', 'encounter', 'shop', 'fork'];
  function openOverlay(name) {
    // the pack, the spells or the map opened while the way in plays end it first: what they do is done on the floor itself
    if (Game.preludeOn()) Game.skipPrelude();
    if (overlay === 'boons' || overlay === 'encounter') {
      if (name !== overlay && GAME_ASKS.includes(name) && !waiting.includes(name)) waiting.push(name);
      return;
    }
    closeOverlay(false);
    // what opened it, to go back to when it closes (a button along the bottom, say)
    const from = /** @type {HTMLElement|null} */ (document.activeElement);
    opener = from && from !== document.body && !from.closest('.overlay') ? from : null;
    overlay = name;
    Sound.play('page');
    held.clear();
    $$('.ctl').forEach(b => b.classList.remove('held'));
    $('#ov-' + name).classList.remove('closing');
    $('#ov-' + name).classList.add('open');
    setBehind(true);
    syncHistory();
    if (name === 'inv') renderInv();
    if (name === 'map') { mapView.panX = 0; mapView.panY = 0; renderMap(); }
    if (name === 'spells') renderSpells();
    if (name === 'char') renderChar();
    if (name === 'menu') renderMenu();
    if (name === 'log') renderLogHistory();
    if (name === 'shop') renderShop();
    if (name === 'journal') renderJournal();
    if (name === 'boons') renderBoons();
    if (name === 'encounter') renderEncounter();
    if (name === 'fork') renderFork();
    if (name === 'code') renderCode();
    // a keyboard's Tab, and a screen reader, start inside what has just opened, not behind it
    // (a pad's ring finds its own way in: pad.js; no box to type in is chosen, so no keyboard springs up on a phone)
    if (lastInput !== 'pad') { const first = /** @type {HTMLElement|null} */ ($('#ov-' + name + ' .ov-body').querySelector('button:not([disabled]), [href], select, summary, [tabindex]:not([tabindex="-1"])')); if (first) first.focus(); }
  }
  /** The hero as a save code, written fresh each time it is asked for. */
  let codeAsk = 0;
  function renderCode() {
    const out = /** @type {HTMLTextAreaElement} */ ($('#code-out'));
    out.value = '';
    $('#code-note').textContent = 'Writing the code…';
    // only the latest asking fills the box, if the menu is opened twice quickly
    const ask = ++codeAsk;
    Game.saveCode().then(code => {
      if (overlay !== 'code' || ask !== codeAsk) return;
      out.value = code || '';
      $('#code-note').textContent = code ? `${Math.round(code.length / 1000)} thousand letters long: copy all of it.` : 'This hero cannot be saved just now.';
    }).catch(() => { if (ask === codeAsk) $('#code-note').textContent = 'The code could not be written on this browser.'; });
  }
  /** The divided stair: each road, what it holds, and a way to stay put. */
  function renderFork() {
    const el = $('#fork-choices');
    el.innerHTML = '';
    // the hero at the head of the window, the roads at its foot
    const body = /** @type {HTMLElement} */ (el.parentElement), old = body.querySelector('.choice-head');
    if (old) old.remove();
    body.insertBefore(choiceHead(''), body.firstChild);
    // held off a moment: held sideways, Descend lies over a road's card, and a second tap took that road unread
    const armedAt = performance.now() + BOON_GUARD_MS;
    for (const id of Object.keys(ROUTES)) {
      const r = ROUTES[id], btn = document.createElement('button');
      btn.className = 'boon fork-choice';
      btn.dataset.route = id;
      // what the road holds, from the run's own plans: its champions, its keeper and its relic
      const plan = Game.roadPlan(id);
      const facts = [plan.champions.length ? `Champions: ${plan.champions.join(' and ')}` : '', `Keeper: ${plan.keeper}`, plan.relic ? `Relic: ${plan.relic[0].toUpperCase() + plan.relic.slice(1)}` : ''].filter(Boolean);
      btn.innerHTML = `<b>${escapeHtml(r.choice)}</b><small>${escapeHtml(r.desc)} ${escapeHtml(r.tells)}</small><small class="road-facts">${facts.map(escapeHtml).join(' \u00b7 ')}</small>`;
      btn.classList.add('arming'); setTimeout(() => btn.classList.remove('arming'), BOON_GUARD_MS);
      btn.addEventListener('click', () => { if (performance.now() < armedAt) return; closeOverlay(false); Game.chooseRoute(id); });
      el.appendChild(btn);
    }
    const stay = document.createElement('button');
    stay.className = 'ghost small';
    stay.textContent = 'Not yet: stay on this floor';
    stay.addEventListener('click', () => closeOverlay());
    el.appendChild(stay);
  }
  const CLOSE_MS = 130;   // the overlay's fade away (see .overlay.closing)
  function closeOverlay(next = true) {
    if (!overlay) return;
    if (overlay === 'boons' && Game.pendingBoons()) return;   // a choice must be made
    // an encounter must be answered: every one offers a way to leave, so
    // backing out would only be a free look at the odds
    if (overlay === 'encounter') { const e = Game.currentEncounter(); if (e && !e.result) return; Game.closeEncounter(); }
    if (overlay === 'shop') Game.closeShop();
    if (overlay === 'fork') Game.leaveFork();
    // it fades away rather than vanishing, and lets taps through while it does
    const gone = $('#ov-' + overlay);
    gone.classList.remove('open'); gone.classList.add('closing');
    setTimeout(() => gone.classList.remove('closing'), CLOSE_MS);
    overlay = null;
    setBehind(false);
    syncHistory();
    // back to what opened it, for a keyboard or a screen reader to carry on from; else nowhere
    const focused = /** @type {HTMLElement|null} */ (document.activeElement);
    if (opener && opener.isConnected && opener.getClientRects().length && lastInput !== 'pad') opener.focus({ preventScroll: true });
    else if (focused && focused.blur) focused.blur();
    opener = null;
    selectedItem = null; selectedSlot = null;
    // then whatever was waiting; each one closes itself if it is no longer wanted
    if (next && waiting.length) openOverlay(/** @type {string} */ (waiting.shift()));
  }
  /** Leaving the game: every overlay comes down, whatever it was holding. */
  function clearOverlays() {
    waiting = [];
    if (overlay === 'encounter') Game.closeEncounter();
    if (overlay === 'shop') Game.closeShop();
    $$('.overlay.open').forEach(el => el.classList.remove('open'));
    overlay = null;
    setBehind(false);
    selectedItem = null; selectedSlot = null;
  }
  function paused() { return !!overlay; }
  /** While an overlay is open the game behind it is inert: a screen reader or a Tab reaches only the overlay. */
  /** @type {HTMLElement|null} what opened the overlay now open */
  let opener = null;
  /** How the player last reached for the game: a touch or click, a key, or a pad. */
  let lastInput = 'pointer';
  /** Back, from the keyboard's Escape or a pad's B: an overlay closes (if it may), the dungeon pauses, another screen goes back. */
  function goBack() {
    if ($('#screen-game').classList.contains('active')) { if (overlay) closeOverlay(); else openOverlay('menu'); return; }
    const back = /** @type {HTMLElement|undefined} */ ($$('.screen.active [id$="-back"]').find(b => b.getClientRects().length));
    if (back) back.click();
  }
  function setBehind(on) { const g = /** @type {HTMLElement|null} */ (document.querySelector('#screen-game .game-layout')); if (g) g.inert = on; }
  let helpFromMenu = false;   // the help was opened from the Menu mid-run: Back returns to it
  // Text size scales the whole interface from the root, so every rem follows.
  // (up to twice the normal size; the two largest lay the dungeon's own bars out
  // afresh, body.big-text in style.css, so nothing is cut short or pushed off)
  const TEXT_SIZES = [{ label: 'Small', px: 14 }, { label: 'Normal', px: 16 }, { label: 'Large', px: 20 }, { label: 'Larger', px: 24 }, { label: 'Double', px: 32 }];
  function textSize() { const raw = store('deepdelve.textSize'), v = Number(raw); return raw !== null && Number.isInteger(v) && v >= 0 && v < TEXT_SIZES.length ? v : 1; }
  function setTextSize(i) {
    store('deepdelve.textSize', String(i));
    document.documentElement.style.fontSize = TEXT_SIZES[i].px + 'px';
    document.body.classList.toggle('big-text', TEXT_SIZES[i].px >= 24);
    fitView();
  }
  // whether the menu's testing tools were last left open
  const TESTS_OPEN = 'deepdelve.testsOpen';
  /** @param {boolean} open */
  function showTests(open) {
    /** @type {HTMLElement} */ ($('#m-tests')).hidden = !open;
    $('#m-testing').setAttribute('aria-expanded', String(open));
  }
  function renderMenu() {
    const G = Game.state();
    // under permadeath there is no going back, and a save made when the app
    // was put away must not become a checkpoint to reload before a gamble
    $('#m-load').disabled = !Game.hasSave() || !!G.opts.permadeath;
    // so under permadeath there is no Load to grey out beside Save: Save only
    // keeps the run for Continue, and says so
    $('#m-load').hidden = !!G.opts.permadeath;
    $('#m-save').textContent = G.opts.permadeath ? 'Save for Continue' : 'Save Game';
    // the testing tools stay folded unless opened; one of them on opens them, and they stay open
    // until folded by hand (not folded under the finger that has just turned the last one off)
    if (testingOn()) store(TESTS_OPEN, '1');
    showTests(store(TESTS_OPEN) === '1');
    $('#m-sound').textContent = 'Sound: ' + (Sound.isEnabled() ? 'On' : 'Off');
    // the music plays through the sound: with the sound off it is silent whatever it says
    $('#m-music').textContent = 'Music: ' + (Music.isEnabled() ? (Sound.isEnabled() ? 'On' : 'On (sound is off)') : 'Off');
    $('#m-rolls').textContent = 'Combat rolls: ' + (Game.rollsShown() ? 'On' : 'Off');
    $('#m-text').textContent = 'Text size: ' + TEXT_SIZES[textSize()].label;
    $('#m-tips').textContent = 'Tips: ' + (tipsOn() ? 'On' : 'Off');
    $('#m-calm').textContent = 'Calm view: ' + (calmOn() ? 'On' : 'Off');
    $('#m-colours').textContent = 'Colours: ' + (access.palette() === 'safe' ? 'colour-blind safe' : 'standard');
    $('#m-numbers').textContent = 'Combat numbers: ' + (bigNumbers() ? 'Large' : 'Normal');
    $('#m-reports').textContent = 'Send reports: ' + (Telemetry.enabled() ? 'On' : 'Off');
    const t = testingSet();
    disarmTest();
    $('#m-test-hp').textContent = 'Endless life: ' + (t.hp ? 'On' : 'Off');
    $('#m-test-sp').textContent = 'Endless spell points: ' + (t.sp ? 'On' : 'Off');
    $('#m-test-gold').textContent = 'Endless gold: ' + (t.gold ? 'On' : 'Off');
    $('#m-test-eye').textContent = 'Show every monster: ' + (t.eye ? 'On' : 'Off');
    // at the top level it gives the next rank of renown instead
    $('#m-test-level').textContent = G.player.level >= MAX_LEVEL ? 'Gain a rank of renown' : 'Gain a level';
    renderTestFloors();
    renderTestItems();
    $('#m-hand').textContent = 'Controls: ' + access.handWords();
    // (a phone that cannot buzz, an iPhone among them, is not offered the switch)
    $('#m-haptics').hidden = !('vibrate' in navigator);
    $('#m-haptics').textContent = 'Vibration: ' + (store(HAPTICS_OFF) === '1' ? 'Off' : 'On');
    $('#m-seed').textContent = `${G.opts.daily ? `${dailyLabel(G.opts.dailyKind)} ${G.opts.daily} · ` : ''}${G.opts.weekly ? `Weekly Challenge ${G.opts.weekly} · ` : ''}Seed "${G.seed}" · ${diffLabel(G.opts)} · ${G.opts.levels} floors${G.route && ROUTES[G.route] ? ` · by ${ROUTES[G.route].name}` : ''} · ${G.opts.size} · ${G.opts.permadeath ? 'permadeath' : 'reload allowed'}`;
  }

  /** Go to floor: every floor of the run, the next one down picked; and a road while none is taken. */
  function renderTestFloors() {
    const G = Game.state(), n = G.opts.levels || 8;
    const floors = /** @type {HTMLSelectElement} */ ($('#m-test-floor'));
    floors.innerHTML = '';
    for (let i = 1; i <= n; i++) {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = `Floor ${i}${i === G.depth ? ' (here)' : ''}`;
      floors.appendChild(o);
    }
    floors.value = String(Math.min(n, G.depth + 1));
    const road = /** @type {HTMLSelectElement} */ ($('#m-test-road'));
    road.hidden = !Dungeon.routeSpan(n) || !!G.route;
    if (!road.options.length) road.innerHTML = Object.keys(ROUTES).map(id => `<option value="${id}">by ${escapeHtml(ROUTES[id].name)}</option>`).join('');
    $('#m-test-said').textContent = '';
  }
  /** Give: everything that can be handed over, by kind; built once, and the pick kept. */
  function renderTestItems() {
    const sel = /** @type {HTMLSelectElement} */ ($('#m-test-item'));
    if (sel.options.length) return;
    const groups = {};
    for (const g of Game.testGifts()) (groups[g.group] = groups[g.group] || []).push(g);
    sel.innerHTML = Object.keys(groups).map(k => `<optgroup label="${escapeHtml(k[0].toUpperCase() + k.slice(1))}">${
      groups[k].map(g => `<option value="${escapeHtml(g.id)}">${escapeHtml(g.name)}</option>`).join('')}</optgroup>`).join('');
  }


  // ---------- input ----------
  function bindControls() {
    for (const b of $$('.ctl[data-act]')) {
      const act = b.dataset.act;
      const down = e => { e.preventDefault(); Sound.unlock(); try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } held.set(act, performance.now()); b.classList.add('held'); Game.input(act); };
      const up = e => { if (e) e.preventDefault(); held.delete(act); b.classList.remove('held'); };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
      b.addEventListener('contextmenu', e => e.preventDefault());
    }
    for (const b of $$('[data-tap]')) {
      b.addEventListener('click', () => { Sound.unlock(); Game.input(b.dataset.tap); });
    }
    for (const b of $$('[data-open]')) b.addEventListener('click', () => { Sound.unlock(); openOverlay(b.dataset.open); });
    // every control's icon drawn from the one set
    for (const el of $$('[data-icon]')) el.innerHTML = icon(/** @type {HTMLElement} */ (el).dataset.icon || '');
    $('#minimap').addEventListener('click', () => openOverlay('map'));
    $('#dock-map').addEventListener('click', () => openOverlay('map'));
    $('#map-in').addEventListener('click', () => zoomMap(1.5));
    $('#map-out').addEventListener('click', () => zoomMap(1 / 1.5));
    wireMapPinch();
    // a tip goes at a tap on it, and the tap goes no further
    // (with the largest text a tip may run past its box: there a drag scrolls it, and only a tap that stays put closes it)
    const closeTip = () => { $('#tip').classList.remove('show'); tipUntil = performance.now(); Telemetry.tipClosed(); };
    let tipDownY = null;
    $('#tip').addEventListener('pointerdown', e => {
      e.stopPropagation();
      if (document.body.classList.contains('big-text')) { tipDownY = e.clientY; return; }
      e.preventDefault(); closeTip();
    });
    $('#tip').addEventListener('pointerup', e => { if (tipDownY !== null && Math.abs(e.clientY - tipDownY) < 8) closeTip(); tipDownY = null; });
    $('#tip').addEventListener('pointercancel', () => { tipDownY = null; });
    $('#log-more').addEventListener('click', () => openOverlay('log'));

    // Tap the view to act, swipe to turn or step.
    const view = $('#view');
    let swipe = null;
    view.addEventListener('pointerdown', e => { e.preventDefault(); Sound.unlock(); swipe = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    view.addEventListener('pointerup', e => {
      if (!swipe) return;
      const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
      const dist = Math.hypot(dx, dy);
      swipe = null;
      if (dist < 24) { Game.input('use'); return; }
      if (Math.abs(dx) > Math.abs(dy)) Game.input(dx > 0 ? 'right' : 'left');
      else Game.input(dy < 0 ? 'forward' : 'back');
    });
    view.addEventListener('pointercancel', () => { swipe = null; });
    for (const b of $$('[data-close]')) b.addEventListener('click', () => closeOverlay());
    $('#m-save').addEventListener('click', () => { Game.save(); closeOverlay(); });
    // a save code: the hero as text, to carry to another phone or browser
    $('#m-code').addEventListener('click', () => openOverlay('code'));
    $('#code-copy').addEventListener('click', async () => {
      const code = /** @type {HTMLTextAreaElement} */ ($('#code-out')).value;
      if (!code) return;
      $('#code-note').textContent = (await copyText(code)) ? 'Copied: paste it on the other phone or browser.' : 'Could not copy it: select the code and copy it by hand.';
    });
    $('#code-file').addEventListener('click', () => {
      const code = /** @type {HTMLTextAreaElement} */ ($('#code-out')).value;
      if (!code) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
      const plain = Game.player().name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/æ/gi, 'ae').replace(/ø/gi, 'o').toLowerCase();
      a.download = `deepdelve-${plain.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'hero'}-floor-${Game.state().depth}.txt`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      $('#code-note').textContent = 'Saved as a file: open it on the other phone or browser.';
    });
    // Load sits under Save, and one slip rewinds the run: the first tap asks
    let loadArmed = 0;
    $('#m-load').addEventListener('click', () => {
      const b = $('#m-load');
      if (performance.now() > loadArmed) {
        loadArmed = performance.now() + 3000;
        b.textContent = 'Tap again to go back to your save';
        setTimeout(() => { if (performance.now() >= loadArmed) b.textContent = 'Load Game'; }, 3050);
        return;
      }
      loadArmed = 0; b.textContent = 'Load Game';
      if (Game.load()) startPlaying();
    });
    $('#m-sound').addEventListener('click', () => { Sound.toggle(); renderMenu(); });
    $('#m-music').addEventListener('click', () => { Music.toggle(); renderMenu(); });
    $('#m-rolls').addEventListener('click', () => { Game.toggleRolls(); renderMenu(); });
    $('#m-text').addEventListener('click', () => { setTextSize((textSize() + 1) % TEXT_SIZES.length); renderMenu(); });
    // turning tips back on starts them over, for a player who wants the tour again
    $('#m-reports').addEventListener('click', () => { Telemetry.setEnabled(!Telemetry.enabled()); renderMenu(); });
    $('#m-calm').addEventListener('click', () => { store(CALM, calmOn() ? '0' : '1'); Renderer.setCalm(calmOn()); document.body.classList.toggle('calm', calmOn()); renderMenu(); });
    $('#m-colours').addEventListener('click', () => { access.setPalette(access.palette() === 'safe' ? 'standard' : 'safe'); renderMenu(); });
    $('#m-numbers').addEventListener('click', () => { store(NUMBERS, bigNumbers() ? '0' : '1'); Renderer.setBigNumbers(bigNumbers()); renderMenu(); });
    // like with like: what you fight with first, what you use up after (the pick stays picked)
    $('#inv-sort').addEventListener('click', () => { Game.sortPack(); renderInv(); });
    for (const k of /** @type {const} */ (['hp', 'sp', 'gold', 'eye'])) {
      const btn = $(`#m-test-${k}`);
      btn.addEventListener('click', () => testGate(btn, () => toggleTesting(k), testingSet()[k]));
    }
    // the floor laid out, and the map opened on it to show it
    $('#m-test-map').addEventListener('click', e => testGate(/** @type {HTMLElement} */ (e.currentTarget), () => { if (Game.testReveal()) { miniSig = ''; openOverlay('map'); } }));
    // the level's choice takes the Menu's place
    $('#m-test-level').addEventListener('click', e => testGate(/** @type {HTMLElement} */ (e.currentTarget), () => { if (Game.testLevel()) { renderMenu(); refreshHud(true); } }));
    $('#m-test-go').addEventListener('click', e => {
      const depth = Number(/** @type {HTMLSelectElement} */ ($('#m-test-floor')).value);
      const road = /** @type {HTMLSelectElement} */ ($('#m-test-road')).value;
      if (depth === Game.state().depth) return;
      testGate(/** @type {HTMLElement} */ (e.currentTarget), () => { closeOverlay(); Game.testFloor(depth, road); });
    });
    $('#m-test-give').addEventListener('click', e => testGate(/** @type {HTMLElement} */ (e.currentTarget), () => { Game.testGive(/** @type {HTMLSelectElement} */ ($('#m-test-item')).value); testSaid(); }));
    $('#m-hand').addEventListener('click', () => { access.nextHand(); renderMenu(); fitView(); });
    $('#m-haptics').addEventListener('click', () => { const off = store(HAPTICS_OFF) === '1'; store(HAPTICS_OFF, off ? '0' : '1'); renderMenu(); if (off) try { navigator.vibrate(30); } catch (e) { /* none */ } });
    $('#m-tips').addEventListener('click', () => { if (tipsOn()) store(TIPS_OFF, '1'); else { store(TIPS_OFF, null); store(TIPS_SEEN, null); tipsSeen = null; } resetTips(); renderMenu(); });
    // How to Play in the middle of a run: the run is kept first (a phone may
    // close a page it cannot see), and Back returns to the Menu, still paused,
    // rather than straight into a blow that was already falling
    $('#m-testing').addEventListener('click', () => { const open = $('#m-testing').getAttribute('aria-expanded') !== 'true'; store(TESTS_OPEN, open ? '1' : '0'); showTests(open); });
    $('#m-help').addEventListener('click', () => {
      if (Game.state() && Game.state().status === 'playing') Game.save(true);
      closeOverlay(); helpFromMenu = true; showScreen('screen-help');
    });
    $('#m-quit').addEventListener('click', () => { Game.save(true); closeOverlay(); showScreen('screen-title'); });

    const KEYS = { ArrowUp: 'forward', KeyW: 'forward', ArrowDown: 'back', KeyS: 'back', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', KeyQ: 'strafeL', KeyE: 'strafeR', Space: 'attack', KeyF: 'attack' };
    const TAPS = { KeyU: 'use', KeyC: 'cast', KeyR: 'rest', KeyX: 'quaff', KeyZ: 'read', KeyT: 'take', KeyG: 'take' };
    const OPENS = { KeyM: 'map', KeyI: 'inv', KeyP: 'spells', KeyH: 'char', KeyJ: 'journal', KeyL: 'log' };
    window.addEventListener('pointerdown', () => { lastInput = 'pointer'; }, { capture: true });
    window.addEventListener('keydown', e => {
      lastInput = 'key';
      const target = /** @type {HTMLElement} */ (e.target);
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
      // Escape is every screen's Back, as B is on a pad
      if (e.code === 'Escape' && !$('#screen-game').classList.contains('active')) { goBack(); e.preventDefault(); return; }
      if (!$('#screen-game').classList.contains('active')) return;
      if (e.code === 'Escape') { if (overlay) closeOverlay(); else openOverlay('menu'); e.preventDefault(); return; }
      if (overlay) { if (OPENS[e.code] === overlay) closeOverlay(); return; }
      if (KEYS[e.code]) { e.preventDefault(); if (!e.repeat) { held.set(KEYS[e.code], performance.now()); Game.input(KEYS[e.code]); } }
      else if (TAPS[e.code]) { e.preventDefault(); if (!e.repeat) Game.input(TAPS[e.code]); }   // held R is one rest, not three
      else if (OPENS[e.code]) { e.preventDefault(); openOverlay(OPENS[e.code]); }
    });
    window.addEventListener('keyup', e => { if (KEYS[e.code]) held.delete(KEYS[e.code]); });
    window.addEventListener('blur', () => held.clear());
  }
  let attackBtn = null, atkShown = -1;
  function pumpHeld() {
    if (overlay) return;
    const atk = attackBtn || (attackBtn = document.querySelector('.ctl.attack'));
    if (atk) { const r = Math.round(Game.attackReady() * 20) / 20; if (r !== atkShown) { atkShown = r; atk.style.setProperty('--ready', String(r)); atk.classList.toggle('cooling', r < 1); } }
    const now = performance.now();
    // turning is one quarter per press, never repeated: a held turn used to
    // carry on round into an about-face nobody asked for
    for (const [act, at] of held) if (act !== 'left' && act !== 'right' && now - at >= HOLD_DELAY) Game.input(act, true);
  }

  /** A daily run's end is kept at once, before any finale, in case the phone is put away. */
  function noteDaily(run, won) {
    // (a week's try is kept the same way, and as soon)
    if (run.opts.weekly && !run.tested) Weekly.finish(run.opts.weekly, { won, depth: run.depth, kills: run.player.kills, cls: run.player.cls, score: Game.score(run.player, run.depth, won, run.t), time: Math.round(run.t / 1000) });
    if (!run.opts.daily || run.tested) return;
    const p = run.player;
    Daily.finish(run.opts.daily, { won, depth: run.depth, kills: p.kills, cls: p.cls, score: Game.score(p, run.depth, won, run.t), time: Math.round(run.t / 1000) }, run.opts.dailyKind || 'main');
  }
  function handleEvents() {
    for (const e of Game.takeEvents()) {
      hudDirty = true;
      if (e === 'boons') { if (overlay === 'boons') renderBoons(); else openOverlay('boons'); }
      else if (e === 'boonsDone') { if (overlay === 'boons') closeOverlay(); }
      else if (e === 'page' && overlay === 'journal') renderJournal();
      else if (e === 'shop') openOverlay('shop');
      else if (e === 'fork') { if (Game.forkPending() && Game.state().status === 'playing') openOverlay('fork'); }
      else if (e === 'encounter') { if (overlay === 'encounter') renderEncounter(); else if (Game.currentEncounter()) openOverlay('encounter'); }
      // the view goes dark a moment first, then the end screen, for this run only
      else if (e === 'dead') {
        const run = Game.state();
        noteDaily(run, false);
        clearTimeout(finaleTimer);
        finaleTimer = setTimeout(() => { if (Game.state() === run && run.status === 'dead' && $('#screen-game').classList.contains('active')) showEnd(false); }, 1200);
      }
      // the Heart's light fills the view first, then the victory screen; only
      // for this run, and only if it is still on screen when the light is done
      else if (e === 'won') {
        const run = Game.state();
        noteDaily(run, true);
        clearTimeout(finaleTimer);
        finaleTimer = setTimeout(() => { if (Game.state() === run && run.status === 'won' && $('#screen-game').classList.contains('active')) showEnd(true); }, Game.finaleLeft());
      }
      else if (e === 'inv') { if (overlay === 'inv') renderInv(); else if (overlay === 'shop') renderShop(); }
      else if (e === 'stats' && overlay === 'shop') renderShop();
    }
  }

  function init() {
    // a state left from before a reload stands for nothing now
    try { if (histState()) history.replaceState(null, ''); } catch (e) { /* ignore */ }
    window.addEventListener('popstate', onBack);
    // each overlay is a dialog, named by its heading, for a screen reader
    for (const ov of $$('.overlay')) {
      ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
      const h = ov.querySelector('h2');
      if (h) { if (!h.id) h.id = ov.id + '-title'; ov.setAttribute('aria-labelledby', h.id); }
    }
    Renderer.setCalm(calmOn());
    document.body.classList.toggle('calm', calmOn());   // (the HUD's own beats are stilled with the view)
    Renderer.setBigNumbers(bigNumbers());
    access.setPalette(access.palette());
    Game.setTesting(testingSet());
    setHand();
    // until Calm view is chosen in the menu, it follows the phone's setting as that changes
    try { const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)'); if (mq && mq.addEventListener) mq.addEventListener('change', () => { Renderer.setCalm(calmOn()); document.body.classList.toggle('calm', calmOn()); }); } catch (e) { /* older browsers */ }
    bindTitle(); bindCreate();
    buildCreate();
    $('#c-seed').value = randomSeedWord();
    if ($('#screen-title').classList.contains('active')) startOpening();
    $('#screen-title').addEventListener('pointerdown', () => { endOpening(); Sound.unlock(); Music.swell(); }, { capture: true });
    $('#btn-help').addEventListener('click', () => { helpFromMenu = false; showScreen('screen-help'); });
    // a hero carried over from another device, in place of any waiting here
    $('#btn-code').addEventListener('click', () => {
      /** @type {HTMLTextAreaElement} */ ($('#code-in')).value = '';
      $('#code-why').textContent = '';
      const s = Game.saveSummary();
      // (as the New Game button warns: a Daily hero replaced is the day's one try spent)
      $('#code-warn').textContent = s ? `This replaces ${s.name} the ${s.cls}, waiting for you on floor ${s.depth}.${s.daily && s.daily === Daily.today() ? ` This is today's ${dailyLabel(s.dailyKind)}, your one try at it: loading another hero ends it unfinished.` : ''}` : '';
      showScreen('screen-code');
    });
    $('#code-back').addEventListener('click', () => showScreen('screen-title'));
    $('#code-open').addEventListener('click', () => $('#code-pick').click());
    $('#code-pick').addEventListener('change', async () => {
      const pick = /** @type {HTMLInputElement} */ ($('#code-pick')), f = pick.files && pick.files[0];
      if (f) /** @type {HTMLTextAreaElement} */ ($('#code-in')).value = await f.text();
      pick.value = '';
    });
    $('#code-load').addEventListener('click', async () => {
      Sound.unlock();
      const b = /** @type {HTMLButtonElement} */ ($('#code-load'));
      b.disabled = true;
      const r = await Game.loadCode(/** @type {HTMLTextAreaElement} */ ($('#code-in')).value);
      b.disabled = false;
      if (r.ok) startPlaying(); else $('#code-why').textContent = r.why || 'That code would not load.';
    });
    $('#btn-hall').addEventListener('click', () => { renderHall(); showScreen('screen-hall'); });
    $('#btn-beasts').addEventListener('click', () => { $('#beasts-count').textContent = renderBestiary($('#beasts-list')); showScreen('screen-beasts'); });
    $('#beasts-back').addEventListener('click', () => showScreen('screen-title'));
    for (const t of $$('[data-jtab]')) t.addEventListener('click', () => { journalTab = t.dataset.jtab; renderJournal(); });
    $('#hall-back').addEventListener('click', () => showScreen('screen-title'));
    $('#hall-relics').addEventListener('click', () => { $('#relics-count').textContent = renderCodex($('#relics-list')); showScreen('screen-relics'); });
    $('#relics-back').addEventListener('click', () => { renderHall(); showScreen('screen-hall'); });
    // the help is split into pages, so a first look is a page, not a wall
    for (const t of $$('[data-htab]')) t.addEventListener('click', () => helpTab(t.dataset.htab));
    $('#help-back').addEventListener('click', () => {
      const playing = !!(Game.state() && Game.state().status === 'playing');
      showScreen(playing ? 'screen-game' : 'screen-title');
      if (playing && helpFromMenu) openOverlay('menu');
      helpFromMenu = false;
    });
    $('#pro-begin').addEventListener('click', commitGame);
    // a look at the day's or the week's delve is not a try at it: nothing is spent until the stair is taken
    $('#pro-back').addEventListener('click', () => { pendingCfg = null; showScreen('screen-title'); });
    $('#end-load').addEventListener('click', () => { if (Game.load()) startPlaying(); });
    // the run as a picture: to the phone's share sheet where it takes files, else saved
    $('#end-card').addEventListener('click', async () => {
      const b = $('#end-card'), G = Game.state();
      if (!G) return;
      const won = G.status === 'won';
      const blob = await new Promise(r => drawShareCard(cardInfo(won)).toBlob(r, 'image/png'));
      if (!blob) { b.textContent = 'Could not draw the picture'; return; }
      const file = new File([blob], `deepdelve-${String(G.seed).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`, { type: 'image/png' });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: runShareLine(won) }); b.textContent = 'Shared'; return; }
      } catch (e) { if (e && e.name === 'AbortError') return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      b.textContent = 'Picture saved';
    });
    $('#end-share').addEventListener('click', () => {
      const G = Game.state(), key = G && G.opts.daily, kind = (G && G.opts.dailyKind) || 'main', st = key ? Daily.status(key, kind) : null;
      if (!G || (key && (!st || !st.done))) return;
      // a week's try is shared as the week's best so far (a test run's kept nothing, so it is told as any run)
      const week = G.opts.weekly && !G.tested ? Weekly.shareLine(G.opts.weekly) : '';
      // (with where to play it: a line with no way in brought nobody)
      const line = `${key ? Daily.shareLine(key, st.done, kind) : week || runShareLine(G.status === 'won')} ${location.origin}${location.pathname}`, out = $('#end-share-line');
      // the line is shown as well, to copy by hand if the clipboard says no
      out.textContent = line; out.style.display = '';
      shareText(line).then(how => { $('#end-share').textContent = SHARED[how] || (how === 'closed' ? $('#end-share').textContent : 'Copy the line below'); });
    });
    $('#end-title-btn').addEventListener('click', () => showScreen('screen-title'));
    bindControls();
    setTextSize(textSize());
    refreshTitle();
    // (a resize may move between layouts: the corner map and the docked one are drawn afresh)
    window.addEventListener('resize', () => { fitView(); miniSig = ''; if (overlay === 'map') renderMap(); });
  }

  // ---------- titlemenu: see titlemenu.js ----------
  const { refreshTitle, newsSeen, dailyLabel, copyText, shareText, SHARED, bindTitle, NEWS } = makeTitleMenu({
    store, get calmOn() { return calmOn; }, get showScreen() { return showScreen; }, get showPrologue() { return showPrologue; },
    get openCreation() { return openCreation; }, get quickStart() { return quickStart; }, get startPlaying() { return startPlaying; },
  });

  // ---------- createview: see createview.js ----------
  const { faceOf, buildCreate, openCreation, quickStart, bindCreate } = makeCreateView({
    get showScreen() { return showScreen; }, get showPrologue() { return showPrologue; }, get startNow() { return startNow; },
  });

  // ---------- endscreen: see endscreen.js ----------
  const { cardInfo, runShareLine, showEnd } = makeEndScreen({
    get clearOverlays() { return clearOverlays; }, get faceOf() { return faceOf; }, get showScreen() { return showScreen; },
  });

  // ---------- mapview: see mapview.js ----------
  const { setPalette: setMapPalette, drawAround, houndHere, mapView, renderMap, underfoot, wireMapPinch, zoomMap } = makeMapView({
    get testingSet() { return testingSet; },
  });

  // ---------- pack: see pack.js ----------
  const { compareText, renderInv } = makePack({
    get closeOverlay() { return closeOverlay; }, get damageShare() { return damageShare; }, get itemBlurb() { return itemBlurb; },
    get knownE() { return knownE; }, get overlay() { return overlay; }, get selectedItem() { return selectedItem; },
    set selectedItem(v) { selectedItem = v; }, get selectedSlot() { return selectedSlot; }, set selectedSlot(v) { selectedSlot = v; },
    get weaponLine() { return weaponLine; },
  });

  // ---------- choices: see choices.js ----------
  const { BOON_GUARD_MS, choiceHead, pathCard, renderBoons, renderEncounter } = makeChoices({
    get SHOP_GUARD_MS() { return SHOP_GUARD_MS; }, get closeOverlay() { return closeOverlay; }, get faceOf() { return faceOf; },
  });

  // ---------- shopview: see shopview.js ----------
  const { SHOP_GUARD_MS, amountWords, damageShare, itemBlurb, knownE, renderShop } = makeShopView({
    get closeOverlay() { return closeOverlay; }, get compareText() { return compareText; },
  });

  // ---------- titlescene: see titlescene.js ----------
  const { renderTitle, title, artState } = makeTitleScene({
    calm: () => calmOn(),
    /** How far down the title's picture its name begins, as a share of the picture's height. */
    nameTop: () => {
      const art = $('#title-art'), name = $('#screen-title .logo-block');
      if (!art || !name) return null;
      const a = art.getBoundingClientRect(), n = name.getBoundingClientRect();
      return a.height ? (n.top - a.top) / a.height : null;
    },
  });

  // ---------- herosheet: see herosheet.js ----------
  const { renderChar, renderSpells, weaponLine } = makeHeroSheet({
    get amountWords() { return amountWords; }, get closeOverlay() { return closeOverlay; }, get faceOf() { return faceOf; },
    get pathCard() { return pathCard; },
  });

  // ---------- access: see access.js ----------
  const access = makeAccess({
    store,
    applyPalette: name => { Renderer.setPalette(name); setMapPalette(name); miniSig = ''; if (overlay === 'map') renderMap(); },
  });

  // ---------- pad: see pad.js ----------
  const inGame = () => $('#screen-game').classList.contains('active');
  const pad = makePad({
    where: () => { if (!inGame() || overlay) return 'ui'; const G = Game.state(); return G && G.status === 'playing' ? 'play' : 'wait'; },
    root: bar => /** @type {HTMLElement|null} */ (bar ? $('#screen-game .bottombar') : overlay ? $('#ov-' + overlay) : $('.screen.active')),
    // the same held-to-repeat steps as the keys (pumpHeld)
    press: act => { held.set(act, performance.now()); Game.input(act); },
    release: act => { held.delete(act); },
    tap: act => Game.input(act),
    open: name => openOverlay(name),
    back: () => goBack(),
    menu: () => { if (!inGame()) return; if (overlay === 'menu') closeOverlay(); else if (!overlay) openOverlay('menu'); },
    woke: () => {
      lastInput = 'pad';
      if ($('#screen-title').classList.contains('active')) endOpening();
      Sound.unlock();
      // the pad's own controls, said once, the first time one is picked up in the dungeon
      if (inGame() && !overlay && Game.state() && Game.state().status === 'playing') showTip('pad');
    },
  });

  return { init, paused, fitView, pumpHeld, pollPad: pad.poll, refreshHud, refreshLog, refreshMinimap, renderTitle, handleEvents, showScreen,
    isPlaying: () => $('#screen-game').classList.contains('active'), pauseIfThreatened,
    isTitle: () => $('#screen-title').classList.contains('active'),
    /** The title's key art, which picture and how it lies: for the tests. */
    titleArt: () => artState(),
    /** Every tip's words, so a test can check each fits where it is shown. */
    // (a tip that suits itself to the spot is given in its widest words, for a test of whether it fits)
    tips: () => Object.fromEntries(Object.entries(TIPS).map(([k, v]) => [k, typeof v === 'function' ? v(true) : v])), placeTip, timeScale, bossBar,
    /** The build, named by its latest news line (sent with a report). */
    version: () => NEWS.id };
})();

export { UI };
