// Visual poses only. The rules own swing duration, release and spell impact.
const ease = u => u * u * (3 - 2 * u);
/** @type {[number, string, number, number][]} */
const CUT = [
  [0, 'rest', .86, .93], [.08, 'drawback', .85, .84], [.16, 'windup', .84, .74],
  [.24, 'strike', .75, .78], [.32, 'cut', .64, .84], [.42, 'sweep', .57, .91],
  [.52, 'through', .5, .98], [.68, 'recover', .67, 1.02], [.84, 'return', .81, .98], [1, 'rest', .86, .93],
];
/** Cached intermediate angles keep the hand and object together through recovery. */
export function meleePose(u, shaft = false) {
  if (shaft) {
    const drive = u < .2 ? -ease(u / .2) * .15 : u < .42 ? -.15 + 1.15 * ease((u - .2) / .22) : 1 - ease((u - .42) / .58);
    return { pose: drive > .35 ? 'drive' : 'rest', x: .86 - drive * .14, y: .93 - drive * .13, scale: 1 - Math.max(0, drive) * .12 };
  }
  const i = CUT.findIndex(p => p[0] > u), b = CUT[i < 0 ? CUT.length - 1 : Math.max(1, i)], a = CUT[Math.max(0, (i < 0 ? CUT.length - 1 : Math.max(1, i)) - 1)];
  const t = ease(Math.max(0, Math.min(1, (u - a[0]) / (b[0] - a[0]))));
  return { pose: String(t < .5 ? a[1] : b[1]), x: a[2] + (b[2] - a[2]) * t,
    y: a[3] + (b[3] - a[3]) * t, scale: 1 };
}

/** Fit the object, retaining its hand anchor and allowing the sleeve off-screen. */
export function heldPlacement(fr, x, y, k, width, height, fit) {
  const lo = fr.at.min, hi = fr.at.max;
  if (fit && lo && hi) {
    k = Math.min(k, (width - 8) / (hi[0] - lo[0]), (height - 8) / (hi[1] - lo[1]));
    x = Math.max(4 - (lo[0] - fr.ax) * k, Math.min(x, width - 4 - (hi[0] - fr.ax) * k));
    y = Math.max(4 - (lo[1] - fr.ay) * k, Math.min(y, height - 4 - (hi[1] - fr.ay) * k));
  }
  return { x, y, k, ox: Math.round(x - fr.ax * k), oy: Math.round(y - fr.ay * k) };
}
