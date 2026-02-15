/**
 * Orion Player 2.0 - Xtream Codes API Service
 * URL format: {url}/player_api.php?username={username}&password={password}[&action={action}]
 */

/**
 * Normalize base URL (no trailing slash).
 * @param {string} url - Base URL (e.g. http://example.com:8080)
 * @returns {string}
 */
function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return url.replace(/\/+$/, '');
}

/**
 * Build player_api.php URL with required params. Optionally add action.
 * @param {string} baseUrl - Server base URL
 * @param {string} username
 * @param {string} password
 * @param {string} [action] - Optional: get_live_streams | get_vod_streams | get_series
 * @returns {string} Full URL, or '' if invalid
 */
function buildPlayerApiUrl(baseUrl, username, password, action = null) {
  const base = ensureHttpUrl(normalizeUrl(baseUrl)); // Ensure HTTP/HTTPS and no trailing slash
  if (!base || !username || !password) return '';
  const params = new URLSearchParams({ username, password });
  if (action) params.set('action', action);
  return `${base}/player_api.php?${params.toString()}`;
}

/**
 * Log URL with password hidden for debugging.
 */
function logSafeUrl(label, url, password) {
  const safe = password
    ? url.replace(new RegExp(encodeURIComponent(password), 'g'), '***')
    : url;
  console.log(`[${label}] EXACT URL:`, safe);
}

/** Ensure base URL has http(s) and no trailing slash. */
function ensureHttpUrl(url) {
  if (!url || typeof url !== 'string') return url || '';
  const t = url.trim().replace(/\/+$/, '');
  if (t.toLowerCase().startsWith('http://') || t.toLowerCase().startsWith('https://')) return t;
  return 'http://' + t; // Default to http if no protocol is specified
}

// ---------------------------------------------------------------------------
// 1. authenticate(username, password, url)
//    URL: {url}/player_api.php?username={username}&password={password}
//    URL sanitization, 10s timeout, throw on non-200.
// ---------------------------------------------------------------------------

const AUTH_TIMEOUT_MS = 10000;

export async function authenticate(credentials) {
  const { username, password, baseUrl: rawUrl } = credentials || {};
  if (!username || !password || !rawUrl) {
    return { success: false, error: 'Username, password and server URL are required.' };
  }

  const baseUrlInput = (rawUrl || '').trim();
  // Ensure baseUrl always has a protocol for the initial attempt
  const baseUrl = ensureHttpUrl(baseUrlInput);

  console.log('Attempting Login:', baseUrl, username);

  const url = buildPlayerApiUrl(baseUrl, username, password, null);
  if (!url) return { success: false, error: 'Invalid server URL.' };

  logSafeUrl('authenticate', url, password);

  const tryFetch = async (targetUrl) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);
    const res = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  };

  const parseJson = async (res) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Invalid Server Response (Not IPTV)');
    }
  };

  try {
    let res = await tryFetch(url);

    // If 404/403, and user didn't specify protocol, try the other protocol
    const hasProtocolInInput = baseUrlInput.toLowerCase().startsWith('http://') || baseUrlInput.toLowerCase().startsWith('https://');
    if (!hasProtocolInInput && (res.status === 404 || res.status === 403)) {
      const altProtocol = baseUrl.startsWith('http://') ? 'https://' : 'http://';
      const altBaseUrl = altProtocol + baseUrl.replace(/^(http|https):\/\//i, ''); // Replace existing protocol
      const altUrl = buildPlayerApiUrl(altBaseUrl, username, password, null);
      if (altUrl) {
        console.log('[authenticate] Retrying with alternate protocol:', altProtocol.replace('://', ''));
        res = await tryFetch(altUrl);
      }
    }

    if (res.status === 404 || res.status === 403) {
      return { success: false, error: 'Server rejected login.' };
    }
    if (res.status !== 200) {
      return { success: false, error: `Server Error: ${res.status}` };
    }

    let data;
    try {
      data = await parseJson(res);
    } catch (parseErr) {
      return { success: false, error: parseErr.message || 'Invalid Server Response (Not IPTV)' };
    }

    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Invalid response from server.' };
    }
    if (data.user_info) {
      return {
        success: true,
        data: {
          user_info: data.user_info,
          server_info: data.server_info || {},
          ...data,
        },
      };
    }
    return { success: false, error: 'Invalid username or password.' };
  } catch (e) {
    const message = e.name === 'AbortError' ? 'Request timed out (10s). Check server URL and network.' : (e.message || 'Network error');
    return { success: false, error: message };
  }
}

/**
 * Fetch account info (user_info) from player_api for display (e.g. subscription expiry).
 * Same endpoint as authenticate; returns user_info or null on failure.
 */
export async function getAccountInfo(credentials) {
  const result = await authenticate(credentials);
  if (!result.success || !result.data?.user_info) return null;
  return result.data.user_info;
}

/**
 * Format Xtream exp_date for display. Handles Unix timestamp (number) or date string.
 */
export function formatExpiryDisplay(expDate) {
  if (expDate == null || expDate === '') return null;
  let date;
  if (typeof expDate === 'number') {
    if (expDate <= 0) return null;
    date = new Date(expDate * 1000);
  } else if (typeof expDate === 'string') {
    const parsed = parseInt(expDate, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      date = new Date(parsed * 1000);
    } else {
      date = new Date(expDate);
    }
  } else {
    return null;
  }
  if (Number.isNaN(date.getTime()) || date.getTime() <= 0) return null;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// getLiveCategories(user, pass, url)
//    URL: {url}/player_api.php?username=...&password=...&action=get_live_categories
// ---------------------------------------------------------------------------

export async function getLiveCategories(opts) {
  const { baseUrl, username, password } = opts || {};
  if (!baseUrl || !username || !password) {
    console.log('[getLiveCategories] Missing credentials (baseUrl, username, or password).');
    return [];
  }

  const url = buildPlayerApiUrl(baseUrl, username, password, 'get_live_categories');
  if (!url) {
    console.log('[getLiveCategories] buildPlayerApiUrl returned empty (invalid baseUrl).');
    return [];
  }

  logSafeUrl('getLiveCategories', url, password);

  try {
    const res = await fetch(url);
    console.log('[getLiveCategories] response.status:', res.status);

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}. Check URL and connection.`);
    }

    const data = await res.json();
    console.log('Create-Expo-App-Debug: RAW DATA PREVIEW:', JSON.stringify(data).slice(0, 200));

    // API may return array directly or { categories: [...] } or { live_categories: [...] }
    const list = Array.isArray(data)
      ? data
      : data.categories || data.live_categories || data.live_categories_list || [];

    if (!Array.isArray(list)) {
      console.log('[getLiveCategories] Response is not an array. keys:', data ? Object.keys(data) : 'no data');
      return [];
    }

    console.log('[getLiveCategories] raw count:', list.length);
    return list;
  } catch (e) {
    console.log('[getLiveCategories] error:', e?.message || e);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// 2. getLiveStreams(username, password, url)
//    URL: {url}/player_api.php?username=...&password=...&action=get_live_streams
// ---------------------------------------------------------------------------

export async function getLiveStreams(opts) {
  let { baseUrl, username, password } = opts || {};
  if (!baseUrl || !username || !password) {
    console.log('[getLiveStreams] Missing credentials (baseUrl, username, or password).');
    return [];
  }

  baseUrl = ensureHttpUrl(baseUrl);
  console.log('[getLiveStreams] cleanUrl (base):', baseUrl);

  const url = buildPlayerApiUrl(baseUrl, username, password, 'get_live_streams');
  if (!url) {
    console.log('[getLiveStreams] buildPlayerApiUrl returned empty (invalid baseUrl).');
    return [];
  }

  logSafeUrl('getLiveStreams', url, password);

  try {
    const res = await fetch(url);
    console.log('[getLiveStreams] response.status:', res.status);

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}. Check URL and connection.`);
    }

    const rawText = await res.text();
    const preview = rawText.slice(0, 500);
    console.log('[getLiveStreams] RAW RESPONSE (first 500 chars):', preview);

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('[getLiveStreams] JSON.parse failed:', parseErr?.message);
      throw new Error('Invalid Data Format received from Server');
    }

    const list = data?.live_streams ?? data?.live_streams_list ?? (Array.isArray(data) ? data : []);

    if (!Array.isArray(list)) {
      console.log('[getLiveStreams] data.live_streams is not an Array. typeof:', typeof list, 'keys:', data ? Object.keys(data) : 'no data');
      throw new Error('Invalid Data Format received from Server');
    }

    if (list.length > 0) {
      console.log('[getLiveStreams] First item:', JSON.stringify(list[0]));
    } else {
      console.log('[getLiveStreams] List length: 0 (no channels returned).');
    }

    return list;
  } catch (e) {
    if (e.message === 'Invalid Data Format received from Server') throw e;
    console.log('[getLiveStreams] fetch/json error:', e.message || e);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// 3. getMovies (getVodStreams) — VOD stream list
//    URL: {url}/player_api.php?username=...&password=...&action=get_vod_streams
// ---------------------------------------------------------------------------

export async function getVodStreams(opts) {
  let { baseUrl, username, password } = opts || {};
  if (!baseUrl || !username || !password) return [];

  baseUrl = ensureHttpUrl(baseUrl);
  console.log('[getVodStreams] cleanUrl (base):', baseUrl);

  const url = buildPlayerApiUrl(baseUrl, username, password, 'get_vod_streams');
  if (!url) return [];

  logSafeUrl('getVodStreams', url, password);

  try {
    const res = await fetch(url);
    console.log('[getVodStreams] response.status:', res.status);
    if (!res.ok) return [];

    const rawText = await res.text();
    const preview = rawText.slice(0, 500);
    console.log('[getVodStreams] RAW RESPONSE (first 500 chars):', preview);
    console.log('[getVodStreams] raw response length:', rawText.length);

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('[getVodStreams] JSON.parse failed:', parseErr?.message);
      return [];
    }

    const list = data?.vod_streams ?? data?.movies ?? (Array.isArray(data) ? data : []);
    const arr = Array.isArray(list) ? list : [];
    console.log('[getVodStreams] parsed list length:', arr.length);
    return arr;
  } catch (e) {
    console.log('[getVodStreams] error:', e?.message || e);
    return [];
  }
}

/**
 * VOD (Movie) categories: action=get_vod_categories
 */
export async function getVodCategories(opts) {
  let { baseUrl, username, password } = opts || {};
  if (!baseUrl || !username || !password) return [];

  baseUrl = ensureHttpUrl(baseUrl);
  const url = buildPlayerApiUrl(baseUrl, username, password, 'get_vod_categories');
  if (!url) return [];
  logSafeUrl('getVodCategories', url, password);

  try {
    const res = await fetch(url);
    console.log('[getVodCategories] response.status:', res.status);
    if (!res.ok) return [];

    const rawText = await res.text();
    console.log('[getVodCategories] raw response length:', rawText.length);
    console.log('[getVodCategories] RAW (first 500):', rawText.slice(0, 500));

    const data = JSON.parse(rawText);
    let list = Array.isArray(data) ? data : data?.categories ?? data?.vod_categories ?? [];
    if (!Array.isArray(list)) list = [];
    if (list.length === 0 && data && typeof data === 'object' && !Array.isArray(data)) {
      const entries = Object.entries(data);
      if (entries.length > 0 && typeof entries[0][1] === 'string') {
        list = entries.map(([k, v]) => ({ category_id: k, category_name: String(v) }));
      }
    }
    console.log('[getVodCategories] parsed count:', list.length);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.log('[getVodCategories] error:', e?.message || e);
    return [];
  }
}

/**
 * Series categories: action=get_series_categories
 */
export async function getSeriesCategories(opts) {
  let { baseUrl, username, password } = opts || {};
  if (!baseUrl || !username || !password) return [];

  baseUrl = ensureHttpUrl(baseUrl);
  const url = buildPlayerApiUrl(baseUrl, username, password, 'get_series_categories');
  if (!url) return [];
  logSafeUrl('getSeriesCategories', url, password);

  try {
    const res = await fetch(url);
    console.log('[getSeriesCategories] response.status:', res.status);
    if (!res.ok) return [];

    const rawText = await res.text();
    console.log('[getSeriesCategories] raw response length:', rawText.length);
    console.log('[getSeriesCategories] RAW (first 500):', rawText.slice(0, 500));

    const data = JSON.parse(rawText);
    const list = Array.isArray(data) ? data : data?.categories ?? data?.series_categories ?? [];
    console.log('[getSeriesCategories] parsed count:', list.length);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.log('[getSeriesCategories] error:', e?.message || e);
    return [];
  }
}

/**
 * Alias for getVodStreams (Movies).
 */
export async function getMovies(opts) {
  return getVodStreams(opts);
}

// ---------------------------------------------------------------------------
// 4. getSeries — series list
//    URL: {url}/player_api.php?username=...&password=...&action=get_series
// ---------------------------------------------------------------------------

export async function getSeriesList(opts) {
  let { baseUrl, username, password } = opts || {};
  if (!baseUrl || !username || !password) return [];

  baseUrl = ensureHttpUrl(baseUrl);
  console.log('[getSeriesList] cleanUrl (base):', baseUrl);

  const url = buildPlayerApiUrl(baseUrl, username, password, 'get_series');
  if (!url) return [];

  logSafeUrl('getSeriesList', url, password);

  try {
    const res = await fetch(url);
    console.log('[getSeriesList] response.status:', res.status);
    if (!res.ok) return [];

    const rawText = await res.text();
    const preview = rawText.slice(0, 500);
    console.log('[getSeriesList] RAW RESPONSE (first 500 chars):', preview);
    console.log('[getSeriesList] raw response length:', rawText.length);

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('[getSeriesList] JSON.parse failed:', parseErr?.message);
      return [];
    }

    const list = data?.series ?? (Array.isArray(data) ? data : []);
    const arr = Array.isArray(list) ? list : [];
    console.log('[getSeriesList] parsed list length:', arr.length);
    return arr;
  } catch (e) {
    console.log('[getSeriesList] error:', e?.message || e);
    return [];
  }
}

/**
 * Alias for getSeriesList.
 */
export async function getSeries(opts) {
  return getSeriesList(opts);
}

// ---------------------------------------------------------------------------
// Stream URL builders (unchanged)
// ---------------------------------------------------------------------------

export function buildLiveStreamUrl(baseUrl, username, password, streamId, extension = 'm3u8') {
  const base = normalizeUrl(baseUrl);
  if (!base || !username || !password || streamId == null) return '';
  return `${base}/live/${username}/${password}/${streamId}.${extension}`;
}

/**
 * Build live stream URL with catch-up / "watch from start" params (if provider supports it).
 * @param {string} baseUrl
 * @param {string} username
 * @param {string} password
 * @param {string|number} streamId
 * @param {number} startTimestamp - Unix epoch (seconds) when program started
 * @param {number} durationSeconds - Program duration in seconds
 * @param {string} extension
 * @returns {string} URL with ?start=...&duration=... appended (or plain live URL if start/duration invalid)
 */
export function buildLiveCatchupUrl(baseUrl, username, password, streamId, startTimestamp, durationSeconds, extension = 'm3u8') {
  const liveUrl = buildLiveStreamUrl(baseUrl, username, password, streamId, extension);
  if (!liveUrl || typeof startTimestamp !== 'number' || startTimestamp <= 0 || typeof durationSeconds !== 'number' || durationSeconds <= 0) {
    return liveUrl;
  }
  const sep = liveUrl.includes('?') ? '&' : '?';
  return `${liveUrl}${sep}start=${Math.floor(startTimestamp)}&duration=${Math.floor(durationSeconds)}`;
}

export function buildVodStreamUrl(baseUrl, username, password, streamId, extension = 'mp4') {
  const base = normalizeUrl(baseUrl);
  if (!base || !username || !password || streamId == null) return '';
  return `${base}/movie/${username}/${password}/${streamId}.${extension}`;
}

export function buildSeriesStreamUrl(baseUrl, username, password, episodeId, extension = 'm4v') {
  const base = normalizeUrl(baseUrl);
  if (!base || !username || !password || episodeId == null) return '';
  return `${base}/series/${username}/${password}/${episodeId}.${extension}`;
}

// ---------------------------------------------------------------------------
// getEpg(stream_id) — fetch EPG (Electronic Program Guide) for a live channel
// Returns: [{ id, epg_id, title, description, start, end, start_timestamp, stop_timestamp }]
// ---------------------------------------------------------------------------

export async function getEpg(opts) {
  const { baseUrl, username, password, streamId, limit = 50 } = opts || {};
  if (!baseUrl || !username || !password || streamId == null) return [];

  const base = ensureHttpUrl(baseUrl).replace(/\/+$/, '');
  const params = new URLSearchParams({
    username,
    password,
    action: 'get_short_epg',
    stream_id: String(streamId),
  });
  if (limit) params.set('limit', String(limit));
  const url = `${base}/player_api.php?${params.toString()}`;
  logSafeUrl('getEpg', url, password);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return [];
    const data = await res.json();
    if (!data || typeof data !== 'object') return [];

    const raw = Array.isArray(data) ? data : (data.epg_listings ?? data.epg ?? []);
    if (!Array.isArray(raw)) return [];

    const decode = (val) => {
      if (val == null) return '';
      if (typeof val !== 'string') return String(val);
      try {
        if (/^[A-Za-z0-9+/=]+$/.test(val) && val.length % 4 === 0) {
          return atob(val) || val;
        }
      } catch (_) {}
      return val;
    };

    const programs = raw.map((p) => ({
      id: p.id ?? p.epg_id ?? '',
      epg_id: p.epg_id ?? p.id ?? '',
      title: decode(p.title) || p.title || 'No title',
      description: decode(p.description) || p.description || '',
      start: p.start ?? '',
      end: p.end ?? '',
      start_timestamp: p.start_timestamp ?? 0,
      stop_timestamp: p.stop_timestamp ?? 0,
    })).sort((a, b) => (a.start_timestamp || 0) - (b.start_timestamp || 0));

    console.log(`[Xtream] getEpg: ${programs.length} programs for stream ${streamId}`);
    return programs;
  } catch (e) {
    console.warn('[Xtream] getEpg error:', e?.message ?? e);
    return [];
  }
}

/**
 * Bulk fetch EPG for all channels using XMLTV endpoint
 * URL: {baseUrl}/xmltv.php?username={username}&password={password}
 * Returns XMLTV formatted data that we can parse or cache
 * @returns {success: boolean, data: object}
 */
export async function bulkFetchEpgXMLTV(opts) {
  const { baseUrl: rawUrl, username, password } = opts || {};
  if (!username || !password || !rawUrl) {
    return { success: false, error: 'Missing credentials' };
  }
  const baseUrl = ensureHttpUrl(rawUrl);
  const url = `${normalizeUrl(baseUrl)}/xmltv.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  
  logSafeUrl('bulkFetchEpgXMLTV', url, password);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s for large XMLTV
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[Xtream] bulkFetchEpgXMLTV: HTTP ${res.status}`);
      return { success: false, error: `HTTP ${res.status}` };
    }

    const text = await res.text();
    console.log(`[Xtream] bulkFetchEpgXMLTV: Received ${text.length} chars of XMLTV`);
    
    // Return raw XMLTV (can be parsed later if needed, or just store as-is)
    return { success: true, data: text, format: 'xmltv' };
  } catch (e) {
    console.warn('[Xtream] bulkFetchEpgXMLTV error:', e?.message ?? e);
    return { success: false, error: e?.message || 'Network error' };
  }
}

/**
 * Fetch EPG for multiple channels in parallel (batch mode)
 * @param {Array} channelIds - Array of stream_ids
 * @param {number} limit - Max programs per channel (default 100)
 * @returns {Object} Map of stream_id -> programs array
 */
export async function bulkFetchEpgByChannels(opts) {
  const { baseUrl, username, password, channelIds = [], limit = 100 } = opts || {};
  if (!channelIds.length) return {};
  
  console.log(`[Xtream] Fetching EPG for ${channelIds.length} channels in parallel...`);
  
  const results = await Promise.allSettled(
    channelIds.map((id) => 
      getEpg({ baseUrl, username, password, streamId: id, limit })
        .then((programs) => ({ id, programs }))
    )
  );
  
  const epgMap = {};
  results.forEach((r) => {
    if (r.status === 'fulfilled' && r.value?.programs) {
      epgMap[r.value.id] = r.value.programs;
    }
  });
  
  console.log(`[Xtream] Loaded EPG for ${Object.keys(epgMap).length}/${channelIds.length} channels`);
  return epgMap;
}

// ---------------------------------------------------------------------------
// getSeriesInfo(series_id) — fetch series info + seasons/episodes, sorted
// Returns: { info: { name, cover, plot, releaseDate }, seasons: [{ season_number, episodes: [...] }] }
// CRITICAL: Seasons sorted by season_number asc; Episodes sorted by episode_num asc.
// ---------------------------------------------------------------------------

export async function getSeriesInfo(opts) {
  const { baseUrl, username, password, seriesId } = opts || {};
  if (!baseUrl || !username || !password || seriesId == null) return { info: null, seasons: [] };

  const base = normalizeUrl(baseUrl) || ensureHttpUrl(baseUrl);
  const params = new URLSearchParams({
    username,
    password,
    action: 'get_series_info',
    series_id: String(seriesId),
  });
  const url = `${base}/player_api.php?${params.toString()}`;
  if (!url) return { info: null, seasons: [] };
  logSafeUrl('getSeriesInfo', url, password);

  // Single attempt with generous timeout for slow IPTV servers
  // 30 second timeout - some servers are VERY slow but will eventually respond
  const TIMEOUT_MS = 30000;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    console.log(`[Xtream] Fetching series ${seriesId}...`);
    const res = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[Xtream] getSeriesInfo HTTP ${res.status} for series ${seriesId}`);
      return { info: null, seasons: [] };
    }

      const data = await res.json();
      if (!data || typeof data !== 'object') return { info: null, seasons: [] };

      const rawInfo = data.info != null ? data.info : (data.name || data.plot ? data : null);
      const info = rawInfo && typeof rawInfo === 'object'
        ? {
            name: rawInfo.name ?? rawInfo.title ?? data.name ?? '',
            cover: rawInfo.cover ?? rawInfo.cover_big ?? rawInfo.image ?? null,
            plot: rawInfo.plot ?? rawInfo.description ?? data.plot ?? '',
            releaseDate: rawInfo.releaseDate ?? rawInfo.released ?? rawInfo.year ?? null,
          }
        : { name: '', cover: null, plot: '', releaseDate: null };

      const rawEpisodes = data.episodes;
      let seasons = [];

      if (rawEpisodes && typeof rawEpisodes === 'object') {
   // ... (existing episode parsing logic) ...
        if (Array.isArray(rawEpisodes)) {
          const sortedEpisodes = [...rawEpisodes].sort(
            (a, b) => (Number(a?.episode_num ?? a?.episode_num ?? 0) - Number(b?.episode_num ?? b?.episode_num ?? 0))
          );
          seasons = [{ season_number: 1, episodes: sortedEpisodes }];
        } else {
          const seasonNumbers = Object.keys(rawEpisodes)
            .map((k) => parseInt(k, 10))
            .filter((n) => !Number.isNaN(n))
            .sort((a, b) => a - b);
          for (const seasonNum of seasonNumbers) {
            const list = rawEpisodes[seasonNum] ?? rawEpisodes[String(seasonNum)];
            const arr = Array.isArray(list)
              ? list
              : list && typeof list === 'object'
                ? Object.values(list)
                : [];
            const sortedEpisodes = [...arr].sort(
              (a, b) => (Number(a?.episode_num ?? 0) - Number(b?.episode_num ?? 0))
            );
            seasons.push({ season_number: seasonNum, episodes: sortedEpisodes });
          }
          seasons.sort((a, b) => (a.season_number ?? 0) - (b.season_number ?? 0));
        }
      }

      console.log(`[Xtream] getSeriesInfo success: ${seasons.length} seasons found for series ${seriesId}`);
      return { info, seasons };
    } catch (e) {
    if (e.name === 'AbortError') {
      console.warn(`[Xtream] getSeriesInfo timeout (30s) for series ${seriesId}`);
    } else {
      console.warn(`[Xtream] getSeriesInfo error for series ${seriesId}:`, e?.message ?? e);
    }
    return { info: null, seasons: [] };
  }
}

// ---------------------------------------------------------------------------
// getSeriesEpisodes — Bulletproof Parser with timeout (never hang)
// ---------------------------------------------------------------------------

const SERIES_EPISODES_TIMEOUT_MS = 12000;

export const getSeriesEpisodes = async (baseUrl, username, password, seriesId) => {
  let data = null;
  try {
    const base = normalizeUrl(baseUrl) || ensureHttpUrl(baseUrl);
    if (!base || !username || !password || seriesId == null) return [];
    const url = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_series_info&series_id=${seriesId}`;
    logSafeUrl('getSeriesEpisodes', url, password);
    console.log('[Xtream] Requesting Series:', seriesId);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SERIES_EPISODES_TIMEOUT_MS);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('[Xtream] getSeriesEpisodes HTTP', response.status);
      return [];
    }
    const raw = await response.text();
    try {
      data = JSON.parse(raw);
    } catch (parseErr) {
      console.warn('[Xtream] getSeriesEpisodes JSON parse failed');
      return [];
    }

    if (data != null && typeof data === 'object') {
      console.log('[Xtream] Raw Data Keys:', Object.keys(data));
      console.log('[Xtream] Raw Series Data:', JSON.stringify(data).substring(0, 200));
    }

    // STRATEGY A: data.episodes — array or object
    if (data && data.episodes !== undefined) {
      if (Array.isArray(data.episodes)) {
        console.log('[Xtream] Found episodes (array)');
        return data.episodes;
      }
      if (data.episodes && typeof data.episodes === 'object') {
        console.log('[Xtream] Found episodes (object map)');
        return Object.values(data.episodes).flat();
      }
    }

    // STRATEGY B: data is direct array
    if (Array.isArray(data)) {
      console.log('[Xtream] Found direct array');
      return data;
    }

    // STRATEGY C: root map with integer keys
    if (data && typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length > 0 && !Number.isNaN(parseInt(keys[0], 10))) {
        console.log('[Xtream] Found root map format');
        return Object.values(data).flat();
      }
    }

    console.warn('[Xtream] Unknown Data Format');
    return [];
  } catch (error) {
    if (error?.name === 'AbortError') console.warn('[Xtream] getSeriesEpisodes Timeout');
    else console.error('[Xtream] getSeriesEpisodes Error:', error);
    return [];
  }
};

// ---------------------------------------------------------------------------
// getSeriesInfoWithSeasons — alias: same as getSeriesInfo (seasons use season_number)
// ---------------------------------------------------------------------------

export async function getSeriesInfoWithSeasons(opts) {
  const result = await getSeriesInfo(opts);
  if (!result || !result.seasons) return { info: result?.info ?? null, seasons: [] };
  const seasons = (result.seasons || []).map((s) => ({
    seasonNumber: s.season_number ?? s.seasonNumber ?? 0,
    episodes: s.episodes || [],
  }));
  return { info: result.info ?? null, seasons };
}

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------

export default {
  authenticate,
  getLiveCategories,
  getLiveStreams,
  getVodStreams,
  getMovies,
  getSeriesList,
  getSeries,
  getSeriesInfo,
  getSeriesInfoWithSeasons,
  getSeriesEpisodes,
  getEpg,
  bulkFetchEpgXMLTV,
  bulkFetchEpgByChannels,
  buildLiveStreamUrl,
  buildLiveCatchupUrl,
  buildVodStreamUrl,
  buildSeriesStreamUrl,
  normalizeUrl,
  buildPlayerApiUrl,
};