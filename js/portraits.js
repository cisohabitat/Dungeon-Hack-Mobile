import { HERO_LOOKS } from './heroart.js';

// The same face follows a hero from the class picker to the last page.
// Keep its old painting until the new one arrives, including on a slow connection.
/** @param {string} cls @param {() => any} fallback @param {boolean} fallen */
export function makePortrait(cls, fallback, fallen = false) {
  const sprite = fallback();
  if (typeof Image === 'undefined') return sprite;
  const backup = sprite.url, path = `img/portraits/${fallen ? 'fallen/' : ''}${cls}.webp`;
  let url = fallen ? backup : path;
  Object.defineProperty(sprite, 'url', { get: () => url, configurable: true });
  const image = new Image();
  // A share request waits briefly for this portrait, then uses its skull
  // fallback if the connection is stalled. Late loads still update the canvas.
  let settled;
  sprite.ready = new Promise(resolve => { settled = resolve; });
  const timer = setTimeout(() => settled(), 1500);
  const ready = () => { clearTimeout(timer); settled(); };
  image.decoding = 'async';
  image.onload = () => {
    // Keep the canvas itself: a share card may already hold a reference to it.
    const face = sprite.levels[0];
    face.width = image.naturalWidth; face.height = image.naturalHeight;
    const g = face.getContext('2d');
    g.imageSmoothingEnabled = true; g.drawImage(image, 0, 0);
    sprite.w = face.width; sprite.h = face.height;
    if (fallen) {
      url = path;
      for (const face of document.querySelectorAll('img')) if (face.getAttribute('src') === backup) face.src = path;
    }
    ready();
  };
  image.onerror = () => {
    url = backup;
    // A face already on the page gets the fallback too; later screens read url.
    for (const face of document.querySelectorAll('img')) if (face.getAttribute('src') === path) face.src = backup;
    ready();
  };
  image.src = path;
  return sprite;
}

// Death art is demand-loaded and independent of the living portraits. A missing
// painting must still show a skull, never silently resurrect the hero's face.
const fallenFaces = new Map();
export function fallenPortrait(cls) {
  const id = Object.hasOwn(HERO_LOOKS, cls) ? cls : 'fighter';
  if (!fallenFaces.has(id)) fallenFaces.set(id, makePortrait(id, () => {
    const face = document.createElement('canvas');
    face.width = face.height = 88;
    const g = face.getContext('2d');
    g.fillStyle = '#17171d'; g.fillRect(0, 0, 88, 88);
    g.fillStyle = HERO_LOOKS[id].cloth;
    g.beginPath(); g.ellipse(44, 88, 39, 29, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#bcae91'; g.fillRect(38, 51, 12, 22);
    g.beginPath(); g.ellipse(44, 31, 24, 26, 0, 0, Math.PI * 2); g.fill();
    g.fillRect(29, 43, 30, 20);
    g.fillStyle = '#151319';
    for (const x of [34, 54]) { g.beginPath(); g.ellipse(x, 32, 8, 8, 0, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.moveTo(44, 38); g.lineTo(39, 47); g.lineTo(49, 47); g.closePath(); g.fill();
    g.fillRect(32, 54, 24, 2);
    for (let x = 35; x <= 53; x += 6) g.fillRect(x, 50, 1, 10);
    return { url: face.toDataURL(), levels: [face], w: 88, h: 88 };
  }, true));
  return fallenFaces.get(id);
}
