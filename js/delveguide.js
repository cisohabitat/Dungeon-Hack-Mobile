// Read-only views of the run. Never resolve an objective or advance its clock here.
import { Game } from './game.js';
import { MONSTERS, CLASSES, ITEMS } from './data.js';
import { RELIC_POWERS, PREFIX_DESC } from './relics.js';
import { escapeHtml } from './uikit.js';
import { visitedPlace } from './rooms.js';
const esc = escapeHtml;
const section = (title, body) => `<section class="guide-card"><h3>${esc(title)}</h3>${body}</section>`;
const list = rows => rows.length ? `<ul>${rows.map(row => `<li>${esc(row)}</li>`).join('')}</ul>` : '<p class="dim">None yet.</p>';
const sign = n => `${n >= 0 ? '+' : '−'}${Math.abs(n)}`;

export function questsView() {
  const G = Game.state(), b = G.bounty, t = G.threads || {};
  const main = G.status === 'won' ? 'The delve is complete.' : G.status === 'dead' ? 'This delve has ended.' : `Reach floor ${G.opts.levels}, defeat the Heart’s keeper and choose what becomes of the Heart.`;
  let html = section('The Heart of the Mountain', `<p>${esc(main)}</p><p class="dim">Floor ${G.depth} of ${Number(G.opts.levels)}</p>`);
  if (b) {
    const objective = b.kind === 'cull' ? `Defeat creatures on floor ${b.depth}: ${b.got || 0}/${b.need}.` : b.kind === 'fetch' ? `Find the lost satchel on floor ${b.depth}.` : `Defeat ${b.name || 'the lair’s champion'} on floor ${b.depth}.`;
    const next = b.done ? 'Find a trader below the floor where you accepted the job to collect your pay.' : G.depth < b.depth ? `Reach floor ${b.depth}.` : 'Finish the job before leaving its floor, or it is lost.';
    html += section(b.done ? 'Trader’s job · ready for payment' : 'Trader’s job · active', `<p>${esc(objective)}</p><p><b>Next:</b> ${esc(next)}</p><p class="dim">${Number(b.reward.gold)} gold and a promised supply.</p>`);
  } else html += section('Trader’s job', '<p>No active job. A trader may offer work for the floor below.</p>');
  const tasks = [];
  if (t.guide && !t.guided) tasks.push('The rescued guildsman has gone ahead. Look for the markings on the next floors.');
  if (t.lamp && !t.lampGift) tasks.push('Meet a Lampfolk trader below to be thanked for relighting the lamp.');
  if (t.mule && !t.muleDone) tasks.push('Lead the lost mule to a trader below.');
  if (t.oath && !t.oathPaid) tasks.push('Continue down to where the weeping knight’s companions fell.');
  if (G.player.inv.some(it => it.t === 'quench')) tasks.push('Carry the smiths’ quench to the Heart if you wish to put it out.');
  if (t.smithway || t.bargain) tasks.push('At the Heart, you may choose to stay and keep it.');
  html += section('Promises and leads', tasks.length ? list(tasks) : '<p class="dim">No unfinished leads recorded.</p>');
  html += section('What follows you', list(Game.threadNotes().filter(n => !n.startsWith('A job') && !n.startsWith(G.companion?.name + ','))));
  const place = visitedPlace(Game.level());
  if (place && Game.level().roomId[G.player.y * Game.level().w + G.player.x] === place.room) html += section(place.name, `<p>${esc(place.description)}</p>`);
  html += '<details class="field-notes"><summary>Fighting groups · field notes</summary>'
    + section('A warband', '<p>The marked leader holds its followers together. Defeat the leader and its followers break and scatter.</p>')
    + section('Blades and bows', '<p>A doorway can narrow a crowd. Step out of an archer\'s line while dealing with what reaches you; a closed door buys time, until it is opened or broken.</p>')
    + section('Foes sharing a square', '<p>A pack holds several creatures. Keep room to step aside when a warning appears; one fallen body does not mean the square is clear.</p>') + '</details>';
  return html;
}

export function activeEffects() {
  const G = Game.state(); if (!G) return [];
  const p = G.player, rows = [], add = (name, detail, until = null) => rows.push({ name, detail, remaining: until === null ? 'Until its condition ends' : `${Math.max(0, Math.ceil((until - G.t) / 1000))}s remaining` });
  const timed = (until, name, detail) => { if (Number.isFinite(until) && until > G.t) add(name, detail, until); };
  timed(p.poison?.until, 'Poisoned', 'Poison takes life at intervals. An antidote or a suitable cure removes it.');
  timed(p.held, { down: 'Knocked down', stone: 'Stone', snare: 'Snared' }[p.heldBy] || 'Frozen', 'You cannot move, turn, attack or use supplies until you are free.');
  timed(p.webbed, 'Webbed', 'Trying to move tears at the web. You remain stuck until it gives way or expires.');
  timed(p.dazzled, 'Dazzled', 'Your blows are less accurate until the flare fades.');
  if (p.hexed) timed(p.hexed.until, p.hexed.kind === 'silence' ? 'Silenced' : 'Slowed', p.hexed.kind === 'silence' ? 'You cannot cast spells until the hex lifts.' : 'Steps, weapon blows and spellcasting take longer.');
  if (p.grabbed && (!p.grabbed.until || p.grabbed.until > G.t)) add('Grabbed', 'Try to move to struggle free of the creature’s grip.', p.grabbed.until || null);
  for (const [key, e] of Object.entries(p.effects || {})) {
    if (!e || e.until <= G.t) continue;
    const rune = { runic_fire: 'Fire', runic_frost: 'Frost', runic_storm: 'Lightning' }[e.src];
    if (key === 'runicEdge') { timed(e.until, `Runic Edge: ${rune}`, `Sword and dagger hits deal ${Number(e.amount)} extra elemental damage.`); continue; }
    if (key === 'spellguard') { timed(e.until, 'Spellguard', `The next hit loses up to ${Number(e.amount)} damage. Poison and hunger pass through.`); continue; }
    if (key === 'runicReturn') { timed(e.until, 'Spellguard: strike ready', `Your next sword or dagger hit deals ${Number(e.amount)} extra damage.`); continue; }
    const kind = key.replace(/^(boon_|crew_)/, ''), name = key === 'crew_hit' ? 'Crew’s song' : key.startsWith('boon_') ? kind === 'ac' ? 'Ward' : 'Prayer' : { ac: 'Shielded', hit: 'Blessed', might: 'Mighty' }[kind] || key;
    const detail = kind === 'ac' ? `${sign(e.amount)} armour class.` : kind === 'hit' ? `${sign(e.amount)} to hit.` : kind === 'might' ? '+2 to hit and +2 damage.' : `Temporary ${kind.replaceAll('_', ' ')} effect (${sign(e.amount)}).`;
    timed(e.until, name, detail);
  }
  timed(p.smokeUntil, 'In smoke', 'The smoke hides you from nearby foes.');
  timed(p.riposteUntil, 'Riposte ready', 'Your next melee blow has +4 to hit. The opening is spent by that blow.');
  if ((p.talents || []).includes('shadow_step')) timed(p.shadowUntil, 'In shadow', 'Your next melee blow can strike from the shadows, even against an awake foe.');
  if (p.mirrors > 0) add('Mirror images', `${Number(p.mirrors)} images remain to mislead attacks. They can be spent by attacks and fade with your shielding.`, p.effects?.ac?.until > G.t ? p.effects.ac.until : null);
  if (p.ward > 0) add('Stored healing ward', `${Number(p.ward)} points of protection remain.`);
  if (p.coating) add(Game.coatingName(p.coating.t) || 'Weapon coating', `${Number(p.coating.left)} landed blows remain. Missing does not spend the coating.`);
  if (p.food === 0) add('Starving', 'You have no food left. Eat from your pack to stop starvation.');
  if (Game.deepward()) add('Deepward', `+${Game.deepward()} armour class from the silver lantern.`);
  const rage = Game.berserkerRage(); if (rage) add('Berserker rage', `+${rage} damage on each blow${p.hp < p.maxHp / 2 ? ', with a quicker swing below half life' : ''}.`);
  if (Game.shaped()) add('Wild Shape', Game.shapeChip(), p.shape?.until || null);
  return rows;
}
export function effectsView() {
  const rows = activeEffects();
  const chips = typeof document === 'undefined' ? [] : [...document.querySelectorAll('#hud-status button[data-guide-tab="effects"][title]')].filter(b => b.getAttribute('title')).map(b => `${b.textContent}: ${b.getAttribute('title')}`);
  return '<h3>Current conditions</h3><p class="dim small">Durations use the delve’s clock. Opening the Journal follows the usual pause rules.</p>'
    + (rows.length ? rows.map(r => section(r.name, `<p>${esc(r.detail)}</p><p class="dim">${esc(r.remaining)}</p>`)).join('') : '<p>No timed effects or conditions are active.</p>')
    + (chips.length ? section('Around you', list([...new Set(chips)])) : '');
}

/** Advice uses only the recorded killing source and the hero's own state. */
export function deathLesson() {
  const G = Game.state();
  if (!G || G.status !== 'dead') return '';
  const killer = Game.lastAttacker(), cause = killer?.cause ? killer.name : '';
  const advice = cause === 'poison' ? 'Cure poison with an antidote or a suitable spell. A healing draught restores life but does not remove poison.'
    : cause === 'hunger' ? 'Keep food for the journey. Eat before food runs out; resting also uses food.'
    : cause === 'bloodstar' ? 'Bloodstar spends life to cast. Leave enough life to survive the next blow.'
    : killer?.encounter ? 'Choices can cost life. Read the offered risk before committing a wounded hero.'
    : killer?.cause ? 'Watch the ground and its warnings. Step clear of rising fire or falling rock before it lands.'
    : killer?.bearing && /left|right|behind/.test(killer.bearing) ? 'Watch the edge chevrons for foes beside or behind you. Turn to face the danger, or move to a doorway to narrow the fight.'
    : 'Watch a foe’s filling warning. Step aside before the blow lands, and use doorways to narrow a crowd.';
  const bad = new Set(['Poisoned', 'Knocked down', 'Stone', 'Snared', 'Frozen', 'Webbed', 'Dazzled', 'Silenced', 'Slowed', 'Grabbed', 'Starving']);
  const conditions = activeEffects().filter(e => bad.has(e.name)).map(e => `${e.name} · ${e.remaining}`);
  return section('For the next delve', `<p>${esc(advice)}</p>${conditions.length ? `<details><summary>Conditions at the fall</summary>${list(conditions)}</details>` : ''}`);
}

export function recapView() {
  const G = Game.state(), p = G.player, s = G.stats, kills = s?.kills || {};
  const bosses = Object.entries(kills).filter(([id, n]) => n > 0 && MONSTERS[id] && (MONSTERS[id].boss || MONSTERS[id].named)).map(([id, n]) => `${MONSTERS[id].name}${n > 1 ? ` ×${n}` : ''}`);
  // Read stored discoveries only; opening a recap must not call a mutating scan.
  const finds = (s?.finds || []).filter(f => typeof f.name === 'string').map(f => `${f.name}${f.depth ? ` · floor ${f.depth}` : ''}`);
  const c = G.companion;
  return section(`${p.name} · ${CLASSES[p.cls].name}`, `<p>Floor ${G.depth}/${Number(G.opts.levels)} · Level ${p.level} · ${G.status === 'won' ? 'Victorious' : G.status === 'dead' ? 'Fallen' : 'Delve in progress'}</p>`)
    + section('Notable finds', list(finds))
    + section('Places visited', list(Object.values(G.levels).map(visitedPlace).filter(Boolean).map(place => `${place.name} · floor ${place.depth}`)))
    + section('Jobs', `<p>${Number(s?.bounties || 0)} completed and paid · ${Number(s?.bountiesLost || 0)} lost${G.bounty?.done ? ' · 1 awaiting payment' : ''}</p>`)
    + section('Companion milestones', c ? `<p>${esc(Game.companionNote())}</p><p class="dim">${Number(c.floors || 0)} floors travelled together · ${Number(c.kills || 0)} foes defeated</p>` : '<p>No companion has joined this delve.</p>')
    + section('Bosses and champions defeated', list(bosses))
    + section('Choices that followed you', list(Game.threadNotes().filter(n => !n.startsWith('A job') && (!c || !n.startsWith(c.name + ',')))));
}

/** Search only the information already disclosed by item inspection. */
export function matchesItem(it, query) {
  const text = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!text.length) return true;
  const b = Game.isKnown(it.t), revealed = b && !it.h;
  const base = ITEMS[it.t], kind = base.kind === 'armor' ? 'armor armour' : base.kind;
  const words = [Game.itemName(it), kind];
  if (revealed && base.desc) words.push(base.desc);
  if (revealed) {
    const r = Game.relicOf(it);
    for (const power of r ? r.powers : [...[].concat(base.power || []), ...(it.pw ? [it.pw] : [])]) if (RELIC_POWERS[power]) words.push(RELIC_POWERS[power]);
    if (it.px && PREFIX_DESC[it.px]) words.push(PREFIX_DESC[it.px]);
  }
  const haystack = words.join(' ').toLocaleLowerCase();
  return text.every(word => haystack.includes(word));
}
