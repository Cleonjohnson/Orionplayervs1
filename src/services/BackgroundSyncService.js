/**
 * Orion Player 2.0 - Background Sync Service
 * Handles EPG and subtitle preloading/caching in the background
 */

import * as SecureStore from 'expo-secure-store';
import { bulkFetchEpgByChannels } from './XtreamService';
import { 
  getChannels, 
  cacheEpgData, 
  getCachedEpg, 
  clearExpiredEpg, 
  clearExpiredSubtitles 
} from './DatabaseService';

const SECURE_KEYS = {
  username: 'orion_xtream_username',
  password: 'orion_xtream_password',
  baseUrl: 'orion_xtream_base_url',
};

const SETTINGS_KEYS = {
  lastEpgSync: 'orion_last_epg_sync',
  lastSubtitleSync: 'orion_last_subtitle_sync',
};

// Sync EPG every 6 hours
const EPG_REFRESH_INTERVAL = 6 * 60 * 60 * 1000;
// Sync subtitles every 24 hours
const SUBTITLE_REFRESH_INTERVAL = 24 * 60 * 60 * 1000;

/**
 * Get credentials from SecureStore
 */
async function getCredentials() {
  try {
    const [username, password, baseUrl] = await Promise.all([
      SecureStore.getItemAsync(SECURE_KEYS.username),
      SecureStore.getItemAsync(SECURE_KEYS.password),
      SecureStore.getItemAsync(SECURE_KEYS.baseUrl),
    ]);
    return { username: username || '', password: password || '', baseUrl: baseUrl || '' };
  } catch (e) {
    console.warn('[BackgroundSync] getCredentials error:', e);
    return { username: '', password: '', baseUrl: '' };
  }
}

/**
 * Check if EPG needs refresh (based on last sync time)
 */
async function shouldRefreshEpg() {
  try {
    const lastSync = await SecureStore.getItemAsync(SETTINGS_KEYS.lastEpgSync);
    if (!lastSync) return true;
    const elapsed = Date.now() - parseInt(lastSync, 10);
    return elapsed > EPG_REFRESH_INTERVAL;
  } catch {
    return true;
  }
}

/**
 * Sync EPG for all live channels in batches
 * Strategy: Fetch EPG for top 50 channels (most used) to avoid overwhelming the API
 */
export async function syncEpgData(opts = {}) {
  console.log('[BackgroundSync] Starting EPG sync...');
  
  try {
    // Check if refresh needed
    if (!opts.force && !(await shouldRefreshEpg())) {
      console.log('[BackgroundSync] EPG sync skipped (recent sync exists)');
      return { success: true, skipped: true };
    }

    // Get credentials
    const cred = opts.credentials || await getCredentials();
    if (!cred.username || !cred.password || !cred.baseUrl) {
      console.warn('[BackgroundSync] Missing credentials for EPG sync');
      return { success: false, error: 'No credentials' };
    }

    // Get all live channels
    const channels = await getChannels(null, 'live');
    if (!channels || channels.length === 0) {
      console.log('[BackgroundSync] No channels to sync EPG for');
      return { success: true, channelCount: 0 };
    }

    // Limit to top 50 channels to avoid API overload
    const limit = Math.min(channels.length, opts.channelLimit || 50);
    const channelsToSync = channels.slice(0, limit);
    const channelIds = channelsToSync.map((c) => c.stream_id).filter((id) => id != null);

    console.log(`[BackgroundSync] Syncing EPG for ${channelIds.length} channels...`);

    // Batch fetch in groups of 10 to avoid overwhelming the API
    const BATCH_SIZE = 10;
    let synced = 0;
    
    for (let i = 0; i < channelIds.length; i += BATCH_SIZE) {
      const batch = channelIds.slice(i, i + BATCH_SIZE);
      const batchChannels = channelsToSync.slice(i, i + BATCH_SIZE);
      
      const epgMap = await bulkFetchEpgByChannels({
        baseUrl: cred.baseUrl,
        username: cred.username,
        password: cred.password,
        channelIds: batch,
        limit: 100,
      });

      // Cache results
      for (let j = 0; j < batch.length; j++) {
        const streamId = batch[j];
        const channel = batchChannels[j];
        const programs = epgMap[streamId];
        if (programs && programs.length > 0) {
          await cacheEpgData(streamId, channel?.name || '', programs);
          synced++;
        }
      }

      console.log(`[BackgroundSync] EPG batch ${Math.floor(i / BATCH_SIZE) + 1}: ${Object.keys(epgMap).length}/${batch.length} channels`);
    }

    // Clean up expired EPG
    await clearExpiredEpg();

    // Update last sync time
    await SecureStore.setItemAsync(SETTINGS_KEYS.lastEpgSync, String(Date.now()));

    console.log(`[BackgroundSync] ✅ EPG sync complete: ${synced}/${channelIds.length} channels`);
    return { success: true, channelCount: synced };
  } catch (e) {
    console.error('[BackgroundSync] syncEpgData error:', e);
    return { success: false, error: e?.message || 'Unknown error' };
  }
}

/**
 * Sync subtitles for movies/series
 * Strategy: Pre-fetch subtitle info for recently watched or favorited content
 */
export async function syncSubtitleData(opts = {}) {
  console.log('[BackgroundSync] Starting subtitle sync...');
  
  try {
    // Check if refresh needed
    const lastSync = await SecureStore.getItemAsync(SETTINGS_KEYS.lastSubtitleSync);
    if (!opts.force && lastSync) {
      const elapsed = Date.now() - parseInt(lastSync, 10);
      if (elapsed < SUBTITLE_REFRESH_INTERVAL) {
        console.log('[BackgroundSync] Subtitle sync skipped (recent sync exists)');
        return { success: true, skipped: true };
      }
    }

    // For now, subtitles are embedded in streams (expo-video handles them)
    // This function is a placeholder for future external subtitle fetching if needed

    await clearExpiredSubtitles();
    await SecureStore.setItemAsync(SETTINGS_KEYS.lastSubtitleSync, String(Date.now()));

    console.log('[BackgroundSync] ✅ Subtitle sync complete');
    return { success: true };
  } catch (e) {
    console.error('[BackgroundSync] syncSubtitleData error:', e);
    return { success: false, error: e?.message || 'Unknown error' };
  }
}

/**
 * Full background sync: EPG + Subtitles
 * Call this on app startup or when user triggers refresh
 */
export async function performBackgroundSync(opts = {}) {
  console.log('[BackgroundSync] Starting full background sync...');
  
  const results = await Promise.allSettled([
    syncEpgData(opts),
    syncSubtitleData(opts),
  ]);

  const epgResult = results[0].status === 'fulfilled' ? results[0].value : { success: false };
  const subResult = results[1].status === 'fulfilled' ? results[1].value : { success: false };

  console.log('[BackgroundSync] ✅ Background sync complete', {
    epg: epgResult.success ? 'OK' : 'FAILED',
    subtitles: subResult.success ? 'OK' : 'FAILED',
  });

  return {
    success: epgResult.success && subResult.success,
    epg: epgResult,
    subtitles: subResult,
  };
}

/**
 * Smart EPG sync: only sync channels that need updates
 * Checks cache age and syncs only stale or missing EPG
 */
export async function smartEpgSync(opts = {}) {
  console.log('[BackgroundSync] Smart EPG sync...');
  
  try {
    const cred = opts.credentials || await getCredentials();
    if (!cred.username || !cred.password || !cred.baseUrl) {
      return { success: false, error: 'No credentials' };
    }

    const channels = await getChannels(null, 'live');
    if (!channels || channels.length === 0) {
      return { success: true, channelCount: 0 };
    }

    // Check which channels need EPG refresh
    const channelsNeedingSync = [];
    const SIX_HOURS = 6 * 60 * 60 * 1000;

    for (const channel of channels.slice(0, 50)) {
      const cached = await getCachedEpg(channel.stream_id);
      if (cached.length === 0) {
        channelsNeedingSync.push(channel);
      } else {
        // Check if oldest cached entry is older than 6h
        const oldest = cached[0]?.cached_at || 0;
        if (Date.now() - oldest > SIX_HOURS) {
          channelsNeedingSync.push(channel);
        }
      }
    }

    if (channelsNeedingSync.length === 0) {
      console.log('[BackgroundSync] All EPG data is fresh');
      return { success: true, channelCount: 0, fresh: true };
    }

    console.log(`[BackgroundSync] ${channelsNeedingSync.length} channels need EPG refresh`);

    // Sync in batches
    const BATCH_SIZE = 10;
    let synced = 0;

    for (let i = 0; i < channelsNeedingSync.length; i += BATCH_SIZE) {
      const batch = channelsNeedingSync.slice(i, i + BATCH_SIZE);
      const ids = batch.map((c) => c.stream_id);

      const epgMap = await bulkFetchEpgByChannels({
        baseUrl: cred.baseUrl,
        username: cred.username,
        password: cred.password,
        channelIds: ids,
        limit: 100,
      });

      for (const channel of batch) {
        const programs = epgMap[channel.stream_id];
        if (programs && programs.length > 0) {
          await cacheEpgData(channel.stream_id, channel.name, programs);
          synced++;
        }
      }
    }

    await clearExpiredEpg();
    await SecureStore.setItemAsync(SETTINGS_KEYS.lastEpgSync, String(Date.now()));

    console.log(`[BackgroundSync] ✅ Smart EPG sync: ${synced} channels updated`);
    return { success: true, channelCount: synced };
  } catch (e) {
    console.error('[BackgroundSync] smartEpgSync error:', e);
    return { success: false, error: e?.message };
  }
}
