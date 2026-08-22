// One-shot helper: mints a Spotify refresh token for the now-playing function.
//
//   1. Create an app at https://developer.spotify.com/dashboard
//   2. Add redirect URI: http://127.0.0.1:8888/callback
//   3. SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... node tools/spotify-refresh-token.mjs
//   4. Paste the printed refresh token into Netlify as SPOTIFY_REFRESH_TOKEN
//
// Nothing is written to disk; the token is only printed to your terminal.

import http from 'node:http';
import { exec } from 'node:child_process';

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = 'http://127.0.0.1:8888/callback';
const SCOPE = 'user-read-currently-playing';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first.');
  process.exit(1);
}

const state = Math.random().toString(36).slice(2);
const authUrl =
  'https://accounts.spotify.com/authorize?' +
  new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPE,
    redirect_uri: REDIRECT_URI,
    state,
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== '/callback') {
    res.writeHead(404).end();
    return;
  }

  const code = url.searchParams.get('code');
  if (!code || url.searchParams.get('state') !== state) {
    res.writeHead(400, { 'content-type': 'text/plain' }).end('Authorization failed.');
    server.close();
    process.exit(1);
  }

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      authorization: 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const data = await tokenRes.json();
  res.writeHead(200, { 'content-type': 'text/plain' }).end(
    tokenRes.ok ? 'Done — check your terminal.' : 'Token exchange failed.'
  );

  if (!tokenRes.ok) {
    console.error('Token exchange failed:', data);
    server.close();
    process.exit(1);
  }

  console.log('\nSPOTIFY_REFRESH_TOKEN=' + data.refresh_token + '\n');
  server.close();
  process.exit(0);
});

server.listen(8888, '127.0.0.1', () => {
  console.log('Opening Spotify authorization in your browser...');
  console.log('If it does not open, visit:\n' + authUrl + '\n');
  exec('open "' + authUrl + '"');
});
