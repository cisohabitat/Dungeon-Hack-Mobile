// What the hero's magic and hands do over the view: each spell's own effect between
// the hand and what it hits, reading a scroll, drinking or eating, and a trap going
// off. Drawn on the view's canvas by renderer.js, which lends what it needs through K.
import { Assets } from './assets.js';

/** @param {any} K */
export function makeSpellFx(K) {
  const W = K.W;
  const ease = (/** @type {any[]} */ ...a) => K.ease(...a);
  const put = (/** @type {any[]} */ ...a) => K.put(...a);

  // ---------- spell effects ----------
  // Each spell draws its own effect between the hero's hand and what it
  // hits, instead of only tinting the view: darts that fly, a fan of fire,
  // a jagged bolt, a pillar of light. Particles are placed by a hash of their
  // index, not by chance, so a frame never flickers from randomness alone.
  const hash = n => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  function glow(x, y, r, color, alpha) {
    if (alpha <= 0 || r <= 0) return;
    const g = K.ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${alpha.toFixed(3)})`);
    g.addColorStop(0.35, hexA(color, alpha * 0.9));
    g.addColorStop(1, hexA(color, 0));
    K.ctx.fillStyle = g;
    K.ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function hexA(hex, a) {
    const h = hex.length === 4 ? hex.slice(1).split('').map(c => c + c).join('') : hex.slice(1);
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  }
  // ---------- reading a scroll ----------
  // The off hand brings the scroll up, unrolled. Its writing kindles line by
  // line in the colour of what it does (fire orange, restoration green,
  // mapping blue, teleport violet, remove curse gold), then the page burns
  // away from the top in embers, with a last flourish of its own: a ring of
  // blue light for mapping, a violet wash for teleport, rays for a curse
  // broken. A fire scroll's fire leaves the page as a fireball (see spellFx).
  const READ_MS = 1000;
  function drawReading(fx, ru, cls, dx, dy) {
    const c = fx.readColor || '#fe8';
    const rise = ease(Math.min(1, ru / 0.22));
    const cx = Math.round(W * 0.3 + dx * 0.6), cy = Math.round(K.H * 0.58 + (1 - rise) * K.H * 0.62 + dy * 0.6);
    const w = 46, h = 30, left = cx - w / 2, top = cy - h / 2;
    const burn = clamp01((ru - 0.62) / 0.38);          // how much of the page is gone, top down
    const edge = top + h * burn;
    // the hand under it
    put(Assets.held(null, 'cast', cls, false), cx - 4, top + h + 10);
    // the page, below the burn line
    K.ctx.save();
    // (the top roll shows until the fire reaches it)
    K.ctx.beginPath(); K.ctx.rect(left - 6, burn > 0 ? edge : top - 6, w + 12, h + 12 + (burn > 0 ? 0 : 6)); K.ctx.clip();
    K.ctx.fillStyle = '#2a1c10'; K.ctx.fillRect(left - 1, top - 1, w + 2, h + 2);
    K.ctx.fillStyle = '#e8d8a8'; K.ctx.fillRect(left, top, w, h);
    K.ctx.fillStyle = '#d4c090'; K.ctx.fillRect(left, top + h - 4, w, 4); K.ctx.fillRect(left + w - 3, top, 3, h);
    // rolled ends, top and bottom
    for (const ry of [top - 4, top + h]) {
      K.ctx.fillStyle = '#2a1c10'; K.ctx.fillRect(left - 4, ry - 1, w + 8, 6);
      K.ctx.fillStyle = '#b08850'; K.ctx.fillRect(left - 3, ry, w + 6, 4);
      K.ctx.fillStyle = '#d8b070'; K.ctx.fillRect(left - 3, ry, w + 6, 1);
    }
    // the writing: five lines, lit one after another
    for (let i = 0; i < 5; i++) {
      const ly = top + 5 + i * 5, lit = clamp01((ru - 0.16 - i * 0.07) / 0.08);
      for (let k = 0; k < 6; k++) {
        const len = 3 + Math.floor(hash(i * 7 + k) * 4), lx = left + 4 + k * 7;
        if (lx + len > left + w - 4) break;
        K.ctx.fillStyle = lit > 0.5 ? c : '#5a4028';
        K.ctx.fillRect(lx, ly, len, 2);
      }
    }
    K.ctx.restore();
    K.ctx.save();
    K.ctx.globalCompositeOperation = 'lighter';
    // the writing's glow, strongest just before the page goes up
    const kindle = clamp01((ru - 0.2) / 0.4) * (1 - burn);
    glow(cx, cy, 30 + kindle * 12, c, kindle * 0.55);
    if (burn > 0 && burn < 1) {
      // a ragged burning edge, and embers rising from it
      for (let k = 0; k < w; k += 2) {
        const j = Math.round((hash(k + Math.floor(ru * 40)) - 0.5) * 3);
        K.ctx.fillStyle = k % 4 ? '#ffb040' : '#fff0a0';
        K.ctx.fillRect(left + k, edge + j, 2, 2);
      }
      glow(cx, edge, 26, '#ff9030', 0.6 * (1 - burn * 0.5));
    }
    for (let i = 0; i < 22; i++) {
      const born = 0.62 + hash(i) * 0.3, age = (ru - born) / 0.35;
      if (age <= 0 || age >= 1) continue;
      const ex = left + hash(i + 5) * w + Math.sin(age * 6 + i) * 3, ey = top + h * (born - 0.62) / 0.38 - age * K.H * 0.3;
      glow(ex, ey, 3 + (1 - age) * 3, i % 2 ? c : '#ffd060', 1 - age);
    }
    // the flourish, as the page goes
    const f = clamp01((ru - 0.62) / 0.38);
    if (f > 0) {
      if (fx.readKind === 'map') {
        // a ring of blue light sweeping out across the view
        K.ctx.strokeStyle = hexA(c, (1 - f) * 0.8); K.ctx.lineWidth = 3;
        K.ctx.beginPath(); K.ctx.arc(cx, cy, 10 + f * W * 0.8, 0, Math.PI * 2); K.ctx.stroke();
      } else if (fx.readKind === 'teleport') {
        K.ctx.fillStyle = hexA(c, Math.sin(f * Math.PI) * 0.45); K.ctx.fillRect(0, 0, W, K.H);
      } else if (fx.readKind === 'uncurse') {
        K.ctx.strokeStyle = hexA(c, (1 - f) * 0.7); K.ctx.lineWidth = 2;
        for (let k = 0; k < 10; k++) {
          const a = k / 10 * Math.PI * 2 + f, r0 = 12 + f * 20, r1 = r0 + 18 + f * 40;
          K.ctx.beginPath(); K.ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); K.ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); K.ctx.stroke();
        }
      } else if (fx.readKind === 'heal') {
        for (let k = 0; k < 12; k++) {
          const a = hash(k + 40), up = (f + hash(k + 60) * 0.4) % 1;
          glow(W * (0.15 + a * 0.7), K.H * (1 - up * 0.8), 4, c, (1 - up) * 0.8);
        }
      }
    }
    K.ctx.restore();
  }

  // ---------- traps ----------
  // A dart streaks out of a slot in one wall across at the hero and strikes;
  // a needle springs up out of the flagstone underfoot, beaded with venom; the
  // floor gives way, darkness closes in from above and below as the hero
  // drops, dust rushing up past, then the landing jolts it open again; a gong's
  // note rolls out in bronze rings; a trap spotted and jammed is a gold glint.
  const TRAP_MS = { dart: 420, needle: 650, pit: 900, alarm: 1400, disarm: 700, snare: 900 };
  function drawTrap(fx, now) {
    const k = fx.trapKind;
    if (!k) return;
    const t = (now - fx.trapAt) / (TRAP_MS[k] || 600);
    if (t < 0 || t >= 1) return;
    K.ctx.save();
    if (k === 'dart') {
      // dodged, it flies on across the view and out the other side
      const side = fx.trapSide || 1, dodged = !!fx.trapDodged, u = Math.min(1, t / (dodged ? 0.6 : 0.35));
      const sx = side > 0 ? W + 8 : -8, sy = K.H * 0.5, ex = dodged ? (side > 0 ? -12 : W + 12) : W * 0.5 + side * W * 0.12, ey = dodged ? K.H * 0.72 : K.H * 0.97;
      if (u < 1 || dodged) {
        const x = sx + (ex - sx) * u, y = sy + (ey - sy) * u, len = Math.hypot(ex - sx, ey - sy);
        const ux = (ex - sx) / len, uy = (ey - sy) / len, L = 10 + u * 12;
        K.ctx.strokeStyle = 'rgba(255,255,240,0.3)'; K.ctx.lineWidth = 1;
        K.ctx.beginPath(); K.ctx.moveTo(x - ux * L * 3, y - uy * L * 3); K.ctx.lineTo(x - ux * L, y - uy * L); K.ctx.stroke();
        K.ctx.lineCap = 'round';
        K.ctx.strokeStyle = '#0a0810'; K.ctx.lineWidth = 3.5; K.ctx.beginPath(); K.ctx.moveTo(x - ux * L, y - uy * L); K.ctx.lineTo(x, y); K.ctx.stroke();
        K.ctx.strokeStyle = '#9aa0a8'; K.ctx.lineWidth = 1.6; K.ctx.beginPath(); K.ctx.moveTo(x - ux * L, y - uy * L); K.ctx.lineTo(x, y); K.ctx.stroke();
        K.ctx.fillStyle = '#c83a2a'; K.ctx.fillRect(Math.round(x - ux * L - 1.5), Math.round(y - uy * L - 1.5), 3, 3);
      } else {
        const f = (t - 0.35) / 0.65;
        K.ctx.globalCompositeOperation = 'lighter';
        glow(ex, ey, 6 + f * 14, '#ffd080', (1 - f) * 0.9);
        for (let i = 0; i < 6; i++) { const a = hash(i + 3) * Math.PI * 2, r = f * 16 * (0.5 + hash(i)); K.ctx.fillStyle = hexA('#ffe0a0', 1 - f); K.ctx.fillRect(Math.round(ex + Math.cos(a) * r), Math.round(ey + Math.sin(a) * r), 1, 1); }
      }
    } else if (k === 'snare') {
      // a kobold's wire loop snaps up off the stones and pulls tight across the foot of the view;
      // a quick foot slipped, it closes on nothing and falls slack
      const u = Math.min(1, t / 0.3), cx = W * 0.5, by = K.H + 4;
      const r = W * (0.32 - (fx.trapDodged ? 0.1 : 0.22) * ease(u)), lift = K.H * 0.13 * ease(u) * (fx.trapDodged && t > 0.5 ? 1 - (t - 0.5) * 2 : 1);
      K.ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      if (!fx.trapDodged && u >= 1) { K.ctx.fillStyle = hexA('#c83a2a', 0.14 * (1 - t)); K.ctx.fillRect(0, 0, W, K.H); }
      for (const [c, w] of [['#0a0810', 3.5], ['#d8dce4', 1.4]]) {
        K.ctx.strokeStyle = c; K.ctx.lineWidth = w;
        K.ctx.beginPath(); K.ctx.ellipse(cx, by - lift, Math.max(2, r), Math.max(1, r * 0.35), 0, Math.PI, Math.PI * 2); K.ctx.stroke();
      }
    } else if (k === 'needle') {
      const up = t < 0.2 ? ease(t / 0.2) : t < 0.55 ? 1 : 1 - ease((t - 0.55) / 0.45);
      const bx = W * 0.5, by = K.H + 2, len = K.H * 0.3 * up;
      if (!fx.trapDodged) { K.ctx.fillStyle = hexA('#50c850', Math.sin(t * Math.PI) * 0.16); K.ctx.fillRect(0, 0, W, K.H); }
      K.ctx.lineCap = 'round';
      K.ctx.strokeStyle = '#0a0810'; K.ctx.lineWidth = 3; K.ctx.beginPath(); K.ctx.moveTo(bx, by); K.ctx.lineTo(bx, by - len); K.ctx.stroke();
      K.ctx.strokeStyle = '#c8ccd4'; K.ctx.lineWidth = 1.2; K.ctx.beginPath(); K.ctx.moveTo(bx, by); K.ctx.lineTo(bx, by - len); K.ctx.stroke();
      if (len > 4) {
        K.ctx.globalCompositeOperation = 'lighter';
        glow(bx, by - len, 4, '#60e060', 0.9 * up);
        K.ctx.globalCompositeOperation = 'source-over';
        K.ctx.fillStyle = '#58c850'; K.ctx.beginPath(); K.ctx.arc(bx + 1.5, by - len + 5 + t * 8, 1.6, 0, Math.PI * 2); K.ctx.fill();
      }
    } else if (k === 'pit') {
      const close = t < 0.45 ? ease(t / 0.45) : 1 - ease((t - 0.45) / 0.55);
      const h = K.H * 0.5 * close * 0.94;
      for (const [y0, dir] of [[0, 1], [K.H, -1]]) {
        const g = K.ctx.createLinearGradient(0, y0, 0, y0 + dir * (h + 18));
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(Math.max(0.01, h / (h + 18)), 'rgba(0,0,0,0.97)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        K.ctx.fillStyle = g; K.ctx.fillRect(0, dir > 0 ? 0 : K.H - h - 18, W, h + 18);
      }
      // dust and grit rushing up past as the hero drops
      for (let i = 0; i < 34; i++) {
        const y = K.H - ((t * 2.4 + hash(i)) % 1) * K.H * 1.2, x = hash(i + 50) * W;
        K.ctx.fillStyle = hexA(i % 3 ? '#8a7a60' : '#b0a080', 0.8 * (1 - t));
        K.ctx.fillRect(Math.round(x), Math.round(y), i % 4 ? 1 : 2, i % 4 ? 3 : 4);
      }
    } else if (k === 'alarm') {
      K.ctx.fillStyle = hexA('#e0a040', Math.max(0, 0.14 - t * 0.2)); K.ctx.fillRect(0, 0, W, K.H);
      for (let r = 0; r < 3; r++) {
        const f = t * 1.35 - r * 0.18;
        if (f <= 0 || f >= 1) continue;
        K.ctx.strokeStyle = hexA('#e0a040', (1 - f) * 0.75); K.ctx.lineWidth = 3 - r * 0.6;
        K.ctx.beginPath(); K.ctx.ellipse(W / 2, K.H * 0.42, 12 + f * W * 0.7, (12 + f * W * 0.7) * 0.55, 0, 0, Math.PI * 2); K.ctx.stroke();
      }
    } else if (k === 'disarm') {
      K.ctx.globalCompositeOperation = 'lighter';
      glow(W * 0.5, K.H * 0.94, 5 + 10 * (1 - t), '#ffe080', (1 - t) * 0.85);
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (hash(i + 9) - 0.5) * 2, r = 4 + t * 18; K.ctx.fillStyle = hexA('#fff0b0', 1 - t); K.ctx.fillRect(Math.round(W * 0.5 + Math.cos(a) * r), Math.round(K.H * 0.94 + Math.sin(a) * r), 1, 1); }
    }
    K.ctx.restore();
  }

  // ---------- drinking and eating ----------
  // The bottle (or the bread) the pack shows comes up in the off hand. A
  // draught is tipped back, rising and turning until it is upended over the
  // view, then lowered, and the view takes on the colour of what it does with
  // motes rising through it. Food goes to the mouth for two bites, and crumbs
  // fall.
  const USE_MS = 850;
  function drawUse(fx, uu, cls, dx, dy) {
    const spr = Assets.sprites[fx.useSprite];
    const img = spr && spr.levels && spr.levels[0];
    if (!img) return;
    const c = fx.useColor || '#fff';
    const base = 42 / img.height;                           // about a fifth of the view tall
    const rest = [W * 0.3 + dx * 0.6, K.H * 0.64 + dy * 0.6];
    let x = rest[0], y = rest[1], s = base, rot = 0, hand = true;
    const rise = ease(Math.min(1, uu / 0.22)), low = ease(clamp01((uu - 0.72) / 0.28));
    if (fx.useKind === 'drink') {
      // to the lips, below the bottom of the view: it comes in close (bigger)
      // and turns over until its neck points down at the mouth
      const tip = ease(clamp01((uu - 0.22) / 0.3)) * (1 - low);
      x = rest[0] + (W * 0.47 - rest[0]) * tip;
      y = rest[1] + (1 - rise) * K.H * 0.6 + (K.H * 0.8 - rest[1]) * tip + low * K.H * 0.6;
      s = base * (1 + tip * 1.3);
      rot = tip * 2.7;
    } else if (fx.useKind === 'coat') {
      // over to the weapon hand and tipped on its side above the blade (or the arrows), held there
      // while it runs out onto it
      const tip = ease(clamp01((uu - 0.2) / 0.25)) * (1 - low);
      x = rest[0] + (W * 0.66 - rest[0]) * tip;
      y = rest[1] + (1 - rise) * K.H * 0.6 + (K.H * 0.56 - rest[1]) * tip + low * K.H * 0.6;
      rot = tip * 1.9;
    } else {
      // to the mouth, low in the middle of the view, and two bites
      const lift = ease(clamp01((uu - 0.2) / 0.2)) * (1 - low);
      const bite = uu > 0.4 && uu < 0.72 ? Math.abs(Math.sin((uu - 0.4) / 0.32 * Math.PI * 2)) : 0;
      x = rest[0] + (W * 0.5 - rest[0]) * lift;
      y = rest[1] + (1 - rise) * K.H * 0.6 + (K.H * 0.9 - rest[1]) * lift + bite * 6 + low * K.H * 0.6;
      s = base * (1 + lift * 0.9);
      hand = lift < 0.35;
    }
    // the hand stays on it: under the bottle as it comes up, then round its
    // belly, low and to the left, as it is tipped back
    if (hand) put(Assets.held(null, 'cast', cls, false), x - 3 - (s / base - 1) * 14, y + img.height * s * (0.45 - (s / base - 1) * 0.2));
    K.ctx.save();
    K.ctx.translate(Math.round(x), Math.round(y));
    K.ctx.rotate(rot);
    K.ctx.drawImage(img, Math.round(-img.width * s / 2), Math.round(-img.height * s / 2), Math.round(img.width * s), Math.round(img.height * s));
    K.ctx.restore();
    K.ctx.save();
    K.ctx.globalCompositeOperation = 'lighter';
    if (fx.useKind === 'drink') {
      // it takes: the view washes the draught's colour, and motes rise
      const f = clamp01((uu - 0.45) / 0.55);
      if (f > 0) {
        K.ctx.fillStyle = hexA(c, Math.sin(f * Math.PI) * 0.22); K.ctx.fillRect(0, 0, W, K.H);
        for (let k = 0; k < 14; k++) {
          const up = (f * 1.2 + hash(k + 70) * 0.5) % 1;
          glow(W * (0.1 + hash(k + 90) * 0.8), K.H * (1 - up * 0.85), 3 + hash(k) * 3, c, (1 - up) * (1 - f * 0.6));
        }
      }
    } else if (fx.useKind === 'coat') {
      // it runs from the neck in drops onto what the other hand holds, which takes its colour a moment
      const f = clamp01((uu - 0.42) / 0.36);
      if (f > 0 && f < 1) {
        const nx = x + Math.cos(rot - Math.PI / 2) * img.height * s * 0.5, ny = y + Math.sin(rot - Math.PI / 2) * img.height * s * 0.5;
        K.ctx.globalCompositeOperation = 'source-over';
        for (let k = 0; k < 6; k++) {
          const age = (f * 3 + hash(k + 40)) % 1;
          K.ctx.fillStyle = k % 2 ? c : '#2a1a0a';
          K.ctx.fillRect(Math.round(nx + (hash(k + 7) - 0.5) * 4), Math.round(ny + age * age * K.H * 0.22), 2, 3);
        }
        K.ctx.globalCompositeOperation = 'lighter';
        glow(W * 0.8, K.H * 0.74, 10 + 8 * Math.sin(f * Math.PI), c, 0.45 * Math.sin(f * Math.PI));
      }
    } else if (uu > 0.4 && uu < 0.9) {
      // crumbs, falling from each bite
      K.ctx.globalCompositeOperation = 'source-over';
      for (let k = 0; k < 10; k++) {
        const born = 0.4 + hash(k + 20) * 0.3, age = (uu - born) / 0.25;
        if (age <= 0 || age >= 1) continue;
        K.ctx.fillStyle = k % 2 ? '#c89858' : '#e8c890';
        K.ctx.fillRect(Math.round(W * 0.5 + (hash(k + 3) - 0.5) * 30), Math.round(K.H * 0.85 + age * age * K.H * 0.3), 2, 2);
      }
    }
    K.ctx.restore();
  }

  function drawSpells(fx, now, proj) {
    if (!fx.spells || !fx.spells.length) return;
    K.ctx.save();
    K.ctx.globalCompositeOperation = 'lighter';
    for (const s of fx.spells) {
      if (now >= s.until || now < s.born) continue;
      const hand = s.from ? { x: W * s.from.x, y: K.H * s.from.y, r: K.H * 0.4 } : { x: W * 0.5, y: K.H * 0.95, r: K.H * 0.4 };
      const t = (now - s.born) / (s.until - s.born);
      const fade = 1 - t;
      const pts = s.pts.map(proj).filter(Boolean);
      const aim = pts.length ? pts[pts.length - 1] : (s.ahead ? proj(s.ahead) : null) || { x: W / 2, y: K.H * 0.55, r: K.H * 0.5 };
      const first = pts[0] || aim;
      const c = s.color;
      switch (s.style) {
        case 'missile': {
          // three darts, a beat apart, curving in from either side
          for (let i = 0; i < 3; i++) {
            const u = clamp01((t - i * 0.12) / 0.5);
            if (u <= 0) continue;
            if (u < 1) {
              for (let k = 0; k < 4; k++) {
                const v = Math.max(0, u - k * 0.05);
                const x = hand.x + (first.x - hand.x) * v + (i - 1) * W * 0.12 * Math.sin(Math.PI * v), y = hand.y + (first.y - hand.y) * v;
                glow(x, y, (10 - k * 2) * (1 - v * 0.3), c, 0.95 - k * 0.2);
              }
            } else {
              const b = clamp01((t - i * 0.12 - 0.5) / 0.25);
              glow(first.x + (i - 1) * 4, first.y, 6 + b * first.r * 0.25, c, 1 - b);
            }
          }
          break;
        }
        case 'hands': {
          // a fan of flame from the hand into the square ahead
          for (let i = 0; i < 26; i++) {
            const u = clamp01(t * 1.7 - hash(i) * 0.5);
            if (u <= 0 || u >= 1) continue;
            const spread = (hash(i + 31) - 0.5) * first.r * 0.9 * u;
            const x = hand.x + (first.x - hand.x) * u + spread, y = hand.y + (first.y - hand.y) * u - hash(i + 7) * first.r * 0.2 * u;
            glow(x, y, 4 + u * first.r * 0.12, u < 0.5 ? '#ffd040' : c, (1 - u) * 0.9);
          }
          break;
        }
        case 'pillar': {
          // a column of fire rising out of the floor where the foe stands
          glow(first.x, first.y + first.r * 0.3, first.r * 0.6, '#ff9040', fade * 0.9);
          for (let i = 0; i < 34; i++) {
            const u = (t * 1.6 + hash(i)) % 1;
            const x = first.x + (hash(i + 11) - 0.5) * first.r * 0.55, y = first.y + first.r * 0.35 - u * first.r * 1.4;
            glow(x, y, 5 + (1 - u) * first.r * 0.12, u < 0.35 ? '#fff0a0' : '#ff8030', Math.min(1, fade * 1.3) * (1 - u * 0.8));
          }
          break;
        }
        case 'knife': case 'stone': case 'arrow': {
          // a missile in flight, hand to target: solid, not a glow, and
          // smaller as it goes; a knife spins, a stone arcs, an arrow flies true
          K.ctx.save();
          K.ctx.globalCompositeOperation = 'source-over';
          const arc = s.style === 'arrow' ? 2 : s.style === 'stone' ? 16 : 9;
          const px = (v2 => hand.x + (first.x - hand.x) * v2), py = (v2 => hand.y + (first.y - hand.y) * v2 - Math.sin(v2 * Math.PI) * arc);
          const x = px(t), y = py(t);
          // it stays big enough to follow the whole way, and a knife or stone
          // draws a faint trail behind it: a speck with no wake was lost
          // against the thing it flew at
          const size = 13 * (1 - t) + Math.max(4, first.r * 0.15) * t;
          if (s.style !== 'arrow' && t > 0.02) {
            K.ctx.lineCap = 'round';
            for (let k = 1; k <= 4; k++) {
              const a0 = Math.max(0, t - k * 0.035), a1 = Math.max(0, t - (k - 1) * 0.035);
              K.ctx.strokeStyle = `rgba(255,250,235,${0.34 - k * 0.07})`; K.ctx.lineWidth = Math.max(1, size * 0.28 * (1 - k * 0.18));
              K.ctx.beginPath(); K.ctx.moveTo(px(a0), py(a0)); K.ctx.lineTo(px(a1), py(a1)); K.ctx.stroke();
            }
          }
          if (s.style === 'knife') {
            const a = t * 16;
            const ux = Math.cos(a) * size, uy = Math.sin(a) * size;
            K.ctx.lineCap = 'round';
            K.ctx.strokeStyle = '#0a0810'; K.ctx.lineWidth = 4; K.ctx.beginPath(); K.ctx.moveTo(x - ux * 0.6, y - uy * 0.6); K.ctx.lineTo(x + ux, y + uy); K.ctx.stroke();
            K.ctx.strokeStyle = '#3a2618'; K.ctx.lineWidth = 2; K.ctx.beginPath(); K.ctx.moveTo(x - ux * 0.6, y - uy * 0.6); K.ctx.lineTo(x - ux * 0.1, y - uy * 0.1); K.ctx.stroke();
            K.ctx.strokeStyle = c; K.ctx.lineWidth = 2; K.ctx.beginPath(); K.ctx.moveTo(x - ux * 0.05, y - uy * 0.05); K.ctx.lineTo(x + ux, y + uy); K.ctx.stroke();
            // a glint on the edge as it turns
            if (Math.cos(a * 2) > 0.6) { K.ctx.fillStyle = '#ffffff'; K.ctx.fillRect(Math.round(x + ux * 0.6), Math.round(y + uy * 0.6), 1, 1); }
          } else if (s.style === 'stone') {
            K.ctx.fillStyle = '#0a0810'; K.ctx.beginPath(); K.ctx.arc(x, y, size * 0.42 + 1, 0, Math.PI * 2); K.ctx.fill();
            K.ctx.fillStyle = c; K.ctx.beginPath(); K.ctx.arc(x, y, size * 0.42, 0, Math.PI * 2); K.ctx.fill();
            K.ctx.fillStyle = '#d8d2c8'; K.ctx.fillRect(Math.round(x - size * 0.2), Math.round(y - size * 0.2), 1, 1);
          } else {
            // the arrow points the way it flies, with a streak behind it
            const bx = px(Math.max(0, t - 0.08)), by = py(Math.max(0, t - 0.08)), dl = Math.hypot(x - bx, y - by) || 1;
            const ux = (x - bx) / dl * size * 1.6, uy = (y - by) / dl * size * 1.6;
            K.ctx.strokeStyle = 'rgba(255,255,240,0.25)'; K.ctx.lineWidth = 1; K.ctx.beginPath(); K.ctx.moveTo(x - ux * 2.2, y - uy * 2.2); K.ctx.lineTo(x - ux, y - uy); K.ctx.stroke();
            K.ctx.lineCap = 'round';
            K.ctx.strokeStyle = '#0a0810'; K.ctx.lineWidth = 3; K.ctx.beginPath(); K.ctx.moveTo(x - ux, y - uy); K.ctx.lineTo(x, y); K.ctx.stroke();
            K.ctx.strokeStyle = c; K.ctx.lineWidth = 1.4; K.ctx.beginPath(); K.ctx.moveTo(x - ux, y - uy); K.ctx.lineTo(x, y); K.ctx.stroke();
            K.ctx.fillStyle = '#e04838'; K.ctx.fillRect(Math.round(x - ux - 1), Math.round(y - uy - 1), 2, 2);
            K.ctx.fillStyle = '#d8dce4'; K.ctx.fillRect(Math.round(x - 1), Math.round(y - 1), 2, 2);
          }
          K.ctx.restore();
          break;
        }
        case 'cord': {
          // a snare's cord in flight: two weights turning about each other on the line between
          // them, smaller as they go, and wrapping round what they strike
          K.ctx.save();
          K.ctx.globalCompositeOperation = 'source-over';
          const x = hand.x + (first.x - hand.x) * t, y = hand.y + (first.y - hand.y) * t - Math.sin(t * Math.PI) * 8;
          const rad = 22 * (1 - t) + Math.max(7, first.r * 0.3) * t, a = t * 22;
          const ux = Math.cos(a) * rad, uy = Math.sin(a) * rad * 0.6;
          K.ctx.lineCap = 'round';
          for (const [col, lw] of [['#0a0810', 4], [c, 2]]) {
            K.ctx.strokeStyle = col; K.ctx.lineWidth = lw;
            K.ctx.beginPath(); K.ctx.moveTo(x - ux, y - uy); K.ctx.lineTo(x + ux, y + uy); K.ctx.stroke();
          }
          for (const sgn of [-1, 1]) {
            K.ctx.fillStyle = '#0a0810'; K.ctx.beginPath(); K.ctx.arc(x + sgn * ux, y + sgn * uy, 4.6, 0, Math.PI * 2); K.ctx.fill();
            K.ctx.fillStyle = '#8e8a84'; K.ctx.beginPath(); K.ctx.arc(x + sgn * ux, y + sgn * uy, 3.4, 0, Math.PI * 2); K.ctx.fill();
          }
          K.ctx.restore();
          break;
        }
        case 'flask': {
          // a flask of oil tumbling end over end in a high arc, then smashing: a burst of glass
          // and dark oil where it lands (the spill itself waits for it, see landings)
          K.ctx.save();
          K.ctx.globalCompositeOperation = 'source-over';
          const f = Math.min(1, t / 0.7);
          if (t < 0.7) {
            const x = hand.x + (first.x - hand.x) * f, y = hand.y + (first.y - hand.y) * f - Math.sin(f * Math.PI) * 26;
            const sz = 16 * (1 - f) + Math.max(6, first.r * 0.16) * f;
            K.ctx.translate(x, y); K.ctx.rotate(f * 9);
            K.ctx.fillStyle = '#0a0810'; K.ctx.fillRect(-sz * 0.5 - 1, -sz * 0.4 - 1, sz + 2, sz * 1.1 + 2); K.ctx.fillRect(-sz * 0.2 - 1, -sz * 0.8 - 1, sz * 0.4 + 2, sz * 0.5 + 2);
            K.ctx.fillStyle = c; K.ctx.fillRect(-sz * 0.5, -sz * 0.4, sz, sz * 1.1);
            K.ctx.fillStyle = '#7a5a30'; K.ctx.fillRect(-sz * 0.2, -sz * 0.8, sz * 0.4, sz * 0.5);
            K.ctx.fillStyle = 'rgba(255,240,200,0.7)'; K.ctx.fillRect(-sz * 0.35, -sz * 0.3, Math.max(1, sz * 0.18), sz * 0.6);
          } else {
            const b = (t - 0.7) / 0.3;
            for (let k = 0; k < 14; k++) {
              const ang = -Math.PI * (0.1 + 0.8 * hash(k + 40)), d = (0.3 + hash(k + 60) * 0.7) * first.r * 0.5 * b;
              const px = first.x + Math.cos(ang) * d, py = first.y + first.r * 0.3 - Math.sin(ang) * d * 0.8 + b * b * first.r * 0.3;
              K.ctx.globalAlpha = 1 - b;
              K.ctx.fillStyle = k % 3 ? '#3a2a12' : '#e8e0c8';
              K.ctx.fillRect(Math.round(px), Math.round(py), k % 3 ? 4 : 3, k % 3 ? 4 : 3);
            }
          }
          K.ctx.restore();
          break;
        }
        case 'fireball': {
          // an orb flies, then bursts
          const u = clamp01(t / 0.35);
          if (u < 1) glow(hand.x + (first.x - hand.x) * u, hand.y + (first.y - hand.y) * u, 8 + u * 6, c, 1);
          else {
            const b = clamp01((t - 0.35) / 0.65);
            for (const q of pts.length ? pts : [first]) {
              glow(q.x, q.y, q.r * (0.25 + b * 0.8), '#ff8030', (1 - b) * 0.9);
              glow(q.x, q.y, q.r * (0.1 + b * 0.35), '#ffe080', (1 - b));
            }
          }
          break;
        }
        case 'lightning': {
          // a jagged bolt to the furthest foe, forking to each one it passes
          const seed = Math.floor(now / 45);
          const bolt = (a, b, width, alpha, salt) => {
            K.ctx.beginPath();
            K.ctx.moveTo(a.x, a.y);
            const n = 9;
            for (let k = 1; k < n; k++) {
              const f = k / n;
              const j = (hash(seed * 31 + k * 7 + salt) - 0.5) * W * 0.09 * Math.sin(Math.PI * f);
              K.ctx.lineTo(a.x + (b.x - a.x) * f + j, a.y + (b.y - a.y) * f + j * 0.4);
            }
            K.ctx.lineTo(b.x, b.y);
            K.ctx.lineWidth = width * 3; K.ctx.strokeStyle = hexA(c, alpha * 0.35); K.ctx.stroke();
            K.ctx.lineWidth = width; K.ctx.strokeStyle = `rgba(255,255,240,${alpha.toFixed(3)})`; K.ctx.stroke();
          };
          const a = fade * (0.7 + 0.3 * hash(seed));
          bolt(hand, aim, 2.2, a, 0);
          pts.forEach((q, i) => { glow(q.x, q.y, q.r * 0.3, c, a); if (q !== aim) bolt({ x: q.x, y: q.y - q.r * 0.3 }, q, 1.2, a * 0.8, 50 + i); });
          break;
        }
        case 'cone': {
          // a widening cone of frost to the furthest foe it reaches
          const half = Math.max(aim.r * 0.9, W * 0.18);
          const g = K.ctx.createLinearGradient(hand.x, hand.y, aim.x, aim.y);
          g.addColorStop(0, hexA('#ffffff', fade * 0.55));
          g.addColorStop(1, hexA(c, fade * 0.25));
          K.ctx.fillStyle = g;
          K.ctx.beginPath();
          K.ctx.moveTo(hand.x - 6, hand.y); K.ctx.lineTo(aim.x - half, aim.y - aim.r * 0.3);
          K.ctx.lineTo(aim.x + half, aim.y + aim.r * 0.1); K.ctx.lineTo(hand.x + 6, hand.y);
          K.ctx.closePath(); K.ctx.fill();
          for (let i = 0; i < 24; i++) {
            const u = (t * 1.3 + hash(i)) % 1;
            const side = (hash(i + 5) - 0.5) * 2 * half * u;
            glow(hand.x + (aim.x - hand.x) * u + side, hand.y + (aim.y - hand.y) * u, 2 + u * 3, '#e8fbff', fade);
          }
          break;
        }
        case 'smite': {
          // a shaft of light straight down on the foe
          const bw = Math.max(8, first.r * 0.3) * (1 - t * 0.5);
          const g = K.ctx.createLinearGradient(first.x - bw, 0, first.x + bw, 0);
          g.addColorStop(0, hexA(c, 0)); g.addColorStop(0.5, `rgba(255,255,235,${(fade * 0.9).toFixed(3)})`); g.addColorStop(1, hexA(c, 0));
          K.ctx.fillStyle = g;
          K.ctx.fillRect(first.x - bw, 0, bw * 2, first.y + first.r * 0.35);
          glow(first.x, first.y + first.r * 0.3, first.r * 0.45, c, fade);
          break;
        }
        case 'heal': {
          // green sparks rising through the view
          for (let i = 0; i < 28; i++) {
            const u = clamp01(t * 1.2 - hash(i) * 0.3);
            if (u <= 0 || u >= 1) continue;
            const x = hash(i + 17) * W, y = K.H * (1.02 - u * (0.6 + hash(i + 3) * 0.4));
            glow(x, y, 3 + hash(i + 9) * 4, c, (1 - u) * 0.9);
          }
          break;
        }
        case 'buff': {
          // a ring of light spreading from the hero, and the edges of the view glowing
          const R = Math.max(W, K.H) * (0.1 + t * 0.7);
          K.ctx.lineWidth = 6 * fade + 1;
          K.ctx.strokeStyle = hexA(c, fade * 0.8);
          K.ctx.beginPath(); K.ctx.ellipse(W / 2, K.H * 0.62, R, R * 0.55, 0, 0, Math.PI * 2); K.ctx.stroke();
          const e = K.ctx.createRadialGradient(W / 2, K.H / 2, Math.min(W, K.H) * 0.35, W / 2, K.H / 2, Math.max(W, K.H) * 0.7);
          e.addColorStop(0, hexA(c, 0)); e.addColorStop(1, hexA(c, fade * 0.45));
          K.ctx.fillStyle = e; K.ctx.fillRect(0, 0, W, K.H);
          break;
        }
      }
    }
    K.ctx.restore();
  }

  return { READ_MS, USE_MS, drawReading, drawSpells, drawTrap, drawUse, hash };
}
