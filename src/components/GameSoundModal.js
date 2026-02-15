/**
 * GameSoundModal - In-game sound options: Sound Effects on/off + Volume slider.
 * Use from GameHub or any game screen so users can turn sound up/down without leaving.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Switch,
} from 'react-native';
import TouchableOpacity from './TouchableOpacity';
import Ionicons from '@expo/vector-icons/Ionicons';
import Slider from '@react-native-community/slider';
import {
  getSfxEnabled,
  setSfxEnabled,
  getSfxVolume,
  setSfxVolume,
  getGameMusicEnabled,
  setGameMusicEnabled,
  playSfx,
} from '../services/SoundService';

const GOLD = '#FFD700';
const CARD_BG = '#1e1e1e';

export default function GameSoundModal({ visible, onClose }) {
  const [enabled, setEnabled] = useState(true);
  const [volume, setVolume] = useState(1);
  const [gameMusicEnabled, setGameMusicEnabledState] = useState(true);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const [e, v, gm] = await Promise.all([getSfxEnabled(), getSfxVolume(), getGameMusicEnabled()]);
        if (!cancelled) {
          setEnabled(e);
          setVolume(v);
          setGameMusicEnabledState(gm);
        }
      } catch (err) {
        if (!cancelled) setEnabled(true);
      }
    })();
    return () => { cancelled = true; };
  }, [visible]);

  const handleToggle = async (value) => {
    setEnabled(value);
    try {
      await setSfxEnabled(value);
      if (value) playSfx('tap');
    } catch (e) {
      console.warn('Set SFX enabled error:', e);
    }
  };

  const handleVolumeChange = (v) => setVolume(v);
  const handleVolumeComplete = async (v) => {
    try {
      await setSfxVolume(v);
      if (v > 0 && enabled) playSfx('tap');
    } catch (e) {
      console.warn('Set volume error:', e);
    }
  };

  const handleGameMusicToggle = async (value) => {
    setGameMusicEnabledState(value);
    try {
      await setGameMusicEnabled(value);
      if (value) playSfx('tap');
    } catch (e) {
      console.warn('Set game music enabled error:', e);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.box}>
          <View style={styles.header}>
            <Ionicons name="volume-high" size={24} color={GOLD} />
            <Text style={styles.title}>Game sound</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={28} color="#888" />
            </TouchableOpacity>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Sound effects</Text>
            <Switch
              value={enabled}
              onValueChange={handleToggle}
              trackColor={{ false: '#333', true: GOLD }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Game music (during gameplay only)</Text>
            <Switch
              value={gameMusicEnabled}
              onValueChange={handleGameMusicToggle}
              trackColor={{ false: '#333', true: GOLD }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.volumeRow}>
            <Text style={styles.label}>Volume</Text>
            <View style={styles.sliderWrap}>
              <Ionicons name="volume-mute-outline" size={20} color={GOLD} />
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={1}
                value={volume}
                onValueChange={handleVolumeChange}
                onSlidingComplete={handleVolumeComplete}
                minimumTrackTintColor={GOLD}
                maximumTrackTintColor="#333"
                thumbTintColor={GOLD}
              />
              <Ionicons name="volume-high-outline" size={20} color={GOLD} />
            </View>
          </View>
          <Text style={styles.hint}>Same setting in Settings → Sound.</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  box: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#fff', flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  label: { fontSize: 15, color: '#fff' },
  volumeRow: { marginBottom: 8 },
  sliderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
  },
  slider: { flex: 1, height: 36 },
  hint: { fontSize: 12, color: '#666', marginTop: 12 },
});
