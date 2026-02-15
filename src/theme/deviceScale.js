/**
 * Device scale for TV vs Mobile (1.5x for TV Box).
 * Read after DeviceSelectScreen saves choice to AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_DEVICE = 'orion_device_type';

export async function getDeviceScale() {
  try {
    const device = await AsyncStorage.getItem(KEY_DEVICE);
    return device === 'tv' ? 1.5 : 1;
  } catch {
    return 1;
  }
}

export function getDeviceScaleSyncOrDefault() {
  return 1;
}
