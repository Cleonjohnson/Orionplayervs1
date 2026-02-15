import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import axios from 'axios';

/** HTTP client with 5-minute timeout for playlist/API calls. Prevents large library fetches from failing at 60s on Android TV/Firestick. */
export const api = axios.create({
  timeout: 300000, // 5 minutes (300000 ms)
});

let dbInstance = null;
let dbPromise = null;

const getDBConnection = async () => {
  if (Platform.OS === 'web') {
    console.warn('[DB] SQLite unavailable on web');
    return null;
  }
  if (dbInstance) return dbInstance;
  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        const db = await SQLite.openDatabaseAsync('orion_v3.db');
        if (!db) {
          console.error('[DB] openDatabaseAsync returned null');
          return null;
        }
        await db.execAsync(`
          PRAGMA journal_mode = WAL;
          CREATE TABLE IF NOT EXISTS channels (id INTEGER PRIMARY KEY NOT NULL, stream_id INTEGER, name TEXT, stream_icon TEXT, category_id TEXT, stream_type TEXT);
          CREATE TABLE IF NOT EXISTS movies (id INTEGER PRIMARY KEY NOT NULL, stream_id INTEGER, name TEXT, stream_icon TEXT, category_id TEXT, container_extension TEXT, rating REAL, added_date TEXT);
          CREATE TABLE IF NOT EXISTS series (id INTEGER PRIMARY KEY NOT NULL, series_id INTEGER, name TEXT, cover TEXT, category_id TEXT, rating REAL, last_modified TEXT);
          CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY NOT NULL, name TEXT, type TEXT);
          CREATE TABLE IF NOT EXISTS favorites (id INTEGER PRIMARY KEY NOT NULL, stream_id INTEGER, name TEXT, stream_icon TEXT, type TEXT, UNIQUE(stream_id, type));
          CREATE TABLE IF NOT EXISTS user_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT);
          CREATE TABLE IF NOT EXISTS series_cache (series_id INTEGER PRIMARY KEY NOT NULL, info_json TEXT, episodes_json TEXT, cached_at INTEGER);
          CREATE TABLE IF NOT EXISTS epg_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            stream_id INTEGER NOT NULL,
            channel_name TEXT,
            epg_id TEXT,
            title TEXT,
            description TEXT,
            start_timestamp INTEGER,
            stop_timestamp INTEGER,
            cached_at INTEGER,
            UNIQUE(stream_id, start_timestamp)
          );
          CREATE INDEX IF NOT EXISTS idx_epg_stream ON epg_cache(stream_id);
          CREATE INDEX IF NOT EXISTS idx_epg_time ON epg_cache(start_timestamp);
          CREATE TABLE IF NOT EXISTS subtitle_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            stream_id INTEGER NOT NULL,
            type TEXT,
            language TEXT,
            url TEXT,
            content TEXT,
            cached_at INTEGER,
            UNIQUE(stream_id, language, type)
          );
          CREATE INDEX IF NOT EXISTS idx_subtitle_stream ON subtitle_cache(stream_id);
        `);
        console.log('[DB] Connected');
        return db;
      } catch (e) {
        console.error('[DB] Init Error:', e);
        dbPromise = null;
        dbInstance = null;
        throw e;
      }
    })();
  }
  try {
    const db = await dbPromise;
    if (db) dbInstance = db;
    return db;
  } catch (e) {
    dbPromise = null;
    return null;
  }
};

// --- INITIALIZATION ---
export const initDB = async () => {
  try {
    const db = await getDBConnection();
    if (!db) return;
    
    // Migration: Drop old watch_history table and recreate with new schema
    try {
      await db.execAsync('DROP TABLE IF EXISTS watch_history');
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS watch_history (
          stream_id INTEGER PRIMARY KEY NOT NULL, 
          name TEXT, 
          stream_icon TEXT, 
          type TEXT, 
          position INTEGER, 
          duration INTEGER, 
          last_watched INTEGER
        )
      `);
      console.log('[DB] watch_history table created/migrated');
    } catch (migrationErr) {
      console.warn('[DB] watch_history migration error:', migrationErr);
    }
    // Seed free local TV from iptv-org index (Jamaica)
    try {
      await syncFreeTvFromIptvOrg();
      console.log('[DB] syncFreeTvFromIptvOrg completed');
    } catch (e) {
      console.warn('[DB] syncFreeTvFromIptvOrg error:', e);
    }
  } catch (e) {
    console.warn('[DB] initDB:', e);
  }
};

// --- SAVING (from API sync) ---
export const saveCategories = async (categories, type) => {
  try {
    const db = await getDBConnection();
    if (!db) return;
    await db.runAsync('DELETE FROM categories WHERE type = ?', [type]);
    if (!categories?.length) return;
    const stmt = await db.prepareAsync('INSERT INTO categories (id, name, type) VALUES ($id, $name, $type)');
    for (const c of categories) {
      const id = String(c.category_id ?? c.cat_id ?? c.id ?? '');
      let name = c.category_name ?? c.cat_name ?? c.name ?? '';
      if (!name || String(name) === String(id)) name = id ? `Category ${id}` : 'Uncategorized';
      await stmt.executeAsync({ $id: id, $name: name, $type: type });
    }
    await stmt.finalizeAsync();
  } catch (e) {
    console.warn('[DB] saveCategories:', e);
  }
};

export const saveChannels = async (data) => {
  try {
    const db = await getDBConnection();
    if (!db) return;
    await db.runAsync('DELETE FROM channels');
    if (!data?.length) return;
    const stmt = await db.prepareAsync('INSERT INTO channels (stream_id, name, stream_icon, category_id, stream_type) VALUES ($id, $name, $icon, $cat, $type)');
    for (const c of data) {
      await stmt.executeAsync({
        $id: c.stream_id ?? c.num,
        $name: c.name ?? '',
        $icon: c.stream_icon ?? c.logo ?? null,
        $cat: String(c.category_id ?? c.cat_id ?? ''),
        $type: c.stream_type ?? 'live',
      });
    }
    await stmt.finalizeAsync();
  } catch (e) {
    console.warn('[DB] saveChannels:', e);
  }
};

export const saveMovies = async (data) => {
  try {
    const db = await getDBConnection();
    if (!db) return;
    await db.runAsync('DELETE FROM movies');
    if (!data?.length) return;
    const stmt = await db.prepareAsync('INSERT INTO movies (stream_id, name, stream_icon, category_id, container_extension, rating, added_date) VALUES ($id, $name, $icon, $cat, $ext, $rating, $date)');
    for (const m of data) {
      await stmt.executeAsync({
        $id: m.stream_id ?? m.num,
        $name: m.name ?? '',
        // Providers vary wildly: prefer stream_icon, then common alternates.
        $icon: m.stream_icon ?? m.movie_image ?? m.cover ?? m.logo ?? m.icon ?? null,
        $cat: String(m.category_id ?? m.cat_id ?? ''),
        $ext: m.container_extension ?? 'mp4',
        $rating: m.rating ?? 0,
        $date: m.added ?? '0',
      });
    }
    await stmt.finalizeAsync();
  } catch (e) {
    console.warn('[DB] saveMovies:', e);
  }
};

export const saveSeries = async (data) => {
  try {
    const db = await getDBConnection();
    if (!db) return;
    await db.runAsync('DELETE FROM series');
    if (!data?.length) return;
    const stmt = await db.prepareAsync('INSERT INTO series (series_id, name, cover, category_id, rating, last_modified) VALUES ($id, $name, $cover, $cat, $rating, $mod)');
    for (const s of data) {
      const seriesId = s.series_id ?? s.id ?? s.num;
      if (seriesId == null) continue;
      await stmt.executeAsync({
        $id: seriesId,
        $name: s.name ?? s.title ?? '',
        $cover: s.cover ?? s.stream_icon ?? s.icon ?? null,
        $cat: String(s.category_id ?? s.cat_id ?? ''),
        $rating: s.rating ?? 0,
        $mod: s.last_modified ?? '0',
      });
    }
    await stmt.finalizeAsync();
  } catch (e) {
    console.warn('[DB] saveSeries:', e);
  }
};

// --- CATEGORIES ---
// Returns rows with BOTH category_id/category_name AND cat_id/cat_name for screen compatibility
function normalizeCategoryRow(r) {
  if (!r || typeof r !== 'object') return { category_id: '', category_name: 'Uncategorized', cat_id: '', cat_name: 'Uncategorized' };
  const id = String(r.category_id ?? r.cat_id ?? r.id ?? '');
  let name = r.category_name ?? r.cat_name ?? r.name ?? '';
  if (!name || String(name) === String(id)) name = id ? `Category ${id}` : 'Uncategorized';
  return { ...r, category_id: id, category_name: name, cat_id: id, cat_name: name };
}

export const getCategories = async (type = 'live') => {
  try {
    const db = await getDBConnection();
    if (!db) return [];
    let rows = (await db.getAllAsync('SELECT id as category_id, name as category_name, type FROM categories WHERE type = ? ORDER BY name', [type])) ?? [];
    if (rows.length > 0) return rows.map(normalizeCategoryRow);
    // Fallback: derive from content tables when categories table is empty
    // Use "Category X" for name since content tables only have category_id (no names)
    if (type === 'live') {
      rows = (await db.getAllAsync('SELECT DISTINCT category_id as cat_id, CASE WHEN category_id IS NULL OR category_id = "" THEN "Uncategorized" ELSE "Category " || category_id END as cat_name FROM channels WHERE stream_type = ?', ['live'])) ?? [];
    } else if (type === 'movie') {
      rows = (await db.getAllAsync('SELECT DISTINCT category_id as cat_id, CASE WHEN category_id IS NULL OR category_id = "" THEN "Uncategorized" ELSE "Category " || category_id END as cat_name FROM movies')) ?? [];
    } else if (type === 'series') {
      rows = (await db.getAllAsync('SELECT DISTINCT category_id as cat_id, CASE WHEN category_id IS NULL OR category_id = "" THEN "Uncategorized" ELSE "Category " || category_id END as cat_name FROM series')) ?? [];
    }
    return rows.map(normalizeCategoryRow);
  } catch (e) {
    console.warn('[DB] getCategories:', e);
    return [];
  }
};

/**
 * Get categories WITH cover images (auto-generated from first item in category).
 * Solves the blank folder problem when provider doesn't send category images.
 */
export const getCategoriesWithImages = async (type = 'movie') => {
  try {
    const db = await getDBConnection();
    if (!db) return [];

    let rows = [];

    if (type === 'movie') {
      // Get categories with first movie poster as cover
      rows = await db.getAllAsync(`
        SELECT 
          m.category_id,
          COALESCE(c.name, 'Category ' || m.category_id) as category_name,
          (SELECT m2.stream_icon FROM movies m2 WHERE m2.category_id = m.category_id AND m2.stream_icon IS NOT NULL AND m2.stream_icon != '' LIMIT 1) as cover_image,
          COUNT(*) as item_count
        FROM movies m
        LEFT JOIN categories c ON c.id = m.category_id AND c.type = 'movie'
        WHERE m.category_id IS NOT NULL AND m.category_id != ''
        GROUP BY m.category_id
        ORDER BY category_name
      `);
    } else if (type === 'series') {
      // Get categories with first series cover as cover
      rows = await db.getAllAsync(`
        SELECT 
          s.category_id,
          COALESCE(c.name, 'Category ' || s.category_id) as category_name,
          (SELECT s2.cover FROM series s2 WHERE s2.category_id = s.category_id AND s2.cover IS NOT NULL AND s2.cover != '' LIMIT 1) as cover_image,
          COUNT(*) as item_count
        FROM series s
        LEFT JOIN categories c ON c.id = s.category_id AND c.type = 'series'
        WHERE s.category_id IS NOT NULL AND s.category_id != ''
        GROUP BY s.category_id
        ORDER BY category_name
      `);
    } else if (type === 'live') {
      // Get categories with first channel logo as cover
      rows = await db.getAllAsync(`
        SELECT 
          ch.category_id,
          COALESCE(c.name, 'Category ' || ch.category_id) as category_name,
          (SELECT ch2.stream_icon FROM channels ch2 WHERE ch2.category_id = ch.category_id AND ch2.stream_icon IS NOT NULL AND ch2.stream_icon != '' LIMIT 1) as cover_image,
          COUNT(*) as item_count
        FROM channels ch
        LEFT JOIN categories c ON c.id = ch.category_id AND c.type = 'live'
        WHERE ch.category_id IS NOT NULL AND ch.category_id != '' AND ch.stream_type = 'live'
        GROUP BY ch.category_id
        ORDER BY category_name
      `);
    }

    // Normalize and return
    return (rows ?? []).map((r) => ({
      category_id: String(r.category_id ?? ''),
      category_name: r.category_name || `Category ${r.category_id}`,
      cat_id: String(r.category_id ?? ''),
      cat_name: r.category_name || `Category ${r.category_id}`,
      cover_image: r.cover_image || null,
      item_count: r.item_count ?? 0,
    }));
  } catch (e) {
    console.warn('[DB] getCategoriesWithImages:', e);
    return [];
  }
};

/** Fallback when categories table is empty - used by CategoryScreen */
export const getChannelCategories = async () => {
  try {
    const db = await getDBConnection();
    if (!db) return [];
    const rows = (await db.getAllAsync('SELECT DISTINCT category_id as cat_id, COALESCE(NULLIF(category_id, ""), "Uncategorized") as cat_name FROM channels WHERE stream_type = ?', ['live'])) ?? [];
    return rows.map((r) => normalizeCategoryRow({ ...r, category_id: r.cat_id, category_name: r.cat_name }));
  } catch (e) {
    console.warn('[DB] getChannelCategories:', e);
    return [];
  }
};

// --- GETTERS (critical for HomeScreen) ---
export const getChannels = async (categoryId, streamType = 'live') => {
  try {
    const db = await getDBConnection();
    if (!db) return [];
    if (categoryId && categoryId !== '' && categoryId !== 'all') {
      return (await db.getAllAsync('SELECT * FROM channels WHERE stream_type = ? AND category_id = ?', [streamType, String(categoryId)])) ?? [];
    }
    return (await db.getAllAsync('SELECT * FROM channels WHERE stream_type = ? ORDER BY stream_id LIMIT 200', [streamType])) ?? [];
  } catch (e) {
    console.warn('[DB] getChannels:', e);
    return [];
  }
};

export const getMovies = async (categoryId) => {
  try {
    const db = await getDBConnection();
    if (!db) return [];
    if (categoryId && categoryId !== '' && categoryId !== 'all') {
      return (await db.getAllAsync('SELECT * FROM movies WHERE category_id = ? ORDER BY name', [String(categoryId)])) ?? [];
    }
    return (await db.getAllAsync('SELECT * FROM movies ORDER BY name')) ?? [];
  } catch (e) {
    console.warn('[DB] getMovies:', e);
    return [];
  }
};

export const getSeries = async (categoryId) => {
  try {
    const db = await getDBConnection();
    if (categoryId && categoryId !== '' && categoryId !== 'all') {
      return (await db.getAllAsync('SELECT * FROM series WHERE category_id = ? ORDER BY name', [String(categoryId)])) ?? [];
    }
    return (await db.getAllAsync('SELECT * FROM series ORDER BY name')) ?? [];
  } catch (e) {
    console.warn('[DB] getSeries:', e);
    return [];
  }
};

export const getSeriesList = (categoryId) => getSeries(categoryId ?? null);

// --- DASHBOARD (HomeScreen rails) ---
export const getDashboardChannels = async (limit = 10) => {
  try {
    const db = await getDBConnection();
    if (!db) return [];
    return (await db.getAllAsync('SELECT * FROM channels WHERE stream_type = ? AND (category_id IS NULL OR category_id != ?) ORDER BY stream_id LIMIT ?', ['live', 'radio', limit ?? 10])) ?? [];
  } catch (e) {
    console.warn('[DB] getDashboardChannels:', e);
    return [];
  }
};

export const getTrendingMovies = async (limit = 10) => {
  try {
    const db = await getDBConnection();
    return (await db.getAllAsync('SELECT * FROM movies ORDER BY rating DESC, stream_id DESC LIMIT ?', [limit ?? 10])) ?? [];
  } catch (e) {
    console.warn('[DB] getTrendingMovies:', e);
    return [];
  }
};

export const getRecentSeries = async (limit = 10) => {
  try {
    const db = await getDBConnection();
    if (!db) return [];
    return (await db.getAllAsync('SELECT * FROM series ORDER BY series_id DESC LIMIT ?', [limit ?? 10])) ?? [];
  } catch (e) {
    console.warn('[DB] getRecentSeries:', e);
    return [];
  }
};

export const getContinueWatching = async () => {
  // Simplified: watch_history lacks name/cover for display; return empty until progress tracking is wired
  return [];
};

// --- RADIO ---
const RADIO_STATIONS = [
  { id: 99901, name: 'Irie FM', icon: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/0c/Irie_FM_logo.png/220px-Irie_FM_logo.png' },
  { id: 99902, name: 'Bob Marley Radio', icon: 'https://upload.wikimedia.org/wikipedia/commons/5/58/Bob_Marley_Signature.png' },
  { id: 99903, name: 'BBC World Service', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/BBC_World_Service_2022.svg/1200px-BBC_World_Service_2022.svg.png' },
];

export const syncRadio = async () => {
  try {
    const db = await getDBConnection();
    const existing = await db.getAllAsync("SELECT 1 FROM channels WHERE category_id = 'radio' LIMIT 1");
    if (existing?.length > 0) return;
    const stmt = await db.prepareAsync("INSERT INTO channels (stream_id, name, stream_icon, category_id, stream_type) VALUES ($id, $name, $icon, 'radio', 'live')");
    for (const s of RADIO_STATIONS) {
      await stmt.executeAsync({ $id: s.id, $name: s.name, $icon: s.icon });
    }
    await stmt.finalizeAsync();
  } catch (e) {
    console.warn('[DB] syncRadio:', e);
  }
};

/**
 * Fetch iptv-org master playlist and seed Jamaica free-local channels.
 * This attempts to find entries that reference Jamaica or JM in their metadata or title.
 */
export const syncFreeTvFromIptvOrg = async () => {
  try {
    const db = await getDBConnection();
    if (!db) return;
    const existing = await db.getAllAsync("SELECT 1 FROM channels WHERE category_id = 'free_local' LIMIT 1");
    if (existing?.length > 0) return;

    // Fetch master playlist from iptv-org and parse entries
    const m3uUrl = 'https://iptv-org.github.io/iptv/index.m3u';
    let text = '';
    try {
      const res = await api.get(m3uUrl, { responseType: 'text' });
      text = res.data || '';
    } catch (e) {
      console.warn('[syncFreeTvFromIptvOrg] fetch failed:', e?.message || e);
      return;
    }

    const lines = (text || '').split(/\r?\n/);
    const entries = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line.startsWith('#EXTINF')) {
        const info = line;
        const nameMatch = info.indexOf(',') >= 0 ? info.slice(info.indexOf(',') + 1).trim() : info;
        const nextUrl = (lines[i + 1] || '').trim();
        // Heuristic: match Jamaica mentions in info attributes or name
        const infoLower = info.toLowerCase();
        const nameLower = String(nameMatch).toLowerCase();
        if (infoLower.includes('jamaica') || infoLower.includes('jm') || nameLower.includes('jamaica') || nameLower.includes('tvj') || nameLower.includes('cvm')) {
          entries.push({ name: nameMatch || nextUrl, url: nextUrl, raw: info });
        }
      }
    }

    if (entries.length === 0) {
      console.log('[syncFreeTvFromIptvOrg] No Jamaica entries found in iptv-org index.m3u');
      return;
    }

    const stmt = await db.prepareAsync("INSERT INTO channels (stream_id, name, stream_icon, category_id, stream_type) VALUES ($id, $name, $icon, $cat, 'live')");
    let idBase = Date.now() % 100000;
    for (const e of entries) {
      const sid = 30000 + (idBase++);
      await stmt.executeAsync({ $id: sid, $name: e.name || `Free TV ${sid}`, $icon: null, $cat: 'free_local' });
    }
    await stmt.finalizeAsync();
    console.log(`[syncFreeTvFromIptvOrg] Seeded ${entries.length} free_local channels`);
  } catch (e) {
    console.warn('[syncFreeTvFromIptvOrg] error:', e);
  }
};

// --- SEARCH ---
export const searchGlobal = async (query) => {
  if (!query || typeof query !== 'string' || query.trim().length < 3) return [];
  try {
    const db = await getDBConnection();
    if (!db) return [];
    const q = `%${query.trim()}%`;
    const c = (await db.getAllAsync(`SELECT name, stream_id, stream_icon, 'live' as type FROM channels WHERE name LIKE ? LIMIT 5`, [q])) ?? [];
    const m = (await db.getAllAsync(`SELECT name, stream_id, stream_icon, container_extension, 'movie' as type FROM movies WHERE name LIKE ? LIMIT 5`, [q])) ?? [];
    const s = (await db.getAllAsync(`SELECT name, series_id as stream_id, cover as stream_icon, 'series' as type FROM series WHERE name LIKE ? LIMIT 5`, [q])) ?? [];
    return [...c, ...m, ...s];
  } catch (e) {
    console.warn('[DB] searchGlobal:', e);
    return [];
  }
};

// --- FAVORITES ---
export const addToFavorites = async (item, type) => {
  try {
    const db = await getDBConnection();
    await db.runAsync('INSERT OR IGNORE INTO favorites (stream_id, name, stream_icon, type) VALUES (?, ?, ?, ?)', [
      item.stream_id ?? item.series_id,
      item.name ?? '',
      item.stream_icon ?? item.cover ?? item.logo ?? null,
      type ?? 'movie',
    ]);
  } catch (e) {
    console.warn('[DB] addToFavorites:', e);
  }
};

export const getFavorites = async (type) => {
  try {
    const db = await getDBConnection();
    if (!db) return [];
    return (await db.getAllAsync('SELECT * FROM favorites WHERE type = ?', [type ?? 'movie'])) ?? [];
  } catch (e) {
    console.warn('[DB] getFavorites:', e);
    return [];
  }
};

// --- USER SETTINGS (Login) ---
export const saveUser = async (user) => {
  if (!user) return;
  try {
    const db = await getDBConnection();
    if (!db) return;
    if (user.username != null) await db.runAsync('INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)', ['username', String(user.username)]);
    if (user.baseUrl != null) await db.runAsync('INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)', ['baseUrl', String(user.baseUrl)]);
  } catch (e) {
    console.warn('[DB] saveUser:', e);
  }
};

// --- FAVORITES HELPERS (UniversalPlayer) ---
export const checkFavoriteStatus = async (streamId, type) => {
  try {
    const db = await getDBConnection();
    if (type) {
      const row = await db.getFirstAsync('SELECT 1 FROM favorites WHERE stream_id = ? AND type = ? LIMIT 1', [String(streamId), type]);
      return !!row;
    }
    const row = await db.getFirstAsync('SELECT 1 FROM favorites WHERE stream_id = ? LIMIT 1', [String(streamId)]);
    return !!row;
  } catch (e) {
    return false;
  }
};

export const removeFromFavorites = async (streamId, type) => {
  try {
    const db = await getDBConnection();
    if (!db) return;
    if (type) {
      await db.runAsync('DELETE FROM favorites WHERE stream_id = ? AND type = ?', [String(streamId), type]);
    } else {
      await db.runAsync('DELETE FROM favorites WHERE stream_id = ?', [String(streamId)]);
    }
    console.log('[DB] Removed from favorites:', streamId);
  } catch (e) {
    console.warn('[DB] removeFromFavorites:', e);
  }
};

// Alias for checkFavoriteStatus (simpler API)
export const checkFavorite = async (streamId) => {
  return checkFavoriteStatus(streamId, null);
};

// --- WATCH HISTORY (Continue Watching) ---

/**
 * Update or insert watch history for an item.
 * @param {Object} item - The item being watched (must have stream_id, name, stream_icon)
 * @param {number} position - Current position in milliseconds
 * @param {number} duration - Total duration in milliseconds
 */
export const updateHistory = async (item, position, duration) => {
  if (!item?.stream_id && !item?.series_id) return;
  try {
    const db = await getDBConnection();
    if (!db) return;
    const streamId = item.stream_id ?? item.series_id;
    const name = item.name ?? item.title ?? 'Untitled';
    const icon = item.stream_icon ?? item.cover ?? item.logo ?? null;
    const type = item.type ?? (item.series_id != null ? 'series' : 'movie');
    
    await db.runAsync(
      `INSERT OR REPLACE INTO watch_history (stream_id, name, stream_icon, type, position, duration, last_watched) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [String(streamId), name, icon, type, position ?? 0, duration ?? 0, Date.now()]
    );
    console.log(`[DB] History updated: ${name} at ${Math.floor((position ?? 0) / 1000)}s`);
  } catch (e) {
    console.warn('[DB] updateHistory:', e);
  }
};

/**
 * Get continue watching list (most recent first, limit 10).
 */
export const getHistory = async () => {
  try {
    const db = await getDBConnection();
    if (!db) return [];
    const rows = await db.getAllAsync(
      `SELECT * FROM watch_history 
       WHERE position > 0 AND duration > 0 
       ORDER BY last_watched DESC LIMIT 10`
    );
    return rows ?? [];
  } catch (e) {
    console.warn('[DB] getHistory:', e);
    return [];
  }
};

/**
 * Get watch position for a specific item.
 * @param {string|number} streamId - The stream_id or series_id
 * @returns {Object|null} - { position, duration } or null if not found
 */
export const getSpecificHistory = async (streamId) => {
  if (streamId == null) return null;
  try {
    const db = await getDBConnection();
    if (!db) return null;
    const row = await db.getFirstAsync(
      'SELECT position, duration FROM watch_history WHERE stream_id = ?',
      [String(streamId)]
    );
    return row ?? null;
  } catch (e) {
    console.warn('[DB] getSpecificHistory:', e);
    return null;
  }
};

/**
 * Remove item from history (called when user finishes watching - >95%).
 * @param {string|number} streamId
 */
export const removeFromHistory = async (streamId) => {
  if (streamId == null) return;
  try {
    const db = await getDBConnection();
    if (!db) return;
    await db.runAsync('DELETE FROM watch_history WHERE stream_id = ?', [String(streamId)]);
    console.log('[DB] Removed from history:', streamId);
  } catch (e) {
    console.warn('[DB] removeFromHistory:', e);
  }
};

/**
 * Clear all watch history.
 */
export const clearHistory = async () => {
  try {
    const db = await getDBConnection();
    if (!db) return;
    await db.runAsync('DELETE FROM watch_history');
    console.log('[DB] Watch history cleared');
  } catch (e) {
    console.warn('[DB] clearHistory:', e);
  }
};

// --- SERIES CACHE (Speed up series loading - reduce API timeouts) ---

/**
 * Cache series info to avoid repeated API calls.
 * Cache expires after 24 hours.
 */
export const cacheSeriesInfo = async (seriesId, info, seasons) => {
  if (seriesId == null) return;
  try {
    const db = await getDBConnection();
    if (!db) return;
    const infoJson = JSON.stringify(info || {});
    const episodesJson = JSON.stringify(seasons || []);
    await db.runAsync(
      'INSERT OR REPLACE INTO series_cache (series_id, info_json, episodes_json, cached_at) VALUES (?, ?, ?, ?)',
      [String(seriesId), infoJson, episodesJson, Date.now()]
    );
    console.log(`[DB] Cached series ${seriesId}`);
  } catch (e) {
    console.warn('[DB] cacheSeriesInfo:', e);
  }
};

/**
 * Get cached series info if available and not expired (24 hours).
 * Returns null if not found or expired.
 */
export const getCachedSeriesInfo = async (seriesId) => {
  if (seriesId == null) return null;
  try {
    const db = await getDBConnection();
    if (!db) return null;
    const row = await db.getFirstAsync(
      'SELECT info_json, episodes_json, cached_at FROM series_cache WHERE series_id = ?',
      [String(seriesId)]
    );
    if (!row) return null;

    // Check if cache is expired (24 hours)
    const age = Date.now() - (row.cached_at || 0);
    const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
    if (age > MAX_AGE) {
      console.log(`[DB] Cache expired for series ${seriesId}`);
      return null;
    }

    const info = JSON.parse(row.info_json || '{}');
    const seasons = JSON.parse(row.episodes_json || '[]');
    console.log(`[DB] Using cached series ${seriesId} (age: ${Math.floor(age / 60000)}m)`);
    return { info, seasons };
  } catch (e) {
    console.warn('[DB] getCachedSeriesInfo:', e);
    return null;
  }
};

/**
 * Clear all series cache.
 */
export const clearSeriesCache = async () => {
  try {
    const db = await getDBConnection();
    if (!db) return;
    await db.runAsync('DELETE FROM series_cache');
    console.log('[DB] Series cache cleared');
  } catch (e) {
    console.warn('[DB] clearSeriesCache:', e);
  }
};

/**
 * Clear invalid/empty cache entries (entries with 0 seasons).
 * Call this on app start to clean up failed cache entries.
 */
export const clearInvalidSeriesCache = async () => {
  try {
    const db = await getDBConnection();
    if (!db) return;
    // Delete cache entries where episodes_json is empty array
    const result = await db.runAsync(
      "DELETE FROM series_cache WHERE episodes_json = '[]' OR episodes_json IS NULL OR episodes_json = ''"
    );
    console.log('[DB] Cleared invalid series cache entries');
  } catch (e) {
    console.warn('[DB] clearInvalidSeriesCache:', e);
  }
};

// --- EPG CACHE ---

/**
 * Cache EPG data for a channel
 * @param {number} streamId - Channel stream_id
 * @param {string} channelName - Channel name
 * @param {Array} programs - EPG program list
 */
export const cacheEpgData = async (streamId, channelName, programs) => {
  if (!streamId || !Array.isArray(programs)) return;
  try {
    const db = await getDBConnection();
    if (!db) return;
    const now = Date.now();
    // Clear old EPG for this channel
    await db.runAsync('DELETE FROM epg_cache WHERE stream_id = ?', [streamId]);
    // Insert new EPG
    for (const prog of programs) {
      if (!prog.start_timestamp) continue;
      await db.runAsync(
        'INSERT OR REPLACE INTO epg_cache (stream_id, channel_name, epg_id, title, description, start_timestamp, stop_timestamp, cached_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [streamId, channelName, prog.epg_id || prog.id || '', prog.title || '', prog.description || '', prog.start_timestamp, prog.stop_timestamp || 0, now]
      );
    }
    console.log(`[DB] Cached ${programs.length} EPG entries for channel ${streamId}`);
  } catch (e) {
    console.warn('[DB] cacheEpgData error:', e);
  }
};

/**
 * Get cached EPG for a channel
 * @param {number} streamId - Channel stream_id
 * @returns {Array} EPG program list or []
 */
export const getCachedEpg = async (streamId) => {
  try {
    const db = await getDBConnection();
    if (!db) return [];
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    // Get EPG from last 24h (or future programs)
    const rows = await db.getAllAsync(
      'SELECT * FROM epg_cache WHERE stream_id = ? AND (stop_timestamp * 1000 > ? OR stop_timestamp = 0) ORDER BY start_timestamp ASC',
      [streamId, dayAgo]
    );
    return rows || [];
  } catch (e) {
    console.warn('[DB] getCachedEpg error:', e);
    return [];
  }
};

/**
 * Clear expired EPG data (older than 48h)
 */
export const clearExpiredEpg = async () => {
  try {
    const db = await getDBConnection();
    if (!db) return;
    const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
    await db.runAsync('DELETE FROM epg_cache WHERE stop_timestamp * 1000 < ?', [twoDaysAgo]);
    console.log('[DB] Cleared expired EPG entries');
  } catch (e) {
    console.warn('[DB] clearExpiredEpg error:', e);
  }
};

// --- SUBTITLE CACHE ---

/**
 * Cache subtitle for a stream
 * @param {number} streamId - Stream ID
 * @param {string} type - Type (e.g. 'movie', 'series', 'live')
 * @param {string} language - Language code
 * @param {string} url - Subtitle URL
 * @param {string} content - Subtitle content (SRT, VTT, etc.)
 */
export const cacheSubtitle = async (streamId, type, language, url, content) => {
  if (!streamId) return;
  try {
    const db = await getDBConnection();
    if (!db) return;
    const now = Date.now();
    await db.runAsync(
      'INSERT OR REPLACE INTO subtitle_cache (stream_id, type, language, url, content, cached_at) VALUES (?, ?, ?, ?, ?, ?)',
      [streamId, type || 'live', language || 'en', url || '', content || '', now]
    );
    console.log(`[DB] Cached subtitle for stream ${streamId} (${language})`);
  } catch (e) {
    console.warn('[DB] cacheSubtitle error:', e);
  }
};

/**
 * Get cached subtitle for a stream
 * @param {number} streamId - Stream ID
 * @param {string} language - Language code (optional)
 * @returns {Object|null} Subtitle object or null
 */
export const getCachedSubtitle = async (streamId, language = null) => {
  try {
    const db = await getDBConnection();
    if (!db) return null;
    if (language) {
      return await db.getFirstAsync('SELECT * FROM subtitle_cache WHERE stream_id = ? AND language = ? ORDER BY cached_at DESC LIMIT 1', [streamId, language]);
    }
    return await db.getFirstAsync('SELECT * FROM subtitle_cache WHERE stream_id = ? ORDER BY cached_at DESC LIMIT 1', [streamId]);
  } catch (e) {
    console.warn('[DB] getCachedSubtitle error:', e);
    return null;
  }
};

/**
 * Clear expired subtitles (older than 7 days)
 */
export const clearExpiredSubtitles = async () => {
  try {
    const db = await getDBConnection();
    if (!db) return;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    await db.runAsync('DELETE FROM subtitle_cache WHERE cached_at < ?', [weekAgo]);
    console.log('[DB] Cleared expired subtitle cache');
  } catch (e) {
    console.warn('[DB] clearExpiredSubtitles error:', e);
  }
};

// --- UTILITIES ---
export const clearDatabase = async () => {
  try {
    const db = await getDBConnection();
    if (!db) return;
    await db.runAsync('DELETE FROM channels');
    await db.runAsync('DELETE FROM movies');
    await db.runAsync('DELETE FROM series');
    await db.runAsync('DELETE FROM categories');
  } catch (e) {
    console.warn('[DB] clearDatabase:', e);
  }
};
