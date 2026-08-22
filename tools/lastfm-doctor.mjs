// Diagnoses why the now-playing line is empty.
//
//   LASTFM_API_KEY=... LASTFM_USER=... node tools/lastfm-doctor.mjs
//
// Prints statuses and error codes only -- never the api key itself.

const { LASTFM_API_KEY: KEY, LASTFM_USER: USER } = process.env;
const ok = (m) => console.log('  ok    ' + m);
const bad = (m) => console.log('  FAIL  ' + m);

console.log('\n1. environment');
if (!KEY) bad('LASTFM_API_KEY is missing'); else ok('LASTFM_API_KEY present (' + KEY.length + ' chars)');
if (!USER) bad('LASTFM_USER is missing'); else ok('LASTFM_USER = ' + USER);
if (!KEY || !USER) process.exit(1);

console.log('\n2. recent tracks');
const url =
  'https://ws.audioscrobbler.com/2.0/?' +
  new URLSearchParams({
    method: 'user.getrecenttracks',
    user: USER,
    api_key: KEY,
    format: 'json',
    limit: '1',
  });
const res = await fetch(url, { headers: { 'user-agent': 'ishankr.com now-playing' } });
const data = await res.json().catch(() => null);
console.log('  HTTP ' + res.status);

if (data && data.error) {
  bad('last.fm error ' + data.error + ': ' + data.message);
  console.log('\n  error 6  -> the username does not exist (it is the last.fm username, not your email)');
  console.log('  error 10 -> the api key is invalid or was truncated when pasted\n');
  process.exit(1);
}
if (!res.ok) { bad(await res.text()); process.exit(1); }

const t = data && data.recenttracks && data.recenttracks.track;
const track = Array.isArray(t) ? t[0] : t;
if (!track) {
  bad('no recent tracks at all -- has anything scrobbled yet?');
  console.log('     check last.fm -> Settings -> Applications -> Spotify is connected');
  process.exit(1);
}

ok('most recent scrobble: ' + track.name + ' by ' + (track.artist && track.artist['#text']));
const nowplaying = !!(track['@attr'] && track['@attr'].nowplaying === 'true');
if (nowplaying) {
  ok('nowplaying=true -- this WILL show on the site');
} else {
  bad('nowplaying flag absent -- last.fm thinks playback has stopped');
  console.log('     play something and rerun; scrobbles can lag by 10-30s');
}
console.log();
