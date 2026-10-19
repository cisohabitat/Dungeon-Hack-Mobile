// The title screen's menu: Continue, New Game, the Daily and the Weekly, what's
// new, the first-time card, and the question asked before a hero waiting below
// is replaced. A factory in the K pattern, wired at the end of ui.js, which keeps
// the prologue, the run's start and the hero made by hand.
import { CLASSES, FUN_FACTS } from './data.js';
import { Sound } from './sound.js';
import { Game } from './game.js';
import { Daily } from './daily.js';
import { Weekly } from './weekly.js';
import { Progress } from './progress.js';
import { RELEASE_VERSION, COMMIT_ID } from './release.js';
import { $, $$ } from './uikit.js';

/**
 * @param {{
 *   store: (k: string, v?: string|null) => string|null,
 *   calmOn: () => boolean,
 *   showScreen: (id: string) => void,
 *   showPrologue: (cfg: any) => void,
 *   openCreation: () => void,
 *   quickStart: () => void,
 *   startPlaying: () => void,
 * }} K
 */
export function makeTitleMenu(K) {
  const { store } = K;
  function refreshTitle() {
    $('#release-info').textContent = `Release ${RELEASE_VERSION} · Commit ${COMMIT_ID}`;
    const s = Game.saveSummary();
    $('#btn-continue').disabled = !s;
    // with nothing saved, no greyed-out Continue taking the second place on the screen
    /** @type {HTMLElement} */ ($('#btn-continue')).hidden = !s;
    // a run waiting to be picked up is the likelier wish
    $('#btn-continue').classList.toggle('primary', !!s);
    $('#btn-new').classList.toggle('primary', !s);
    $('#save-summary').textContent = s
      ? `${s.name} the ${s.cls}, level ${s.level}, on floor ${s.depth}`
      : 'No saved game';
    refreshDaily();
    refreshNews();
    refreshFirstTime();
    // the run before, in a line: who, and how it ended
    const lr = Game.lastRun(), lastEl = $('#last-run');
    lastEl.hidden = !lr;
    if (lr) lastEl.textContent = `Last time: ${lr.name} the ${CLASSES[lr.cls] ? CLASSES[lr.cls].name : lr.cls} ${lr.won ? `won the Heart of the Mountain (${lr.levels} floors)` : `fell on floor ${lr.depth}${lr.killer ? `, killed by ${lr.killer}` : ''}`}.`;
    // and one thing to go down for next (someone new has the card instead)
    const goal = Progress.nextGoals(Progress.load(), lr ? lr.cls : '', Math.max(0, ...Game.hall().map(e => e.depth || 0)))[0], goalEl = $('#next-goal');
    goalEl.hidden = !goal || !returning();
    if (goal) goalEl.textContent = `Next: ${goal.how}, for ${goal.what}.`;
  }
  // ---------- what's new ----------
  // A returning player hears once, on the title, what has changed since they
  // last played; it goes when dismissed or when a run starts. A new player,
  // with nothing to compare it with, is not told. Change `id` with the text.
  const NEWS = { id: 'relic-portraits-2026-10-19', text: "Every named relic now has a painted portrait. Find them in the Relic codex and identified item details; tap a painting to look closer." };
  const NEWS_SEEN = 'deepdelve.news';
  const returning = () => ['deepdelve.save', 'deepdelve.hall', 'deepdelve.bestiary', 'deepdelve.companions', 'deepdelve.progress'].some(k => store(k));
  let greetingChosen = false;
  function refreshNews() {
    if (store(NEWS_SEEN) !== NEWS.id && !returning()) store(NEWS_SEEN, NEWS.id);
    $('#news-text').textContent = NEWS.text;
    $('#news').hidden = store(NEWS_SEEN) === NEWS.id;
    // One greeting per visit: dismissing news does not ask for another tap.
    if (!greetingChosen) {
      greetingChosen = true;
      if ($('#news').hidden) {
        const last = Number(store('deepdelve.lastFact') ?? -1);
        const choices = FUN_FACTS.map((_, i) => i).filter(i => i !== last);
        const pick = choices[Math.floor(Math.random() * choices.length)];
        store('deepdelve.lastFact', String(pick));
        $('#game-fact-text').textContent = FUN_FACTS[pick];
        $('#game-fact').hidden = false;
      }
    }
  }
  function newsSeen() { store(NEWS_SEEN, NEWS.id); $('#news').hidden = true; $('#game-fact').hidden = true; }
  // Someone new, with no run behind them, is met on the title by a card that
  // says in a minute what the game is and how it is played, once, until put away
  const FIRST_SEEN = 'deepdelve.firstSeen';
  function refreshFirstTime() { $('#first-time').hidden = returning() || store(FIRST_SEEN) === '1'; }
  // Put away, the card fades out first and the title fades up where it now
  // stands: the name drops down the screen as the card goes, and seen to jump
  // there it looked like a fault.
  const CARD_OUT_MS = 160;
  function firstTimeSeen() {
    store(FIRST_SEEN, '1');
    const card = $('#first-time'), inner = $('#screen-title .title-inner');
    if (card.hidden) return;
    if (K.calmOn() || !$('#screen-title').classList.contains('active')) { card.hidden = true; return; }
    card.classList.add('closing');
    setTimeout(() => {
      card.classList.remove('closing'); card.hidden = true;
      inner.classList.add('settling');
      setTimeout(() => inner.classList.remove('settling'), 260);
    }, CARD_OUT_MS);
  }
  /** Which daily a button is for, and where it says how it stands. @param {'main'|'earned'} kind */
  const DAILY_UI = { main: { btn: '#btn-daily', note: '#daily-summary' }, earned: { btn: '#btn-daily', note: '#daily-earned-summary' } };
  // which daily the title's Daily button is set to: the day's dungeon for any hero, or a Ranger's or a Druid's
  const DAILY_KIND = 'deepdelve.dailyKind';
  /** @returns {'main'|'earned'} */
  function dailyKind() {
    // left as the player set it; never set, a daily run waiting below sets it to its own kind
    const k = store(DAILY_KIND), s = Game.saveSummary();
    if (k) return k === 'earned' ? 'earned' : 'main';
    return s && s.daily === Daily.today() && s.dailyKind === 'earned' ? 'earned' : 'main';
  }
  /** Set the Daily button to one daily or the other, and show how that one stands. */
  function showDailyKind() {
    const kind = dailyKind();
    for (const b of $$('.daily-kind [data-kind]')) { const on = /** @type {HTMLElement} */ (b).dataset.kind === kind; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }
    $('#daily-name').textContent = kind === 'earned' ? 'Ranger & Druid Daily' : 'Daily Delve';
    // which daily is a choice for someone who has played one; a first visit sees one button
    /** @type {HTMLElement} */ ($('.daily-kind')).hidden = !returning();
    /** @type {HTMLElement} */ ($('#daily-summary')).hidden = kind !== 'main';
    /** @type {HTMLElement} */ ($('#daily-earned-summary')).hidden = kind !== 'earned';
    $('#btn-daily').classList.toggle('done', $('#btn-daily').dataset[kind === 'earned' ? 'earnedDone' : 'mainDone'] === '1');
  }
  /** The Daily Delve buttons say how today stands: fresh, waiting below, or done. */
  function refreshDaily() {
    for (const kind of /** @type {('main'|'earned')[]} */ (['main', 'earned'])) {
      const key = Daily.today(), st = Daily.status(key, kind), s = Game.saveSummary();
      const btn = /** @type {HTMLButtonElement} */ ($(DAILY_UI[kind].btn)), note = $(DAILY_UI[kind].note);
      if (!btn || !note) continue;
      // the day's own run, not a custom one that borrowed its seed
      const waiting = !!s && s.daily === key && s.dailyKind === kind;
      const run = Daily.streak(key, kind);
      btn.dataset[kind === 'earned' ? 'earnedDone' : 'mainDone'] = st.state !== 'fresh' && !waiting ? '1' : '0';
      if (waiting) note.textContent = `Today's delve waits on floor ${s.depth}`;
      else if (st.state === 'done') note.textContent = `Today: ${Daily.outcome(st.done)} \u00b7 Share`;
      else if (st.state === 'started') note.textContent = 'Today: left unfinished';
      else note.textContent = run ? `One try today \u00b7 streak ${run}` : kind === 'earned' ? 'A Ranger or a Druid, one try' : "Today's dungeon, one try";
    }
    // the week's challenge: waiting below, or what it asks, or the best try so far
    const wk = Weekly.weekKey(), ws = Game.saveSummary();
    $('#weekly-summary').textContent = ws && ws.weekly === wk ? `This week's delve waits on floor ${ws.depth}` : Weekly.summary(wk);
    showDailyKind();
  }
  /** Copy a line to the clipboard, the old way if the new one is refused. */
  async function copyText(text) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch (e) { /* try the old way */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }
  /**
   * Pass a line on: through the phone's own share sheet where there is one
   * (a message, a chat, a note), else onto the clipboard. Closing the sheet
   * without choosing is not a failure, and copies nothing behind the player's back.
   * @returns {Promise<'shared'|'closed'|'copied'|'failed'>}
   */
  async function shareText(text) {
    if (navigator.share) {
      try { await navigator.share({ text }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'closed'; }
    }
    return (await copyText(text)) ? 'copied' : 'failed';
  }
  const SHARED = { shared: 'Shared', copied: 'Copied: paste it anywhere' };
  /** A Daily Delve button: start today's, go back to it, or share how it went. @param {'main'|'earned'} [kind] */
  function dailyTap(kind = 'main') {
    const key = Daily.today(), st = Daily.status(key, kind), s = Game.saveSummary(), note = $(DAILY_UI[kind].note);
    if (s && s.daily === key && s.dailyKind === kind) { if (Game.load()) K.startPlaying(); return; }
    if (st.state === 'done') {
      const line = Daily.shareLine(key, st.done, kind);
      shareText(line).then(how => { note.textContent = SHARED[how] || line; });
      return;
    }
    // one try a day: a run begun and then given up is still the day's try
    if (st.state === 'started') { note.textContent = 'One try a day. Back tomorrow'; return; }
    startNewGameFlow(kind === 'earned' ? 'earned' : 'daily');
  }
  /** The Weekly Challenge button: go back to the week's run waiting below, or begin a new try. */
  function weeklyTap() {
    const s = Game.saveSummary();
    if (s && s.weekly === Weekly.weekKey()) { if (Game.load()) K.startPlaying(); return; }
    startNewGameFlow('weekly');
  }
  /** Today's hero, the same for everyone, into the prologue. @param {'main'|'earned'} [kind] */
  function dailyStart(kind = 'main') { K.showPrologue(Daily.heroFor(Daily.today(), kind)); }
  /** @type {'new'|'quick'|'daily'|'earned'|'weekly'} what the player asked for, waiting on the replace question */
  let pendingKind = 'new';
  /** Which daily a run is, by name. @param {string} [kind] */
  const dailyLabel = kind => (kind === 'earned' ? 'Ranger & Druid Daily' : 'Daily Delve');
  function startPending() { if (pendingKind === 'quick') K.quickStart(); else if (pendingKind === 'daily') dailyStart(); else if (pendingKind === 'earned') dailyStart('earned'); else if (pendingKind === 'weekly') K.showPrologue(Weekly.heroFor(Weekly.weekKey())); else K.openCreation(); }
  /** A run in progress is a real investment, so never discard one silently. @param {'new'|'quick'|'daily'|'earned'|'weekly'} [kind] */
  function startNewGameFlow(kind = 'new') {
    pendingKind = kind;
    const saved = Game.saveSummary();
    if (!saved) { startPending(); return; }
    // what was asked for, so the question is not a surprise
    $('#confirm-what').textContent = `You chose ${kind === 'quick' ? 'Quick Start' : kind === 'weekly' ? 'the Weekly Challenge' : kind === 'daily' || kind === 'earned' ? `the ${dailyLabel(kind)}` : 'New Game'}.`;
    // today's Daily is one try: replacing that hero spends it, so say so
    $('#confirm-who').textContent =
      `${saved.name} the ${saved.cls}, level ${saved.level}, waiting on floor ${saved.depth}.${saved.daily && saved.daily === Daily.today() ? ` This is today\'s ${dailyLabel(saved.dailyKind)}, your one try at it: a new hero ends it unfinished.` : ''}`;
    K.showScreen('screen-confirm');
  }

  /** The title's own controls, wired once. */
  function bindTitle() {
    $('#btn-new').addEventListener('click', () => { Sound.unlock(); startNewGameFlow(); });
    $('#btn-continue').addEventListener('click', () => { Sound.unlock(); if (Game.load()) K.startPlaying(); });
    $('#news-close').addEventListener('click', newsSeen);
    $('#game-fact-close').addEventListener('click', () => { $('#game-fact').hidden = true; });
    $('#end-new').addEventListener('click', () => startNewGameFlow());
    $('#confirm-keep').addEventListener('click', () => { if (Game.load()) K.startPlaying(); });
    $('#confirm-replace').addEventListener('click', startPending);
    $('#btn-quick').addEventListener('click', () => { Sound.unlock(); startNewGameFlow('quick'); });
    $('#ft-close').addEventListener('click', firstTimeSeen);
    $('#ft-quick').addEventListener('click', () => { firstTimeSeen(); Sound.unlock(); startNewGameFlow('quick'); });
    $('#btn-daily').addEventListener('click', () => { Sound.unlock(); dailyTap(dailyKind()); });
    $('#btn-weekly').addEventListener('click', () => { Sound.unlock(); weeklyTap(); });
    for (const b of $$('.daily-kind [data-kind]')) b.addEventListener('click', () => { store(DAILY_KIND, /** @type {HTMLElement} */ (b).dataset.kind === 'earned' ? 'earned' : 'main'); showDailyKind(); });
  }

  return { refreshTitle, newsSeen, firstTimeSeen, dailyLabel, copyText, shareText, SHARED, startNewGameFlow, startPending, bindTitle, NEWS };
}
