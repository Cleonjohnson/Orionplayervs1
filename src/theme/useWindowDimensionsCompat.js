import { useEffect, useState } from 'react';
import { Dimensions } from 'react-native';

/**
 * Compatibility hook for window dimensions.
 *
 * Some environments/builds can be missing `useWindowDimensions` from `react-native`
 * exports. This provides the same shape using `Dimensions` with a change listener.
 */
export function useWindowDimensionsCompat() {
  const [dims, setDims] = useState(() => Dimensions.get('window'));

  useEffect(() => {
    const handler = ({ window }) => setDims(window);
    const sub = Dimensions.addEventListener?.('change', handler);

    return () => {
      // RN newer: subscription has remove(); older: Dimensions.removeEventListener exists.
      if (sub && typeof sub.remove === 'function') {
        sub.remove();
      } else if (typeof Dimensions.removeEventListener === 'function') {
        Dimensions.removeEventListener('change', handler);
      }
    };
  }, []);

  return dims;
}

