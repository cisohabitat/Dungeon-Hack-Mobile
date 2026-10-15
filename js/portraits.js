// The same face follows a hero from the class picker to the last page.
// Keep its old painting until the new one arrives, including on a slow connection.
/** @param {string} cls @param {() => any} fallback */
export function makePortrait(cls, fallback) {
  const sprite = fallback();
  if (typeof Image === 'undefined') return sprite;
  const backup = sprite.url, path = `img/portraits/${cls}.webp`;
  let url = path;
  Object.defineProperty(sprite, 'url', { get: () => url, configurable: true });
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => {
    // Keep the canvas itself: a share card may already hold a reference to it.
    const face = sprite.levels[0];
    face.width = image.naturalWidth; face.height = image.naturalHeight;
    const g = face.getContext('2d');
    g.imageSmoothingEnabled = true; g.drawImage(image, 0, 0);
    sprite.w = face.width; sprite.h = face.height;
  };
  image.onerror = () => {
    url = backup;
    // A face already on the page gets the fallback too; later screens read url.
    for (const face of document.querySelectorAll('img')) if (face.getAttribute('src') === path) face.src = backup;
  };
  image.src = path;
  return sprite;
}
