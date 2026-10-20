// Shared, read-only item inspection. Unknown qualities never enter comparisons.
import { Assets } from './assets.js';
import { ITEMS } from './data.js';
import { Game } from './game.js';
import { escapeHtml } from './uikit.js';

const signed = n => n < 0 ? `−${-n}` : `+${n}`;
const dice = d => `${d[0]}d${d[1]}${d[2] ? signed(d[2]) : ''}`;
const known = it => !it || (!it.h && Game.isKnown(it.t));
const gradeOf = it => Game.grade(it);

/** @param {any} it @param {any} [options] */
export function itemPicture(it, options = {}) {
  const sprite = options.sprite || Game.spriteFor(it), art = Assets.sprites[sprite];
  const revealed = options.revealed ?? (!!Game.relicOf(it) && known(it));
  return `<img ${revealed ? `data-relic-portrait="${escapeHtml(it.u)}"` : ''} src="${escapeHtml(art?.url || '')}" alt="">`;
}
/** @param {any} it @param {any} [options] */
export function itemHeading(it, options = {}) {
  const grade = options.grade || gradeOf(it), name = options.name || Game.itemName(it);
  return `${options.newFind ? '<p class="treasure-new">New find</p>' : ''}<h3 ${options.titleId ? `id="${escapeHtml(options.titleId)}" tabindex="-1"` : ''} class="g-${grade}${Game.relicOf(it) && (options.revealed || known(it)) ? ' relic' : ''}">${escapeHtml(name)}</h3>${grade !== 'plain' ? `<p class="grade-word g-${grade}">${Game.GRADES[grade]}</p>` : ''}`;
}
/** @param {any} it @param {any} [options] */
export function itemHeader(it, options = {}) {
  const grade = options.grade || gradeOf(it);
  return `<div class="item-showcase item-inspection g-${grade}">${itemPicture(it, options)}<div>${itemHeading(it, options)}</div></div>`;
}

// These are item contributions, not a second copy of the hero's combat formula.
function values(it) {
  if (!it) return {};
  const b = ITEMS[it.t], e = it.e || 0, stats = {};
  if (b.kind === 'weapon') {
    stats['Damage dice'] = dice([b.dmg[0], b.dmg[1], b.dmg[2] + e]);
    stats['Weapon hit bonus'] = signed(e + (it.px === 'true' ? 1 : 0));
  }
  if (['armor', 'shield', 'cloak'].includes(b.kind)) stats['Item armour'] = signed((b.ac || 0) + (b.focus ? 0 : e + (it.px === 'sturdy' ? 1 : 0)));
  if (b.bonus) {
    const labels = { protect: 'Item armour', might: 'Hit and damage bonus', evasion: 'Saving throw bonus', seer: 'Detection bonus' };
    const label = labels[[].concat(b.power)[0]];
    if (label) stats[label] = signed(b.bonus + e);
  }
  return stats;
}
/** Numeric item stats for an already revealed codex entry or known item. */
export function itemFacts(it, revealed = known(it)) {
  if (!revealed) return '<p class="item-facts dim">Identify this item to compare its bonuses.</p>';
  const stats = values(it);
  return Object.keys(stats).length ? `<p class="item-facts">${Object.entries(stats).map(([label, value]) => `${escapeHtml(label)} ${escapeHtml(value)}`).join(' · ')}</p>` : '';
}
/** Side-effect-free current → selected values, shared by bag, trader and codex. */
export function itemComparison(it, slot = '') {
  if (!Game.state() || Game.state().status !== 'playing' || !known(it)) return '';
  const b = ITEMS[it.t], p = Game.player();
  if (!['weapon', 'armor', 'shield', 'ring', 'amulet', 'cloak'].includes(b.kind)) return '';
  slot = slot || (b.kind === 'ring' ? (!p.eq.ring ? 'ring' : !p.eq.ring2 ? 'ring2' : p.eq.ring?.curse ? 'ring2' : 'ring') : b.kind);
  const current = p.eq[slot];
  if (current === it) return '';
  if (!known(current)) return '<p class="item-facts dim">Identify the worn item before comparing its bonuses.</p>';
  const before = !current && slot === 'weapon' ? { 'Damage dice': '1d2', 'Weapon hit bonus': '+0' } : values(current), after = values(it);
  const rows = [...new Set([...Object.keys(before), ...Object.keys(after)])].map(label => [label, before[label] ?? '—', after[label] ?? '—']);
  if (slot === 'weapon' && !Game.canEquip(it)) rows.push(['Damage/sec estimate', Game.blowRate(current).toFixed(1), Game.blowRate(it).toFixed(1)]);
  if (!rows.length) return '';
  return `<div class="item-compare"><p class="dim small">Item stats · current → selected</p><table aria-label="Equipment comparison"><thead><tr><th scope="col">Stat</th><th scope="col">Current</th><th scope="col">Selected</th></tr></thead><tbody>${rows.map(([label, a, z]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(a)}</td><td>${escapeHtml(z)}</td></tr>`).join('')}</tbody></table><p class="dim small">Class effects and item powers are described separately.</p></div>`;
}

/** Why an item cannot be offered for this equipment slot. Does not equip it. */
export function slotReason(it, slot) {
  const p = Game.player(), b = ITEMS[it.t];
  if (slot === 'left') {
    if (b.kind === 'weapon') return slotReason(it, 'offhand');
    return b.kind === 'shield' ? slotReason(it, 'shield') : 'That is not held in the left hand.';
  }
  if (b.kind !== (slot === 'ring2' ? 'ring' : slot === 'offhand' ? 'weapon' : slot)) return 'That belongs in another slot.';
  const why = Game.canEquip(it) || (slot === 'offhand' && Game.offhandReason(it));
  if (why) return why;
  const held = [p.eq[slot], ...(slot === 'offhand' ? [p.eq.shield] : slot === 'weapon' && b.twoHanded ? [p.eq.shield, p.eq.offhand] : [])];
  if (held.some(x => x && x.curse && !x.h)) return 'A cursed item holds this slot.';
  if (p.inv.length >= Game.INV_MAX && ((slot === 'offhand' && p.eq.shield) || (slot === 'weapon' && b.twoHanded && (p.eq.shield || p.eq.offhand)))) return 'There is no room to stow the other hand.';
  return null;
}

/** Both hands as an explicit loadout preview; no temporary equip calls. */
export function handComparison(it, target = '') {
  if (!Game.state() || !known(it)) return '';
  const b = ITEMS[it.t], p = Game.player();
  if (!['weapon', 'shield'].includes(b.kind)) return '';
  const name = x => x ? Game.itemName({ ...x, q: 1 }) : 'Empty';
  const before = [name(p.eq.weapon), p.eq.weapon && ITEMS[p.eq.weapon.t].twoHanded ? 'Two-handed grip' : name(p.eq.offhand || p.eq.shield)];
  const plans = b.kind === 'shield' ? [{ label: 'Use shield / focus', slot: 'shield', right: p.eq.weapon, left: it }]
    : [{ label: b.twoHanded ? 'Use both hands' : 'Use right hand', slot: 'weapon', right: it, left: b.twoHanded ? null : p.eq.offhand || p.eq.shield },
      ...(!b.twoHanded && (!target || target === 'offhand') ? [{ label: 'Use left hand', slot: 'offhand', right: p.eq.weapon, left: it }] : [])];
  return '<div class="hand-compare"><h4>Both hands</h4>' + plans.filter(plan => !target || target === plan.slot).map(plan => {
    const why = slotReason(it, plan.slot), after = [name(plan.right), name(plan.left)];
    const stowed = plan.slot === 'offhand' ? p.eq.shield : b.twoHanded ? p.eq.offhand || p.eq.shield : null;
    return `<section><h4>${plan.label}</h4><dl><dt>Right hand</dt><dd>${escapeHtml(before[0])} → ${escapeHtml(after[0])}</dd><dt>Left hand</dt><dd>${escapeHtml(before[1])} → ${b.twoHanded ? 'Two-handed grip' : escapeHtml(after[1])}</dd></dl>`
      + (stowed ? `<p class="dim small">${escapeHtml(name(stowed))} goes into your pack.</p>` : '')
      + (why ? `<p class="bad small">${escapeHtml(why)}</p>` : plan.slot === 'offhand' ? '<p class="dim small">Your normal off-hand penalties apply; the shield comes off.</p>' : '') + '</section>';
  }).join('') + '</div>';
}
