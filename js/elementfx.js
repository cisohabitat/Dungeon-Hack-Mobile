import { paintedImpact } from './paintedworld.js';
// Elemental impacts stay close to their targets. Paths are fixed by their
// index, so a bolt never strobes between unrelated shapes from frame to frame.
export function makeElementFx(K) {
  const hash = K.hash, hexA = K.hexA, glow = K.glow;
  const clamp = n => Math.max(0, Math.min(1, n));
  const radius = q => Math.max(12, Math.min(54, q.r * 0.26));
  const targets = pts => pts.slice(0, 6);

  function painted(ctx, family, q, age) {
    if (K.calm || age < 0 || age >= 1) return false;
    const i = age < .135 ? 0 : age < .4 ? 1 : age < .7 ? 2 : 3;
    const image = paintedImpact(family, i);
    if (!image) return false;
    // Painted bursts use the same bounded target radius as their fallback.
    // A nearby target must not turn a torso impact into a full-view flare.
    const size = radius(q) * (family === 'fire' ? 1.6 : 1.4) * 256 / 216;
    ctx.save(); ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = (1 - age) ** (family === 'fire' ? 2 : 1.6);
    ctx.drawImage(image, q.x - size / 2, q.y - size / 2, size, size); ctx.restore();
    return true;
  }
  function fireImpact(q, age) {
    if (age < 0 || age >= 1) return;
    if (painted(K.ctx, 'fire', q, age)) return;
    const ctx = K.ctx, calm = K.calm, r = radius(q), fade = (1 - age) ** 2;
    const size = r * (calm ? 0.38 : 0.48 + age * 0.32);
    ctx.save(); ctx.globalCompositeOperation = 'source-over';
    const heat = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, size);
    const strength = fade * (calm ? 0.3 : 0.75);
    heat.addColorStop(0, hexA('#ffe0a0', strength));
    heat.addColorStop(0.3, hexA('#ff8c28', strength));
    heat.addColorStop(1, hexA('#ff7828', 0));
    ctx.fillStyle = heat; ctx.fillRect(q.x - size, q.y - size, size * 2, size * 2);
    if (!calm) for (let i = 0; i < 9; i++) {
      const x = q.x + (hash(i + 70) - 0.5) * r * (0.45 + age * 0.7);
      const y = q.y + (hash(i + 90) - 0.5) * r * 0.35 - age * r * (0.3 + hash(i + 100) * 0.35);
      ctx.fillStyle = hexA(i % 3 ? '#ff9838' : '#ffe0a0', fade * 0.85);
      ctx.fillRect(Math.round(x), Math.round(y), 2, i % 3 ? 2 : 3);
    }
    ctx.restore();
  }

  function pillar(pts, t, hit) {
    const age = (t - hit) / (1 - hit);
    for (const q of targets(pts)) {
      if (!K.calm && age >= 0) {
        const r = radius(q), fade = (1 - age) ** 2;
        for (let i = 0; i < 9; i++) {
          const u = clamp(age * 1.3 + hash(i + 4) * 0.3);
          glow(q.x + (hash(i + 11) - 0.5) * r * 0.65, q.y + r * 0.4 - u * r,
            3 + r * 0.13 * (1 - u), '#ff9838', fade * 0.45);
        }
      }
      fireImpact(q, age);
    }
  }

  function fireball(hand, pts, t, hit) {
    const q = pts[0], u = clamp(t / hit);
    if (!K.calm && t < hit) {
      for (let i = 0; i < 3; i++) {
        const v = Math.max(0, u - i * 0.07);
        glow(hand.x + (q.x - hand.x) * v, hand.y + (q.y - hand.y) * v, 8 - i * 2, '#ff9838', 0.7 - i * 0.18);
      }
    }
    for (const p of targets(pts)) fireImpact(p, (t - hit) / (1 - hit));
  }

  function cold(hand, pts, aim, t, hit) {
    const ctx = K.ctx, age = (t - hit) / (1 - hit);
    if (!K.calm && t < hit) {
      const u = clamp(t / hit), r = radius(aim);
      for (let i = 0; i < 8; i++) {
        const v = Math.max(0, u - hash(i + 4) * 0.25);
        glow(hand.x + (aim.x - hand.x) * v + (hash(i + 8) - 0.5) * r * v,
          hand.y + (aim.y - hand.y) * v, 2 + v * 2, '#b8edff', (1 - v * 0.5) * 0.45);
      }
    }
    if (age < 0 || age >= 1) return;
    const fade = (1 - age) ** 1.6;
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'round';
    for (const q of targets(pts)) {
      if (painted(ctx, 'frost', q, age)) continue;
      const r = radius(q), size = r * (K.calm ? 0.25 : 0.25 + age * 0.45);
      const frost = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, size * 1.5);
      frost.addColorStop(0, hexA('#78c8ef', fade * (K.calm ? 0.25 : 0.5)));
      frost.addColorStop(1, hexA('#78c8ef', 0));
      ctx.fillStyle = frost; ctx.fillRect(q.x - size * 1.5, q.y - size * 1.5, size * 3, size * 3);
      ctx.beginPath();
      for (let i = 0; i < (K.calm ? 4 : 7); i++) {
        const a = i * Math.PI * 2 / (K.calm ? 4 : 7) + 0.2;
        const x = q.x + Math.cos(a) * size, y = q.y + Math.sin(a) * size + (K.calm ? 0 : age * r * 0.12);
        ctx.moveTo(x - 2, y + 3); ctx.lineTo(x, y - 4); ctx.lineTo(x + 2, y + 2);
      }
      // The dark edge keeps the shards visible over a creature's white hit flash.
      ctx.strokeStyle = hexA('#20546c', fade * (K.calm ? 0.3 : 0.65)); ctx.lineWidth = K.calm ? 2 : 3; ctx.stroke();
      ctx.strokeStyle = hexA('#d6f3ff', fade * (K.calm ? 0.45 : 0.85)); ctx.lineWidth = 1.2; ctx.stroke();
    }
    ctx.restore();
  }

  function lightning(hand, pts, aim, t, hit) {
    const ctx = K.ctx, age = (t - hit) / (1 - hit);
    if (age >= 1) return;
    const fade = age < 0 ? 0.22 : (1 - age) ** 1.4;
    const bolt = (a, b, width, salt, progress = 1) => {
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      for (let i = 1; i <= 8; i++) {
        const u = i / 8 * progress;
        const bend = (hash(i * 7 + salt) - 0.5) * 16 * Math.sin(u * Math.PI);
        ctx.lineTo(a.x + (b.x - a.x) * u + bend, a.y + (b.y - a.y) * u);
      }
      ctx.strokeStyle = hexA('#748be8', fade * 0.4); ctx.lineWidth = width * 3; ctx.stroke();
      ctx.strokeStyle = hexA('#dce8ff', fade * 0.9); ctx.lineWidth = width; ctx.stroke();
    };
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.lineJoin = 'round';
    if (!K.calm) bolt(hand, aim, 1.5, 0, age < 0 ? clamp(t / hit) : 1);
    if (age >= 0) for (const [i, q] of targets(pts).entries()) {
      const r = Math.min(18, radius(q) * (K.calm ? 0.22 : 0.4));
      if (!K.calm) bolt({ x: q.x + r, y: q.y - r }, q, 1, 50 + i);
      // A small angular mark holds still in Calm view; no moving arc or flicker.
      ctx.beginPath(); ctx.moveTo(q.x - r * 0.2, q.y - r * 0.6);
      ctx.lineTo(q.x + r * 0.2, q.y - r * 0.1); ctx.lineTo(q.x - r * 0.2, q.y + r * 0.1); ctx.lineTo(q.x + r * 0.2, q.y + r * 0.6);
      ctx.strokeStyle = hexA('#b8ccff', fade * (K.calm ? 0.45 : 0.85)); ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.restore();
  }

  return { fireImpact, pillar, fireball, cold, lightning };
}
