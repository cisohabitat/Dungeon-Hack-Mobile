// Non-elemental magic: force has facets, thorns have a stem, holy light a
// seal. All marks stay below the face and warning. Calm view keeps fixed
// shapes which only fade; it never sends particles across the view.
export function makeArcaneFx(K) {
  const { hash, hexA, glow, W } = K;
  const clamp = u => Math.max(0, Math.min(1, u));
  const radius = q => Math.max(8, Math.min(28, q.r * 0.16));
  function path(points, colour, width, alpha) {
    const ctx = K.ctx;
    ctx.save(); ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath(); ctx.moveTo(...points[0]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // The fine dark edge survives a white damage flash without a bigger glow.
    ctx.strokeStyle = hexA('#18202c', alpha * 0.65); ctx.lineWidth = width + 1.8; ctx.stroke();
    ctx.strokeStyle = hexA(colour, alpha); ctx.lineWidth = width; ctx.stroke();
    ctx.restore();
  }
  const diamond = (x, y, r, c, a) => path([[x, y - r], [x + r * 0.6, y], [x, y + r], [x - r * 0.6, y], [x, y - r]], c, 1.2, a);

  function missile(hand, q, t, c, hit) {
    const thorn = c === '#8c4', r = radius(q), age = (t - hit) / (1 - hit);
    if (!K.calm && t < hit) {
      const u = clamp(t / hit);
      if (thorn) {
        const pts = [];
        for (let i = 0; i <= 16; i++) {
          const v = i / 16 * u, bend = Math.sin(v * Math.PI) * r;
          const x = hand.x + (q.x - hand.x) * v + bend, y = hand.y + (q.y - hand.y) * v;
          pts.push([x, y]);
          if (i % 3 === 0) path([[x - 3, y + 1], [x, y], [x + 1, y - 4]], '#c0dc78', 1, 0.75);
        }
        path(pts, '#466c30', 3, 0.65); path(pts, c, 1.2, 0.8);
      } else for (let i = 0; i < 3; i++) {
        const v = clamp(u * 1.24 - i * 0.12), x = hand.x + (q.x - hand.x) * v + (i - 1) * W * 0.08 * Math.sin(v * Math.PI);
        const y = hand.y + (q.y - hand.y) * v;
        const tail = Math.max(0, v - 0.12);
        path([[hand.x + (q.x - hand.x) * tail + (i - 1) * W * 0.08 * Math.sin(tail * Math.PI), hand.y + (q.y - hand.y) * tail], [x, y]], c, 2, 0.5);
        glow(x, y, 5, c, 0.45); diamond(x, y, 3, '#e0f4ff', 0.85);
      }
    }
    if (age < 0 || age >= 1) return;
    const fade = (1 - age) ** 1.5, size = r * (K.calm ? 0.3 : 0.3 + age * 0.45);
    if (thorn) {
      for (const side of [-1, 1]) path([[q.x, q.y + size], [q.x + side * size, q.y], [q.x + side * size * 0.4, q.y - size * 0.5]], c, 1.5, fade * 0.7);
    } else {
      diamond(q.x, q.y, size, c, fade * 0.8);
      if (!K.calm) diamond(q.x, q.y, size * 1.5, '#d8efff', fade * 0.35);
    }
  }

  function smite(pts, t, c, hit) {
    const age = (t - hit) / (1 - hit);
    if (age < 0 || age >= 1) return;
    const root = c === '#6b3', fade = (1 - age) ** 1.5;
    for (const q of pts.slice(0, 6)) {
      const r = radius(q), grow = K.calm ? 1 : clamp(age * 6), size = r * (K.calm ? 0.45 : 0.85);
      if (root) {
        for (const side of [-1, 1]) {
          const x = q.x + side * size * 0.7, y = q.y + size;
          path([[x + side * 4, y], [x, y - size * grow], [q.x, y - size * 1.5 * grow]], '#98bc68', K.calm ? 1 : 2, fade * 0.75);
          path([[x, y - size * 0.5 * grow], [x + side * 4, y - size * 0.8 * grow]], c, 1, fade * 0.7);
        }
      } else {
        diamond(q.x, q.y, size * 0.65, c, fade * 0.75);
        for (const side of [-1, 1]) path([[q.x + side * size, q.y - size * 0.8], [q.x + side * size, q.y + size * 0.8]], c, 1, fade * 0.5);
        glow(q.x, q.y, size * 0.6, c, fade * 0.25);
      }
    }
  }

  function heal(t, c) {
    const fade = (1 - t) ** 1.4;
    for (let i = 0; i < (K.calm ? 3 : 12); i++) {
      const x = W * (0.12 + hash(i + 17) * 0.76);
      const y = K.H * (0.84 + hash(i + 9) * 0.1 - (K.calm ? 0 : t * 0.26));
      const r = K.calm ? 2 : 2 + hash(i) * 2;
      path([[x - r, y], [x + r, y]], c, 1.4, fade * 0.65);
      path([[x, y - r], [x, y + r]], c, 1.4, fade * 0.65);
      if (!K.calm) glow(x, y, r * 2, c, fade * 0.18);
    }
  }

  function buff(t, c) {
    const fade = (1 - t) ** 1.4, ctx = K.ctx;
    const r = Math.min(W, K.H) * 0.11, x = W / 2, y = K.H * 0.86;
    if (c === '#c95') {
      // The bear's paw, rather than a second shield or a blessing.
      ctx.fillStyle = hexA(c, fade * 0.55);
      ctx.beginPath(); ctx.ellipse(x, y + r * 0.25, r * 0.45, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + (i - 1.5) * r * 0.35, y - r * 0.3 - (i === 1 || i === 2 ? r * 0.15 : 0), r * 0.13, 0, Math.PI * 2); ctx.fill(); }
    } else if (c === '#ff8') {
      diamond(x, y, r * 0.65, c, fade * 0.65);
      for (const side of [-1, 1]) path([[x + side * r, y], [x + side * r * (K.calm ? 1.5 : 1.5 + t), y]], c, 1.5, fade * 0.55);
    } else {
      path([[x - r, y - r * 0.6], [x, y - r], [x + r, y - r * 0.6], [x + r * 0.7, y + r * 0.3], [x, y + r * 0.7], [x - r * 0.7, y + r * 0.3], [x - r, y - r * 0.6]], c, 1.5, fade * 0.65);
      path([[x, y - r * 0.5], [x, y + r * 0.25]], c, 1, fade * 0.5);
    }
  }

  function swarm(q, t, c, hit) {
    if (t < hit) return;
    const age = (t - hit) / (1 - hit), fade = (1 - age) ** 1.4, r = radius(q);
    for (let i = 0; i < (K.calm ? 5 : 16); i++) {
      const a = hash(i + 40) * Math.PI * 2 + (K.calm ? 0 : age * 2), d = r * (0.3 + hash(i) * 0.6);
      const x = q.x + Math.cos(a) * d, y = q.y + Math.sin(a) * d * 0.5;
      path([[x - 1.5, y - 1], [x, y], [x + 1.5, y - 1]], c, 1, fade * 0.7);
    }
  }
  return { missile, smite, heal, buff, swarm };
}
