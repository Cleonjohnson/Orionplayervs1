/**
 * JamRock Charades - Gameplay Screen
 * Tilt down = Correct, Tilt up = Pass. 60s timer. Orientation lock landscape.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import { playSfx } from '../services/SoundService';
import GameSoundModal from '../components/GameSoundModal';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Tilt detection is calibrated per-device using a baseline.
// This prevents the word from auto-advancing when the phone is held at a constant angle.
const BASE_TILT_DELTA_THRESHOLD = 0.42; // delta from baseline required to count as a gesture
const BASE_NEUTRAL_DELTA = 0.14; // must return within this band to "re-arm" gestures
const BASE_TILT_COOLDOWN_MS = 1400;
const BASE_TILT_SUSTAIN_SAMPLES = 2; // require 2 consecutive readings beyond threshold
const GAME_DURATION = 60;

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function CharadesGameScreen({ route, navigation }) {
  const pack = route?.params?.pack;
  const packColor = pack?.color || '#4CAF50';

  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [score, setScore] = useState(0);
  const level = 1 + Math.floor(score / 6);
  const [words, setWords] = useState(() => (pack?.words ? shuffleArray(pack.words) : []));
  const [wordIndex, setWordIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [flash, setFlash] = useState(null); // 'correct' | 'pass' | null
  const [showSoundModal, setShowSoundModal] = useState(false);
  const [levelUpText, setLevelUpText] = useState(null);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const tiltLockRef = useRef(false);
  const lastTiltTimeRef = useRef(0);
  const lastTiltDirectionRef = useRef(null); // 'up' | 'down' | null
  const consecutiveTiltRef = useRef(0);
  const lastLevelRef = useRef(level);
  const baselineZRef = useRef(null);
  const tiltArmedRef = useRef(false);

  const currentWord = words[wordIndex] ?? null;

  // Shuffle the pack words ONCE per pack (do not reshuffle every render).
  useEffect(() => {
    setWords(pack?.words ? shuffleArray(pack.words) : []);
    setWordIndex(0);
    baselineZRef.current = null;
    tiltArmedRef.current = false;
  }, [pack?.id]);

  // Difficulty scales with level
  const tiltDeltaThreshold = Math.min(0.85, BASE_TILT_DELTA_THRESHOLD + (level - 1) * 0.03);
  const neutralDelta = Math.min(0.24, BASE_NEUTRAL_DELTA + (level - 1) * 0.01);
  const tiltCooldownMs = Math.max(900, BASE_TILT_COOLDOWN_MS - (level - 1) * 120);
  const tiltSustainSamples = Math.min(4, BASE_TILT_SUSTAIN_SAMPLES + Math.floor((level - 1) / 2));

  // Level-up feedback: shave a bit of time + show toast
  useEffect(() => {
    if (showGameOver) return;
    if (level <= 1) return;
    if (lastLevelRef.current === level) return;
    lastLevelRef.current = level;
    setLevelUpText(`Level ${level}!`);
    setTimeLeft((t) => Math.max(15, (t ?? 0) - 4));
    const id = setTimeout(() => setLevelUpText(null), 900);
    return () => clearTimeout(id);
  }, [level, showGameOver]);

  // Timer
  useEffect(() => {
    if (isPaused || showGameOver || words.length === 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setShowGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPaused, showGameOver, wordIndex, words.length]);

  // Orientation: lock landscape on mount, portrait on unmount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } catch (e) {
        console.warn('[Charades] Orientation lock failed:', e);
      }
    })();
    return () => {
      mounted = false;
      (async () => {
        try {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
        } catch (e) {
          console.warn('[Charades] Orientation unlock failed:', e);
        }
      })();
    };
  }, []);

  const nextWord = useCallback(() => {
    if (wordIndex >= words.length - 1) {
      setWordIndex(0);
    } else {
      setWordIndex((i) => i + 1);
    }
    tiltLockRef.current = false;
    lastTiltDirectionRef.current = null;
    consecutiveTiltRef.current = 0;
  }, [wordIndex, words.length]);

  const handleCorrect = useCallback(() => {
    if (tiltLockRef.current) return;
    tiltArmedRef.current = false;
    tiltLockRef.current = true;
    lastTiltTimeRef.current = Date.now();
    setFlash('correct');
    setScore((s) => s + 1);
    playSfx('success');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    flashAnim.setValue(0);
    Animated.timing(flashAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setFlash(null);
      nextWord();
    });
  }, [nextWord, flashAnim]);

  const handlePass = useCallback(() => {
    if (tiltLockRef.current) return;
    tiltArmedRef.current = false;
    tiltLockRef.current = true;
    lastTiltTimeRef.current = Date.now();
    setFlash('pass');
    playSfx('tap');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    flashAnim.setValue(0);
    Animated.timing(flashAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setFlash(null);
      nextWord();
    });
  }, [nextWord, flashAnim]);

  // Accelerometer: only change word on deliberate tilt (sustained beyond threshold)
  useEffect(() => {
    if (!currentWord || showGameOver) return;
    Accelerometer.setUpdateInterval(280);
    const sub = Accelerometer.addListener((data) => {
      if (isPaused || tiltLockRef.current) return;
      const now = Date.now();
      if (now - lastTiltTimeRef.current < tiltCooldownMs) return;
      const z = typeof data.z === 'number' ? data.z : 0;

      // Baseline calibration
      if (baselineZRef.current == null) {
        baselineZRef.current = z;
        return;
      }

      const delta = z - baselineZRef.current;
      const absDelta = Math.abs(delta);

      // When near-neutral, update baseline slowly and re-arm gestures.
      if (absDelta < neutralDelta) {
        tiltArmedRef.current = true;
        baselineZRef.current = baselineZRef.current * 0.9 + z * 0.1;
        lastTiltDirectionRef.current = null;
        consecutiveTiltRef.current = 0;
        return;
      }

      // Require neutral → tilt transition; prevents auto-advancing when held at constant tilt.
      if (!tiltArmedRef.current) return;

      if (delta < -tiltDeltaThreshold) {
        if (lastTiltDirectionRef.current === 'down') {
          consecutiveTiltRef.current += 1;
          if (consecutiveTiltRef.current >= tiltSustainSamples) {
            consecutiveTiltRef.current = 0;
            lastTiltDirectionRef.current = null;
            tiltArmedRef.current = false;
            handleCorrect();
          }
        } else {
          lastTiltDirectionRef.current = 'down';
          consecutiveTiltRef.current = 1;
        }
      } else if (delta > tiltDeltaThreshold) {
        if (lastTiltDirectionRef.current === 'up') {
          consecutiveTiltRef.current += 1;
          if (consecutiveTiltRef.current >= tiltSustainSamples) {
            consecutiveTiltRef.current = 0;
            lastTiltDirectionRef.current = null;
            tiltArmedRef.current = false;
            handlePass();
          }
        } else {
          lastTiltDirectionRef.current = 'up';
          consecutiveTiltRef.current = 1;
        }
      } else {
        // In-between zone: don't count samples.
        lastTiltDirectionRef.current = null;
        consecutiveTiltRef.current = 0;
      }
    });
    return () => sub.remove();
  }, [currentWord, showGameOver, isPaused, handleCorrect, handlePass, tiltDeltaThreshold, neutralDelta, tiltCooldownMs, tiltSustainSamples]);

  const handlePlayAgain = () => {
    setShowGameOver(false);
    setTimeLeft(GAME_DURATION);
    setScore(0);
    setWords(pack?.words ? shuffleArray(pack.words) : []);
    setWordIndex(0);
    setFlash(null);
    tiltLockRef.current = false;
    lastTiltDirectionRef.current = null;
    consecutiveTiltRef.current = 0;
    baselineZRef.current = null;
    tiltArmedRef.current = false;
  };

  const handleExit = () => {
    navigation.goBack();
  };

  if (!pack || words.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: packColor }]}>
        <Text style={styles.errorText}>No words in this pack.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const flashOpacity = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.85],
  });

  return (
    <View style={[styles.container, { backgroundColor: packColor }]}>
      {/* Flash overlay */}
      {flash && (
        <Animated.View
          style={[
            styles.flashOverlay,
            {
              backgroundColor: flash === 'correct' ? '#4CAF50' : '#D32F2F',
              opacity: flashOpacity,
            },
          ]}
          pointerEvents="none"
        />
      )}

      {levelUpText ? (
        <View style={styles.levelUp}>
          <Text style={styles.levelUpText}>{levelUpText}</Text>
        </View>
      ) : null}

      {/* HUD */}
      <View style={styles.hud}>
        <Text style={styles.timer}>{timeLeft}s</Text>
        <Text style={styles.score}>Score: {score} · Level {level}</Text>
      </View>

      {/* Word - tap left = Correct, tap right = Pass (works if tilt is unreliable) */}
      <View style={styles.wordRow}>
        <Pressable style={styles.tapZone} onPress={handleCorrect} />
        <View style={styles.wordWrap}>
          <Text style={styles.word} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.55}>
            {currentWord}
          </Text>
          <Text style={styles.hint}>Tilt down = Correct · Tilt up = Pass</Text>
          <Text style={styles.tapHint}>Or TAP: left = Correct · right = Pass</Text>
        </View>
        <Pressable style={styles.tapZone} onPress={handlePass} />
      </View>

      {/* Game Over Modal */}
      <Modal visible={showGameOver} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Game Over</Text>
            <Text style={styles.modalScore}>Score: {score}</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={handlePlayAgain}>
              <Text style={styles.modalBtnText}>Play Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalBtnAlt} onPress={handleExit}>
              <Text style={styles.modalBtnAltText}>Exit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  hud: {
    position: 'absolute',
    top: 16,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  levelUp: {
    position: 'absolute',
    top: 64,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  levelUpText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  timer: {
    fontSize: 28,
    fontWeight: 'bold',
    color: "#FFFFFF",
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  score: {
    fontSize: 22,
    fontWeight: '600',
    color: "#FFFFFF",
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  hudSoundBtn: { padding: 4 },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    flex: 1,
  },
  tapZone: {
    flex: 1,
    minHeight: 200,
    alignSelf: 'stretch',
  },
  wordWrap: {
    flex: 2,
    minWidth: 0,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: SCREEN_WIDTH * 0.72,
  },
  word: {
    fontSize: Math.min(SCREEN_WIDTH * 0.1, 64),
    fontWeight: 'bold',
    color: "#FFFFFF",
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    includeFontPadding: false,
  },
  hint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 12,
  },
  tapHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 6,
  },
  errorText: {
    fontSize: 18,
    color: "#FFFFFF",
    marginBottom: 20,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
  },
  btnText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 32,
    minWidth: 280,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: "#FFFFFF",
    marginBottom: 12,
  },
  modalScore: {
    fontSize: 22,
    color: '#FFD700',
    marginBottom: 24,
  },
  modalBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: "#FFFFFF",
  },
  modalBtnAlt: {
    paddingVertical: 12,
  },
  modalBtnAltText: {
    fontSize: 16,
    color: '#888',
  },
});