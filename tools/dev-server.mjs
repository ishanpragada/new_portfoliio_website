// Minimal local preview: serves the site and runs the now-playing function in-process,
// so the page can be checked without installing the Netlify CLI.
//
//   node tools/dev-server.mjs                          → function returns { playing: false }
//   LASTFM_API_KEY=... LASTFM_USER=... node tools/dev-server.mjs  → hits Last.fm for real

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { handler } = require(path.join(root, 'netlify/functions/now-playing.js'));

const PORT = Number(process.env.PORT || 8000);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/.netlify/functions/now-playing') {
    const result = await handler({
      queryStringParameters: Object.fromEntries(url.searchParams),
    });
    res.writeHead(result.statusCode, result.headers).end(result.body);
    return;
  }

  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  try {
    const body = await readFile(path.join(root, file));
    const type = file.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/plain';
    res.writeHead(200, { 'content-type': type }).end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
  }
});

server.listen(PORT, () => console.log('http://localhost:' + PORT));
