// The title's key art: a hero at the head of a stair that falls away through a
// carved arch to the Heart of the Mountain, far below (art/keyart holds the
// brief, the originals and how they were made). One picture for a phone held
// upright and one for a phone held sideways, the same scene framed for where
// the title's own words and buttons fall over it. ui.js draws it behind the
// title every frame, and lends what it needs through K.
//
// It is never quite still: it comes up a little close and settles back as the
// title opens, then drifts, slow as breathing; the Heart pulses, the torch in
// the hero's hand flickers, and embers rise. A calm view holds all of that
// still and shows the picture as it is.
import { $ } from './uikit.js';

/**
 * Where things are in each picture, as fractions of its width and height: the
 * Heart and the torch, for the light lit over them; and the point the picture
 * is held on when the box crops it, between the Heart and the hero's feet.
 */
const ART = {
  portrait: { src: 'img/keyart-portrait.webp', heart: [0.5, 0.285], torch: [0.459, 0.512], focus: [0.5, 0.43] },
  landscape: { src: 'img/keyart-landscape.webp', heart: [0.286, 0.33], torch: [0.266, 0.596], focus: [0.33, 0.5] },
};
/** How close the picture comes as the title opens, and how long it takes to settle. */
const PUSH = 0.05, PUSH_S = 7;
/** How close it sits once settled: enough to drift without an edge showing. */
const REST = 1.035;
/** The drift's reach, as a share of the box, and its periods in seconds. */
const SWAY = 0.007, SWAY_S = 29, BOB_S = 43;

/** Where the Heart sits in an upright box, at most, as a share of its height; and as a share of the room above the title's name. */
const HEART_AT = 0.31, ABOVE_NAME = 0.55;

/** @param {{ calm: () => boolean, nameTop: () => number|null }} K */
export function makeTitleScene(K) {
  const title = { t0: 0, last: 0, embers: /** @type {any[]} */ ([]), state: /** @type {any} */ (null), nameAt: /** @type {number|null} */ (null), nameRead: 0 };
  /** @type {Record<string, {img: HTMLImageElement, ready: boolean}>} */
  const pictures = {};
  function picture(which) {
    if (!pictures[which]) {
      const img = new Image();
      /** @type {{img: HTMLImageElement, ready: boolean}} */
      const p = { img, ready: false };
      pictures[which] = p;
      img.decoding = 'async';
      img.onload = () => { p.ready = true; };
      img.src = ART[which].src;
    }
    return pictures[which];
  }

  function newEmber(w, h, fresh) {
    const near = Math.random() < 0.3;
    return { x: Math.random() * w, y: fresh ? h + 4 : Math.random() * h, vy: -(near ? 18 + Math.random() * 16 : 6 + Math.random() * 8),
      vx: (Math.random() - 0.5) * (near ? 10 : 5), r: near ? 2 : 1, life: fresh ? 0 : Math.random() };
  }

  function renderTitle(now) {
    const c = /** @type {HTMLCanvasElement} */ ($('#title-art'));
    const box = c.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.round(box.width * dpr), ch = Math.round(box.height * dpr);
    if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; title.embers = []; }
    const g = c.getContext('2d');
    const which = box.width / box.height < 1.05 ? 'portrait' : 'landscape';
    const art = ART[which], pic = picture(which);
    // the other framing is fetched too, quietly, for when the phone is turned
    picture(which === 'portrait' ? 'landscape' : 'portrait');
    if (!title.t0) title.t0 = now;
    const still = K.calm();
    if (!pic.ready) { g.fillStyle = '#050408'; g.fillRect(0, 0, cw, ch); title.state = { which, ready: false, still }; return; }
    const iw = pic.img.naturalWidth, ih = pic.img.naturalHeight;
    // Cover the box, held on the focus point: the crop falls on what matters least.
    const base = Math.max(cw / iw, ch / ih);
    // Upright, the title's name covers the middle of the box, and how high it
    // sits varies with the phone (and with the first-time card): the Heart is
    // set in the room above it, and the picture closes in on the Heart. Sideways
    // the name sits to the left, below the Heart, and the picture is held on a
    // point between the Heart and the hero.
    if (now - title.nameRead > 500) { title.nameRead = now; title.nameAt = K.nameTop(); }
    const upright = which === 'portrait';
    const [fx, fy] = upright ? art.heart : art.focus;
    const aimY = upright ? Math.min(HEART_AT, (title.nameAt == null ? 1 : title.nameAt) * ABOVE_NAME) : 0.5;
    const dx0 = Math.min(0, Math.max(cw - iw * base, cw / 2 - fx * iw * base));
    const dy0 = Math.min(0, Math.max(ch - ih * base, ch * aimY - fy * ih * base));
    const px = dx0 + fx * iw * base, py = dy0 + fy * ih * base;
    // the push in as the title opens, then the drift; nearer about the focus point, so it stays put
    const t = (now - title.t0) / 1000;
    const settle = still ? 1 : Math.min(1, t / PUSH_S), eased = 1 - Math.pow(1 - settle, 3);
    const zoom = REST + PUSH * (1 - eased);
    const s = base * zoom, dw = iw * s, dh = ih * s;
    const sx = still ? 0 : Math.sin(now / 1000 * 2 * Math.PI / SWAY_S) * cw * SWAY;
    const sy = still ? 0 : Math.sin(now / 1000 * 2 * Math.PI / BOB_S + 1.3) * ch * SWAY * 0.7;
    const dx = Math.min(0, Math.max(cw - dw, px - fx * dw + sx)), dy = Math.min(0, Math.max(ch - dh, py - fy * dh + sy));
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(pic.img, dx, dy, dw, dh);
    const at = (/** @type {number[]} */ q) => [dx + q[0] * dw, dy + q[1] * dh];
    // the Heart's pulse and the torch's flicker, lit over the picture
    g.save();
    g.globalCompositeOperation = 'lighter';
    const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(now / 1000 * 2.1);
    const [hx, hy] = at(art.heart), hr = dh * 0.11;
    let grd = g.createRadialGradient(hx, hy, 0, hx, hy, hr);
    grd.addColorStop(0, `rgba(255,190,110,${(0.10 + 0.10 * pulse).toFixed(3)})`); grd.addColorStop(1, 'rgba(255,80,30,0)');
    g.fillStyle = grd; g.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);
    const flick = still ? 0.5 : 0.5 + Math.sin(now / 1000 * 13.1) * 0.25 + Math.sin(now / 1000 * 7.7 + 1) * 0.25;
    const [tx, ty] = at(art.torch), tr = dh * 0.045;
    grd = g.createRadialGradient(tx, ty, 0, tx, ty, tr);
    grd.addColorStop(0, `rgba(255,180,90,${(0.10 + 0.14 * flick).toFixed(3)})`); grd.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = grd; g.fillRect(tx - tr, ty - tr, tr * 2, tr * 2);
    g.restore();
    // embers rising through it (none in a calm view)
    const dt = title.last ? Math.min(0.05, (now - title.last) / 1000) : 0;
    title.last = now;
    if (!still) {
      if (!title.embers.length) for (let i = 0; i < 34; i++) title.embers.push(newEmber(cw, ch, false));
      for (const e of title.embers) {
        e.x += e.vx * dt * dpr; e.y += e.vy * dt * dpr;
        e.life += dt * 0.3;
        if (e.y < -4 || e.life > 1) Object.assign(e, newEmber(cw, ch, true));
        const a = Math.sin(Math.min(1, e.life) * Math.PI) * 0.8;
        g.fillStyle = `rgba(255,${150 + Math.floor(e.life * 80)},70,${a.toFixed(2)})`;
        g.fillRect(e.x | 0, e.y | 0, e.r * dpr, e.r * dpr);
      }
    }
    title.state = { which, ready: true, still, zoom, dx, dy, dw, dh, heart: [hx / cw, hy / ch] };
  }

  return {
    renderTitle, title,
    /** Which picture is up and how it lies, for the tests. */
    artState: () => (title.state ? { ...title.state } : null),
  };
}
