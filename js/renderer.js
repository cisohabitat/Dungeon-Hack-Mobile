'use strict';
// First-person raycast renderer with textured walls and billboard sprites.

const Renderer = (() => {
  const W = 320, H = 200;
  const FOV = Math.PI / 3;
  const TAN_HALF = Math.tan(FOV / 2);
  const FOG = 9;
  const T = Dungeon.T;
  const LIGHT_R = 4.5;        // torch radius in tiles
  const LIGHT_MAX = 3.2;       // strongest brightening, in shade levels
  const lightCache = new WeakMap();
  let canvas, ctx, fb, fb32;
  const zbuf = new Float32Array(W);
  const rowLevel = new Uint8Array(H);   // darkness level per floor row
  const rowDist = new Float32Array(H);
  for (let y = H / 2 + 1; y < H; y++) {
    const dist = (H / 2) / (y - H / 2);
    rowDist[y] = dist;
    rowLevel[y] = Math.min(7, Math.round(dist / FOG * 7));
  }
  const shadeStyles = [];
  for (let i = 0; i <= 20; i++) shadeStyles.push(`rgba(0,0,0,${(i / 20).toFixed(2)})`);

  function init(c) {
    canvas = c;
    canvas.width = W; canvas.height = H;
    ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;
    fb = ctx.createImageData(W, H);
    fb32 = new Uint32Array(fb.data.buffer);
  }

  // Textured floor and ceiling: for every screen row below the horizon, walk
  // the world-space line it sees and copy pre-shaded texture pixels.
  function castFloor(tex, px, py, dirX, dirY, planeX, planeY, level, lm) {
    const TX = Assets.TEX;
    const floorT = tex.floor, ceilT = tex.ceil;
    const lw = level.w, lh = level.h;
    const rdx0 = dirX - planeX, rdy0 = dirY - planeY;
    const rdx1 = dirX + planeX, rdy1 = dirY + planeY;
    const half = H / 2;
    for (let y = half + 1; y < H; y++) {
      const level = rowLevel[y];
      const dist = rowDist[y];
      const fl = floorT[level], ce = ceilT[level];
      if (level >= 7 && dist > FOG) {
        const o0 = y * W, oc0 = (H - 1 - y) * W;
        for (let x = 0; x < W; x++) { fb32[o0 + x] = 0xff000000; fb32[oc0 + x] = 0xff000000; }
        continue;
      }
      const stepX = dist * (rdx1 - rdx0) / W, stepY = dist * (rdy1 - rdy0) / W;
      let fx = px + dist * rdx0, fy = py + dist * rdy0;
      let o = y * W, oc = (H - 1 - y) * W;
      for (let x = 0; x < W; x++) {
        const mx = fx | 0, my = fy | 0;
        let lv = level;
        if (mx >= 0 && my >= 0 && mx < lw && my < lh) {
          const boost = lm[my * lw + mx];
          if (boost > 0) lv = Math.max(0, level - Math.round(boost));
        }
        if (lv >= 7) { fb32[o + x] = 0xff000000; fb32[oc + x] = 0xff000000; fx += stepX; fy += stepY; continue; }
        const src = lv === level ? fl : floorT[lv];
        const csrc = lv === level ? ce : ceilT[lv];
        const tx = ((fx * TX) | 0) & (TX - 1), ty = ((fy * TX) | 0) & (TX - 1);
        const ti = ty * TX + tx;
        fb32[o + x] = src[ti];
        fb32[oc + x] = csrc[ti];
        fx += stepX; fy += stepY;
      }
    }
    // horizon rows
    for (let x = 0; x < W; x++) { fb32[half * W + x] = 0xff000000; fb32[(half - 1) * W + x] = 0xff000000; }
    ctx.putImageData(fb, 0, 0);
  }

  function isSolid(t) { return t !== T.FLOOR && t !== T.DOOR_OPEN; }

  // A per-tile brightness field from the level's torches, built once per level.
  function ensureLights(level) {
    const cached = lightCache.get(level);
    if (cached) return cached;
    const lm = new Float32Array(level.w * level.h);
    for (const l of (level.lights || [])) {
      const r = Math.ceil(LIGHT_R);
      for (let y = Math.max(0, l.y - r); y <= Math.min(level.h - 1, l.y + r); y++) {
        for (let x = Math.max(0, l.x - r); x <= Math.min(level.w - 1, l.x + r); x++) {
          const dist = Math.hypot(x - l.x, y - l.y);
          if (dist > LIGHT_R) continue;
          const v = LIGHT_MAX * (1 - dist / LIGHT_R) * (1 - dist / LIGHT_R);
          const i = y * level.w + x;
          if (v > lm[i]) lm[i] = v;
        }
      }
    }
    lightCache.set(level, lm);
    return lm;
  }

  function texFor(tex, tile, x, y) {
    switch (tile) {
      case T.DOOR: return tex.door;
      case T.DOOR_LOCKED: return null; // resolved by caller using locks
      case T.STAIRS_DOWN: return tex.stairsDown;
      case T.STAIRS_UP: return tex.stairsUp;
      case T.FOUNTAIN: return null;
      case T.TORCH: return tex.torch;
      default: return ((x * 7 + y * 13) % 6 === 0) ? tex.wallCracked : tex.wall;
    }
  }

  // sprites: [{x, y, img (sprite asset), scale, yOff, flash}]
  function render(level, cam, sprites, fx, now) {
    const tex = Assets.themes[level.theme];
    const px = cam.x, py = cam.y;
    {
      const hx = px | 0, hy = py | 0;
      if (hx >= 0 && hy >= 0 && hx < level.w && hy < level.h) level.explored[hy * level.w + hx] = 1;
    }
    const dirX = Math.cos(cam.angle), dirY = Math.sin(cam.angle);
    const planeX = -dirY * TAN_HALF, planeY = dirX * TAN_HALF;
    const lm = ensureLights(level);
    castFloor(tex, px, py, dirX, dirY, planeX, planeY, level, lm);
    const w = level.w, h = level.h, tiles = level.tiles, explored = level.explored;
    const getT = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? T.WALL : tiles[y * w + x];

    for (let col = 0; col < W; col++) {
      const camX = 2 * col / W - 1;
      const rdx = dirX + planeX * camX, rdy = dirY + planeY * camX;
      let mapX = Math.floor(px), mapY = Math.floor(py);
      const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx), ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
      let stepX, stepY, sdx, sdy;
      if (rdx < 0) { stepX = -1; sdx = (px - mapX) * ddx; } else { stepX = 1; sdx = (mapX + 1 - px) * ddx; }
      if (rdy < 0) { stepY = -1; sdy = (py - mapY) * ddy; } else { stepY = 1; sdy = (mapY + 1 - py) * ddy; }
      let side = 0, tile = T.WALL, n = 0;
      while (n++ < 64) {
        if (sdx < sdy) { sdx += ddx; mapX += stepX; side = 0; } else { sdy += ddy; mapY += stepY; side = 1; }
        tile = getT(mapX, mapY);
        if (mapX >= 0 && mapY >= 0 && mapX < w && mapY < h) explored[mapY * w + mapX] = 1;
        if (isSolid(tile)) break;
      }
      const dist = side === 0 ? (sdx - ddx) : (sdy - ddy);
      zbuf[col] = dist;
      if (dist > FOG + 1) continue;
      const lineH = Math.floor(H / dist);
      const top = ((H - lineH) / 2) | 0;
      let wallX = side === 0 ? py + dist * rdy : px + dist * rdx;
      wallX -= Math.floor(wallX);
      let tx = Math.floor(wallX * 64);
      if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) tx = 63 - tx;
      let img = texFor(tex, tile, mapX, mapY);
      if (!img) {
        if (tile === T.FOUNTAIN) { const f = level.features && level.features[mapX + ',' + mapY]; img = (f && f.used) ? tex.fountainDry : tex.fountain; }
        else { const c = level.locks[mapX + ',' + mapY]; img = tex.locked[c] || tex.door; }
      }
      ctx.drawImage(img, tx, 0, 1, 64, col, top, 1, lineH);
      let shade = dist / FOG + (side === 1 ? 0.12 : 0);
      // torchlight falling on this wall face brightens it
      const lightHere = lm[mapY * w + mapX];
      if (lightHere > 0 || tile === T.TORCH) shade -= (tile === T.TORCH ? LIGHT_MAX : lightHere) / 7;
      if (shade > 0.03) {
        ctx.fillStyle = shadeStyles[Math.min(20, Math.round(shade * 20))];
        ctx.fillRect(col, top, 1, lineH);
      }
    }

    // sprites
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    const list = [];
    for (const s of sprites) {
      const sx = s.x - px, sy = s.y - py;
      const tY = invDet * (-planeY * sx + planeX * sy);
      if (tY <= 0.15 || tY > FOG + 0.5) continue;
      const tX = invDet * (dirY * sx - dirX * sy);
      list.push({ s, tX, tY });
    }
    list.sort((a, b) => b.tY - a.tY);
    for (const { s, tX, tY } of list) {
      const screenX = (W / 2) * (1 + tX / tY);
      const hFull = H / tY;
      const sh = hFull * s.scale;
      const sw = sh;
      const floorY = H / 2 + hFull / 2;
      const top = floorY - sh - (s.yOff || 0) * hFull;
      const left = screenX - sw / 2;
      const x0 = Math.max(0, Math.floor(left)), x1 = Math.min(W, Math.ceil(left + sw));
      if (x1 <= x0) continue;
      let shadeIdx = Math.min(Assets.SHADES.length - 1, Math.floor(tY / FOG * Assets.SHADES.length));
      const sLm = (s.x | 0) >= 0 && (s.y | 0) >= 0 && (s.x | 0) < w && (s.y | 0) < h ? lm[(s.y | 0) * w + (s.x | 0)] : 0;
      if (sLm > 0) shadeIdx = Math.max(0, shadeIdx - Math.round(sLm / 7 * Assets.SHADES.length));
      const img = (s.flash && now < s.flash) ? s.img.flash : s.img.levels[shadeIdx];
      let run = -1;
      for (let x = x0; x <= x1; x++) {
        const vis = x < x1 && tY < zbuf[x];
        if (vis && run < 0) run = x;
        if (!vis && run >= 0) {
          const tw = img.width, th = img.height;   // sprites are not all one size
          const u0 = (run - left) / sw * tw, u1 = (x - left) / sw * tw;
          ctx.drawImage(img, u0, 0, Math.max(0.01, u1 - u0), th, run, top, x - run, sh);
          run = -1;
        }
      }
      if (s.hp != null && s.hp < s.maxHp && top > 6) {
        const bw = Math.max(10, Math.floor(sw * 0.5)), bx = Math.floor(screenX - bw / 2), by = Math.floor(top) - 5;
        ctx.fillStyle = '#000';
        ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
        ctx.fillStyle = '#5a1a1a';
        ctx.fillRect(bx, by, bw, 2);
        ctx.fillStyle = '#e04030';
        ctx.fillRect(bx, by, Math.max(1, Math.round(bw * s.hp / s.maxHp)), 2);
      }
    }

    // floating texts
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    for (const t of fx.texts) {
      const sx = t.x - px, sy = t.y - py;
      const tY = invDet * (-planeY * sx + planeX * sy);
      if (tY <= 0.15) continue;
      const tX = invDet * (dirY * sx - dirX * sy);
      const screenX = (W / 2) * (1 + tX / tY);
      const hFull = H / tY;
      const age = (now - t.born) / (t.until - t.born);
      const y = H / 2 - hFull * 0.4 - age * 18;
      ctx.globalAlpha = Math.max(0, 1 - age);
      ctx.fillStyle = '#000';
      ctx.fillText(t.text, screenX + 1, y + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, screenX, y);
      ctx.globalAlpha = 1;
    }

    // effects
    if (now < fx.swingUntil) {
      const p = 1 - (fx.swingUntil - now) / 160;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(W * 0.62, H * 0.95, 70, Math.PI * (1.15 + p * 0.3), Math.PI * (1.3 + p * 0.3));
      ctx.stroke();
    }
    if (now < fx.castUntil) {
      const a = (fx.castUntil - now) / 260;
      ctx.fillStyle = fx.castColor;
      ctx.globalAlpha = a * 0.45;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (now < fx.damageUntil) {
      const a = (fx.damageUntil - now) / 260;
      ctx.fillStyle = 'rgba(200,0,0,1)';
      ctx.globalAlpha = a * 0.5;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (now < fx.healUntil) {
      const a = (fx.healUntil - now) / 260;
      ctx.fillStyle = 'rgba(80,220,120,1)';
      ctx.globalAlpha = a * 0.35;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  return { init, render, W, H, FOG };
})();
