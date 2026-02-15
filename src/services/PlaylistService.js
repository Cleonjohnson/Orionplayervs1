import { saveChannels, saveCategories, saveMovies, saveSeries, clearDatabase, api } from './DatabaseService';
import * as Xtream from './XtreamService';

/** Playlist/API fetch with 5-minute timeout (uses api from DatabaseService). */
const safeFetch = async (url) => {
  try {
    console.log(`[API] Fetching: ${url}`);
    const response = await api.get(url, { responseType: 'text', validateStatus: () => true });

    if (response.status !== 200) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const text = response.data;
    if (!text || (typeof text === 'string' && text.trim() === '')) {
      console.warn('[API] Response was empty');
      return [];
    }
    try {
      const data = JSON.parse(text);
      return data;
    } catch (e) {
      console.error('[API] JSON Parse Failed. Snippet:', String(text).substring(0, 100));
      return [];
    }
  } catch (error) {
    console.error('[API] Network Request Failed:', error?.message || error);
    return [];
  }
};

export const syncLiveTV = async (cred) => {
  const user = cred?.username ?? cred?.user;
  const pass = cred?.password ?? cred?.pass;
  const url = (cred?.baseUrl ?? cred?.url ?? '').trim();
  if (!user || !pass || !url) {
    return { success: false, error: 'Missing credentials.', categoriesCount: 0, channelsCount: 0 };
  }
  const cleanUrl = url.toLowerCase().startsWith('http') ? url.replace(/\/+$/, '') : `http://${url.replace(/\/+$/, '')}`;
  const opts = { baseUrl: cleanUrl, username: user, password: pass };

  console.log('[Sync] Starting Live TV Sync...');

  try {
    // 1. Fetch live categories (optional; if API fails we still have channels and fallback from channels)
    let categories = [];
    try {
      categories = await Xtream.getLiveCategories(opts);
      if (categories && categories.length > 0) {
        await saveCategories(categories, 'live');
        console.log(`[Sync] Saved ${categories.length} live categories.`);
      }
    } catch (catErr) {
      console.warn('[Sync] getLiveCategories failed (non-fatal):', catErr?.message || catErr);
    }

    // 2. Fetch live streams
    const raw = await Xtream.getLiveStreams(opts);
    const channels = (raw || []).map((c) => ({
      stream_id: c.stream_id ?? c.num,
      name: c.name ?? '',
      stream_icon: c.stream_icon ?? c.logo ?? null,
      category_id: String(c.category_id ?? c.cat_id ?? ''),
      stream_type: String(c.stream_type ?? c.type ?? 'live').toLowerCase(),
    }));

    if (channels.length === 0) {
      console.warn('[Sync] No channels found in API response.');
      if (categories.length > 0) {
        await saveChannels([]);
        return { success: true, categoriesCount: categories.length, channelsCount: 0, message: `${categories.length} categories saved. No channels in API response (provider may restrict channel list).` };
      }
      return { success: false, error: 'No channels returned. Check URL and credentials.', categoriesCount: 0, channelsCount: 0 };
    }

    await saveChannels(channels);
    const categoriesCount = categories.length > 0 ? categories.length : new Set(channels.map((c) => c.category_id)).size;
    return { success: true, categoriesCount, channelsCount: channels.length };
  } catch (err) {
    console.error('[Sync] Live TV sync failed:', err);
    return { success: false, error: err?.message || 'Failed to sync Live TV.', categoriesCount: 0, channelsCount: 0 };
  }
};

export const syncMovies = async (cred) => {
  const user = cred?.username ?? cred?.user;
  const pass = cred?.password ?? cred?.pass;
  const url = (cred?.baseUrl ?? cred?.url ?? '').trim();
  if (!user || !pass || !url) return { success: false, count: 0 };
  const cleanUrl = url.toLowerCase().startsWith('http') ? url.replace(/\/+$/, '') : `http://${url.replace(/\/+$/, '')}`;
  const opts = { baseUrl: cleanUrl, username: user, password: pass };

  // 1. Fetch VOD (movie) categories so folder names display correctly (non-blocking)
  try {
    const categories = await Xtream.getVodCategories(opts);
    if (Array.isArray(categories) && categories.length > 0) {
      await saveCategories(categories, 'movie');
      console.log(`[Sync] Saved ${categories.length} movie categories.`);
    }
  } catch (catErr) {
    console.warn('[Sync] getVodCategories failed (non-fatal):', catErr?.message || catErr);
  }

  // 2. Fetch movies (main sync - must succeed)
  const targetUrl = `${cleanUrl}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_vod_streams`;
  const data = await safeFetch(targetUrl);
  const movies = Array.isArray(data) ? data : (data?.vod_streams ?? data?.movies ?? data?.data ?? []);
  if (movies.length > 0) await saveMovies(movies);
  return { success: true, count: movies.length };
};

export const syncSeries = async (cred) => {
  const user = cred?.username ?? cred?.user;
  const pass = cred?.password ?? cred?.pass;
  const url = (cred?.baseUrl ?? cred?.url ?? '').trim();
  if (!user || !pass || !url) return { success: false, count: 0 };
  const cleanUrl = url.toLowerCase().startsWith('http') ? url.replace(/\/+$/, '') : `http://${url.replace(/\/+$/, '')}`;
  const opts = { baseUrl: cleanUrl, username: user, password: pass };

  try {
    let categories = [];
    try {
      categories = await Xtream.getSeriesCategories(opts);
      if (categories && categories.length > 0) {
        await saveCategories(categories, 'series');
      }
    } catch (catErr) {
      console.warn('[Sync] getSeriesCategories failed (non-fatal):', catErr?.message || catErr);
    }

    const data = await Xtream.getSeriesList(opts);
    const series = Array.isArray(data) ? data : (data?.series ?? data?.data ?? []);
    if (series.length > 0) await saveSeries(series);
    return { success: true, count: series.length };
  } catch (err) {
    console.error('[Sync] Series sync failed:', err);
    return { success: false, count: 0 };
  }
};

/**
 * Enhanced sync with progress callbacks and batching to prevent memory overload
 * @param {Object} cred - Credentials
 * @param {Function} onProgress - Progress callback (type, current, total, message)
 * @returns {Object} - { success, liveCount, moviesCount, seriesCount, epgCount }
 */
export const syncAllContentWithProgress = async (cred, onProgress) => {
  const results = {
    success: true,
    liveCount: 0,
    moviesCount: 0,
    seriesCount: 0,
    epgCount: 0,
    errors: [],
  };

  try {
    // Step 1: Sync Live TV
    onProgress?.('live', 0, 100, 'Connecting to server...');
    const liveResult = await syncLiveTV(cred);
    if (liveResult.success) {
      results.liveCount = liveResult.channelsCount || 0;
      onProgress?.('live', 100, 100, `${results.liveCount} channels loaded`);
    } else {
      results.errors.push(`Live TV: ${liveResult.error}`);
      onProgress?.('live', 100, 100, 'Failed to load channels');
    }

    // Small delay to prevent API rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 2: Sync Movies
    onProgress?.('movies', 0, 100, 'Loading movies...');
    const moviesResult = await syncMovies(cred);
    if (moviesResult.success) {
      results.moviesCount = moviesResult.count || 0;
      onProgress?.('movies', 100, 100, `${results.moviesCount} movies loaded`);
    } else {
      results.errors.push('Movies: Failed to load');
      onProgress?.('movies', 100, 100, 'Failed to load movies');
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 3: Sync Series
    onProgress?.('series', 0, 100, 'Loading series...');
    const seriesResult = await syncSeries(cred);
    if (seriesResult.success) {
      results.seriesCount = seriesResult.count || 0;
      onProgress?.('series', 100, 100, `${results.seriesCount} series loaded`);
    } else {
      results.errors.push('Series: Failed to load');
      onProgress?.('series', 100, 100, 'Failed to load series');
    }

    // Step 4: Sync EPG (smart sync, limited channels)
    try {
      onProgress?.('epg', 0, 100, 'Loading TV guide...');
      const { smartEpgSync } = await import('./BackgroundSyncService');
      const epgResult = await smartEpgSync({ 
        credentials: cred, 
        force: true,
        channelLimit: 30, // Limit to 30 channels on first sync
      });
      if (epgResult.success) {
        results.epgCount = epgResult.channelCount || 0;
        onProgress?.('epg', 100, 100, `EPG loaded for ${results.epgCount} channels`);
      }
    } catch (epgErr) {
      console.warn('[Sync] EPG sync error (non-fatal):', epgErr);
      onProgress?.('epg', 100, 100, 'EPG sync skipped');
    }

    results.success = results.liveCount > 0 || results.moviesCount > 0 || results.seriesCount > 0;
    return results;
  } catch (err) {
    console.error('[Sync] syncAllContentWithProgress error:', err);
    results.success = false;
    results.errors.push(err?.message || 'Unknown error');
    return results;
  }
};

/**
 * Check if user needs onboarding (first-time setup)
 * @returns {boolean} - true if database is empty
 */
export const needsOnboarding = async () => {
  const { getMovies, getChannels, getSeries } = await import('./DatabaseService');
  const [movies, channels, series] = await Promise.all([
    getMovies(),
    getChannels(null, 'live'),
    getSeries(),
  ]);
  return (!movies?.length && !channels?.length && !series?.length);
};