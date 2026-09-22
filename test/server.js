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
};

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
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
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
