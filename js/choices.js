// The choices the game puts to the player: an encounter's, and a level's (a talent,
// a lesson, a path, a capstone, renown). ui.js opens them, and lends what it needs
// through K.
import { Assets } from './assets.js';
import { BOONS, CAPSTONE_LEVEL, CLASSES, ITEMS, MAX_LEVEL, PATHS, PATH_LEVEL, RENOWN, STAT_NAMES, TALENTS } from './data.js';
import { Game } from './game.js';
import { $, $$, escapeHtml } from './uikit.js';

/** @param {any} K */
export function makeChoices(K) {
  const closeOverlay = (/** @type {any[]} */ ...a) => K.closeOverlay(...a);

  // An encounter: the prose, then each choice with what it tests and how
  // likely it is to go well; once chosen, what happened and what it did.
  function renderEncounter() {
    const e = Game.currentEncounter();
    if (!e) { closeOverlay(); return; }
    $('#enc-title').textContent = e.def.title;
    const art = Assets.sprites[e.def.sprite];
    $('#enc-art').src = art ? art.url : '';
    const el = $('#enc-choices');
    el.innerHTML = '';
    if (!e.result) {
      $('#enc-text').textContent = e.def.text;
      // the tap that opened it (twice on the view, twice on Use) must not
      // answer it unread: the choices arm a moment later, as the level-up offers do
      const armedAt = performance.now() + BOON_GUARD_MS;
      for (const o of Game.encounterOptions()) {
        const btn = document.createElement('button');
        btn.className = 'boon enc-choice';
        const bits = [];
        // the odds always; the dice behind them only for a player who has asked to see the rolls
        if (o.stat) bits.push(`${o.statName}: ${Game.rollsShown() ? `d20${o.bonus < 0 ? '' : '+'}${o.bonus} vs ${o.dc}, ` : ''}${Math.round(o.chance * 100)}% chance${o.trained && o.helper ? ` (your training and ${o.helper} help)` : o.trained ? ' (your training helps)' : o.helper ? ` (${o.helper} helps)` : ''}`);
        if (o.cost) bits.push(`costs ${o.cost}`);
        if (o.blocked) bits.push(o.blocked);
        btn.innerHTML = `<b>${escapeHtml(o.label)}</b>${bits.length ? `<small>${escapeHtml(bits.join(' · '))}</small>` : ''}`;
        btn.disabled = !!o.blocked;
        if (!o.blocked) { btn.classList.add('arming'); setTimeout(() => btn.classList.remove('arming'), BOON_GUARD_MS); }
        btn.addEventListener('click', () => { if (performance.now() < armedAt) return; Game.chooseEncounter(o.i); renderEncounter(); });
        el.appendChild(btn);
      }
      return;
    }
    const r = e.result;
    const verdict = r.check ? (r.check.pass ? '<b class="enc-pass">It goes well.</b> ' : '<b class="enc-fail">It goes badly.</b> ') : '';
    $('#enc-text').innerHTML = verdict + escapeHtml(r.text) + (r.check && r.check.note ? ` <span class="roll">${escapeHtml(r.check.note.trim())}</span>` : '');
    if (r.lines.length) {
      const ul = document.createElement('ul');
      ul.className = 'enc-lines';
      ul.innerHTML = r.lines.map(l => `<li>${escapeHtml(l)}</li>`).join('');
      el.appendChild(ul);
    }
    const done = document.createElement('button');
    done.className = 'primary';
    done.textContent = 'Continue';
    // the second tap of a double tap on a choice lands here: the outcome is read first
    // (the shop's own guard, read when asked: it is made after this)
    const readFrom = performance.now() + K.SHOP_GUARD_MS;
    done.addEventListener('click', () => { if (performance.now() >= readFrom) closeOverlay(); });
    el.appendChild(done);
  }
  const BOON_GUARD_MS = 700, SPREAD_GUARD_MS = 350;
  /** A lesson's card: for a stat, what it will be and what it buys this hero. */
  function lessonText(b, p) {
    if (!b.stat) return b.desc;
    const s = p.stats[b.stat], next = s + (s % 2 ? 1 : 2);
    const what = {
      str: p.cls === 'thief' ? 'to hit' : 'to hit and to damage',
      // a ranger lands and weights every blow with Dexterity, as a fighter does with Strength
      dex: p.cls === 'thief' ? 'to armour class and to damage' : p.cls === 'ranger' ? 'to hit, to damage and to armour class' : 'to armour class',
      con: 'hit point with every level from now on',
      int: p.cls === 'mage' ? 'spell point for every hero level' : 'to Study and to every Intelligence check',
      wis: p.cls === 'cleric' || p.cls === 'druid' ? 'spell point for every hero level, to hit and to damage, and a surer will against draining' : 'against draining',
    }[b.stat];
    return `${STAT_NAMES[b.stat]} ${s} \u2192 ${next}: +1 ${what}.`;
  }
  /** Self-Taught: tap a score for each point; both on one is fine. */
  function renderSpread(b) {
    const p = Game.player(), el = $('#boon-list'), picks = [];
    el.classList.remove('paths');
    // the tap that chose Self-Taught must not land on a score as well: the scores wait a moment
    const armedAt = performance.now() + SPREAD_GUARD_MS;
    const draw = () => {
      el.innerHTML = `<p class="boon-head">${escapeHtml(b.name)}: ${b.spread - picks.length} point${b.spread - picks.length === 1 ? '' : 's'} to place</p>`
        + '<p class="dim small spread-hint">A point on a score shown in green raises its bonus. ★ marks your class\'s key score.</p>';
      const grid = document.createElement('div');
      grid.className = 'spread-grid';
      for (const k in STAT_NAMES) {
        const v = p.stats[k] + picks.filter(x => x === k).length, m = Game.mod(v);
        // Self-Taught gives a score two points over the whole run, no more
        const full = ((p.taught || {})[k] || 0) + picks.filter(x => x === k).length >= 2;
        const btn = document.createElement('button');
        btn.className = 'boon spread-stat' + (CLASSES[p.cls].primary === k ? ' key' : '');
        btn.dataset.stat = k;
        // which taps move a bonus: a point onto an odd score raises it
        const up = Game.mod(v + 1) > m;
        const put = picks.filter(x => x === k).length, key = CLASSES[p.cls].primary === k;
        btn.innerHTML = `<b>${key ? '\u2605 ' : ''}${escapeHtml(STAT_NAMES[k])}</b><small>${v} (${m >= 0 ? '+' : ''}${m})${up ? ` \u2192 ${m + 1 >= 0 ? '+' : ''}${m + 1}` : ''}</small>${put ? `<em class="picked">+${put}</em>` : ''}`;
        if (put) btn.classList.add('picked');
        if (up) btn.classList.add('raises');
        const wait = armedAt - performance.now();
        if (full) { btn.disabled = true; btn.classList.add('full'); btn.title = 'Self-Taught has given this score its two points'; }
        else if (wait > 0) { btn.disabled = true; setTimeout(() => { btn.disabled = false; }, wait); }
        btn.addEventListener('click', () => {
          if (performance.now() < armedAt) return;
          picks.push(k);
          if (picks.length < b.spread) { draw(); return; }
          // refused (the offer changed under it): start the placing again rather than piling up taps
          if (!Game.chooseBoon(b.id, picks)) { picks.length = 0; draw(); return; }
          if (Game.pendingBoons()) renderBoons(); else closeOverlay();
        });
        grid.appendChild(btn);
      }
      el.appendChild(grid);
      const back = document.createElement('button');
      back.className = 'ghost small';
      back.textContent = picks.length ? 'Start again' : 'Choose a different lesson';
      back.addEventListener('click', () => { if (picks.length) { picks.length = 0; draw(); } else renderBoons(); });
      el.appendChild(back);
    };
    draw();
  }
  function renderBoons() {
    const offer = Game.pendingBoons();
    if (!offer) { closeOverlay(); return; }
    if (Game.isPathOffer(offer) || Game.isCapstoneOffer(offer)) { renderPaths(offer); return; }
    if (Game.isRenownOffer(offer)) { renderRenown(offer); return; }
    const p = Game.player();
    const talents = TALENTS[p.cls] || [];
    const isTalent = offer.some(id => talents.some(t => t.id === id));
    $('#boon-title').textContent = isTalent
      ? `Hero level ${Game.pendingLevel()}: a ${CLASSES[p.cls].name}'s talent`
      : `Hero level ${Game.pendingLevel()}: what the delve taught you`;
    const el = $('#boon-list');
    el.innerHTML = '';
    el.classList.remove('paths');
    // what the level brought, and what comes next
    const level = Game.pendingLevel(), got = Game.levelNote(level);
    const bits = [];
    if (got) { bits.push(`+${got.hp} hit point${got.hp === 1 ? '' : 's'}`); for (const sp of got.spells) bits.push(`learned ${sp}`); }
    const nextTalent = level + (level % 2 === 0 ? 2 : 1);   // talents come at the even levels
    if (nextTalent <= MAX_LEVEL) bits.push(isTalent ? `next talent at level ${nextTalent}` : (nextTalent === level + 1 ? 'a talent at the next level' : `next talent at level ${nextTalent}`));
    if (!p.path && level < PATH_LEVEL && PATHS[p.cls]) bits.push(`your path at level ${PATH_LEVEL}`);
    else if (p.path && !p.capstone && level < CAPSTONE_LEVEL) bits.push(`you master your path at level ${CAPSTONE_LEVEL}`);
    const head = document.createElement('p');
    head.className = 'boon-head';
    head.textContent = bits.join(' \u00b7 ');
    el.appendChild(head);
    const note = document.createElement('p');
    note.className = 'dim small';
    note.textContent = isTalent ? 'A talent is for good, and each can be taken once. Choose the one that suits how you fight.'
      : 'A small lesson. Choose one.';
    el.appendChild(note);
    // a tap already on its way when the screen opened must not choose for you
    const openedAt = performance.now();
    for (const id of offer) {
      const b = BOONS.find(x => x.id === id) || talents.find(x => x.id === id);
      if (!b) continue;
      const btn = document.createElement('button');
      btn.className = 'boon' + (isTalent ? ' talent' : '');
      btn.innerHTML = `<b>${escapeHtml(b.name)}</b><small>${escapeHtml(isTalent ? b.desc : lessonText(b, p))}</small>`;
      btn.disabled = true; btn.classList.add('arming');
      setTimeout(() => { btn.disabled = false; btn.classList.remove('arming'); }, BOON_GUARD_MS);
      btn.addEventListener('click', () => {
        if (performance.now() - openedAt < BOON_GUARD_MS) return;
        if (/** @type {any} */ (b).spread) { renderSpread(/** @type {any} */ (b)); return; }
        Game.chooseBoon(id);
        if (Game.pendingBoons()) renderBoons(); else closeOverlay();
      });
      el.appendChild(btn);
    }
  }

  // A rank of renown, past the top level: the same kind of card as a lesson,
  // with what the next rank asks for, so the bar still has somewhere to go.
  function renderRenown(offer) {
    const rank = Game.pendingLevel() - MAX_LEVEL;
    $('#boon-title').textContent = `Renown, rank ${rank}: your name goes before you`;
    const el = $('#boon-list');
    el.innerHTML = '';
    el.classList.remove('paths');
    const head = document.createElement('p');
    head.className = 'boon-head';
    // (with ranks still waiting to be chosen, the next is the one after the hero's own, not after this card's)
    head.textContent = `past the top level \u00b7 the next rank at ${Game.renownAt((Game.player().renown || 0) + 1)} experience`;
    el.appendChild(head);
    const note = document.createElement('p');
    note.className = 'dim small';
    note.textContent = 'A small gain, for good. Choose one.';
    el.appendChild(note);
    const openedAt = performance.now();
    for (const id of offer) {
      const b = RENOWN.find(x => x.id === id);
      if (!b) continue;
      const btn = document.createElement('button');
      btn.className = 'boon renown';
      btn.innerHTML = `<b>${escapeHtml(b.name)}</b><small>${escapeHtml(b.desc)}</small>`;
      btn.disabled = true; btn.classList.add('arming');
      setTimeout(() => { btn.disabled = false; btn.classList.remove('arming'); }, BOON_GUARD_MS);
      btn.addEventListener('click', () => {
        if (performance.now() - openedAt < BOON_GUARD_MS) return;
        Game.chooseBoon(id);
        if (Game.pendingBoons()) renderBoons(); else closeOverlay();
      });
      el.appendChild(btn);
    }
  }

  /** A path's card: its name, a line of flavour, and what it does, as a list. */
  const pathCard = x => `<b>${escapeHtml(x.name)}</b><small class="path-flavour">${escapeHtml(x.flavour)}</small><ul class="path-effects">${x.effects.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>${pathWarning(x)}`;
  // a Knight's first two powers are a shield's: one fighting with two blades,
  // or a two-handed sword, is told so before choosing, not after
  function pathWarning(x) {
    const eq = Game.player().eq;
    if (x.wants !== 'shield' || eq.shield) return '';
    const why = eq.offhand ? 'Your off hand holds a blade' : eq.weapon && ITEMS[eq.weapon.t].twoHanded ? 'Your weapon takes both hands' : 'You carry no shield';
    return `<small class="path-warn">${why}: the first two need a shield.</small>`;
  }
  // The class's two paths, once a run: set apart from lessons and talents
  // because it is the bigger choice, and it cannot be undone. The path's two
  // capstones later are the same kind of choice, and shown the same way.
  function renderPaths(offer) {
    const p = Game.player(), mastery = Game.isCapstoneOffer(offer);
    const paths = mastery ? (Game.pathOf() || { capstones: [] }).capstones : PATHS[p.cls] || [];
    const level = Game.pendingLevel(), got = Game.levelNote(level);
    $('#boon-title').textContent = mastery ? `Hero level ${level}: master your path` : `Hero level ${level}: choose your path`;
    const el = $('#boon-list');
    el.innerHTML = '';
    // held sideways, the paths sit side by side: one under the other, the second was below the fold
    el.classList.add('paths');
    const bits = [];
    if (got) { bits.push(`+${got.hp} hit point${got.hp === 1 ? '' : 's'}`); for (const sp of got.spells) bits.push(`learned ${sp}`); }
    const head = document.createElement('p');
    head.className = 'boon-head';
    head.textContent = bits.join(' \u00b7 ');
    if (bits.length) el.appendChild(head);
    const note = document.createElement('p');
    note.className = 'dim small';
    // at the path's own level it is instead of the lesson; a hero who came past
    // that level before there were paths gets it on top of what the level gives
    const inPlace = Game.pendingLevel() === (mastery ? CAPSTONE_LEVEL : PATH_LEVEL);
    if (mastery) note.textContent = `The ${Game.pathOf().name}'s path ends in one of two masteries. Choose one: it is yours for the rest of the run${inPlace ? ', and it takes the place of this level\'s lesson' : ', and it comes on top of what this level gives you'}.`;
    else note.textContent = `Every ${CLASSES[p.cls].name.toLowerCase()} chooses a path here. Choose one: it is yours for the rest of the run${inPlace ? ', and it takes the place of this level\'s lesson' : ', and it comes on top of what this level gives you'}.`;
    el.appendChild(note);
    const openedAt = performance.now();
    for (const id of offer) {
      const x = paths.find(q => q.id === id);
      if (!x) continue;
      const btn = document.createElement('button');
      btn.className = 'boon path';
      btn.dataset.path = x.id;
      btn.innerHTML = pathCard(x);
      btn.disabled = true; btn.classList.add('arming');
      setTimeout(() => { btn.disabled = false; btn.classList.remove('arming'); }, BOON_GUARD_MS);
      // it cannot be undone, so it asks twice, as a dear buy at the trader does:
      // the first tap marks the card, a second on the same card takes the path
      btn.addEventListener('click', () => {
        if (performance.now() - openedAt < BOON_GUARD_MS) return;
        if (!btn.classList.contains('armed')) {
          for (const b of $$('#boon-list .boon.path.armed')) b.dispatchEvent(new Event('disarm'));
          btn.classList.add('armed');
          btn.insertAdjacentHTML('beforeend', `<span class="path-confirm">${mastery ? `Tap again to master ${escapeHtml(x.name)}` : `Tap again to take the ${escapeHtml(x.name)}'s path`}</span>`);
          return;
        }
        Game.chooseBoon(id);
        if (Game.pendingBoons()) renderBoons(); else closeOverlay();
      });
      btn.addEventListener('disarm', () => { btn.classList.remove('armed'); btn.querySelector('.path-confirm')?.remove(); });
      el.appendChild(btn);
    }
  }

  return { BOON_GUARD_MS, pathCard, renderBoons, renderEncounter };
}
