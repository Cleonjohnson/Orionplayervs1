/**
 * JamRock Charades - Category Selector (Menu)
 * Pick Yuh Poison. How fi Play. Age gate for Big People Ting.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CHARADES_PACKS } from '../data/GameData';
import { playSfx } from '../services/SoundService';
import GameSoundModal from '../components/GameSoundModal';

const GREEN = '#007A3D';

const HOW_FI_PLAY_STEPS = [
  'Pick a pack (Kids, General, or 18+). Game locks to landscape.',
  'Put phone on your forehead so you CANNOT see the word. Friends read the word aloud.',
  'Guess the word! Tilt phone DOWN (nod) = Correct — green flash, next word, +1 score.',
  'Can\'t guess? Tilt phone UP (look up) = Pass — red flash, next word, no score.',
  'Or TAP: left side of screen = Correct, right side = Pass (if tilt doesn\'t work on your device).',
  'You have 60 seconds. Most correct guesses wins. Big People Ting requires age 18+.',
];

export default function CharadesMenuScreen({ navigation }) {
  const [showHowFiPlay, setShowHowFiPlay] = useState(false);
  const [showSoundModal, setShowSoundModal] = useState(false);

  const handlePackPress = (pack) => {
    if (pack.requiresAgeGate) {
      Alert.alert(
        'Big People Ting',
        'Are you over 18? This gets wild.',
        [
          { text: 'No', style: 'cancel', onPress: () => {} },
          { text: 'Yes', onPress: () => goToGame(pack) },
        ]
      );
      return;
    }
    goToGame(pack);
  };

  const goToGame = (pack) => {
    navigation.navigate('CharadesGame', { pack });
  };

  return (
    <View style={styles.container}>
      {/* Header - Jamaican flag colors */}
      <LinearGradient
        colors={[GREEN, "#000000", "#FFD700"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>JamRock Charades</Text>
        <Text style={styles.headerSub}>Pick Yuh Poison</Text>
        <View style={styles.headerBtns}>
          <TouchableOpacity style={styles.howFiPlayBtn} onPress={() => { playSfx('tap'); setShowSoundModal(true); }}>
            <Ionicons name="volume-high" size={22} color="#FFFFFF" />
            <Text style={styles.howFiPlayText}>Sound</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.howFiPlayBtn} onPress={() => setShowHowFiPlay(true)}>
            <Ionicons name="help-circle-outline" size={22} color="#FFFFFF" />
            <Text style={styles.howFiPlayText}>How fi Play</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
      <GameSoundModal visible={showSoundModal} onClose={() => setShowSoundModal(false)} />

      <Modal visible={showHowFiPlay} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>How fi Play — JamRock Charades</Text>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {HOW_FI_PLAY_STEPS.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <Text style={styles.stepNum}>{i + 1}.</Text>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalBtn} onPress={() => setShowHowFiPlay(false)}>
            <Text style={[styles.modalBtnText, { color: '#000000' }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {CHARADES_PACKS.map((pack) => (
          <TouchableOpacity
            key={pack.id}
            style={styles.cardWrap}
            onPress={() => { playSfx('tap'); handlePackPress(pack); }}
            activeOpacity={0.85}
          >
            <View style={[styles.card, { borderLeftColor: pack.color }]}>
              <View style={[styles.colorBar, { backgroundColor: pack.color }]} />
              <View style={styles.cardContent}>
                <Text style={styles.cardName}> {pack.name}</Text>
                <Text style={styles.cardSub}>{pack.subtitle}</Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.wordCount}>{pack.words.length} words</Text>
                  {pack.requiresAgeGate && (
                    <View style={styles.ageBadge}>
                      <Ionicons name="lock-closed" size={14} color="#FFFFFF" />
                      <Text style={styles.ageText}>18+</Text>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={24} color={pack.color} style={styles.chevron} />
              </View>
            </View>
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
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    overflow: 'hidden',
    borderLeftWidth: 6,
    flexDirection: 'row',
  },
  colorBar: {
    width: 6,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  cardContent: {
    flex: 1,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  cardName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: "#FFFFFF",
    width: '100%',
  },
  cardSub: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
    width: '100%',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
  },
  wordCount: {
    fontSize: 13,
    color: "#FFD700",
  },
  ageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D32F2F',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 10,
  },
  ageText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: '600',
    marginLeft: 4,
  },
  chevron: {
    position: 'absolute',
    right: 0,
    top: '50%',
    marginTop: -12,
  },
  headerBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 16,
  },
  howFiPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
  },
  howFiPlayText: {
    fontSize: 14,
    color: "#FFFFFF",
    marginLeft: 8,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 24,
    minWidth: 280,
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: "#FFD700",
    textAlign: 'center',
    marginBottom: 20,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  stepNum: {
    fontSize: 16,
    fontWeight: 'bold',
    color: "#FFD700",
    width: 24,
  },
  stepText: {
    flex: 1,
    fontSize: 16,
    color: "#FFFFFF",
    lineHeight: 22,
  },
  modalBtn: {
    backgroundColor: "#FFD700",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  modalBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: "#000000",
  },
});
