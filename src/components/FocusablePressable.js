/**
 * TV/Remote-friendly Pressable with focus glow.
 * Use on Device Select, Hub, and any screen navigated with D-pad/remote.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

const defaultFocusedStyle = {
  borderColor: '#FFD700',
  borderWidth: 3,
  transform: [{ scale: 1.05 }],
  backgroundColor: '#333',
};

export default function FocusablePressable({
  children,
  style,
  focusedStyle = defaultFocusedStyle,
  onPress,
  onFocus,
  onBlur,
  ...rest
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onFocus={(e) => {
        setIsFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setIsFocused(false);
        onBlur?.(e);
      }}
      style={[style, isFocused && (focusedStyle || defaultFocusedStyle)]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

export const focusableFocusedStyles = StyleSheet.create({
  glow: {
    borderColor: 'gold',
    borderWidth: 3,
    transform: [{ scale: 1.1 }],
    backgroundColor: '#333',
  },
  subtle: {
    borderColor: '#FFD700',
    borderWidth: 2,
    transform: [{ scale: 1.02 }],
    backgroundColor: '#252525',
  },
});
