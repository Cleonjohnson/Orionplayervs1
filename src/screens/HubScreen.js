/**
 * Orion Amusement Enterprise Hub – Premium entrance
 * Radio, Games, IPTV as distinct entrances. Premium appeal (Expo: LinearGradient, typography, layout).
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  ScrollView,
  Animated,
  Image,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { playSfx } from '../services/SoundService';
import { ORION_LOGO, BRAND } from '../constants/Branding';
import FocusablePressable from '../components/FocusablePressable';
import { isTV, fs } from '../constants/device';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = 24;
const CARD_WIDTH = SCREEN_WIDTH - CARD_MARGIN * 2;
const CARD_HEIGHT = 128;
const GOLD = '#FFD700';

const ENTRANCES = [
  {
    id: 'radio',
    title: 'Radio',
    subtitle: 'Live stations & music',
    icon: 'radio',
    route: 'Radio',
    colors: ['#0d3320', '#1a472a', '#0d2818'],
    accent: '#2E7D32',
    label: 'ENTRANCE',
  },
  {
    id: 'games',
    title: 'Games',
    subtitle: 'Charades, Border Control, Politricks, Studio Rush & more',
    icon: 'game-controller',
    route: 'GameHub',
    colors: ['#2d0d2d', '#4a1a4a', '#1a0a1a'],
    accent: '#7B1FA2',
    label: 'ENTRANCE',
  },
  {
    id: 'iptv',
    title: 'IPTV',
    subtitle: 'Live TV, Movies & Series',
    icon: 'tv',
    route: 'Home',
    colors: ['#0d1828', '#1a2a4a', '#0d1220'],
    accent: '#1565C0',
    label: 'ENTRANCE',
  },
];

export default function HubScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnims = useRef(ENTRANCES.map(() => new Animated.Value(40))).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    const stagger = slideAnims.map((a, i) =>
      Animated.timing(a, { toValue: 0, duration: 350, delay: 80 * (i + 1), useNativeDriver: true })
    );
    Animated.stagger(80, stagger).start();
  }, [fadeAnim, slideAnims]);

  const handleEntrance = (ent) => {
    playSfx('tap');
    navigation.navigate(ent.route);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#0f0520', '#1a0a2e', '#0f0f0f', "#121212"]}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <View style={[styles.logoWrap, isTV && { width: 200, height: 88 }]}>
            <Image source={ORION_LOGO} style={styles.brandLogo} resizeMode="contain" />
          </View>
          <Text style={[styles.brand, { fontSize: fs(22, 28) }]}>Orion Amusement Enterprise</Text>
          <Text style={[styles.tagline, { fontSize: fs(15, 20) }]}>Pick your entrance</Text>
          <View style={styles.upgradeRow}>
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => {
                playSfx('tap');
                navigation.navigate('Settings');
              }}
            >
              <Text style={styles.upgradeText}>Upgrade to Premium</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />
        </Animated.View>

        <View style={styles.cards}>
          {ENTRANCES.map((ent, i) => (
            <Animated.View
              key={ent.id}
              style={[
                styles.cardWrap,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnims[i] }],
                },
              ]}
            >
              <FocusablePressable
                style={styles.cardTouch}
                onPress={() => handleEntrance(ent)}
                focusedStyle={styles.cardTouchFocused}
              >
                <LinearGradient
                  colors={ent.colors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.card}
                >
                  <View style={[styles.iconWrap, { backgroundColor: ent.accent + 'CC' }]}>
                    <Ionicons
                      name={ent.icon === 'radio' ? 'radio' : ent.icon === 'game-controller' ? 'game-controller' : 'tv'}
                      size={isTV ? 52 : 44}
                      color="#FFD700"
                    />
                  </View>
                  <View style={styles.cardText}>
                    <Text style={[styles.entranceLabel, isTV && { fontSize: 18 }]}>{ent.label}</Text>
                    <Text style={[styles.cardTitle, isTV && { fontSize: 34 }]}>{ent.title}</Text>
                    <Text style={[styles.cardSub, isTV && { fontSize: 22, lineHeight: 28 }]}>{ent.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={30} color="rgba(255,215,0,0.9)" style={styles.chevron} />
                </LinearGradient>
              </FocusablePressable>
            </Animated.View>
          ))}
        </View>

        <View style={styles.footer}>
          {isTV ? (
            <FocusablePressable
              style={styles.settingsBtn}
              onPress={() => {
                playSfx('tap');
                navigation.navigate('Settings');
              }}
              focusedStyle={styles.settingsBtnFocused}
            >
              <Ionicons name="settings-outline" size={fs(22, 32)} color="#888888" />
              <Text style={[styles.settingsText, { fontSize: fs(14, 22) }]}>Settings</Text>
            </FocusablePressable>
          ) : (
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => {
                playSfx('tap');
                navigation.navigate('Settings');
              }}
            >
              <Ionicons name="settings-outline" size={22} color="#888888" />
              <Text style={styles.settingsText}>Settings</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 28,
    paddingBottom: 28,
    alignItems: 'center',
  },
  logoWrap: {
    marginBottom: 16,
    width: 160,
    height: 72,
  },
  brandLogo: {
    width: '100%',
    height: '100%',
  },
  brand: {
    fontSize: 22,
    fontWeight: 'bold',
    color: "#FFD700",
    textAlign: 'center',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 10,
    letterSpacing: 0.5,
  },
  divider: {
    width: 60,
    height: 3,
    backgroundColor: 'rgba(255,215,0,0.4)',
    marginTop: 20,
    borderRadius: 2,
  },
  upgradeRow: { marginTop: 12, alignItems: 'center' },
  upgradeBtn: { backgroundColor: '#FFD700', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  upgradeText: { color: '#000', fontWeight: '700' },
  cards: {
    paddingHorizontal: CARD_MARGIN,
    paddingTop: 8,
  },
  cardWrap: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.15)',
  },
  cardTouch: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardTouchFocused: {
    borderColor: "#FFD700",
    borderWidth: 3,
    transform: [{ scale: 1.05 }],
    backgroundColor: 'transparent',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 22,
    minHeight: CARD_HEIGHT,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  cardText: {
    flex: 1,
  },
  entranceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,215,0,0.9)',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: "#FFFFFF",
    marginBottom: 6,
  },
  cardSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 18,
  },
  chevron: {
    marginLeft: 8,
  },
  footer: {
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    marginTop: 16,
    marginHorizontal: 24,
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  settingsBtnFocused: {
    borderColor: "#FFD700",
    borderWidth: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(255,215,0,0.15)',
  },
  settingsText: {
    fontSize: 14,
    color: "#888888",
  },
});