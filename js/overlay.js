// What lies over the whole view rather than in it: the rim that shows what ails or aids the
// hero, the lich's or a champion's life along the top, the dark of the stair lifting on a new
// floor, the light of a level gained, blood on the glass after a hard blow, and the Heart
// lifted at the end. Drawn on the view's canvas by renderer.js, which lends what it needs
// through K: the size and the canvas are read live, since the view's height follows its box.
import { Assets } from './assets.js';

/** @param {any} K */
export function makeOverlay(K) {
  const W = K.W;
  const hash = (/** @type {number} */ n) => K.hash(n);
  const ease = (/** @type {number} */ u) => K.ease(u);
  const artK = () => K.artK();

  /** The lich's life along the top of the view, marked where its fight turns; or a named champion's, in gold. */
  function drawBossBar(b, now) {
    if (!b) return;
    // in its third act the torches are out: the hall goes dark round the edges
    if (b.phase >= 2) rim(4, 2, 10, 0.72, 0.12);
    // along the top left, clear of the minimap in the corner
    const bx = 8, bw = Math.round(W * 0.6), by = 16, bh = 5;
    K.ctx.save();
    K.ctx.font = 'bold 9px monospace'; K.ctx.textAlign = 'left'; K.ctx.lineJoin = 'round';
    K.ctx.lineWidth = 3; K.ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    const label = b.rite ? `${b.name.toUpperCase()}: THE RITE` : b.name.toUpperCase();
    // a long name (a shade's, say) drawn smaller rather than into the minimap
    if (K.ctx.measureText(label).width > bw) K.ctx.font = 'bold 7px monospace';
    K.ctx.strokeText(label, bx, by - 4);
    K.ctx.fillStyle = b.rite ? (Math.sin(now / 90) > 0 ? '#ff80ff' : '#c080ff') : b.named ? '#ffe0a0' : '#d8c8ff';
    K.ctx.fillText(label, bx, by - 4);
    // how far its rite has gone: strike it before this fills
    if (b.rite) {
      K.ctx.fillStyle = '#000'; K.ctx.fillRect(bx - 1, by + bh + 2, bw + 2, 4);
      K.ctx.fillStyle = '#ff60f0'; K.ctx.fillRect(bx, by + bh + 3, Math.round(bw * b.riteDone), 2);
    }
    K.ctx.fillStyle = '#000'; K.ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    K.ctx.fillStyle = b.named ? '#30200c' : '#2a1030'; K.ctx.fillRect(bx, by, bw, bh);
    const f = Math.max(0, b.hp / b.maxHp);
    K.ctx.fillStyle = b.named ? '#d89a30' : b.phase >= 2 ? '#c02040' : b.phase === 1 ? '#a03cc0' : '#7a5ad8';
    K.ctx.fillRect(bx, by, Math.round(bw * f), bh);
    K.ctx.fillStyle = 'rgba(255,255,255,0.25)'; K.ctx.fillRect(bx, by, Math.round(bw * f), 1);
    // notches where its fight turns
    K.ctx.fillStyle = '#000';
    for (const n of b.notches || [1 / 3, 2 / 3]) K.ctx.fillRect(bx + Math.round(bw * n), by, 1, bh);
    K.ctx.restore();
  }

  // Come onto a new floor, the view rises out of the dark of the stair: black at
  // first, lifting quickly and then slowly, like eyes getting used to the light.
  const ARRIVE_MS = 700;
  let arrivingN = 0, levellingN = 0;
  function drawArrival(fx, now) {
    arrivingN = 0;
    const u = (now - (fx.arriveAt == null ? -1e9 : fx.arriveAt)) / ARRIVE_MS;
    if (u < 0 || u >= 1) return;
    arrivingN = 1;
    K.ctx.fillStyle = `rgba(0,0,0,${(0.95 * (1 - u) * (1 - u)).toFixed(3)})`;
    K.ctx.fillRect(0, 0, W, K.H);
  }
  // A level gained: shafts of golden light rise through the view from below,
  // motes climbing in them, and fade; held still in a K.calm view, only fading.
  const LEVEL_MS = 1300;
  function drawLevelUp(fx, now) {
    levellingN = 0;
    const u = (now - (fx.levelAt == null ? -1e9 : fx.levelAt)) / LEVEL_MS;
    if (u < 0 || u >= 1) return;
    levellingN = 1;
    const fade = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85, rise = K.calm ? 1 : Math.min(1, u * 2.2);
    K.ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const x = Math.round(W * (i + 0.5) / 9 + (K.calm ? 0 : Math.sin(now / 300 + i) * 3)), bw = Math.max(3, Math.round(W / 22));
      const top = Math.round(K.H - K.H * rise * (0.55 + 0.4 * hash(i * 3.3)));
      const g = K.ctx.createLinearGradient(0, top, 0, K.H);
      g.addColorStop(0, 'rgba(255,220,120,0)'); g.addColorStop(1, `rgba(255,200,90,${(0.32 * fade).toFixed(3)})`);
      K.ctx.fillStyle = g;
      K.ctx.fillRect(x - (bw >> 1), top, bw, K.H - top);
    }
    for (let i = 0; i < 24; i++) {
      const ph = K.calm ? hash(i * 2.1) : (u * 1.4 + hash(i * 2.1)) % 1;
      const x = Math.round(W * hash(i * 5.3)), y = Math.round(K.H - ph * K.H * 0.9);
      K.ctx.fillStyle = `rgba(255,236,160,${((1 - ph) * fade).toFixed(3)})`;
      K.ctx.fillRect(x, y, 2, 2);
    }
    K.ctx.globalCompositeOperation = 'source-over';
  }

  /** Blood on the view after a hard blow: a splash at the edge, flecks flung
   * round it, a thin run down from it; it all fades. Pixel squares, like the rest. */
  function drawDrops(drops, now) {
    if (!drops || !drops.length) return;
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      const u = (now - d.born) / d.life;
      if (u < 0 || u >= 1) continue;
      const x = Math.round(d.x * W), y = Math.round(d.y * K.H), r = Math.max(2, Math.round(d.r * K.H));
      const run = Math.round(Math.min(1, u * 1.4) * r * 3);
      K.ctx.globalAlpha = u < 0.6 ? 0.8 : 0.8 * (1 - (u - 0.6) / 0.4);
      K.ctx.fillStyle = '#5a0306';
      K.ctx.fillRect(x - r, y - (r >> 1), r * 2, r);
      K.ctx.fillRect(x - (r >> 1), y - r, r, r * 2);
      K.ctx.fillRect(x - 1, y, 2, r + run);
      for (let k = 0; k < 5; k++) {
        const a = hash(d.born + k) * Math.PI * 2, dd = r * (1.4 + hash(d.born + k + 7) * 1.6);
        K.ctx.fillRect(Math.round(x + Math.cos(a) * dd), Math.round(y + Math.sin(a) * dd), 2, 2);
      }
      K.ctx.fillStyle = '#9a1418';
      K.ctx.fillRect(x - (r >> 1), y - (r >> 1), Math.max(1, r >> 1), Math.max(1, r >> 1));
    }
    K.ctx.globalAlpha = 1;
  }
  /** An edge glow in one colour, strongest at the rim, for what ails or aids the hero. */
  function rim(r, g, b, a, inner = 0.34) {
    const grad = K.ctx.createRadialGradient(W / 2, K.H / 2, Math.min(W, K.H) * inner, W / 2, K.H / 2, Math.max(W, K.H) * 0.66);
    grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},${a.toFixed(3)})`);
    K.ctx.fillStyle = grad;
    K.ctx.fillRect(0, 0, W, K.H);
  }
  // A web across the corners, and frost that creeps in from them: fixed
  // strands, placed by hash so they hold still from frame to frame.
  function corners(color, width, n, reach, jag) {
    K.ctx.save();
    K.ctx.strokeStyle = color; K.ctx.lineWidth = width; K.ctx.lineCap = 'round';
    for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, K.H, 1, -1], [W, K.H, -1, -1]]) {
      for (let i = 0; i < n; i++) {
        const a = (i + 0.5) / n * Math.PI / 2, len = reach * (0.6 + hash(i * 7 + cx + cy) * 0.5);
        K.ctx.beginPath(); K.ctx.moveTo(cx, cy);
        let x = cx, y = cy;
        for (let k = 1; k <= 4; k++) {
          const j = jag ? (hash(i * 13 + k + cx) - 0.5) * jag : 0;
          x = cx + sx * Math.cos(a + j) * len * k / 4; y = cy + sy * Math.sin(a + j) * len * k / 4;
          K.ctx.lineTo(x, y);
        }
        K.ctx.stroke();
      }
      if (!jag) {
        // the web's rings, strung between its spokes
        for (let ring = 1; ring <= 3; ring++) {
          K.ctx.beginPath();
          for (let i = 0; i < n; i++) {
            const a = (i + 0.5) / n * Math.PI / 2, rr = reach * ring / 4 * (0.8 + hash(i + ring * 3) * 0.2);
            const x = cx + sx * Math.cos(a) * rr, y = cy + sy * Math.sin(a) * rr;
            if (i === 0) K.ctx.moveTo(x, y); else K.ctx.lineTo(x, y);
          }
          K.ctx.stroke();
        }
      }
    }
    K.ctx.restore();
  }
  function drawStatus(st, now) {
    if (!st) return;
    const slow = 0.5 + 0.5 * Math.sin(now / 600);
    if (st.poison) rim(70, 170, 40, 0.22 + 0.14 * slow);
    if (st.burning) {
      // standing in fire: a hot rim, and flames licking up the foot of the view
      const flick = K.calm ? 0.5 : 0.5 + 0.5 * Math.sin(now / 70);
      rim(255, 110, 30, 0.3 + 0.15 * flick, 0.3);
      const n = 11, w = W / n;
      for (let i = 0; i < n; i++) {
        const h = K.H * (0.08 + 0.07 * hash(i * 7 + 1) + (K.calm ? 0 : 0.035 * Math.sin(now / (90 + hash(i) * 60) + i * 2)));
        const x0 = i * w, cx = x0 + w / 2 + (K.calm ? 0 : Math.sin(now / 130 + i) * w * 0.15);
        K.ctx.fillStyle = i % 2 ? 'rgba(232,110,30,0.85)' : 'rgba(250,170,60,0.8)';
        K.ctx.beginPath(); K.ctx.moveTo(x0 - w * 0.2, K.H); K.ctx.quadraticCurveTo(cx - w * 0.3, K.H - h * 0.5, cx, K.H - h); K.ctx.quadraticCurveTo(cx + w * 0.3, K.H - h * 0.5, x0 + w * 1.2, K.H); K.ctx.fill();
      }
    }
    if (st.starving) rim(20, 14, 10, 0.4, 0.3);
    if (st.grabbed) rim(70, 50, 30, 0.35);
    if (st.might) rim(230, 110, 40, 0.14 + 0.06 * slow, 0.42);
    if (st.ac) {
      // a thin shimmer running round the rim of the shield
      rim(90, 150, 255, 0.2 + 0.08 * Math.sin(now / 250), 0.4);
    }
    if (st.hit) {
      // motes of gold rising up the sides
      rim(255, 210, 90, 0.1, 0.44);
      K.ctx.fillStyle = '#ffe89a';
      for (let i = 0; i < 14; i++) {
        const side = i % 2, speed = 0.25 + hash(i) * 0.2, phase = (now / 1000 * speed + hash(i + 20)) % 1;
        const x = side ? W - 6 - hash(i + 3) * 26 : 6 + hash(i + 3) * 26, y = K.H * (1 - phase);
        K.ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.9;
        K.ctx.fillRect(Math.round(x), Math.round(y), 3, 3);
      }
      K.ctx.globalAlpha = 1;
    }
    if (st.held) {
      rim(170, 220, 255, 0.35, 0.3);
      corners('rgba(220,240,255,0.55)', 1, 5, Math.min(W, K.H) * 0.3, 0.5);
    }
    if (st.webbed) corners('rgba(220,220,210,0.5)', 1, 5, Math.min(W, K.H) * 0.34, 0);
    if (st.dazzled) {
      // a moth's flare still in the eyes: a pale bloom over the middle of the view, breathing
      const g = K.ctx.createRadialGradient(W / 2, K.H * 0.45, 0, W / 2, K.H * 0.45, Math.max(W, K.H) * 0.55);
      g.addColorStop(0, `rgba(255,252,235,${0.38 + 0.06 * Math.sin(now / 300)})`);
      g.addColorStop(1, 'rgba(255,252,235,0)');
      K.ctx.fillStyle = g; K.ctx.fillRect(0, 0, W, K.H);
    }
  }

  /** The Heart lifted: it rises in the hero's hands and its light swells from
   * it, motes streaming up, until the light is all there is. */
  function drawFinale(t, cls) {
    const u = Math.min(1, t / 2400), e = ease(u);
    const cx = W / 2, cy = K.H * (0.95 - 0.4 * e);
    K.ctx.save();
    K.ctx.globalCompositeOperation = 'lighter';
    const r = Math.max(W, K.H) * (0.18 + 1.2 * u * u);
    const g = K.ctx.createRadialGradient(cx, cy - K.H * 0.05, 0, cx, cy - K.H * 0.05, r);
    g.addColorStop(0, `rgba(255,244,215,${(0.5 + 0.4 * u).toFixed(3)})`);
    g.addColorStop(0.35, `rgba(255,190,110,${(0.2 + 0.5 * u).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,150,60,0)');
    K.ctx.fillStyle = g;
    K.ctx.fillRect(0, 0, W, K.H);
    // motes streaming up out of it, faster as the light grows
    K.ctx.fillStyle = '#fff0c0';
    for (let i = 0; i < 40; i++) {
      const sp = 0.35 + hash(i) * 0.6, ph = (t / 1000 * sp * (1 + u) + hash(i + 50)) % 1;
      const x = cx + (hash(i + 7) - 0.5) * W * (0.3 + ph * 0.9), y = cy - ph * K.H * 1.1;
      K.ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9;
      K.ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
    K.ctx.restore();
    // two open hands raise it, over its own light so they stay seen: the
    // casting hand, and the same turned about
    const palm = cls ? Assets.held(null, 'cast', cls, false) : null;
    if (palm) {
      const k = artK(), w = palm.img.width * k, h = palm.img.height * k;
      const hy = Math.round(cy + K.H * 0.2 - palm.ay * k);
      K.ctx.drawImage(palm.img, Math.round(cx - W * 0.1 - palm.ax * k), hy, Math.round(w), Math.round(h));
      K.ctx.save(); K.ctx.translate(Math.round(cx + W * 0.1), 0); K.ctx.scale(-1, 1);
      K.ctx.drawImage(palm.img, Math.round(-palm.ax * k), hy, Math.round(w), Math.round(h));
      K.ctx.restore();
    }
    const art = Assets.sprites.artifact;
    if (art) {
      const size = K.H * (0.3 + 0.12 * e);
      K.ctx.drawImage(art.levels[0], Math.round(cx - size / 2), Math.round(cy - size * 0.6), Math.round(size), Math.round(size));
    }
    // and at the last it is all light
    if (u > 0.62) {
      K.ctx.fillStyle = `rgba(255,246,226,${Math.min(1, (u - 0.62) / 0.33).toFixed(3)})`;
      K.ctx.fillRect(0, 0, W, K.H);
    }
  }

  return { ARRIVE_MS, drawArrival, drawBossBar, drawDrops, drawFinale, drawLevelUp, drawStatus, rim,
    get arriving() { return arrivingN; }, get levelling() { return levellingN; } };
}
