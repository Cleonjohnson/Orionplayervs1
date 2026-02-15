/**
 * One-off script: test each Jamaican radio stream URL.
 * Run with: node scripts/test-radio-streams.js
 * Uses fetch with 8s timeout; 200/301/302 or audio content-type = working.
 */
const STATIONS = [
  { stream_id: 1001, name: 'Irie FM 107.7', stream_url: 'https://usa19.fastcast4u.com:7430/;' },
  { stream_id: 1002, name: 'Zip 103 FM', stream_url: 'https://stream.zeno.fm/c0ytcn43vxquv' },
  { stream_id: 1003, name: 'Radio Jamaica 94FM', stream_url: 'https://stream.zeno.fm/cub84trbgy5tv' },
  { stream_id: 1004, name: 'Love 101 FM', stream_url: 'https://stream.zeno.fm/webzstrtpy5tv' },
  { stream_id: 1005, name: 'Nationwide 90FM', stream_url: 'http://stream.zenolive.com/a3wmsfazfv5tv' },
  { stream_id: 1006, name: 'Kool 97 FM', stream_url: 'https://stream.zeno.fm/we0agoxeeojvv' },
  { stream_id: 1007, name: 'NCU 91.1 FM', stream_url: 'https://stream.zeno.fm/qvv8y1m06umtv' },
  { stream_id: 1008, name: 'Mello FM 88.1', stream_url: 'http://peridot.streamguys.com:5660/live' },
  { stream_id: 1009, name: 'Roots 96.1 FM', stream_url: 'https://stream.zeno.fm/pnp236t7nbruv' },
  { stream_id: 1010, name: 'Stylz FM', stream_url: 'https://stream.zeno.fm/0d1hpcmqqy5tv' },
  { stream_id: 1011, name: 'TBC Radio 88.5 FM', stream_url: 'https://stream.zeno.fm/004dvn2qqy5tv' },
  { stream_id: 1012, name: 'Newstalk 93 FM', stream_url: 'http://procyon.shoutca.st:8083/quality196' },
  { stream_id: 1013, name: 'The Edge 105 FM', stream_url: 'https://listen.radioking.com/radio/331171/stream/387835' },
  { stream_id: 1014, name: 'Fyah 105', stream_url: 'https://listen.radioking.com/radio/459389/stream/514595' },
  { stream_id: 1015, name: 'SunCity 104.9 FM', stream_url: 'https://edge.mixlr.com/channel/ibrdq' },
  { stream_id: 1016, name: 'KLAS Sports Radio 89.5', stream_url: 'http://stream.zenolive.com/4uw093pbyvduv' },
  { stream_id: 1017, name: 'Gospel FM Jamaica', stream_url: 'https://stream-37.zeno.fm/zpksre88rm0uv' },
  { stream_id: 1018, name: 'Alpha Boys School Radio', stream_url: 'http://alphaboys-live.streamguys1.com/alphaboys.mp3' },
  { stream_id: 1019, name: 'Rebel Radio', stream_url: 'https://streamer.radio.co/s830ce6f36/listen' },
  { stream_id: 1020, name: 'GGFM 90.1 Discovery Bay', stream_url: 'http://usa14.fastcast4u.com:5192/;' },
  { stream_id: 1021, name: 'UnityXM', stream_url: 'https://a8.asurahosting.com:7430/radio.mp3' },
  { stream_id: 1022, name: 'PONdENDS.COM', stream_url: 'http://s7.voscast.com:7000/' },
  { stream_id: 1023, name: 'Worlvybz Radio', stream_url: 'http://stream.zeno.fm/mkg0g0t2td0uv' },
  { stream_id: 1024, name: 'IRIE Storm Radio', stream_url: 'https://auds1.intacs.com/iriestormradio' },
  { stream_id: 1025, name: '808 Live Reggaecast', stream_url: 'http://808.rastamusic.com/rastamusic.mp3' },
];

const TIMEOUT_MS = 8000;

async function testUrl(url) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'OrionPlayer/2.0 (Stream Check)' },
      redirect: 'follow',
    });
    clearTimeout(to);
    const ok = res.ok || res.status === 200 || res.status === 206;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const isAudio = /audio|mpeg|ogg|aac|mp3|icecast|stream/.test(ct);
    return { ok: ok || isAudio, status: res.status, contentType: ct };
  } catch (err) {
    clearTimeout(to);
    return { ok: false, error: err.message || String(err) };
  }
}

async function main() {
  console.log('Testing', STATIONS.length, 'radio streams (timeout', TIMEOUT_MS, 'ms)...\n');
  const results = [];
  for (const s of STATIONS) {
    process.stdout.write(s.name + ' ... ');
    const r = await testUrl(s.stream_url);
    const working = r.ok;
    results.push({ ...s, working, ...r });
    console.log(working ? 'OK' : ('FAIL ' + (r.error || r.status)));
  }
  const workingList = results.filter((r) => r.working);
  const brokenList = results.filter((r) => !r.working);
  console.log('\n--- Working:', workingList.length);
  workingList.forEach((r) => console.log('  ', r.stream_id, r.name));
  console.log('\n--- Broken:', brokenList.length);
  brokenList.forEach((r) => console.log('  ', r.stream_id, r.name, r.error || r.status));
  return { working: workingList, broken: brokenList };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
