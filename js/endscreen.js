// The end of a run: the screen that sums it up, what it is remembered for, the line
// and the picture card to share. ui.js shows it, and lends what it needs through K.
import { Assets } from './assets.js';
import { BACKGROUNDS, BOONS, CLASSES, FEATS, ITEMS, MONSTERS, PATHS, RENOWN, SPELLS, TALENTS, VOWS } from './data.js';
import { Game } from './game.js';
import { Progress } from './progress.js';
import { $, diffName, diffOf, escapeHtml, upFirst } from './uikit.js';

/** @param {any} K */
export function makeEndScreen(K) {
  const clearOverlays = (/** @type {any[]} */ ...a) => K.clearOverlays(...a);
  const faceOf = (/** @type {any[]} */ ...a) => K.faceOf(...a);
  const showScreen = (/** @type {any[]} */ ...a) => K.showScreen(...a);

  // ---------- end screens ----------
  // The run told back: a few lines in the log's voice, then pictures and names, numbers last.
  // (a common kind in lower case, as the line about what killed you has it: "a green slime")
  const aName = (id, name) => MONSTERS[id] && (MONSTERS[id].boss || MONSTERS[id].named || MONSTERS[id].shade) ? `the ${name}` : `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name.toLowerCase()}`;
  /** "Grisk, the Goblin King": a named champion by its own name. */
  const namedTitle = id => `${MONSTERS[id].named.called}, the ${MONSTERS[id].name}`;
  /** A few lines about the run, the notable parts only, in the log's voice. */
  function runHighlights(G, won) {
    const s = Game.runStats(), p = G.player, out = [];
    const b = s.best;
    if (b) out.push(`Your best blow: <b>${b.dmg}</b> to ${escapeHtml(aName(b.id, b.to))}, with ${escapeHtml(b.how)}.`);
    else out.push('You never landed a blow.');
    const w = s.worst;
    if (w) out.push(w.from ? `The hardest hit you took: <b>${w.dmg}</b>, from ${escapeHtml(aName(w.id, w.from))}.` : (w.cause ? `The hardest hit you took: <b>${w.dmg}</b>, from ${escapeHtml(w.cause)}.` : `The hardest hit you took: <b>${w.dmg}</b>, and no monster dealt it.`));
    else out.push('Nothing so much as scratched you.');
    // the named champions cut down are told by name
    const named = Object.keys(s.kills).filter(id => MONSTERS[id] && MONSTERS[id].named);
    if (named.length) out.push(`You cut down <b>${named.map(id => escapeHtml(namedTitle(id))).join('</b> and <b>')}</b>.`);
    // the pictures below carry no names, so the kind that fell most often gets one here
    const kills = Object.entries(s.kills).filter(([id]) => MONSTERS[id]).sort((x, y) => y[1] - x[1]);
    if (kills.length && kills[0][1] >= 3) out.push(`The ${escapeHtml(MONSTERS[kills[0][0]].name)}s came off worst: <b>${kills[0][1]}</b> never got up.`);
    // the floor that cost the most, when there was more than one to compare
    const floors = Object.keys(s.hurtOn).map(Number).filter(f => s.hurtOn[f] > 0);
    if (floors.length > 1) {
      const worst = floors.reduce((a, f) => (s.hurtOn[f] > s.hurtOn[a] ? f : a));
      out.push(`Floor ${worst} took the most out of you: <b>${s.hurtOn[worst]}</b> of the ${s.taken} hit points you lost.`);
    }
    const casts = Object.entries(s.spells).sort((x, y) => y[1] - x[1]);
    if (casts.length) {
      const own = SPELLS[p.cls] || [];
      const nameOf = id => { const sp = own.find(x => x && x.id === id); return sp ? sp.name : id; };
      const total = casts.reduce((n, [, k]) => n + k, 0);
      const [topId, topN] = casts[0];
      out.push(casts.length === 1
        ? `You cast ${escapeHtml(nameOf(topId))} ${topN === 1 ? 'once' : `<b>${topN}</b> times`}, and nothing else.`
        : (topN * 2 > total
          ? `You cast <b>${total}</b> spells, most of them ${escapeHtml(nameOf(topId))}.`
          : `You cast <b>${total}</b> spells, ${escapeHtml(nameOf(topId))} more than any other.`));
    }
    // dying with the cure in your pack is worth a word
    const heals = !won ? p.inv.filter(it => ITEMS[it.t] && ITEMS[it.t].kind === 'potion' && ITEMS[it.t].effect === 'heal') : [];
    const healing = heals.reduce((n, it) => n + it.q, 0), unknown = heals.filter(it => !Game.isKnown(it.t)).reduce((n, it) => n + it.q, 0);
    // and the ones it never knew for healing get that said, now it no longer matters
    if (healing) out.push(`You died with ${healing === 1 ? 'a healing potion' : `<b>${healing}</b> healing potions`} still in your pack${unknown ? (unknown === healing ? `, not knowing ${healing === 1 ? 'it' : 'them'} for what ${healing === 1 ? 'it was' : 'they were'}` : `, ${unknown} of them never known for what they were`) : ''}.`);
    else if (s.potions) out.push(`You drank ${s.potions === 1 ? 'one potion' : `<b>${s.potions}</b> potions`}${s.scrolls ? ` and read ${s.scrolls === 1 ? 'one scroll' : `<b>${s.scrolls}</b> scrolls`}` : ''}.`);
    return out;
  }
  /** The summary block: highlights, the kills as pictures, talents, relics, totals. */
  function renderSummary(G, won) {
    const s = Game.runStats(), p = G.player, parts = [];
    parts.push('<div class="end-h"><span>The run</span></div><ul class="end-lines">' + runHighlights(G, won).map(l => `<li>${l}</li>`).join('') + '</ul>');
    // most killed first; a tie goes to the tougher kind
    const kills = Object.entries(s.kills).filter(([id]) => MONSTERS[id]).sort((a, b) => b[1] - a[1] || MONSTERS[b[0]].xp - MONSTERS[a[0]].xp);
    if (kills.length) {
      parts.push('<div class="end-h"><span>Slain</span></div><div class="end-kills">' + kills.map(([id, n]) => {
        const mb = MONSTERS[id], base = Assets.sprites[mb.sprite], art = (mb.named && base && base.elite && base.elite[id]) || base;
        const label = `${mb.named ? namedTitle(id) : mb.name} \u00d7${n}`;
        return `<div class="kill" data-kill="${id}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"><img src="${art ? art.url : ''}" alt=""><span>\u00d7${n}</span></div>`;
      }).join('') + '</div>');
    } else parts.push('<p class="end-none">Nothing died by your hand.</p>');
    const own = TALENTS[p.cls] || [];
    const path = Game.pathOf(p);
    if (path) parts.push(`<div class="end-h"><span>Path</span></div><div class="end-tags"><span class="tag path">${escapeHtml(path.name)}</span></div>`);
    const talents = (p.talents || []).map(id => own.find(t => t.id === id)).filter(Boolean);
    if (talents.length) parts.push('<div class="end-h"><span>Talents</span></div><div class="end-tags">' + talents.map(t => `<span class="tag">${escapeHtml(t.name)}</span>`).join('') + '</div>');
    // and the smaller lessons of each level, a count where one was learnt more than once
    const learnt = new Map();
    for (const id of p.boons || []) { const b = BOONS.find(x => x.id === id); if (b) learnt.set(b.name, (learnt.get(b.name) || 0) + 1); }
    for (const id of p.renownTaken || []) { const b = RENOWN.find(x => x.id === id); if (b) learnt.set(b.name, (learnt.get(b.name) || 0) + 1); }
    if (learnt.size) parts.push('<div class="end-h"><span>Lessons</span></div><div class="end-tags">' + [...learnt].map(([name, n]) => `<span class="tag">${escapeHtml(name)}${n > 1 ? ` \u00d7${n}` : ''}</span>`).join('') + '</div>');
    // what was found: the rare gear, the relics and any legend, in the colours of their grades
    const finds = Game.runFinds();
    if (finds.length) parts.push('<div class="end-h"><span>Finds</span></div><div class="end-tags">' + finds.map(f => `<span class="tag g-${f.grade}${f.grade === 'relic' ? ' relic' : ''}">${escapeHtml(upFirst(f.name))}</span>`).join('') + '</div>');
    parts.push(`<div class="end-totals"><div><b>${s.dealt}</b><small>damage dealt</small></div><div><b>${s.taken}</b><small>damage taken</small></div><div><b>${s.healed}</b><small>healed</small></div></div>`);
    $('#end-summary').innerHTML = parts.join('');
  }

  /**
   * One line to paste anywhere: the seed and every choice left off its usual
   * setting, since the same seed with other choices is another dungeon, and any vow sworn.
   */
  function runShareLine(won) {
    const G = Game.state(), p = G.player, o = G.opts;
    const ways = [diffName(diffOf(o))];
    if (o.levels && o.levels !== 8) ways.push(`${o.levels} floors`);
    if (o.size && o.size !== 'medium') ways.push(`${o.size} halls`);
    if (o.monsters && o.monsters !== 'normal') ways.push(`${o.monsters} monsters`);
    if (o.treasure && o.treasure !== 'normal') ways.push(`${o.treasure} treasure`);
    if (o.lockedDoors === false) ways.push('no locked doors');
    if (o.traps === false) ways.push('no traps');
    // a vow leaves the dungeon as it is, but it is half of what the run was
    for (const v of o.vows || []) if (VOWS[v]) ways.push(VOWS[v].name);
    const cls = CLASSES[p.cls] ? CLASSES[p.cls].name : p.cls;
    // and where to play it, when it is being played somewhere a friend can reach
    const where = location.protocol === 'https:' ? ` ${location.origin}${location.pathname}` : '';
    return `Deepdelve seed ${G.seed} (${ways.join(', ')}): ${cls}, ${won ? 'claimed the Heart' : `fell on floor ${G.depth}`}, ${p.kills} kill${p.kills === 1 ? '' : 's'}, score ${Game.score(p, G.depth, won)}${where}`;
  }
  /** What the share card says of this run, and the picture it shows. */
  function cardInfo(won) {
    const G = Game.state(), p = G.player, o = G.opts;
    const k = Game.lastAttacker(), mb = k && k.id ? MONSTERS[k.id] : null;
    const pic = s => (s && s.levels ? s.levels[0] : s) || null;
    let art = null, killer = '';
    if (won) { art = pic(Assets.sprites.artifact); killer = 'and brought down the Dread Lich'; }
    else if (mb) {
      const s = Assets.sprites[mb.sprite];
      art = pic(mb.named && s && s.elite && s.elite[k.id] ? s.elite[k.id] : s);
      killer = `to ${mb.named || /^the /i.test(k.name) ? k.name : `${/^[aeiou]/i.test(k.name) ? 'an' : 'a'} ${k.name.toLowerCase()}`}`;
    } else {
      art = pic(Assets.sprites.bone_heap);
      if (k) killer = `to ${k.name.replace(/^[A-Z](?=[a-z])/, c => (k.encounter ? c : c.toLowerCase()))}`;
    }
    // a hound still at the hero's side at the end stands in the picture with them
    // (not one told to stay floors above). Beside a killer it read as the killer's
    // dog, so on a death it is named, not drawn
    const c = G.companion, hound = c && !c.fallen && c.depth === G.depth ? { name: c.name, word: Game.companionWord(), art: won ? pic(Assets.sprites[{ goblin: 'scrag', wolf: 'wolf', sellsword: 'sellsword', mender: 'mender', renegade: 'renegade' }[c.kind] || 'dog'] || Assets.sprites.dog) : null } : null;
    const mode = [diffName(diffOf(o)), `${o.levels || 8} floors`, ...(o.vows || []).filter(v => VOWS[v]).map(v => VOWS[v].name)];
    return {
      won, art, killer, hound, face: pic(Assets.sprites['portrait_' + p.cls]),
      hero: `${p.name} the ${(Game.pathOf(p) || CLASSES[p.cls]).name}`,
      outcome: won ? 'Claimed the Heart' : `Fell on floor ${G.depth}`,
      stats: `Level ${p.level}${p.renown ? ` \u2605${p.renown}` : ''} \u00b7 ${p.kills} kill${p.kills === 1 ? '' : 's'} \u00b7 score ${Game.score(p, G.depth, won)}`,
      mode: mode.join(' \u00b7 '),
      seed: String(G.seed),
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    };
  }
  function showEnd(won) {
    const G = Game.state(), p = G.player;
    clearOverlays();
    $('#end-title').textContent = won ? 'VICTORY' : 'YOU HAVE DIED';
    // the hero's face under it, gone grey if they fell
    const face = /** @type {HTMLImageElement} */ ($('#end-face'));
    face.src = faceOf(p.cls); face.alt = `${p.name}, the ${CLASSES[p.cls].name}`; face.classList.toggle('fallen', !won);
    $('#end-text').textContent = won
      ? `${p.name} the ${(Game.pathOf(p) || CLASSES[p.cls]).name} brought down the Dread Lich and lifted the Heart of the Mountain.`
      : `${G.opts.permadeath ? 'The save has been erased.' : ''}`;   // where they fell, the epilogue below says
    // a first win for this class at this difficulty, and any past it opened
    const earned = won ? Game.earned() : null, news = [];
    if (earned && earned.first && CLASSES[earned.cls]) news.push(`First win as a ${CLASSES[earned.cls].name} on ${diffName(earned.difficulty)}!${earned.difficulty === 'hard' ? ` The ${CLASSES[earned.cls].plural} will call you ${CLASSES[earned.cls].title}.` : ''}`);
    for (const id of (earned && earned.unlocked) || []) if (BACKGROUNDS[id]) news.push(`${BACKGROUNDS[id].name} can now be chosen for a new hero.`);
    if (earned && earned.firstPath) { const x = Object.values(PATHS).flat().find(q => q.id === earned.firstPath); if (x) news.push(`First win on the ${x.name}'s path!`); }
    if (earned && earned.mastered && CLASSES[earned.cls]) news.push(`The ${CLASSES[earned.cls].name} mastered: a win on both its paths, and a trophy of its own.`);
    for (const id of (earned && earned.firstVows) || []) if (VOWS[id]) news.push(`The ${VOWS[id].name} kept to the end: a trophy of its own.`);
    for (const id of (earned && earned.firstFeats) || []) if (FEATS[id]) news.push(`${FEATS[id].name}: a feat, and a trophy of its own.`);
    if (earned && earned.vowsOpened) news.push('Vows are open: a new hero can swear one for a harder run.');
    if (G.tested) news.push('A test run (a testing tool from the Menu was used): it is not written in the Hall, and earns no trophy.');
    else if (won && (G.opts.levels || 8) <= 2) news.push('A quick delve won: it goes in the Hall, but trophies wait for a delve of four floors or more.');
    else if (earned && earned.reloadable) news.push('Trophies are for a win on one life: tick Permadeath to earn one.');
    // and the next thing to aim for, while a past is still locked
    else if (won) {
      const next = Object.keys(BACKGROUNDS).find(id => BACKGROUNDS[id].unlock && !Progress.bgOpen(id));
      if (next) news.push(`Win on ${BACKGROUNDS[next].unlock === 'hard' ? 'Hard' : 'Normal or Hard'} to open ${BACKGROUNDS[next].name}.`);
    }
    // one line each: run together in one centred block, four of them read as one long sentence
    $('#end-trophy').innerHTML = news.map(n => `<span class="end-news">${escapeHtml(n)}</span>`).join('');
    $('#end-trophy').style.display = news.length ? '' : 'none';
    const rows = [['Hero level', p.level], ['Experience', p.xp], ['Gold', p.gold], ['Kills', p.kills], ['Steps', p.steps], ['Deepest floor', p.deepest]];
    // time spent underground, by the game's own clock
    const secs = Math.round(G.t / 1000);
    rows.push(['Time', `${Math.floor(secs / 60)}m ${String(secs % 60).padStart(2, '0')}s`]);
    rows.unshift(['Score', Game.score(p, G.depth, won)]);
    rows.push(['Seed', G.seed]);
    $('#end-stats').innerHTML = rows.map(([k, v]) => `<div>${k}<span>${escapeHtml(String(v))}</span></div>`).join('');
    renderSummary(G, won);
    const cause = $('#end-cause');
    const killer = Game.lastAttacker();
    if (!won && killer && killer.encounter) {
      cause.innerHTML = `Died at <b>${escapeHtml(killer.name)}</b>, when a choice went wrong (${killer.dmg} damage).`;
    } else if (!won && killer && killer.cause) {
      cause.innerHTML = `Killed by <b>${escapeHtml(killer.name)}</b> (${killer.dmg} damage).`;
    } else if (!won && killer) {
      // "an ogre", as the lines below it say; a champion keeps its own name
      const who = killer.name.includes(',') || /^the /i.test(killer.name) ? killer.name : `${/^[aeiou]/i.test(killer.name) ? 'an' : 'a'} ${killer.name.toLowerCase()}`;
      cause.innerHTML = `Killed by <b>${escapeHtml(who)}</b>, striking ${escapeHtml(killer.bearing)} for ${killer.dmg}.`;
    } else if (!won) {
      cause.textContent = 'Killed by the dungeon itself.';
    } else cause.textContent = '';
    const moments = Game.deathLog();
    $('#end-final').style.display = (!won && moments.length) ? '' : 'none';
    $('#end-final-log').innerHTML = moments.map(m => `<p>${escapeHtml(m)}</p>`).join('');
    $('#end-epilogue').innerHTML = Game.epilogue(won).map(t => `<p>${escapeHtml(t)}</p>`).join('');
    $('#end-load').style.display = (!won && !G.opts.permadeath && Game.hasSave()) ? '' : 'none';
    // any run can be told in one line: a daily one with its streak, another with
    // its seed, so a friend can walk the same halls
    // (a test run's Daily kept no result, so it has none to share)
    $('#end-share').style.display = G.opts.daily && G.tested ? 'none' : '';
    $('#end-card').style.display = '';
    $('#end-card').textContent = 'Share a picture';
    $('#end-share').textContent = G.opts.daily ? 'Share today\'s result' : 'Share this run';
    $('#end-share-line').style.display = 'none';
    showScreen('screen-end');
    $('#screen-end').scrollTop = 0;   // a second death, or the win, opens at its title, not where the last was left
  }

  return { cardInfo, runShareLine, showEnd };
}
