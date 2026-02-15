import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Accelerometer } from 'expo-sensors';
import { useFocusEffect } from '@react-navigation/native';
import { playSfx as playGlobalSfx, getSfxVolume, getGameMusicEnabled } from '../services/SoundService';
import GameSoundModal from '../components/GameSoundModal';

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

function KingTuffheadAvatar({ golden = false }) {
  return (
    <View style={[styles.avatarWrap, golden && styles.avatarWrapGolden]}>
      {/* Dreads / hair */}
      <View style={styles.avatarHair} />
      <View style={[styles.avatarHairStrand, { left: 4 }]} />
      <View style={[styles.avatarHairStrand, { left: 12 }]} />
      <View style={[styles.avatarHairStrand, { left: 20 }]} />
      <View style={[styles.avatarHairStrand, { left: 28 }]} />
      <View style={[styles.avatarHairStrand, { left: 36 }]} />
      {/* Face */}
      <View style={styles.avatarFace}>
        <View style={styles.avatarBrowRow}>
          <View style={styles.avatarBrow} />
          <View style={styles.avatarBrow} />
        </View>
        <View style={styles.avatarEyeRow}>
          <View style={styles.avatarEye}>
            <View style={styles.avatarPupil} />
          </View>
          <View style={styles.avatarEye}>
            <View style={styles.avatarPupil} />
          </View>
        </View>
        <View style={styles.avatarNose} />
        <View style={styles.avatarBeard} />
        <View style={styles.avatarMouth} />
      </View>
      {/* Mic / crown accent */}
      <View style={[styles.avatarBadge, golden && styles.avatarBadgeGolden]}>
        <Ionicons name={golden ? 'mic' : 'musical-notes'} size={14} color={golden ? "#000000" : "#FFFFFF"} />
      </View>
    </View>
  );
}

// ----- DUBPLATES (Background music – KingTuffhead / Cleon Orion Johnson) -----
// To use "Inna I and I" locally: add assets/music/InnaIAndI.mp3 and use require('../../assets/music/InnaIAndI.mp3') for uri.
const DUBPLATES = [
  { id: 'inna', name: 'Inna I and I', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' }, // Replace with your track: add assets/music/InnaIAndI.mp3 or your URL
  { id: '1', name: 'Gospel Steppers', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: '2', name: 'Studio Rush Anthem', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: '3', name: 'Blessings Flow', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CENTER_X = SCREEN_WIDTH / 2;

// Lanes: Left, Center, Right (X offset from center)
const LANES = [-100, 0, 100];
const BASE_SPEED = 4;
const SPEED_INCREMENT = 0.05; // 5% every 10 seconds
const SPEED_INTERVAL_MS = 10000;
const SPAWN_INTERVAL_MS = 1200;
const PLAYER_Y = SCREEN_HEIGHT - 140;
const OBSTACLE_SIZE = 56;
const BONUS_SIZE = 48;
const COLLISION_MARGIN = 45;
const SCROLL_BONUS_POINTS = 500;

const WISDOM_FACTS = [
  'Did you know the first recording studio in Jamaica was Federal Records (1950s)?',
  'Proverbs 18:16 - A man\\\'s gift maketh room for him, and bringeth him before great men.',
  'Clement "Coxsone" Dodd opened Studio One in 1963—birthplace of ska and rocksteady.',
  'King Tubby invented dub in the 1970s by remixing on a mixing board.',
  'Bob Marley recorded "Catch a Fire" at Harry J Studio in Kingston.',
  'Proverbs 22:29 - Seest thou a man diligent in his business? He shall stand before kings.',
  'Tuff Gong Studio was founded by Bob Marley in 1970s—still running today.',
  'Duke Reid\\\'s Treasure Isle and Studio One shaped Jamaican music forever.',
  'A man\\\'s gift maketh room—your talent is your key. Keep running.',
  'Federal, Studio One, Treasure Isle: the big three of early JA music.',
];

const OBSTACLE_TYPES = ['pothole', 'badmind'];
const BONUS_TYPES = ['mic', 'scroll'];
// Motion: tilt threshold and cooldown (ms) so lane changes aren't too sensitive
const TILT_THRESHOLD = 0.35;
const MOTION_COOLDOWN_MS = 280;

let idCounter = 0;
function nextId() {
  return `obj_${++idCounter}_${Date.now()}`;
}

function getRandomLane() {
  return Math.floor(Math.random() * 3);
}

function getRandomFact() {
  return WISDOM_FACTS[Math.floor(Math.random() * WISDOM_FACTS.length)];
}

export default function KingTuffheadGameScreen({ navigation }) {
  const [gameState, setGameState] = useState('MENU');
  const [playerLane, setPlayerLane] = useState(1);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [obstacles, setObstacles] = useState([]);
  const [bonuses, setBonuses] = useState([]);
  const [speed, setSpeed] = useState(BASE_SPEED);
  const [showWisdom, setShowWisdom] = useState(false);
  const [wisdomFact, setWisdomFact] = useState('');
  const [goldenMicUnlocked, setGoldenMicUnlocked] = useState(false);
  const [sumfestBgUnlocked, setSumfestBgUnlocked] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showSoundModal, setShowSoundModal] = useState(false);
  const [sound, setSound] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTrack, setCurrentTrack] = useState('');
  const [levelUpText, setLevelUpText] = useState(null);

  const roadOffset = useRef(new Animated.Value(0)).current;
  const soundRef = useRef(null);
  const gameLoopRef = useRef(null);
  const spawnRef = useRef(null);
  const speedUpRef = useRef(null);
  const lastTimeRef = useRef(0);
  const playerLaneRef = useRef(1);
  const showWisdomRef = useRef(false);
  const lastTiltTimeRef = useRef(0);
  const lastLevelRef = useRef(1);
  const gameStateRef = useRef(gameState);
  const musicSessionRef = useRef(0); // increments to cancel in-flight audio loads
  playerLaneRef.current = playerLane;
  showWisdomRef.current = showWisdom;

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const level = 1 + Math.floor(score / 1200);
  const spawnIntervalMs = Math.max(520, SPAWN_INTERVAL_MS - (level - 1) * 140);
  const speedUpMult = SPEED_INCREMENT + Math.min(0.03, (level - 1) * 0.005);
  const roadAnimDuration = Math.max(220, 420 - (level - 1) * 18);

  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    if (level <= 1) return;
    if (lastLevelRef.current === level) return;
    lastLevelRef.current = level;
    setLevelUpText(`LEVEL ${level}`);
    const id = setTimeout(() => setLevelUpText(null), 850);
    return () => clearTimeout(id);
  }, [level, gameState]);

  const playerX = CENTER_X + LANES[playerLane];

  const moveLeft = useCallback(() => {
    if (gameState !== 'PLAYING') return;
    setPlayerLane((l) => (l > 0 ? l - 1 : l));
  }, [gameState]);

  const moveRight = useCallback(() => {
    if (gameState !== 'PLAYING') return;
    setPlayerLane((l) => (l < 2 ? l + 1 : l));
  }, [gameState]);

  const startGame = useCallback(() => {
    setGameState('PLAYING');
    setScore(0);
    setCoins(0);
    setObstacles([]);
    setBonuses([]);
    setSpeed(BASE_SPEED);
    setPlayerLane(1);
    lastTimeRef.current = 0;
  }, []);

  const onAmen = useCallback(() => {
    setScore((s) => s + SCROLL_BONUS_POINTS);
    setShowWisdom(false);
  }, []);

  const playMusic = useCallback(async () => {
    try {
      const sessionId = ++musicSessionRef.current;
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const gameVol = await getSfxVolume();
      const vol = isMuted ? 0 : Math.max(0, Math.min(1, gameVol));
      const track = DUBPLATES[Math.floor(Math.random() * DUBPLATES.length)];
      const { sound: s } = await Audio.Sound.createAsync(
        { uri: track.uri },
        { shouldPlay: true, isLooping: true, volume: vol }
      );

      // If the user left the screen / game state changed while loading, cleanup silently.
      if (sessionId !== musicSessionRef.current || gameStateRef.current !== 'PLAYING') {
        try {
          const status = await s.getStatusAsync().catch(() => null);
          if (status?.isLoaded) {
            await s.stopAsync().catch(() => {});
            await s.unloadAsync().catch(() => {});
          }
        } catch (_) { /* Silent by design */ }
        return;
      }

      soundRef.current = s;
      setSound(s);
      setCurrentTrack(track.name);
    } catch (e) {
      console.warn('[KingTuffhead] playMusic failed:', e);
    }
  }, [isMuted]);

  const stopMusic = useCallback(async () => {
    // Cancel any in-flight playMusic call.
    musicSessionRef.current += 1;
    const s = soundRef.current || sound;
    if (!s) return;
    try {
      const status = await s.getStatusAsync().catch(() => null);
      if (status?.isLoaded) {
        await s.stopAsync().catch(() => {});
        await s.unloadAsync().catch(() => {});
      }
    } catch (_) {
      // Silent by design (prevents terminal spam on already-unloaded sounds).
    } finally {
      soundRef.current = null;
      setSound(null);
      setCurrentTrack('');
    }
  }, [sound]);

  const endGame = useCallback(() => {
    playGlobalSfx('crash');
    stopMusic();
    setGameState('GAMEOVER');
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    if (spawnRef.current) clearInterval(spawnRef.current);
    if (speedUpRef.current) clearInterval(speedUpRef.current);
  }, [stopMusic]);

  const toggleMute = useCallback(async () => {
    const next = !isMuted;
    setIsMuted(next);
    const s = soundRef.current || sound;
    if (s) {
      try {
        const gameVol = await getSfxVolume();
        await s.setVolumeAsync(next ? 0 : Math.max(0, Math.min(1, gameVol)));
      } catch (e) {
        console.warn('[KingTuffhead] setVolume failed:', e);
      }
    }
  }, [isMuted, sound]);

  const handleSoundModalClose = useCallback(async () => {
    setShowSoundModal(false);
    const s = soundRef.current || sound;
    if (s && !isMuted) {
      try {
        const v = await getSfxVolume();
        await s.setVolumeAsync(Math.max(0, Math.min(1, v)));
      } catch (_) { /* Silent by design */ }
    }
  }, [sound, isMuted]);

  // Game loop: move objects, collision
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    gameLoopRef.current = setInterval(() => {
      if (showWisdomRef.current) return;
      const now = Date.now();
      const dt = Math.min((now - lastTimeRef.current) / 16, 4);
      lastTimeRef.current = now;

      setObstacles((prev) => {
        const pl = playerLaneRef.current;
        const next = prev.map((o) => ({ ...o, y: o.y + speed * dt })).filter((o) => o.y < SCREEN_HEIGHT + 50);
        for (const o of next) {
          if (o.y >= PLAYER_Y - COLLISION_MARGIN && o.y <= PLAYER_Y + COLLISION_MARGIN && o.lane === pl) {
            endGame();
            return next;
          }
        }
        return next;
      });

      setBonuses((prev) => {
        const pl = playerLaneRef.current;
        const next = prev.map((b) => ({ ...b, y: b.y + speed * dt })).filter((b) => {
          if (b.y >= PLAYER_Y - COLLISION_MARGIN && b.y <= PLAYER_Y + COLLISION_MARGIN && b.lane === pl) {
            playGlobalSfx(b.type === 'scroll' ? 'scroll' : 'coin');
            if (b.type === 'scroll') {
              setWisdomFact(getRandomFact());
              setShowWisdom(true);
            } else {
              setScore((s) => s + 100);
              setCoins((c) => c + 5);
            }
            return false;
          }
          return b.y < SCREEN_HEIGHT + 50;
        });
        return next;
      });
    }, 16);

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [gameState, speed, playerLane, endGame]);

  // Spawn obstacles & bonuses
  useEffect(() => {
    if (gameState !== 'PLAYING' || showWisdom) return;

    const spawn = () => {
      const lane = getRandomLane();
      const roll = Math.random();
      if (roll < 0.5) {
        const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
        setObstacles((prev) => [...prev, { id: nextId(), lane, y: -OBSTACLE_SIZE, type }]);
      } else {
        const type = BONUS_TYPES[Math.floor(Math.random() * BONUS_TYPES.length)];
        setBonuses((prev) => [...prev, { id: nextId(), lane, y: -BONUS_SIZE, type }]);
      }
    };

    spawnRef.current = setInterval(spawn, spawnIntervalMs);
    return () => {
      if (spawnRef.current) clearInterval(spawnRef.current);
    };
  }, [gameState, showWisdom, spawnIntervalMs]);

  // Speed up every 10s
  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    speedUpRef.current = setInterval(() => {
      setSpeed((s) => s * (1 + speedUpMult));
    }, SPEED_INTERVAL_MS);
    return () => {
      if (speedUpRef.current) clearInterval(speedUpRef.current);
    };
  }, [gameState, speedUpMult]);

  // Stop music when leaving this screen (IPTV, Radio, GameHub, etc.)
  useFocusEffect(
    useCallback(() => {
      return () => {
        stopMusic();
      };
    }, [stopMusic])
  );

  // Start music only when playing and game music is enabled
  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    let cancelled = false;
    getGameMusicEnabled().then((enabled) => {
      if (!cancelled && enabled) playMusic();
    });
    return () => { cancelled = true; };
  }, [gameState, playMusic]);

  // Scrolling road background
  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const anim = Animated.loop(
      Animated.timing(roadOffset, {
        toValue: 120,
        duration: roadAnimDuration,
        useNativeDriver: true,
        easing: Easing.linear,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [gameState, roadOffset, roadAnimDuration]);

  // Motion sensor: tilt device left/right to change lanes
  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const sub = Accelerometer.addListener((data) => {
      const now = Date.now();
      if (now - lastTiltTimeRef.current < MOTION_COOLDOWN_MS) return;
      const x = data.x;
      if (x < -TILT_THRESHOLD) {
        lastTiltTimeRef.current = now;
        setPlayerLane((l) => (l > 0 ? l - 1 : l));
      } else if (x > TILT_THRESHOLD) {
        lastTiltTimeRef.current = now;
        setPlayerLane((l) => (l < 2 ? l + 1 : l));
      }
    });
    Accelerometer.setUpdateInterval(80);
    return () => sub.remove();
  }, [gameState]);

  const buyGoldenMic = () => {
    if (coins >= 100 && !goldenMicUnlocked) {
      setCoins((c) => c - 100);
      setGoldenMicUnlocked(true);
    }
  };

  const buySumfestBg = () => {
    if (coins >= 500 && !sumfestBgUnlocked) {
      setCoins((c) => c - 500);
      setSumfestBgUnlocked(true);
    }
  };

  // ----- RENDER: MENU -----
  if (gameState === 'MENU') {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#1A0A2E', '#2D1B4E', "#121212"]} style={StyleSheet.absoluteFill} />
        <View style={styles.menuContent}>
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>KingTuffhead</Text>
            <Text style={styles.menuSub}>Studio Rush</Text>
            <Text style={styles.menuHint}>Dodge potholes & badmind. Collect vinyl & wisdom.</Text>
            <Text style={styles.menuHintSub}>Tilt device to move — or tap left/right.</Text>
            <TouchableOpacity style={styles.menuBtn} onPress={startGame} activeOpacity={0.9}>
              <LinearGradient colors={["#FFD700", '#B8860B']} style={styles.menuBtnGrad}>
                <Ionicons name="flash" size={28} color="#000000" />
                <Text style={styles.menuBtnText}>START RUN</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backBtnText}>Back to GameHub</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.credit}>Created by Cleon Orion Johnson</Text>
        </View>
      </View>
    );
  }

  // ----- RENDER: GAMEOVER + Shop -----
  if (gameState === 'GAMEOVER') {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#1A0A2E', "#121212"]} style={StyleSheet.absoluteFill} />
        <View style={styles.overContent}>
          <Text style={styles.overTitle}>Studio Time Earned</Text>
          <Text style={styles.overScore}>Score: {score}</Text>
          <Text style={styles.overCoins}>Vinyl: {coins}</Text>

          <TouchableOpacity style={styles.shopBtn} onPress={() => setShowShop(true)}>
            <Ionicons name="gift-outline" size={24} color="#FFD700" />
            <Text style={styles.shopBtnText}>Shop / Rewards</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuBtn} onPress={startGame} activeOpacity={0.9}>
            <LinearGradient colors={["#FFD700", '#B8860B']} style={styles.menuBtnGrad}>
              <Text style={styles.menuBtnText}>PLAY AGAIN</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Back to GameHub</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={showShop} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.shopBox}>
              <Text style={styles.shopTitle}>The Hook — Unlockables</Text>
              <ScrollView style={styles.shopScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.shopRow}>
                  <Ionicons name="mic" size={32} color={goldenMicUnlocked ? "#FFD700" : "#888888"} />
                  <View style={styles.shopTextWrap}>
                    <Text style={styles.shopItemName}>Golden Microphone</Text>
                    <Text style={styles.shopItemCost}>100 Vinyl</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.buyBtn, goldenMicUnlocked && styles.buyBtnDisabled]}
                    onPress={buyGoldenMic}
                    disabled={goldenMicUnlocked || coins < 100}
                  >
                    <Text style={styles.buyBtnText}>{goldenMicUnlocked ? 'Unlocked' : 'Unlock'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.shopRow}>
                  <Ionicons name="musical-notes" size={32} color={sumfestBgUnlocked ? "#FFD700" : "#888888"} />
                  <View style={styles.shopTextWrap}>
                    <Text style={styles.shopItemName}>Sumfest Stage Background</Text>
                    <Text style={styles.shopItemCost}>500 Vinyl</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.buyBtn, sumfestBgUnlocked && styles.buyBtnDisabled]}
                    onPress={buySumfestBg}
                    disabled={sumfestBgUnlocked || coins < 500}
                  >
                    <Text style={styles.buyBtnText}>{sumfestBgUnlocked ? 'Unlocked' : 'Unlock'}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
              <TouchableOpacity style={styles.modalClose} onPress={() => setShowShop(false)}>
                <Text style={styles.modalCloseText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ----- RENDER: PLAYING -----
  return (
    <View style={styles.container}>
      {/* Scenery: sky + parallax hills */}
      <LinearGradient
        colors={sumfestBgUnlocked ? ['#140022', '#2d0033', "#121212"] : ['#0C1445', '#1A1A2E', "#121212"]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.parallaxHills, { transform: [{ translateY: roadOffset }] }]}>
        <View style={[styles.hill, styles.hillBack]} />
        <View style={[styles.hill, styles.hillMid]} />
        <View style={[styles.hill, styles.hillFront]} />
      </Animated.View>

      {/* Road (3D-style track) */}
      <View style={styles.roadWrap}>
        <View style={styles.roadPerspective}>
          <Animated.View style={[styles.roadStripes, { transform: [{ translateY: roadOffset }] }]}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <View key={i} style={[styles.stripe, { top: i * 100 }]} />
            ))}
          </Animated.View>
          <View style={[styles.laneLine, { left: CENTER_X + LANES[0] - 2 }]} />
          <View style={[styles.laneLine, { left: CENTER_X + LANES[1] - 2 }]} />
          <View style={[styles.laneLine, { left: CENTER_X + LANES[2] - 2 }]} />
        </View>
      </View>

      {/* HUD */}
      <View style={styles.hud} pointerEvents="box-none">
        <View>
          <Text style={styles.hudScore}>Score: {score}</Text>
          <Text style={styles.hudLevel}>Level {level}</Text>
        </View>
        <View style={styles.hudRight}>
          <TouchableOpacity
            style={styles.hudSoundBtn}
            onPress={() => { playGlobalSfx('tap'); setShowSoundModal(true); }}
            hitSlop={8}
          >
            <Ionicons name="volume-high" size={24} color="#FFD700" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.hudMuteBtn} onPress={toggleMute} hitSlop={8}>
            <Ionicons name={isMuted ? 'volume-mute' : 'volume-medium'} size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.hudCoins}>
            <Ionicons name="disc-outline" size={20} color="#FFD700" />
            <Text style={styles.hudCoinsText}>{coins}</Text>
          </View>
        </View>
      </View>

      {levelUpText ? (
        <View style={styles.levelUpToast} pointerEvents="none">
          <Text style={styles.levelUpToastText}>{levelUpText}</Text>
        </View>
      ) : null}

      <GameSoundModal visible={showSoundModal} onClose={handleSoundModalClose} />

      {/* Obstacles (with depth shadow) */}
      {obstacles.map((o) => {
        const depth = clamp(0.65 + o.y / (SCREEN_HEIGHT * 0.9), 0.7, 1.25);
        return (
          <View
            key={o.id}
            style={[
              styles.obstacle,
              styles.obstacleShadow,
              {
                left: CENTER_X + LANES[o.lane] - OBSTACLE_SIZE / 2,
                top: o.y,
                transform: [{ scale: depth }],
              },
            ]}
          >
            {o.type === 'pothole' ? (
              <View style={styles.pothole}>
                <View style={styles.potholeInner} />
                <View style={styles.potholeCrack} />
              </View>
            ) : (
              <View style={styles.badmind}>
                <View style={styles.badmindEyes}>
                  <View style={styles.badmindEye} />
                  <View style={styles.badmindEye} />
                </View>
                <View style={styles.badmindMouth} />
              </View>
            )}
          </View>
        );
      })}+

      {/* Bonuses (with depth shadow) */}
      {bonuses.map((b) => {
        const depth = clamp(0.7 + b.y / (SCREEN_HEIGHT * 0.9), 0.75, 1.2);
        return (
          <View
            key={b.id}
            style={[
              styles.bonus,
              styles.bonusShadow,
              {
                left: CENTER_X + LANES[b.lane] - BONUS_SIZE / 2,
                top: b.y,
                transform: [{ scale: depth }],
              },
            ]}
          >
            {b.type === 'scroll' ? (
              <View style={styles.scrollBonus}>
                <View style={styles.scrollRollLeft} />
                <View style={styles.scrollRollRight} />
                <View style={styles.scrollSheet} />
              </View>
            ) : (
              <View style={styles.vinylBonus}>
                <View style={styles.vinylInner} />
                <View style={styles.vinylDot} />
              </View>
            )}
          </View>
        );
      })}+

      {/* Player: KingTuffhead (on top so always visible) */}
      <View style={[styles.player, { left: playerX - 28 }]} pointerEvents="none">
        <View style={[styles.playerShadow]}>
          <KingTuffheadAvatar golden={goldenMicUnlocked} />
        </View>
        <Text style={styles.playerNameplate} numberOfLines={1}>KingTuffhead</Text>
      </View>

      {/* Controls: tap left/right (on top so always hittable) */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlLeft} onPress={moveLeft} activeOpacity={1} />
        <TouchableOpacity style={styles.controlRight} onPress={moveRight} activeOpacity={1} />
      </View>

      {/* Wisdom Scroll Modal */}
      <Modal visible={showWisdom} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.wisdomBox}>
            <Text style={styles.wisdomTitle}>King's Wisdom!</Text>
            <Text style={styles.wisdomFact}>{wisdomFact}</Text>
            <TouchableOpacity style={styles.amenBtn} onPress={onAmen}>
              <Text style={styles.amenBtnText}>Amen</Text>
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
    backgroundColor: "#121212",
  },
  menuCard: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,215,0,0.3)',
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  credit: {
    position: 'absolute',
    bottom: 24,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  parallaxHills: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  hill: {
    position: 'absolute',
    left: '-20%',
    right: '-20%',
    height: 400,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
  },
  hillBack: {
    bottom: -80,
    backgroundColor: 'rgba(30,20,60,0.9)',
    transform: [{ scaleX: 1.4 }],
  },
  hillMid: {
    bottom: -120,
    backgroundColor: 'rgba(50,30,80,0.85)',
    transform: [{ scaleX: 1.2 }],
  },
  hillFront: {
    bottom: -160,
    backgroundColor: 'rgba(60,40,90,0.8)',
  },
  roadWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  roadPerspective: {
    height: SCREEN_HEIGHT * 0.72,
    marginHorizontal: 0,
    backgroundColor: "#252525",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,215,0,0.15)',
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  roadStripes: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  stripe: {
    position: 'absolute',
    left: '42%',
    right: '42%',
    height: 36,
    backgroundColor: "#FFD700",
    opacity: 0.85,
  },
  laneLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  hud: {
    position: 'absolute',
    top: 48,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hudScore: {
    fontSize: 20,
    fontWeight: 'bold',
    color: "#FFFFFF",
  },
  hudLevel: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
    letterSpacing: 0.6,
  },
  hudRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hudSoundBtn: { padding: 4 },
  hudMuteBtn: { padding: 4 },
  hudCoins: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hudCoinsText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: "#FFD700",
    marginLeft: 6,
  },
  levelUpToast: {
    position: 'absolute',
    top: 96,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.35)',
    zIndex: 200,
  },
  levelUpToastText: {
    color: "#FFD700",
    fontWeight: '900',
    letterSpacing: 1,
    fontSize: 12,
  },
  obstacle: {
    position: 'absolute',
    width: OBSTACLE_SIZE,
    height: OBSTACLE_SIZE,
    borderRadius: OBSTACLE_SIZE / 2,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pothole: {
    width: OBSTACLE_SIZE - 6,
    height: OBSTACLE_SIZE - 6,
    borderRadius: (OBSTACLE_SIZE - 6) / 2,
    backgroundColor: "#0B0B0B",
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  potholeInner: {
    width: OBSTACLE_SIZE - 18,
    height: OBSTACLE_SIZE - 18,
    borderRadius: (OBSTACLE_SIZE - 18) / 2,
    backgroundColor: "#141414",
    opacity: 0.9,
  },
  potholeCrack: {
    position: 'absolute',
    width: OBSTACLE_SIZE - 22,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    transform: [{ rotate: '-18deg' }],
    opacity: 0.5,
  },
  badmind: {
    width: OBSTACLE_SIZE - 8,
    height: OBSTACLE_SIZE - 8,
    borderRadius: (OBSTACLE_SIZE - 8) / 2,
    backgroundColor: "#B00020",
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badmindEyes: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  badmindEye: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  badmindMouth: {
    marginTop: 6,
    width: 20,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.55)',
    transform: [{ rotate: '6deg' }],
  },
  obstacleShadow: {
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 6,
      },
      android: { elevation: 6 },
    }),
  },
  bonus: {
    position: 'absolute',
    width: BONUS_SIZE,
    height: BONUS_SIZE,
    borderRadius: BONUS_SIZE / 2,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vinylBonus: {
    width: BONUS_SIZE - 6,
    height: BONUS_SIZE - 6,
    borderRadius: (BONUS_SIZE - 6) / 2,
    backgroundColor: "#111111",
    borderWidth: 2,
    borderColor: 'rgba(255,215,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vinylInner: {
    width: BONUS_SIZE - 20,
    height: BONUS_SIZE - 20,
    borderRadius: (BONUS_SIZE - 20) / 2,
    backgroundColor: "#1F1F1F",
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  vinylDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFD700",
  },
  scrollBonus: {
    width: BONUS_SIZE - 8,
    height: BONUS_SIZE - 10,
    borderRadius: 10,
    backgroundColor: "#E8D3A9",
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollSheet: {
    width: BONUS_SIZE - 18,
    height: BONUS_SIZE - 20,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  scrollRollLeft: {
    position: 'absolute',
    left: -2,
    top: 6,
    width: 8,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#CDB68F",
  },
  scrollRollRight: {
    position: 'absolute',
    right: -2,
    top: 6,
    width: 8,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#CDB68F",
  },
  bonusShadow: {
    ...Platform.select({
      ios: {
        shadowColor: "#FFD700",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.6,
        shadowRadius: 6,
      },
      android: { elevation: 6 },
    }),
  },
  player: {
    position: 'absolute',
    top: PLAYER_Y - 28,
    width: 56,
    alignItems: 'center',
    zIndex: 100,
  },
  playerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#7B1FA2",
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2A1A35",
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  avatarWrapGolden: {
    borderColor: 'rgba(255,215,0,0.65)',
  },
  avatarHair: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    height: 26,
    backgroundColor: "#121212",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    opacity: 0.95,
  },
  avatarHairStrand: {
    position: 'absolute',
    top: 14,
    width: 6,
    height: 20,
    backgroundColor: "#151515",
    borderRadius: 4,
    opacity: 0.9,
  },
  avatarFace: {
    position: 'absolute',
    top: 18,
    left: 10,
    right: 10,
    bottom: 8,
    backgroundColor: "#B77A4C",
    borderRadius: 16,
  },
  avatarBrowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingTop: 4,
  },
  avatarBrow: {
    width: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  avatarEyeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 3,
  },
  avatarEye: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPupil: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#111111",
  },
  avatarNose: {
    alignSelf: 'center',
    width: 6,
    height: 8,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.12)',
    marginTop: 2,
  },
  avatarBeard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 12,
    backgroundColor: "#2B1B10",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    opacity: 0.95,
  },
  avatarMouth: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    width: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
    opacity: 0.45,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  avatarBadgeGolden: {
    backgroundColor: "#FFD700",
    borderColor: 'rgba(0,0,0,0.25)',
  },
  playerShadow: {
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
      },
      android: { elevation: 10 },
    }),
  },
  playerIconGolden: {
    backgroundColor: "#B8860B",
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  playerNameplate: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '700',
    color: "#FFD700",
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    maxWidth: 70,
  },
  controls: {
    position: 'absolute',
    top: 100,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    zIndex: 50,
  },
  controlLeft: {
    flex: 1,
    minWidth: 80,
  },
  controlRight: {
    flex: 1,
    minWidth: 80,
  },
  menuContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  menuTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: "#FFD700",
    marginBottom: 8,
  },
  menuSub: {
    fontSize: 22,
    color: "#FFFFFF",
    marginBottom: 24,
  },
  menuHint: {
    fontSize: 14,
    color: "#888888",
    textAlign: 'center',
    marginBottom: 6,
  },
  menuHintSub: {
    fontSize: 12,
    color: "#666666",
    textAlign: 'center',
    marginBottom: 32,
  },
  menuBtn: {
    overflow: 'hidden',
    borderRadius: 16,
    marginBottom: 16,
  },
  menuBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 40,
    gap: 10,
  },
  menuBtnText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: "#000000",
  },
  backBtn: {
    paddingVertical: 12,
  },
  backBtnText: {
    fontSize: 16,
    color: "#888888",
  },
  overContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  creditOver: {
    position: 'absolute',
    top: 48,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  overTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: "#FFD700",
    marginBottom: 16,
  },
  overScore: {
    fontSize: 22,
    color: "#FFFFFF",
    marginBottom: 8,
  },
  overCoins: {
    fontSize: 20,
    color: "#FFD700",
    marginBottom: 24,
  },
  shopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,215,0,0.2)',
    borderRadius: 12,
    gap: 8,
  },
  shopBtnText: {
    fontSize: 16,
    color: "#FFD700",
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  wisdomBox: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 28,
    minWidth: 300,
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  wisdomTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: "#FFD700",
    marginBottom: 16,
    textAlign: 'center',
  },
  wisdomFact: {
    fontSize: 16,
    color: "#FFFFFF",
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  amenBtn: {
    backgroundColor: "#FFD700",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  amenBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: "#000000",
  },
  shopBox: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 24,
    minWidth: 320,
    maxHeight: '80%',
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  shopTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: "#FFD700",
    marginBottom: 20,
    textAlign: 'center',
  },
  shopScroll: {
    maxHeight: 280,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  shopTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  shopItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: "#FFFFFF",
  },
  shopItemCost: {
    fontSize: 14,
    color: "#FFD700",
    marginTop: 2,
  },
  buyBtn: {
    backgroundColor: "#FFD700",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buyBtnDisabled: {
    backgroundColor: "#444444",
  },
  buyBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: "#000000",
  },
  modalClose: {
    marginTop: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    color: "#FFD700",
    fontWeight: '600',
  },
});