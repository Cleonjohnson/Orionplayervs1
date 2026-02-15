/**
 * GameHub - Master menu to select JamRock Charades or Border Control
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { playSfx } from '../services/SoundService';
import GameSoundModal from '../components/GameSoundModal';
import { ORION_LOGO } from '../constants/Branding';

const GREEN = '#007A3D';
const PURPLE = '#7B1FA2';
const ORANGE = '#FF8C00';
const GOLD = '#FFD700';

const GAMES = [
  {
    id: 'charades',
    name: 'JamRock Charades',
    subtitle: 'Tilt to guess. Pickney, Yardie, or Big People.',
    icon: 'happy',
    route: 'CharadesMenu',
    colors: [GREEN, '#2E7D32'],
  },
  {
    id: 'border',
    name: 'Border Control',
    subtitle: 'Immigration Officer. Admit or Secondary.',
    icon: 'hand-left',
    route: 'BorderControl',
    colors: ['#D32F2F', '#B71C1C'],
  },
  {
    id: 'politricks',
    name: 'Politricks',
    subtitle: 'Gordon House Rumble. Prosperity or Time Come.',
    icon: 'megaphone',
    route: 'Politricks',
    colors: [PURPLE, '#5E35B1'],
  },
  {
    id: 'hustle',
    name: 'Yardie Hustle',
    subtitle: 'Tap to earn. Jobs, Events, Cash Pot.',
    icon: 'briefcase',
    route: 'YardieHustle',
    colors: [ORANGE, '#E65100'],
  },
  {
    id: 'kingtuffhead',
    name: 'KingTuffhead: Studio Rush',
    subtitle: '3-lane infinite runner. Dodge potholes, collect vinyl & wisdom.',
    icon: 'musical-note',
    route: 'KingTuffhead',
    colors: [GOLD, PURPLE],
  },
];

export default function GameHubScreen({ navigation }) {
  const [showSoundModal, setShowSoundModal] = useState(false);
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[GREEN, "#000000", GOLD]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <View style={styles.headerLogoWrap}>
          <Image source={ORION_LOGO} style={styles.headerLogo} resizeMode="contain" />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>GameHub</Text>
          <Text style={styles.headerSub}>Pick yuh game. Have fun.</Text>
        </View>
        <TouchableOpacity
          style={styles.soundBtn}
          onPress={() => { playSfx('tap'); setShowSoundModal(true); }}
          hitSlop={12}
        >
          <Ionicons name="volume-high" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>
      <GameSoundModal
        visible={showSoundModal}
        onClose={() => setShowSoundModal(false)}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {GAMES.map((game) => (
          <TouchableOpacity
            key={game.id}
            style={styles.cardWrap}
            onPress={() => { playSfx('tap'); navigation.navigate(game.route); }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[game.colors[0] + '22', game.colors[1] + '11']}
              style={styles.card}
            >
              <View style={[styles.iconWrap, { backgroundColor: game.colors[0] }]}>
                <Ionicons
                  name={
                    game.icon === 'happy'
                      ? 'happy-outline'
                      : game.icon === 'hand-left'
                        ? 'hand-left-outline'
                        : game.icon === 'megaphone'
                          ? 'megaphone-outline'
                          : game.icon === 'briefcase'
                            ? 'briefcase-outline'
                            : game.icon === 'musical-note'
                              ? 'musical-notes'
                              : game.icon === 'business'
                                ? 'business-outline'
                                : 'cash-outline'
                  }
                  size={44}
                  color="#FFFFFF"
                />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardName}>{game.name}</Text>
                <Text style={styles.cardSub}>{game.subtitle}</Text>
                <Ionicons name="chevron-forward" size={24} color="#FFD700" style={styles.chevron} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  header: {
    paddingTop: 48,
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerLogoWrap: {
    width: 100,
    height: 44,
    marginBottom: 12,
  },
  headerLogo: {
    width: '100%',
    height: '100%',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: "#FFFFFF",
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 6,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  cardWrap: {
    marginBottom: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: 20,
  },
  cardName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: "#FFFFFF",
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 14,
    color: "#888888",
    // color: COLORS.textMuted,
  },
  chevron: {
    position: 'absolute',
    right: 0,
    top: '50%',
    marginTop: -12,
  },
});