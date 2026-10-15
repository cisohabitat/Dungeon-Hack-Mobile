'use strict';
// A static file server with no dependencies, used by the browser tests and by
// `npm start`. The game is plain files, so nothing needs building first.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
};

// The same Content-Security-Policy as vercel.json: a change to one is a change to both (test/run.js checks).
const CSP = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')).headers.find(h => h.source === '/(.*)').headers.find(h => h.key === 'Content-Security-Policy').value;
function serve(req, res) {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(ROOT, url === '/' ? 'index.html' : url);
  // never serve outside the project
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
  fs.stat(file, (err, st) => {
    if (err || st.isDirectory()) {
      if (!err && st.isDirectory()) file = path.join(file, 'index.html');
      else { res.writeHead(404).end('not found'); return; }
    }
    fs.readFile(file, (err2, body) => {
      if (err2) { res.writeHead(404).end('not found'); return; }
      const headers = {
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        'Content-Length': body.length,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
        // the deployment's policy (vercel.json), so the browser tests run under it
        'Content-Security-Policy': CSP,
      };
      // Media readers seek to the final Ogg page for its duration. Without
      // byte ranges Chromium estimates a shorter duration from the first pages.
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (range) {
        const start = range[1] ? Number(range[1]) : Math.max(0, body.length - Number(range[2]));
        const end = range[1] && range[2] ? Math.min(body.length - 1, Number(range[2])) : body.length - 1;
        if ((!range[1] && !range[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= body.length) {
          res.writeHead(416, { ...headers, 'Content-Length': 0, 'Content-Range': `bytes */${body.length}` });
          res.end(); return;
        }
        res.writeHead(206, { ...headers, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${body.length}` });
        res.end(body.subarray(start, end + 1)); return;
      }
      res.writeHead(200, headers);
      res.end(body);
    });
  });
}

function start(port) {
  return new Promise(resolve => {
    const server = http.createServer(serve);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

if (require.main === module) {
  const port = parseInt(process.env.PORT || process.argv[2] || '4173', 10);
  start(port).then(() => console.log(`Deepdelve served at http://127.0.0.1:${port}`));
}
module.exports = { start };
