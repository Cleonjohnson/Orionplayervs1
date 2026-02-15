/**
 * Drop-in replacement for React Native's TouchableOpacity (use Pressable under the hood).
 * Use this so existing code works when TouchableOpacity is not available in the build.
 */
import React, { useState } from 'react';
import { Pressable, Platform } from 'react-native';

export default function TouchableOpacity({ activeOpacity = 0.85, style, children, ...rest }) {
  // On TV platforms make controls focusable by default so remote navigation works.
  const tvProps = Platform.isTV ? { focusable: rest.focusable ?? true } : {};
  const [focused, setFocused] = useState(false);

  const focusStyle = Platform.isTV
    ? { borderWidth: 2, borderColor: '#FFD700', borderRadius: 8 }
    : null;

  return (
    <Pressable
      style={({ pressed }) => {
        const base = pressed ? [style, { opacity: activeOpacity }] : style;
        if (Platform.isTV && focused) {
          return Array.isArray(base) ? [...base, focusStyle] : [base, focusStyle];
        }
        return base;
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      {...tvProps}
      {...rest}
    >
      {children}
    </Pressable>
  );
}
