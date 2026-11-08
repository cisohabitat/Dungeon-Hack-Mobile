import { Assets } from './assets.js';
import { heldPlacement, meleePose } from './heldview.js';
import { namedBase, namedId } from './namedart.js';

// Held-item presentation only. Read changing canvas, height and Calm state
// through K; spell/arrival helpers are wired later by the world renderer.
export function makeHeldRenderer(K) {
  const { W, ease } = K;
  // ---------- the hero's hands ----------
  // What the hero holds, drawn at the bottom of the view: the weapon's own
  // picture in a gloved fist at the right, a shield or second blade at the
  // left. It sways at rest, bobs with each step, slashes across on Attack,
  // jolts when a blow lands, and the other hand rises glowing to cast.
  const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  // the hands themselves are drawn smaller than that, so loot on the floor
  // and a monster's feet stay in sight; snapped to quarters so each art pixel
  // lands on whole view pixels in a steady pattern rather than a ragged one
  const handK = () => Math.max(1, Math.round(K.H / 142 * 0.72 * 4) / 4);
  /** Draw a painted frame with its hand (or centre) at view point (x, y). */
  function put(fr, x, y, s = 1, fit = false, width = W, drop = 0) {
    if (!fr) return;
    const { H, ctx } = K;
    const placement = heldPlacement(fr, x, y, handK() * s, width, H, fit);
    placement.y += drop; placement.oy += Math.round(drop);
    const { k, ox, oy } = placement;
    const box = [ox, oy, Math.round(fr.img.width * k), Math.round(fr.img.height * k)];
    ctx.drawImage(fr.img, box[0], box[1], box[2], box[3]);
    handBoxes.push(box);
    return placement;
  }
  // where the hands were drawn this frame, so a test can see they keep clear
  // of the square ahead
  const handBoxes = [];
  // where the hand is in each pose, as a fraction of the view: low, and out
  // toward the corners, so the middle of the floor is left clear
  const POSE_AT = {
    rest: [0.86, 0.93], windup: [0.84, 0.74], cut: [0.64, 0.84], through: [0.5, 0.98],
    fist: [0.85, 0.95], punch: [0.64, 0.83], left: [0.13, 0.95], cast: [0.26, 0.93], shield: [0.08, 0.96], bow: [0.2, 0.86],
  };
  const at = (pose, lift = 0) => [POSE_AT[pose][0] * W, (POSE_AT[pose][1] - lift) * K.H];
  // Visual inertia only: a small settling motion after a completed step.
  // It never feeds the camera, controls or the run's clock, and Calm view resets it.
  const lanternMotion = { walk: 0, steps: -1, time: -1e9, stopped: -1e9, held: false };
  function lanternSettle(v, now, held) {
    const { calm } = K;
    const walk = v.walk || 0;
    if (calm || !held || !lanternMotion.held || now < lanternMotion.time || v.steps < lanternMotion.steps) lanternMotion.stopped = -1e9;
    else if (lanternMotion.walk > 0 && !walk) lanternMotion.stopped = now;
    lanternMotion.walk = walk; lanternMotion.steps = v.steps; lanternMotion.time = now; lanternMotion.held = held;
    const t = (now - lanternMotion.stopped) / 260;
    return !calm && held && !walk && t >= 0 && t < 1 ? Math.sin(t * Math.PI * 2) * Math.exp(-t * 3) * 2 : 0;
  }
  function drawView(fx, now) {
    const { H, ctx, calm, ARRIVE_MS, READ_MS, USE_MS, drawLantern, drawReading, drawUse } = K;
    handBoxes.length = 0;
    const v = fx.view;
    if (!v) return;
    const weaponBase = v.weapon && namedBase(v.weapon);
    const lamp = v.shield === 'wayfarer_lantern', reflected = lamp && v.cls === 'spellblade';
    const settling = lanternSettle(v, now, lamp);
    // a step's bob and a slow sway at rest (held still in a calm view)
    const step = calm ? 0 : Math.sin((v.walk || 0) * Math.PI);
    const bx = calm ? 0 : Math.sin(now / 900) * 1.5 + (v.steps % 2 ? 1 : -1) * step * 3, by = calm ? 0 : Math.abs(step) * 7 + Math.sin(now / 700) * 1.2;
    // a blow landing jolts the hands down (not in a calm view)
    const hurt = !calm && now < fx.damageUntil ? (fx.damageUntil - now) / 260 : 0;
    const jx = hurt ? Math.sin(now / 17) * 4 * hurt : 0, jy = hurt * 9;
    // just come down the stair, the hands come up into the view with it
    const au = (now - (fx.arriveAt == null ? -1e9 : fx.arriveAt)) / ARRIVE_MS, rising = au >= 0 && au < 1 ? (1 - au) * (1 - au) * H * 0.3 : 0;
    const dx = bx + jx, dy = by + jy + rising;
    const u = (now - fx.swingAt) / (fx.swingMs || 300);
    const swinging = u >= 0 && u < 1;
    // the off hand's blow: it draws back a touch, drives in toward the middle
    // (smaller as it goes, reaching into the screen), then comes home. It
    // starts once the main cut has landed, so two blades read as a one-two.
    const ou = (now - fx.offAt) / 380;
    let ox = 0, oy = 0, os = 1, opose = 'left';
    if (ou >= 0 && ou < 1) {
      if (ou < 0.2) { const e = ease(ou / 0.2); ox = -e * W * 0.03; oy = e * H * 0.05; }
      else if (ou < 0.5) { const e = ease((ou - 0.2) / 0.3); ox = W * (-0.03 + e * 0.27); oy = H * (0.05 - e * 0.23); os = 1 - e * 0.2; opose = 'thrust'; }
      else { const e = ease((ou - 0.5) / 0.5); ox = W * 0.24 * (1 - e); oy = -H * 0.18 * (1 - e); os = 0.8 + e * 0.2; opose = e < 0.4 ? 'thrust' : 'left'; }
    }
    // reading: the off hand brings the scroll up, and what it held goes down
    const ru = (now - (fx.readAt ?? -1e9)) / READ_MS;
    const reading = ru >= 0 && ru < 1;
    // drinking or eating: the same off hand brings up the bottle or the bread
    const uu = (now - (fx.useAt ?? -1e9)) / USE_MS;
    const using = uu >= 0 && uu < 1 && !reading;
    const put_down = reading ? Math.min(1, ru * 6, (1 - ru) * 6) * H * 0.45
      : using ? Math.min(1, uu * 6, (1 - uu) * 6) * H * 0.45 : 0;
    // casting: the off hand rises into view, alight, and what it held dips
    const cu = (now - fx.castAt) / 520;
    const cast = cu >= 0 && cu < 1 ? Math.sin(cu * Math.PI) : 0;
    // a Bash: drawn back a touch, driven in toward the middle and away (smaller, reaching into
    // the view) to land a third of the way through, held there a beat, then home
    const bu = (now - (fx.bashAt ?? -1e9)) / BASH_MS, bashing = bu >= 0 && bu < 1 ? fx.bashKind : '';
    const shove = !bashing ? 0 : bu < 0.14 ? -0.2 * ease(bu / 0.14) : bu < 0.33 ? -0.2 + 1.2 * ease((bu - 0.14) / 0.19) : bu < 0.5 ? 1 : 1 - ease((bu - 0.5) / 0.5);
    // the weapon hand's shove, by pommel or fist; the shield's is drawn with the shield
    const jab = bashing && bashing !== 'shield' ? shove : 0;
    const rdx = dx - jab * W * 0.24, rdy0 = dy - jab * H * 0.13;
    // a throw (a snare's cord, a flask of oil): what the weapon hand held goes down out of the
    // way, and the empty hand comes up, cocks back by the ear and snaps forward (see drawThrow)
    const tu = (now - (fx.throwAt ?? -1e9)) / THROW_MS, throwing = tu >= 0 && tu < 1;
    const rdy = rdy0 + (throwing ? Math.min(1, tu * 6, (1 - tu) * 6) * H * 0.5 : 0);

    // left: a shield carried low, or a second blade
    if (v.weapon && v.drawn) {
      // a bow: held out in the left hand, the right on the string; an attack
      // draws the string back to the cheek and looses it
      // A bash shoves the bow; other actions take the drawing hand.
      const aim = !calm && swinging ? u < .8 ? ease(u / .5) : 1 - ease((u - .8) / .2) : 0;
      const [x0, y] = at('bow'), x = x0 + W * .23 * aim - jab * W * .24;
      const by0 = y + (H * .55 - y) * aim - jab * H * .13;
      const loosed = swinging && u >= .72;
      const pull = swinging ? u < .72 ? ease((u - .16) / .34) : 1 - ease((u - .72) / .07) : 0;
      // The left hand raises the bow. The right reaches in from its resting
      // place, catches the string, then draws back towards the right cheek.
      // The string springs home before that hand relaxes to the right again.
      const fr = Assets.held(v.weapon, !calm && pull > .65 ? 'bowfull' : !calm && pull > .15 ? 'bowdraw' : 'rest', v.cls, false);
      const placed = put(fr, x + dx, by0 + dy, 1, true, W, cast * H * .65 + put_down);
      if (fr && placed) {
        const { k, ox, oy } = placed;
        const tip = m => [ox + fr.at[m][0] * k, oy + fr.at[m][1] * k];
        const [tx, ty] = tip('top'), [bx2, by2] = tip('bot');
        const mx = (tx + bx2) / 2, my = (ty + by2) / 2;
        const nx = mx + W * .31 * pull, ny = my + H * .18 * pull;
        const idleX = W * .84 + dx, idleY = H * .95 + dy + cast * H * .65 + put_down;
        let hx = idleX, hy = idleY;
        if (swinging && !loosed) {
          const catchString = ease(u / .16);
          hx += (nx - idleX) * catchString; hy += (ny - idleY) * catchString;
        } else if (loosed) {
          const recoil = 1 + .06 * ease((u - .72) / .08), home = ease((u - .8) / .2);
          hx = mx + W * .31 * recoil; hy = my + H * .18 * recoil;
          hx += (idleX - hx) * home; hy += (idleY - hy) * home;
        }
        ctx.lineCap = 'round';
        const name = namedId(v.weapon), stringColour = name === 'horizon' ? '#d1bde7' : name === 'farstrider' ? '#aeb9c7' : '#e8e0cc';
        for (const [c, w] of [['#0a0810', 3], [stringColour, 1]]) {
          ctx.strokeStyle = c; ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(nx, ny); ctx.lineTo(bx2, by2); ctx.stroke();
        }
        if (!loosed) {
          // The shaft passes over the bow hand. Its point stays beyond that
          // rest as the nock is drawn towards the viewer, never away from it.
          const rx = placed.x - 2 * k, ry = placed.y - 8 * k;
          const ex = rx + (rx - nx) * .16, ey = ry + (ry - ny) * .16;
          const angle = Math.atan2(ey - ny, ex - nx);
          ctx.save(); ctx.translate(nx, ny); ctx.rotate(angle);
          const length = Math.hypot(ex - nx, ey - ny);
          for (const [c, w] of [['#0a0810', 4], ['#b08858', 2]]) {
            ctx.strokeStyle = c; ctx.lineWidth = w;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(length, 0); ctx.stroke();
          }
          ctx.fillStyle = '#d8dce4'; ctx.beginPath(); ctx.moveTo(length + 3, 0); ctx.lineTo(length - 3, -2); ctx.lineTo(length - 3, 2); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#e04838'; ctx.fillRect(1, -3, 6, 2); ctx.fillRect(1, 1, 6, 2);
          ctx.restore();
        }
        if (!cast && !reading && !using && !throwing) put(Assets.held(null, 'fist', v.cls, false), hx, hy + 2.6 * handK());
      }
    } else if (v.shield) {
      // a Bash drives the shield in toward the middle of the view, rim first, and brings it home
      const lantern = v.shield === 'wayfarer_lantern';
      const frame = Assets.carried(v.shield, v.cls);
      // At the minimum hand scale a short view needs more room below the
      // grip. Reserve the cage's base plus a walking bob, keeping the arm low.
      const drop = lantern && frame ? (frame.at.base[1] - frame.ay) * handK() : 0;
      const [x, y] = lantern ? [W * 0.23, Math.min(H * 0.63, H - drop - 10)] : at('shield'), sh = bashing === 'shield' ? shove : 0;
      // Lower the raised grip just as far out of sight when casting or
      // bringing up a scroll or drink, leaving only the acting hand visible.
      const lower = lantern ? Math.max(0, H * 0.63 - y) * Math.max(cast, put_down / (H * 0.45)) : 0;
      const weight = lantern ? by * -0.45 + settling : 0;
      // Actions start from the same fitted grip as rest, so a cast or bash
      // cannot snap the shield back to its old, clipped corner position.
      const base = lantern || !frame ? { x: x + dx, y: y + dy, k: handK() } : heldPlacement(frame, x + dx, y + dy, handK(), W * .42, H, true);
      put(frame, base.x - hurt * 4 + sh * W * 0.3, base.y + weight + cast * H * 0.4 + put_down + lower + hurt * 6 - sh * H * 0.16, base.k / handK() * (1 - sh * 0.14));
    } else if (v.offhand) {
      const [x, y] = at('left');
      put(Assets.held(v.offhand, opose, v.cls, false), x + dx + ox, y + dy + oy, os, true, ou >= 0 && ou < 1 ? W : W * .42, cast * H * .4 + put_down);
    }
    // on a dark floor, a lantern: in the free hand, or hung from the wrist beside the shield
    if (v.lantern) { const [lx, ly] = v.shield || v.offhand || (v.weapon && v.two) ? [W * 0.09, H * 0.8] : at('left'); drawLantern(lx, ly, dx, dy, now); }
    if (reading) drawReading(fx, ru, v.cls, dx, dy);
    if (using) drawUse(fx, uu, v.cls, dx, dy);
    if (cast > 0) {
      const [x, y] = at('cast'), cy = y + (1 - cast) * H * 0.35 + by;
      const g = ctx.createRadialGradient(x + bx, cy - H * 0.06, 0, x + bx, cy - H * 0.06, H * 0.15);
      g.addColorStop(0, (fx.castColor || '#fff').replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3') + 'cc'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x + bx - H * 0.15, cy - H * 0.21, H * 0.3, H * 0.3);
      put(Assets.held(null, 'cast', v.cls, false), x + bx, cy);
    }

    // right: the weapon, through the poses of a swing, or a bare fist
    if (v.weapon && v.drawn) {
      // drawn above, with the left hand
    } else if (weaponBase === 'sling') {
      // overhead: the hand goes up, the pouch whirls round above it twice
      // (seen from below, a tilted ring), and at the top of the second turn
      // the stone is let go; then the arm comes down and the sling hangs again
      const r = at('rest', 0.16), top = [W * 0.76, H * 0.36];
      if (swinging && u < 0.62) {
        const up = ease(Math.min(1, u / 0.12));
        const hx = r[0] + (top[0] - r[0]) * up + rdx, hy = r[1] + (top[1] - r[1]) * up + rdy;
        const a = (u / 0.55) * Math.PI * 4 - Math.PI / 2, R = W * 0.2 * up;
        const px = hx + Math.cos(a) * R, py = hy - H * 0.06 + Math.sin(a) * R * 0.45;
        ctx.lineCap = 'round';
        for (const [col, lw] of [['#2a1a0e', 3.6], ['#a07848', 1.8]]) {
          ctx.strokeStyle = col; ctx.lineWidth = lw;
          ctx.beginPath(); ctx.moveTo(hx, hy - 2); ctx.lineTo(px, py); ctx.stroke();
        }
        ctx.fillStyle = '#2a1a0e'; ctx.beginPath(); ctx.ellipse(px, py, 6.8, 5, a, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#7a5230'; ctx.beginPath(); ctx.ellipse(px, py, 5.6, 3.8, a, 0, Math.PI * 2); ctx.fill();
        if (u < 0.55) { ctx.fillStyle = '#8e8a84'; ctx.beginPath(); ctx.arc(px, py - 1.5, 2.8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#d8d4cc'; ctx.fillRect(Math.round(px - 1.5), Math.round(py - 3), 1, 1); }
        put(Assets.held(null, 'fist', v.cls, false), hx, hy + 6);
      } else {
        let q = r;
        if (swinging) { const e = ease((u - 0.62) / 0.38); q = [top[0] + (r[0] - top[0]) * e, top[1] + (r[1] - top[1]) * e]; }
        // the pouch comes down empty: the next stone is only fitted once the arm is home
        put(Assets.held(v.weapon, swinging ? 'loosed' : 'rest', v.cls, false), q[0] + rdx, q[1] + rdy0, 1, true, W, rdy - rdy0);
      }
    } else if (weaponBase === 'handxbow') {
      // a hand crossbow is not swung: it comes up level with the eye, the
      // trigger lets the bolt go with a kick up the wrist, and it comes down
      const r = at('rest');
      let x = r[0], y = r[1];
      if (swinging) {
        if (u < 0.32) { const e = ease(u / 0.32); x -= W * 0.1 * e; y -= H * 0.12 * e; }
        else if (u < 0.45) { x -= W * 0.1; y -= H * (0.12 + 0.05 * Math.sin((u - 0.32) / 0.13 * Math.PI)); }
        else { const e = ease((u - 0.45) / 0.55); x -= W * 0.1 * (1 - e); y -= H * 0.12 * (1 - e); }
      }
      put(Assets.held(v.weapon, 'rest', v.cls, false), x + rdx, y + rdy0, 1, true, W, rdy - rdy0);
    } else if (weaponBase === 'throwknife') {
      // a throw, not a slash: the hand cocks back up by the ear, snaps forward
      // toward the middle (smaller, reaching into the view) as a knife leaves
      // it, follows through, and comes home
      const r = at('rest');
      let x = r[0], y = r[1], s = 1;
      if (swinging) {
        if (u < 0.3) { const e = ease(u / 0.3); x += W * 0.04 * e; y -= H * 0.22 * e; }
        else if (u < 0.4) { const e = ease((u - 0.3) / 0.1); x += W * (0.04 - 0.3 * e); y -= H * (0.22 - 0.1 * e); s = 1 - 0.18 * e; }
        else { const e = ease((u - 0.4) / 0.6); x -= W * 0.26 * (1 - e); y -= H * 0.12 * (1 - e); s = 0.82 + 0.18 * e; }
      }
      put(Assets.held(swinging && u >= .4 ? null : v.weapon, swinging && u >= .4 ? 'fist' : 'rest', v.cls, false), x + rdx, y + rdy0, s, true, W, rdy - rdy0);
    } else if (v.weapon) {
      // a two-handed grip sits higher so the lower hand shows, the long grip of
      // a two-handed sword higher still; a sling hangs from the hand
      const lift = weaponBase === 'greatsword' ? 0.15 : v.two ? 0.07 : 0;
      // (a Bash with a blade in hand is a jab of the pommel, not a cut: the swing waits)
      const base = weaponBase, shaft = base === 'staff' || base === 'spear';
      let pose = 'rest', p = at('rest', lift), scale = 1;
      if (swinging && !bashing) {
        const motion = meleePose(u, shaft);
        pose = motion.pose; p = [motion.x * W, (motion.y - lift) * H]; scale = motion.scale;
      }
      if (base === 'staff' && cast && !swinging && !bashing) { pose = cast > .3 ? 'channel' : 'rest'; p[0] -= cast * W * .04; p[1] -= cast * H * .03; }
      // the lower hand of a two-handed grip is the one that casts, reads, drinks
      // and eats: it lets go of the grip, or a third hand would bring the bottle up
      const frame = Assets.held(v.weapon, pose, v.cls, v.two && !cast && !reading && !using, reflected);
      const placement = put(frame, p[0] + rdx, p[1] + rdy0, scale, true, W, rdy - rdy0);
      // A small surface glint, never a dungeon light or a change in visibility.
      const name = namedId(v.weapon), gleam = cast && base === 'staff' ? cast : name && swinging && u > .16 && u < .52 ? Math.sin((u - .16) / .36 * Math.PI) : 0;
      if (!calm && gleam && frame?.at.tip && placement) {
        const colour = { bloodstar: '#d96878', thirst: '#bb667b', emberwood: '#efa365', oakheart: '#a4ba7a', heartroot: '#ca9582', ninth_circle: '#a394c8', whisper: '#bec7d8', grimtooth: '#b0be8f' }[name] || (base === 'staff' ? '#9bcef1' : '#e8d3a2');
        const x = placement.ox + frame.at.tip[0] * placement.k, y = placement.oy + frame.at.tip[1] * placement.k;
        ctx.save(); ctx.globalAlpha = gleam * .7; ctx.strokeStyle = colour; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - 2, y); ctx.lineTo(x + 2, y); ctx.moveTo(x, y - 2); ctx.lineTo(x, y + 2); ctx.stroke(); ctx.restore();
      }
    } else {
      const punch = swinging && u < 0.55 && !bashing;
      const p = punch ? lerp(at('fist'), at('punch'), Math.sin(u / 0.55 * Math.PI)) : at('fist');
      put(Assets.held(null, (punch && u > 0.12 && u < 0.43) || jab > 0.5 ? 'punch' : 'fist', v.cls, false), p[0] + rdx, p[1] + rdy);
    }
    if (throwing) drawThrow(tu, v.cls, dx, dy);
  }

  // how long a Bash takes in the view, its shove landing a third of the way in (BASH_LANDS in game.js)
  const BASH_MS = 450;
  // how long a throw takes, the thing let go of at THROW_LET_GO in game.js
  const THROW_MS = 460;
  /**
   * The throwing hand: up from below the view, cocked back by the ear, then
   * snapped forward toward the middle (smaller, reaching in) as what it held
   * leaves it, a follow-through, and down out of sight again.
   */
  function drawThrow(tu, cls, dx, dy) {
    const { H } = K;
    const r = at('fist');
    let x = r[0] + dx, y = r[1] + dy, s = 1, pose = 'fist';
    if (tu < 0.16) { const e = ease(tu / 0.16); y += (1 - e) * H * 0.4; }
    else if (tu < 0.34) { const e = ease((tu - 0.16) / 0.18); x += W * 0.04 * e; y -= H * 0.22 * e; }
    else if (tu < 0.5) { const e = ease((tu - 0.34) / 0.16); x += W * (0.04 - 0.3 * e); y -= H * (0.22 - 0.12 * e); s = 1 - 0.18 * e; pose = e > 0.5 ? 'punch' : 'fist'; }
    else { const e = ease((tu - 0.5) / 0.5); x -= W * 0.26 * (1 - e); y -= H * 0.1 * (1 - e) - e * H * 0.45; s = 0.82 + 0.18 * e; pose = e < 0.3 ? 'punch' : 'fist'; }
    put(Assets.held(null, pose, cls, false), x, y, s);
  }


  return { drawView, put, handBoxes };
}
