'use strict';
// First-person raycast renderer with textured walls and billboard sprites.

const Renderer = (() => {
  const W = 320, H = 200;
  const FOV = Math.PI / 3;
  const TAN_HALF = Math.tan(FOV / 2);
  const FOG = 9;
  const T = Dungeon.T;
  let canvas, ctx;
  const zbuf = new Float32Array(W);
  const shadeStyles = [];
  for (let i = 0; i <= 20; i++) shadeStyles.push(`rgba(0,0,0,${(i / 20).toFixed(2)})`);
  const gradCache = {};

  function init(c) {
    canvas = c;
    canvas.width = W; canvas.height = H;
    ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;
  }

  function gradients(theme, ti) {
    if (gradCache[ti]) return gradCache[ti];
    const ceil = ctx.createLinearGradient(0, 0, 0, H / 2);
    ceil.addColorStop(0, theme.ceil);
    ceil.addColorStop(1, '#000');
    const floor = ctx.createLinearGradient(0, H / 2, 0, H);
    floor.addColorStop(0, '#000');
    floor.addColorStop(0.15, '#050505');
    floor.addColorStop(1, theme.floor);
    return (gradCache[ti] = { ceil, floor });
  }

  function isSolid(t) { return t !== T.FLOOR && t !== T.DOOR_OPEN; }

  function texFor(tex, tile, x, y) {
    switch (tile) {
      case T.DOOR: return tex.door;
      case T.DOOR_LOCKED: return null; // resolved by caller using locks
      case T.STAIRS_DOWN: return tex.stairsDown;
      case T.STAIRS_UP: return tex.stairsUp;
      default: return ((x * 7 + y * 13) % 6 === 0) ? tex.wallCracked : tex.wall;
    }
  }

  // sprites: [{x, y, img (sprite asset), scale, yOff, flash}]
  function render(level, cam, sprites, fx, now) {
    const tex = Assets.themes[level.theme];
    const theme = tex.theme;
    const g = gradients(theme, level.theme);
    ctx.fillStyle = g.ceil; ctx.fillRect(0, 0, W, H / 2);
    ctx.fillStyle = g.floor; ctx.fillRect(0, H / 2, W, H / 2);

    const px = cam.x, py = cam.y;
    const dirX = Math.cos(cam.angle), dirY = Math.sin(cam.angle);
    const planeX = -dirY * TAN_HALF, planeY = dirX * TAN_HALF;
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
      if (!img) { const c = level.locks[mapX + ',' + mapY]; img = tex.locked[c] || tex.door; }
      ctx.drawImage(img, tx, 0, 1, 64, col, top, 1, lineH);
      let shade = dist / FOG + (side === 1 ? 0.12 : 0);
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
      const shadeIdx = Math.min(Assets.SHADES.length - 1, Math.floor(tY / FOG * Assets.SHADES.length));
      const img = (s.flash && now < s.flash) ? s.img.flash : s.img.levels[shadeIdx];
      let run = -1;
      for (let x = x0; x <= x1; x++) {
        const vis = x < x1 && tY < zbuf[x];
        if (vis && run < 0) run = x;
        if (!vis && run >= 0) {
          const u0 = (run - left) / sw * 16, u1 = (x - left) / sw * 16;
          ctx.drawImage(img, u0, 0, Math.max(0.01, u1 - u0), 16, run, top, x - run, sh);
          run = -1;
        }
      }
      s._screen = { x: screenX, top, h: sh };
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
