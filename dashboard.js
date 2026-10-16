'use strict';
// The README's balance table, read as it stands, so the bot's side never goes stale.
const CLASSES = ['Cleric', 'Fighter', 'Mage', 'Thief', 'Ranger', 'Druid'];
const ROWS = [
  { label: 'Easy', key: '8|easy' }, { label: 'Normal', key: '8|normal' }, { label: 'Hard', key: '8|hard' },
  { label: 'Long Delve (12 floors), Normal', key: '12|normal' }, { label: 'Long Delve (12 floors), Hard', key: '12|hard' },
  { label: 'Long Delve (16 floors), Normal', key: '16|normal' }, { label: 'Long Delve (16 floors), Hard', key: '16|hard' },
  { label: 'Quick delve (2 floors), Normal', key: '2|normal' },
  { label: 'Hard+1', key: '8|hard+1' },
  { label: 'Hard+2', key: '8|hard+2' },
  { label: 'Hard+3', key: '8|hard+3' },
  { label: 'Hard+4', key: '8|hard+4' },
  { label: 'Hard+5', key: '8|hard+5' },
];
const MIN_RUNS = 20;
const el = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };

async function botTable() {
  const out = {};
  try {
    const md = await (await fetch('/README.md')).text();
    for (const line of md.split('\n')) {
      const cells = line.split('|').map(s => s.trim()).filter((s, i, a) => i > 0 && i < a.length - 1);
      const row = ROWS.find(r => r.label === cells[0]);
      if (row && cells.length >= 7) CLASSES.forEach((c, i) => { out[row.key + '|' + c.toLowerCase()] = parseFloat(cells[i + 1]); });
    }
  } catch { /* the bot's side stays empty */ }
  return out;
}

async function main() {
  const [bot, stats] = await Promise.all([botTable(), fetch('/api/stats').then(r => r.json()).catch(() => ({ error: 'unreachable' }))]);
  const state = document.getElementById('state');
  if (stats.error) state.textContent = 'The store could not be reached.';
  else if (!stats.ready) state.textContent = 'No store is set up yet, so these are the bot’s figures alone (see ROADMAP.md, Phase 0).';
  else state.textContent = `${Object.values(stats.runs).reduce((a, b) => a + b, 0)} runs reported.`;
  const runs = stats.runs || {}, wins = stats.wins || {};
  const t = document.getElementById('rates');
  const head = el('tr'); head.append(el('th', 'Delve'), ...CLASSES.map(c => el('th', c))); t.append(head);
  for (const r of ROWS) {
    const tr = el('tr'); tr.append(el('td', r.label));
    for (const c of CLASSES) {
      const k = r.key + '|' + c.toLowerCase(), n = runs[k] || 0, b = bot[k];
      const td = el('td');
      const real = n >= MIN_RUNS ? Math.round((wins[k] || 0) / n * 1000) / 10 : null;
      const top = el('span', real == null ? (n ? `${n} runs` : '–') : `${real}%`, real == null || b == null ? '' : real < b - 10 ? 'low' : real > b + 10 ? 'high' : '');
      td.append(top, el('span', b == null ? '' : `bot ${b}%`, 'bot'));
      tr.append(td);
    }
    t.append(tr);
  }
  // how many wins made at least one named combination (the aim is 60% or more), and the commonest
  const allWins = Object.values(wins).reduce((a, b) => a + b, 0), comboWins = Object.values(stats.comboWins || {}).reduce((a, b) => a + b, 0);
  const most = Object.entries(stats.combos || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => `${id.replace(/_/g, ' ')} ${n}`);
  document.getElementById('builds').textContent = allWins
    ? `Wins that made a named combination: ${Math.round(comboWins / allWins * 1000) / 10}% of ${allWins}.${most.length ? ` Most made: ${most.join(' · ')}.` : ''}`
    : 'No wins reported yet.';
  // and how many wins carried out every page of the crews' (the aim is 40% or more)
  const pageWins = Object.values(stats.pageWins || {}).reduce((a, b) => a + b, 0);
  document.getElementById('journal').textContent = allWins ? `Wins that carried out every page: ${Math.round(pageWins / allWins * 1000) / 10}% of ${allWins}.` : 'No wins reported yet.';
  // and how the wins ended: carried up, put out, or kept
  const ends = stats.endings || {}, endsAll = ['take', 'quench', 'keep'].reduce((a, k) => a + (ends[k] || 0), 0);
  document.getElementById('endings').textContent = endsAll ? [['take', 'Carried up'], ['quench', 'Put out'], ['keep', 'Kept']].map(([k, l]) => `${l}: ${Math.round((ends[k] || 0) / endsAll * 1000) / 10}%`).join(' · ') + ` of ${endsAll}.` : 'No endings reported yet.';
  const f = stats.fps || {}, total = [0, 1, 2, 3].reduce((a, i) => a + (f[i] || 0), 0);
  document.getElementById('fps').textContent = total
    ? ['50 or more', '30 to 50', '20 to 30', 'under 20'].map((l, i) => `${l} fps: ${Math.round((f[i] || 0) / total * 1000) / 10}%`).join(' · ')
    : 'No frames reported yet.';
  const ct = document.getElementById('crashes');
  const ch = el('tr'); ch.append(el('th', 'Build and crash signature'), el('th', 'Times')); ct.append(ch);
  for (const [m, n] of stats.crashes || []) { const tr = el('tr'); tr.append(el('td', m), el('td', String(n))); ct.append(tr); }
  if (!(stats.crashes || []).length) { const tr = el('tr'); tr.append(el('td', 'None reported.'), el('td', '')); ct.append(tr); }
}
main();
