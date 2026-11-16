// A static server with single-page fallback, for testing the production build (dist/).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root = process.argv[2];
const port = Number(process.argv[3] ?? 4321);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.css': 'text/css', '.svg': 'image/svg+xml' };
createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, path);
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch { file = join(root, 'index.html'); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(port, () => console.log('serving', root, 'on', port));
