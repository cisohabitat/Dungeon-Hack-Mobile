// A small mark where a blow lands, below the face and its warning symbol.
// No pause or camera movement: the fight keeps its own time.
export function drawMeleeImpact(ctx, impact, x, y, radius, calm) {
  const p = impact.progress;
  ctx.save();
  ctx.globalAlpha = (1 - p) * (calm ? 0.65 : 0.95);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const r = radius * (calm ? 0.55 : 0.65 + p * 0.35);
  ctx.beginPath();
  if (calm || impact.kind === 'blunt') {
    ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
  } else {
    ctx.moveTo(x - r * 0.7, y + r * 0.6); ctx.lineTo(x + r * 0.7, y - r * 0.6);
  }
  if (!calm && impact.critical) {
    ctx.moveTo(x - r * 0.6, y - r * 0.65); ctx.lineTo(x + r * 0.6, y + r * 0.65);
  }
  ctx.strokeStyle = '#24170e'; ctx.lineWidth = 5; ctx.stroke();
  ctx.strokeStyle = impact.critical ? '#ffe6a0' : '#eccb8b'; ctx.lineWidth = calm ? 1 : 2; ctx.stroke();
  ctx.restore();
}

// Small, high-contrast signs stay inside the existing warning and its rim.
export function drawTellGlyph(ctx, kind, x, y, size) {
  const cy = y - size * 0.45;
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  if (kind === 'shot') {
    const r = size * 0.24;
    ctx.moveTo(x - r, cy + r); ctx.lineTo(x + r, cy - r);
    ctx.moveTo(x - r * 0.4, cy - r); ctx.lineTo(x + r, cy - r); ctx.lineTo(x + r, cy + r * 0.4);
  } else if (kind === 'magic') {
    const r = size * 0.25;
    ctx.moveTo(x, cy - r); ctx.lineTo(x + r, cy); ctx.lineTo(x, cy + r); ctx.lineTo(x - r, cy); ctx.closePath();
  } else {
    ctx.moveTo(x, cy - size * 0.23); ctx.lineTo(x, cy + size * 0.08);
    ctx.moveTo(x, cy + size * 0.28); ctx.lineTo(x, cy + size * 0.29);
  }
  ctx.strokeStyle = '#1a0a08'; ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = '#fff0cf'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
}

// A short receipt for a blow that never hurt. Side labels retain its bearing,
// while the middle, creature faces and warning marks stay clear.
export function drawDefence(ctx, cue, now, width, height, keepClear, boss, warnings = []) {
  if (!cue || now < cue.at || now >= cue.until) return;
  const block = cue.kind === 'block';
  const label = block ? 'BLOCK' : cue.kind === 'dodge' ? 'DODGED' : 'MISSED YOU';
  const w = 104, h = 22;
  const x = cue.rel === 1 ? width - w - 5 : cue.rel === 3 ? 5 : (width - w) / 2;
  let y = cue.rel === 2 ? height - h - 40 : Math.min(height - h - 5, Math.max(keepClear + (boss ? 38 : 8), height * 0.18));
  // Never cover an attack warning or the rear chevron with its last outcome.
  if (warnings.some(m => m.markSize && x < m.markX + m.markSize && x + w > m.markX - m.markSize && y < m.markY + 3 && y + h > m.markY - m.markSize - 3)) y = height - h - 40;
  y = Math.max(0, y);
  ctx.save();
  ctx.globalAlpha = Math.min(1, (cue.until - now) / 180);
  ctx.fillStyle = 'rgba(8,10,18,0.9)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = block ? '#a9d9ff' : '#e4e4ee'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fillText(label, x + w / 2, y + h / 2);
  ctx.restore();
}

// Calm view keeps urgency through size and brightness, without a flashing edge.
export function drawThreat(ctx, threat, now, calm, width, height) {
  const a = calm ? (threat.tell ? 1 : threat.near ? 0.85 : 0.6)
    : threat.tell ? 0.85 + 0.15 * Math.sin(now / 45) : threat.near ? 0.75 + 0.25 * Math.sin(now / 110) : 0.6;
  const s = threat.tell ? 17 : threat.near ? 14 : 11;
  const x = threat.rel === 1 ? width - 14 : threat.rel === 3 ? 14 : width / 2;
  const y = threat.rel === 2 ? height - 14 : height / 2;
  const angle = threat.rel === 1 ? 0 : threat.rel === 3 ? Math.PI : Math.PI / 2;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha = a;
  ctx.lineJoin = 'round'; ctx.beginPath();
  ctx.moveTo(-s * 0.6, -s); ctx.lineTo(s * 0.5, 0); ctx.lineTo(-s * 0.6, s);
  ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.stroke();
  ctx.lineWidth = 4.5; ctx.strokeStyle = '#ff4030'; ctx.stroke(); ctx.restore();
}
