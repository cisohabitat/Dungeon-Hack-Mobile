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
