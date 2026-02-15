/**
 * TV/Remote-friendly button with visible focus state.
 * Uses onFocus/onBlur to apply a highlight when selected with a remote (D-pad).
 * Use for Main Menu Grid, Movie Posters, Player Controls, and any focusable UI.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

const GOLD = '#FFD700';

/** Highlight when focused: 3px solid gold border, scale 1.1, lighter background. */
const defaultFocusedStyle = {
  borderWidth: 3,
  borderColor: GOLD,
  borderStyle: 'solid',
  transform: [{ scale: 1.1 }],
  backgroundColor: '#2a2a2a',
};

export default function FocusableButton({
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

export const focusHighlight = StyleSheet.create({
  gold: {
    borderWidth: 3,
    borderColor: GOLD,
    borderStyle: 'solid',
    transform: [{ scale: 1.1 }],
    backgroundColor: '#2a2a2a',
  },
  subtle: {
    borderWidth: 2,
    borderColor: GOLD,
    transform: [{ scale: 1.02 }],
    backgroundColor: '#252525',
  },
});
