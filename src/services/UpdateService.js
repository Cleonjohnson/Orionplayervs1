/**
 * Expo Updates (OTA) – check, fetch, reload.
 * Safe to call in dev/Expo Go (no-ops when updates not available).
 */

let UpdatesModule = null;
try {
  UpdatesModule = require('expo-updates');
} catch (e) {
  // expo-updates not installed or not in native build
}

const isUpdatesAvailable = () => {
  return UpdatesModule && typeof UpdatesModule.checkForUpdateAsync === 'function';
};

/**
 * Check for an OTA update. Returns { available: boolean, message: string }.
 */
export async function checkForUpdate() {
  if (!isUpdatesAvailable()) {
    return { available: false, message: 'Updates not available in this build.' };
  }
  try {
    const update = await UpdatesModule.checkForUpdateAsync();
    if (update?.isAvailable) {
      return { available: true, message: 'Update available.' };
    }
    return { available: false, message: "You're up to date." };
  } catch (e) {
    console.warn('[UpdateService] checkForUpdate error:', e);
    return { available: false, message: e?.message || 'Check failed.' };
  }
}

/**
 * Fetch and apply the latest update. Call reloadAsync() after fetch to restart with new bundle.
 */
export async function fetchAndReload() {
  if (!isUpdatesAvailable()) {
    return { ok: false, error: 'Updates not available.' };
  }
  try {
    const result = await UpdatesModule.fetchUpdateAsync();
    if (result?.isNew) {
      await UpdatesModule.reloadAsync();
      return { ok: true };
    }
    return { ok: false, error: 'No new update to apply.' };
  } catch (e) {
    console.warn('[UpdateService] fetchAndReload error:', e);
    return { ok: false, error: e?.message || 'Update failed.' };
  }
}

/**
 * Run a background check on app load; if update available, fetch and reload.
 * Call once after app is ready (e.g. after splash). No-op in Expo Go / dev.
 */
export async function checkAndApplyOnLoad() {
  if (!isUpdatesAvailable() || __DEV__) return;
  try {
    const update = await UpdatesModule.checkForUpdateAsync();
    if (!update?.isAvailable) return;
    await UpdatesModule.fetchUpdateAsync();
    await UpdatesModule.reloadAsync();
  } catch (e) {
    console.warn('[UpdateService] checkAndApplyOnLoad error:', e);
  }
}

export { isUpdatesAvailable };
