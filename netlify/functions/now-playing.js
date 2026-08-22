// Reports whatever Ishan is currently scrobbling, via Last.fm.
//
// Last.fm is used rather than Spotify directly because Spotify's Web API now
// requires the *app owner* to hold a Premium subscription; Last.fm scrobbles
// from a free Spotify account and has no such requirement.
//
// Required Netlify environment variables:
//   LASTFM_API_KEY   from https://www.last.fm/api/account/create
//   LASTFM_USER      the Last.fm username to read
//
// Append ?debug=1 for a non-secret report of which stage failed.

const API = 'https://ws.audioscrobbler.com/2.0/';

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

// Last.fm returns a bare object instead of an array when there is only one track.
function firstTrack(data) {
  const t = data && data.recenttracks && data.recenttracks.track;
  if (!t) return null;
  return Array.isArray(t) ? t[0] : t;
}

exports.handler = async function (event) {
  const debug = !!(event && event.queryStringParameters && event.queryStringParameters.debug);
  const { LASTFM_API_KEY, LASTFM_USER } = process.env;

  const report = (stage, detail, extra) =>
    debug
      ? json(Object.assign({ ok: false, stage, detail }, extra), 0)
      : json({ playing: false }, stage === 'config' ? 300 : 30);

  if (!LASTFM_API_KEY || !LASTFM_USER) {
    return report('config', 'LASTFM_API_KEY and/or LASTFM_USER are not set', {
      hasKey: !!LASTFM_API_KEY,
      hasUser: !!LASTFM_USER,
    });
  }

  try {
    const url =
      API +
      '?' +
      new URLSearchParams({
        method: 'user.getrecenttracks',
        user: LASTFM_USER,
        api_key: LASTFM_API_KEY,
        format: 'json',
        limit: '1',
      });

    const res = await fetch(url, { headers: { 'user-agent': 'ishankr.com now-playing' } });
    const data = await res.json().catch(() => null);

    // Last.fm signals errors in the body with HTTP 200, so check both.
    if (!res.ok || (data && data.error)) {
      return report('lastfm', 'api error', {
        status: res.status,
        code: data && data.error,
        message: data && data.message,
      });
    }

    const track = firstTrack(data);
    if (!track) return report('empty', 'no recent tracks for user ' + LASTFM_USER, { status: res.status });

    const nowplaying = !!(track['@attr'] && track['@attr'].nowplaying === 'true');
    if (!nowplaying) {
      return report('idle', 'most recent track is not currently playing', {
        lastPlayed: track.name,
      });
    }

    const payload = {
      playing: true,
      title: track.name,
      artist: track.artist && (track.artist['#text'] || track.artist.name),
      url: track.url,
    };
    return debug ? json(Object.assign({ ok: true, stage: 'playing' }, payload), 0) : json(payload, 30);
  } catch (err) {
    return report('fetch', String((err && err.message) || err));
  }
};
