// A run as a picture to share: what it came to, drawn in the game's own
// colours. A win shows the Heart that was lifted; a death, the thing that
// did it. Everything it says comes in `info`, so this knows nothing of rules.

const W = 800, H = 420, SERIF = "Georgia, 'Times New Roman', serif";

/** Write a line, shrinking the type until it fits the width it is given. */
function fitText(g, text, x, y, maxW, size, weight, colour) {
  let s = size;
  do { g.font = `${weight} ${s}px ${SERIF}`; s -= 1; } while (g.measureText(text).width > maxW && s > 10);
  g.fillStyle = colour;
  g.fillText(text, x, y);
}

/**
 * @param {{ won: boolean, hero: string, outcome: string, killer?: string, stats: string, mode: string,
 *   seed: string, date: string, art?: HTMLCanvasElement | HTMLImageElement | null }} info
 * @returns {HTMLCanvasElement}
 */
function drawShareCard(info) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  // stone-dark ground, torchlight (or the Heart's gold) behind the picture, and a gold rule round the edge
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1e1a26'); bg.addColorStop(1, '#0b0a10');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(205, 235, 10, 205, 235, 220);
  glow.addColorStop(0, info.won ? 'rgba(255, 196, 90, 0.42)' : 'rgba(190, 60, 48, 0.32)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#c9a24a'; g.lineWidth = 3; g.strokeRect(10, 10, W - 20, H - 20);
  g.strokeStyle = 'rgba(201, 162, 74, 0.35)'; g.lineWidth = 1; g.strokeRect(19, 19, W - 38, H - 38);
  // the picture, pixels kept sharp, standing on a shadow
  g.fillStyle = 'rgba(0, 0, 0, 0.45)';
  g.beginPath(); g.ellipse(205, 360, 120, 16, 0, 0, Math.PI * 2); g.fill();
  if (info.art && info.art.width) {
    g.imageSmoothingEnabled = false;
    const s = Math.min(300 / info.art.width, 300 / info.art.height), w = info.art.width * s, h = info.art.height * s;
    g.drawImage(info.art, 205 - w / 2, 368 - h, w, h);
  }
  // the words, on the right
  const x = 400, maxW = W - x - 40;
  g.textBaseline = 'alphabetic';
  fitText(g, 'DEEPDELVE', x, 78, maxW, 40, 'normal', '#e8c76a');
  g.fillStyle = 'rgba(201, 162, 74, 0.5)'; g.fillRect(x, 92, maxW, 1);
  fitText(g, info.hero, x, 140, maxW, 30, 'normal', '#f2ead8');
  fitText(g, info.outcome, x, 196, maxW, 38, 'bold', info.won ? '#ffd76a' : '#f08a80');
  if (info.killer) fitText(g, info.killer, x, 234, maxW, 24, 'italic', '#d8c8b0');
  fitText(g, info.stats, x, 284, maxW, 22, 'normal', '#e0d6c2');
  fitText(g, info.mode, x, 318, maxW, 20, 'normal', '#b8ad98');
  fitText(g, `Seed "${info.seed}" · ${info.date}`, x, 370, maxW, 17, 'normal', '#8a8070');
  return c;
}

export { drawShareCard };
