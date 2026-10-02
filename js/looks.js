import { Dungeon } from './dungeon.js';

// What each square of a floor looks like beyond its tile: the floor it is
// laid with, the roof over it, what its walls are built of, and which doors
// are a cell's barred gates. Worked out once a floor from the finished level
// alone, so a floor saved before any of this looks right when it is loaded,
// and kept from the renderer so the generator checks can look at it too.

const T = Dungeon.T;

/** The floors a square may be laid with. */
const FLOOR = { ROOM: 0, PATH: 1, MOSAIC: 2, ALTAR: 3, WATER: 4, RUBBLE: 5, STRAW: 6 };
/** The roofs over it. */
const CEIL = { ROCK: 0, BEAMS: 1, ROOTS: 2, CAVE: 3 };
/** What a wall is built of: dressed stone, bare rock, or stone that has come down. */
const WALL = { PLAIN: 0, ROCK: 1, FALLEN: 2 };

// Rooms nobody built, only dug or found: their walls are the rock itself,
// their roofs rough and dark. Rooms built to be looked up at carry beams.
const DUG = new Set(['cave', 'burrow']);
const RAFTERED = new Set(['hall', 'colonnade', 'gallery', 'sanctum']);

/** A repeatable number for a square, so a choice made by it never changes. */
function hashXY(x, y) {
  let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ 0x2545f491;
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

/** Stone that a floor or a roof meets at its edge (a door is a gap in it, not a wall). */
const isStone = t => t === T.WALL || t === T.TORCH || t === T.SECRET || t === T.STAIRS_UP || t === T.STAIRS_DOWN || t === T.FOUNTAIN;

/**
 * @typedef {{ floor: Uint8Array, ceil: Uint8Array, wall: Uint8Array, edge: Uint8Array, cell: Uint8Array, kinds: { floor: number[], ceil: number[] } }} Look
 */

/**
 * @param {import('./types.js').Level} L
 * @param {{face?: string}} [theme]  the floor's theme, whose face decides whether its rooms were dug from earth
 * @returns {Look}
 */
function lookOf(L, theme = {}) {
  const w = L.w, h = L.h, n = w * h, tiles = L.tiles, roomId = L.roomId || [];
  const rooms = L.rooms || [];
  const shapeOf = id => (id >= 0 && rooms[id] && rooms[id].shape) || 'box';
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? T.WALL : tiles[y * w + x]);
  const earth = theme.face === 'earth';
  const floor = new Uint8Array(n), ceil = new Uint8Array(n), wall = new Uint8Array(n), edge = new Uint8Array(n), cell = new Uint8Array(n);

  // the set piece, and the squares it fills
  const piece = L.piece && rooms[L.piece.room] ? { kind: L.piece.kind, id: L.piece.room, r: rooms[L.piece.room] } : null;
  const inPiece = (x, y) => piece && x >= piece.r.x && y >= piece.r.y && x < piece.r.x + piece.r.w && y < piece.r.y + piece.r.h;

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, t = tiles[i], id = roomId[i], shape = shapeOf(id);
    // where the floor meets stone on each side: north 1, east 2, south 4, west 8
    edge[i] = (isStone(at(x, y - 1)) ? 1 : 0) | (isStone(at(x + 1, y)) ? 2 : 0) | (isStone(at(x, y + 1)) ? 4 : 0) | (isStone(at(x - 1, y)) ? 8 : 0);

    // ---- the floor ----
    if (id < 0) floor[i] = FLOOR.PATH;
    else if (piece && id === piece.id) {
      const r = piece.r;
      if (piece.kind === 'shrine') floor[i] = x === r.x + (r.w >> 1) && y === r.y + (r.h >> 1) ? FLOOR.ALTAR : FLOOR.MOSAIC;
      else if (piece.kind === 'cistern') floor[i] = FLOOR.WATER;
      else if (piece.kind === 'rubble') floor[i] = FLOOR.RUBBLE;
      else if (piece.kind === 'cells') {
        // the aisle runs down the middle of the long way; the cells lie either side of it
        const aisle = r.w > r.h ? y === r.y + (r.h >> 1) : x === r.x + (r.w >> 1);
        floor[i] = aisle ? FLOOR.ROOM : FLOOR.STRAW;
      }
    }

    // ---- the roof ----
    if (earth) {
      // the Warrens: roots through the roof of every tunnel and burrow, and
      // timber holding up the rooms that were cut square
      ceil[i] = id < 0 || DUG.has(shape) ? (id < 0 && hashXY(x, y) % 3 === 0 ? CEIL.ROCK : CEIL.ROOTS) : CEIL.BEAMS;
    } else if (id >= 0) {
      ceil[i] = DUG.has(shape) ? CEIL.CAVE : RAFTERED.has(shape) ? CEIL.BEAMS : CEIL.ROCK;
    }

    // ---- what a wall is built of ----
    if (t === T.WALL || t === T.TORCH || t === T.SECRET) {
      if (piece && piece.kind === 'rubble' && inPiece(x, y)) wall[i] = WALL.FALLEN;
      else if (!earth) {
        // stone beside a cavern is the cavern's own rock (dug earth stays earth)
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (roomId[j] >= 0 && DUG.has(shapeOf(roomId[j]))) { wall[i] = WALL.ROCK; break; }
        }
      }
    }

    // ---- a cell's door: one with its own room on both sides of it ----
    if (piece && piece.kind === 'cells' && (t === T.DOOR || t === T.DOOR_LOCKED || t === T.DOOR_OPEN)) {
      const ns = roomId[(y - 1) * w + x] === piece.id && roomId[(y + 1) * w + x] === piece.id;
      const ew = roomId[y * w + x - 1] === piece.id && roomId[y * w + x + 1] === piece.id;
      if (ns || ew) cell[i] = 1;
    }
  }
  const used = a => [...new Set(a)].sort((p, q) => p - q);
  return { floor, ceil, wall, edge, cell, kinds: { floor: used(floor), ceil: used(ceil) } };
}

export { FLOOR, CEIL, WALL, lookOf, hashXY };
