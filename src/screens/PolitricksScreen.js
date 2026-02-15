/**
 * Politricks - Satire Decision Game
 * Gordon House Rumble. Votes, Treasury, Scandal. Win or get voted out.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { POLITICAL_SCENARIOS } from '../data/PolitricksData';
import { playSfx } from '../services/SoundService';
import GameSoundModal from '../components/GameSoundModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GOLD = '#FFD700';
const GREEN = '#007A3D';
const ORANGE = '#FF8C00';
const PURPLE = '#7B1FA2';
const START_VOTES = 50;
const START_TREASURY = 50;
const START_SCANDAL = 0;
const WIN_VOTES = 80;
const LOSE_VOTES = 20;
const LOSE_SCANDAL = 90;

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

export default function PolitricksScreen({ navigation }) {
  const [votes, setVotes] = useState(START_VOTES);
  const [treasury, setTreasury] = useState(START_TREASURY);
  const [scandal, setScandal] = useState(START_SCANDAL);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [scenarios, setScenarios] = useState([]);
  const [result, setResult] = useState(null); // 'win' | 'voted_out' | 'imf' | 'resign'
  const [showResult, setShowResult] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showSoundModal, setShowSoundModal] = useState(false);

  const currentScenario = scenarios[scenarioIndex];
  const level = 1 + Math.floor(scenarioIndex / 5);
  const effectMult = 1 + (level - 1) * 0.18; // bigger swings as levels increase

  useEffect(() => {
    setScenarios(shuffleArray(POLITICAL_SCENARIOS));
  }, []);

  const applyEffect = useCallback((effect) => {
    setVotes((v) => clamp(v + (effect.votes || 0), 0, 100));
    setTreasury((t) => clamp(t + (effect.treasury || 0), -100, 100));
    setScandal((s) => clamp(s + (effect.scandal || 0), 0, 100));
  }, []);

  const checkGameOver = useCallback((newVotes, newTreasury, newScandal) => {
    if (newVotes >= WIN_VOTES) return 'win';
    if (newVotes < LOSE_VOTES) return 'voted_out';
    if (newTreasury < 0) return 'imf';
    if (newScandal > LOSE_SCANDAL) return 'resign';
    return null;
  }, []);

  const handleChoice = useCallback(
    (effect) => {
      playSfx('tap');
      const scaled = {
        votes: Math.round((effect?.votes || 0) * effectMult),
        treasury: Math.round((effect?.treasury || 0) * effectMult),
        scandal: Math.round((effect?.scandal || 0) * effectMult),
      };
      const newVotes = clamp(votes + (scaled.votes || 0), 0, 100);
      const newTreasury = clamp(treasury + (scaled.treasury || 0), -100, 100);
      const newScandal = clamp(scandal + (scaled.scandal || 0), 0, 100);
      applyEffect(scaled);
      const outcome = checkGameOver(newVotes, newTreasury, newScandal);
      if (outcome) {
        setResult(outcome);
        setShowResult(true);
        return;
      }
      if (scenarioIndex >= scenarios.length - 1) {
        setScenarios(shuffleArray(POLITICAL_SCENARIOS));
        setScenarioIndex(0);
      } else {
        setScenarioIndex((i) => i + 1);
      }
    },
    [votes, treasury, scandal, scenarioIndex, scenarios.length, applyEffect, checkGameOver, effectMult]
  );

  const handlePlayAgain = () => {
    setVotes(START_VOTES);
    setTreasury(START_TREASURY);
    setScandal(START_SCANDAL);
    setScenarioIndex(0);
    setScenarios(shuffleArray(POLITICAL_SCENARIOS));
    setResult(null);
    setShowResult(false);
  };

  const getResultConfig = () => {
    switch (result) {
      case 'win':
        return {
          title: 'Landslide Victory!',
          message: 'You run tings. Gordon House is yours.',
          icon: 'trophy',
          color: GOLD,
        };
      case 'voted_out':
        return {
          title: 'Voted Out!',
          message: 'Pack yuh bag. Time fi go.',
          icon: 'sad',
          color: '#f44336',
        };
      case 'imf':
        return {
          title: 'IMF Take Over',
          message: 'Austerity time. No more dubplate.',
          icon: 'wallet',
          color: ORANGE,
        };
      case 'resign':
        return {
          title: 'Resignation!',
          message: 'Integrity Commission lock yuh up.',
          icon: 'lock-closed',
          color: '#f44336',
        };
      default:
        return { title: '', message: '', icon: 'help', color: GOLD };
    }
  };

  if (scenarios.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>Loading crisis...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#2d1b4e', '#0f0f0f']} style={StyleSheet.absoluteFill} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={GOLD} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gordon House Rumble · L{level}</Text>
        <TouchableOpacity onPress={() => { playSfx('tap'); setShowSoundModal(true); }} style={styles.soundBtn} hitSlop={8}>
          <Ionicons name="volume-high" size={24} color={GOLD} />
        </TouchableOpacity>
      </View>
      <GameSoundModal visible={showSoundModal} onClose={() => setShowSoundModal(false)} />

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Ionicons name="people" size={24} color={GOLD} />
          <Text style={styles.statLabel}>Votes</Text>
          <Text style={styles.statValue}>{Math.round(votes)}%</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="wallet" size={24} color={GREEN} />
          <Text style={styles.statLabel}>Treasury</Text>
          <Text style={styles.statValue}>{Math.round(treasury)}%</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="warning" size={24} color={scandal > 50 ? '#f44336' : '#888'} />
          <Text style={styles.statLabel}>Scandal</Text>
          <Text style={styles.statValue}>{Math.round(scandal)}%</Text>
        </View>
      </View>

      {/* Crisis Card */}
      <View style={styles.cardWrap}>
        <View style={styles.crisisCard}>
          <Text style={styles.crisisLabel}>CRISIS</Text>
          <Text style={styles.crisisText}>"{currentScenario?.text}"</Text>
        </View>
      </View>

      {/* Buttons */}
      <View style={styles.buttonsWrap}>
        <TouchableOpacity
          style={styles.btnWrap}
          onPress={() => handleChoice(currentScenario?.effectA)}
          activeOpacity={0.85}
        >
          <LinearGradient colors={[GREEN, '#2E7D32']} style={styles.btn}>
            <Text style={styles.btnLabel}>Prosperity</Text>
            <Text style={styles.btnText} numberOfLines={2}>{currentScenario?.optionA}</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnWrap}
          onPress={() => handleChoice(currentScenario?.effectB)}
          activeOpacity={0.85}
        >
          <LinearGradient colors={[ORANGE, '#E65100']} style={styles.btn}>
            <Text style={styles.btnLabel}>Time Come</Text>
            <Text style={styles.btnText} numberOfLines={2}>{currentScenario?.optionB}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* How to Play Modal */}
      <Modal visible={showInstructions} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.instructionsBox}>
            <Text style={styles.instructionsTitle}>How to Play — Politricks</Text>
            <ScrollView style={styles.instructionsScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.instructionsIntro}>Satirical political decision game. You run Jamaica. Keep Votes high, Treasury funded, and Scandal low—or get voted out!</Text>
              <Text style={styles.instructionsStep}>1. You start with 50% Votes, 50% Treasury, 0% Scandal.</Text>
              <Text style={styles.instructionsStep}>2. Each crisis gives two choices: "Prosperity" (green) or "Time Come" (orange). Each choice changes Votes, Treasury, and/or Scandal.</Text>
              <Text style={styles.instructionsStep}>3. WIN: Reach 80%+ Votes → Landslide Victory!</Text>
              <Text style={styles.instructionsStep}>4. LOSE: Votes drop below 20% → Voted Out. Treasury below 0% → IMF Take Over. Scandal above 90% → Resignation.</Text>
              <Text style={styles.instructionsStep}>5. Balance populist promises (votes) with treasury cost and scandal risk. All in good fun—satire only!</Text>
            </ScrollView>
            <TouchableOpacity style={styles.instructionsBtn} onPress={() => setShowInstructions(false)}>
              <Text style={styles.instructionsBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Result Modal */}
      <Modal visible={showResult} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.resultBox}>
            <Ionicons name={getResultConfig().icon} size={64} color={getResultConfig().color} />
            <Text style={styles.resultTitle}>{getResultConfig().title}</Text>
            <Text style={styles.resultMessage}>{getResultConfig().message}</Text>
            <TouchableOpacity style={styles.resultBtn} onPress={handlePlayAgain}>
              <Text style={styles.resultBtnText}>Play Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resultBtnAlt} onPress={() => navigation.goBack()}>
              <Text style={styles.resultBtnAltText}>Back to GameHub</Text>
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
    backgroundColor: "#0f0f0f",
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: GOLD,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backBtn: { padding: 8 },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: GOLD,
  },
  soundBtn: { padding: 8 },
  placeholder: { width: 40 },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 2,
  },
  cardWrap: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  crisisCard: {
    backgroundColor: 'rgba(123, 31, 162, 0.25)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: PURPLE,
    padding: 24,
  },
  crisisLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: PURPLE,
    letterSpacing: 1,
    marginBottom: 12,
  },
  crisisText: {
    fontSize: 18,
    color: '#fff',
    lineHeight: 26,
    fontStyle: 'italic',
  },
  buttonsWrap: {
    padding: 20,
    gap: 16,
  },
  btnWrap: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  btn: {
    padding: 18,
    borderRadius: 12,
  },
  btnLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 6,
  },
  btnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  resultBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 32,
    minWidth: 280,
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: PURPLE,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    textAlign: 'center',
  },
  resultMessage: {
    fontSize: 16,
    color: '#ccc',
    marginTop: 8,
    textAlign: 'center',
  },
  resultBtn: {
    backgroundColor: PURPLE,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 24,
    width: '100%',
    alignItems: 'center',
  },
  resultBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  resultBtnAlt: {
    marginTop: 12,
    paddingVertical: 10,
  },
  resultBtnAltText: {
    fontSize: 16,
    color: '#888',
  },
});
