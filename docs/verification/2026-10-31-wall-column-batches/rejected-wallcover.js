// Only omit floor samples that an unchanged, opaque wall will paint over.
// Textures are immutable prepared canvases; late replacements have new identities.
export function makeFloorCoverage(width, imageOf) {
  const cover = { top: new Int32Array(width), bottom: new Int32Array(width), kinds: 0 };
  const opacity = new WeakMap(), walls = [];
  let previous = null, tiles = null, visited = new Uint8Array(0);
  const same = ['level', 'tex', 'look', 'x', 'y', 'dx', 'dy', 'height', 'fog', 'grid', 'w', 'h'];
  function opaque(image) {
    if (!image || image.width !== 64 || image.height !== 64 || !image.getContext) return false;
    if (opacity.has(image)) return opacity.get(image);
    let solid = false;
    try {
      const data = image.getContext('2d').getImageData(0, 0, 64, 64).data;
      solid = true;
      for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) { solid = false; break; }
    } catch { /* Unreadable pictures retain the complete floor. */ }
    opacity.set(image, solid); return solid;
  }
  function before(view) {
    if (!previous || view.moving || view.alpha !== 1 || view.operation !== 'source-over') return null;
    for (const key of same) if (view[key] !== previous[key]) return null;
    if (view.grid.length !== tiles.length) return null;
    for (let i = 0; i < tiles.length; i++) if (view.grid[i] !== tiles[i]) return null;
    for (const wall of walls) if (imageOf(view.tex, wall.tile, wall.x, wall.y, wall.built, wall.jamb, wall.pillar) !== wall.image) return null;
    return cover;
  }
  function begin(area) {
    cover.top.fill(0); cover.bottom.fill(0); walls.length = 0;
    if (visited.length !== area * 2) visited = new Uint8Array(area * 2);
    else visited.fill(0);
  }
  function add(col, top, height, image, tile, x, y, built, jamb, pillar, index) {
    if (!opaque(image)) return;
    cover.top[col] = top; cover.bottom[col] = top + height;
    const key = index * 2 + (jamb ? 1 : 0);
    if (!visited[key]) { visited[key] = 1; walls.push({ image, tile, x, y, built, jamb, pillar }); }
  }
  function end(view, kinds) {
    cover.kinds = kinds;
    if (view.moving || view.alpha !== 1 || view.operation !== 'source-over') { previous = null; return; }
    previous = view;
    if (!tiles || tiles.length !== view.grid.length) tiles = new Uint8Array(view.grid.length);
    tiles.set(view.grid);
  }
  return { before, begin, add, end };
}
