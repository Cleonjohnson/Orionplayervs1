/**
 * Ensures TouchableOpacity exists on react-native before any app code runs.
 * Fixes "TouchableOpacity doesn't exist" on EAS/Expo builds where RN doesn't export it.
 */
import * as ReactNative from 'react-native';
import TouchableOpacityShim from './src/components/TouchableOpacity';
try {
  if (typeof ReactNative.TouchableOpacity === 'undefined') {
    ReactNative.TouchableOpacity = TouchableOpacityShim;
  }
} catch (_) {
  // Exports may be frozen; app still uses shim via direct imports
}
