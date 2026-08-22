// Proxies Spotify's "currently playing" endpoint so no credentials reach the browser.
//
// Required Netlify environment variables:
//   SPOTIFY_CLIENT_ID
//   SPOTIFY_CLIENT_SECRET
//   SPOTIFY_REFRESH_TOKEN   (mint once with tools/spotify-refresh-token.mjs)

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const NOW_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing';

function json(body, maxAge) {
  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=' + maxAge,
    },
    body: JSON.stringify(body),
  };
}

async function accessToken(id, secret, refresh) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      authorization: 'Basic ' + Buffer.from(id + ':' + secret).toString('base64'),
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }),
  });
  if (!res.ok) throw new Error('token refresh failed: ' + res.status);
  return (await res.json()).access_token;
}

exports.handler = async function () {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } = process.env;
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
    return json({ playing: false }, 300);
  }

  try {
    const token = await accessToken(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN);
    const res = await fetch(NOW_PLAYING_URL, { headers: { authorization: 'Bearer ' + token } });

    // 204 = nothing playing. 202 shows up occasionally when the player is idle.
    if (res.status === 204 || res.status === 202) return json({ playing: false }, 30);
    if (!res.ok) return json({ playing: false }, 30);

    const data = await res.json();
    if (!data || !data.is_playing || !data.item || data.currently_playing_type !== 'track') {
      return json({ playing: false }, 30);
    }

    return json({
      playing: true,
      title: data.item.name,
      artist: (data.item.artists || []).map((a) => a.name).join(', '),
      url: data.item.external_urls && data.item.external_urls.spotify,
    }, 30);
  } catch (err) {
    // Never let a Spotify hiccup turn into a visible error on the page.
    return json({ playing: false }, 30);
  }
};
