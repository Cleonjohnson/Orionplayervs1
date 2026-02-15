/**
 * Border Control - Immigration Game
 * Passport card, Walk Good / Search Dem, score, 10 travelers then Game Over
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import {
  IMMIGRATION_SCENARIOS,
  VISA_FREE_FOR_JAMAICA,
  VISA_REQUIRED_FOR_JAMAICA,
  VISA_FACTS,
} from '../data/GameData';
import { playSfx } from '../services/SoundService';
import GameSoundModal from '../components/GameSoundModal';

// colors inlined as hex to avoid missing-constant runtime errors

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GOLD = "#FFD700";
const GREEN = '#4CAF50';
const RED = '#D32F2F';
const TRAVELERS_PER_GAME = 10;
const BASE_DECISION_TIME_S = 14;

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function BorderControlScreen({ navigation }) {
  const [score, setScore] = useState(0);
  const [travelerIndex, setTravelerIndex] = useState(0);
  const [scenarios, setScenarios] = useState([]);
  const [message, setMessage] = useState(null); // { type: 'success'|'fail', text }
  const [showMessage, setShowMessage] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [showVisaInfo, setShowVisaInfo] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showSoundModal, setShowSoundModal] = useState(false);
  const [decisionTimeLeft, setDecisionTimeLeft] = useState(BASE_DECISION_TIME_S);
  const timeoutFiredRef = useRef(false);

  const currentScenario = scenarios[travelerIndex];
  const level = useMemo(() => 1 + Math.floor(Math.max(0, score) / 3), [score]);
  const decisionTimeForLevel = useMemo(
    () => Math.max(6, BASE_DECISION_TIME_S - (level - 1) * 2),
    [level]
  );

  // Load random batch of 10 scenarios
  useEffect(() => {
    const pool = shuffleArray(IMMIGRATION_SCENARIOS);
    const batch = [];
    for (let i = 0; i < TRAVELERS_PER_GAME; i++) {
      batch.push(pool[i % pool.length]);
    }
    setScenarios(batch);
  }, []);

  // Reset per-traveler timer when traveler or level changes
  useEffect(() => {
    timeoutFiredRef.current = false;
    setDecisionTimeLeft(decisionTimeForLevel);
  }, [travelerIndex, decisionTimeForLevel]);

  // Countdown timer (harder with higher levels)
  useEffect(() => {
    if (!currentScenario) return;
    if (showMessage || showGameOver || showVisaInfo || showInstructions) return;
    if (timeoutFiredRef.current) return;
    const t = setInterval(() => {
      setDecisionTimeLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [currentScenario, showMessage, showGameOver, showVisaInfo, showInstructions]);

  // When timer hits 0, auto-fail (too slow)
  useEffect(() => {
    if (!currentScenario) return;
    if (showMessage || showGameOver) return;
    if (decisionTimeLeft > 0) return;
    if (timeoutFiredRef.current) return;
    timeoutFiredRef.current = true;
    playSfx('fail');
    setScore((s) => Math.max(0, s - (level >= 3 ? 2 : 1)));
    setMessage({
      type: 'fail',
      text: `Too slow, Officer!\n\nTime run out. ${currentScenario.reason}`,
    });
    setShowMessage(true);
  }, [decisionTimeLeft, currentScenario, showMessage, showGameOver, level]);

  const handleVerdict = useCallback(
    (allow) => {
      if (!currentScenario) return;
      timeoutFiredRef.current = true;
      const correct = currentScenario.isSuspicious ? !allow : allow;
      if (correct) {
        playSfx('success');
        setScore((s) => s + 1);
        const successMessages = [
          'Yuh catch him!',
          'Welcome home Auntie!',
          'Good eye, Officer!',
          'Send dem to secondary!',
          'Walk good—next!',
        ];
        setMessage({
          type: 'success',
          text: successMessages[Math.floor(Math.random() * successMessages.length)] + '\n\n' + currentScenario.reason,
        });
      } else {
        playSfx('fail');
        setScore((s) => Math.max(0, s - (level >= 3 ? 2 : 1)));
        const failMessages = [
          'Yuh let a scammer pass!',
          'Yuh harass innocent tourist!',
          'Wrong call, Officer!',
          'Him was clean!',
          'Dat one did legit!',
        ];
        setMessage({
          type: 'fail',
          text: failMessages[Math.floor(Math.random() * failMessages.length)] + '\n\n' + currentScenario.reason,
        });
      }
      setShowMessage(true);
    },
    [currentScenario, level]
  );

  const goNext = useCallback(() => {
    setShowMessage(false);
    setMessage(null);
    if (travelerIndex >= TRAVELERS_PER_GAME - 1) {
      setShowGameOver(true);
    } else {
      setTravelerIndex((i) => i + 1);
    }
  }, [travelerIndex]);

  const handlePlayAgain = () => {
    setShowGameOver(false);
    setScore(0);
    setTravelerIndex(0);
    setScenarios(shuffleArray(IMMIGRATION_SCENARIOS).slice(0, TRAVELERS_PER_GAME));
  };

  if (scenarios.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>Loading travelers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a2e', '#121212']}
        style={StyleSheet.absoluteFill}
      />
      {/* Top bar */}
      <View style={styles.topBar}>
          <TouchableOpacity onPress={() => { playSfx('tap'); navigation.goBack(); }} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={"#FFD700"} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Immigration Officer on Duty</Text>
        <View style={styles.topBarRight}>
          <TouchableOpacity onPress={() => { playSfx('tap'); setShowSoundModal(true); }} style={styles.visaInfoBtn}>
            <Ionicons name="volume-high" size={22} color={"#FFD700"} />
            <Text style={styles.visaInfoText}>Sound</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowInstructions(true)} style={styles.visaInfoBtn}>
            <Ionicons name="help-circle-outline" size={22} color={"#FFD700"} />
            <Text style={styles.visaInfoText}>How to Play</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { playSfx('tap'); setShowVisaInfo(true); }} style={styles.visaInfoBtn}>
            <Ionicons name="document-text-outline" size={22} color={"#FFD700"} />
            <Text style={styles.visaInfoText}>Visa Info</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.scoreWrap}>
          <Text style={styles.scoreText}>Score: {score}</Text>
          <Text style={styles.travelerCount}>Level {level} · {travelerIndex + 1} / {TRAVELERS_PER_GAME} · {decisionTimeLeft}s</Text>
        </View>
      </View>

      {/* Passport Card */}
      <View style={styles.cardWrap}>
        <View style={styles.passportCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text" size={32} color={"#FFD700"} />
            <Text style={styles.cardHeaderTitle}>PASSPORT CONTROL</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Traveler</Text>
            <Text style={styles.cardValue}>{currentScenario?.traveler}</Text>
          </View>
          {currentScenario?.nationality ? (
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Nationality</Text>
              <Text style={styles.cardValue}>{currentScenario.nationality}</Text>
            </View>
          ) : null}
          {currentScenario?.purpose ? (
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Purpose</Text>
              <Text style={styles.cardValue}>{currentScenario.purpose}</Text>
            </View>
          ) : null}
          {currentScenario?.stay ? (
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Length of Stay</Text>
              <Text style={styles.cardValue}>{currentScenario.stay}</Text>
            </View>
          ) : null}
          {currentScenario?.documents ? (
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Documents</Text>
              <Text style={styles.cardValueSmall}>{currentScenario.documents}</Text>
            </View>
          ) : null}
          <View style={styles.cardRowStory}>
            <Text style={styles.cardLabel}>Story</Text>
            <Text style={styles.cardStory}>"{currentScenario?.story}"</Text>
          </View>
        </View>
      </View>

      {/* Buttons */}
      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={styles.btnAllow}
          onPress={() => handleVerdict(true)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[GREEN, '#2E7D32']}
            style={styles.btnGradient}
          >
            <Ionicons name="checkmark-circle" size={28} color={"#FFFFFF"} />
            <Text style={styles.btnAllowText}>ADMIT</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnSearch}
          onPress={() => handleVerdict(false)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[RED, '#B71C1C']}
            style={styles.btnGradient}
          >
            <Ionicons name="alert-circle" size={28} color={"#FFFFFF"} />
            <Text style={styles.btnSearchText}>SECONDARY</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Result message modal */}
      <Modal visible={showMessage} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, message?.type === 'fail' && styles.modalBoxFail]}>
            <Ionicons
              name={message?.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
              size={56}
              color={message?.type === 'success' ? GREEN : RED}
            />
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalText}>{message?.text}</Text>
            </ScrollView>
            <TouchableOpacity style={styles.modalBtn} onPress={goNext}>
              <Text style={styles.modalBtnText}>Next Traveler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* How to Play Modal */}
      <Modal visible={showInstructions} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.instructionsModalBox}>
            <View style={styles.visaModalHeader}>
              <Text style={styles.visaModalTitle}>How to Play — Border Control</Text>
              <TouchableOpacity onPress={() => setShowInstructions(false)}>
                <Ionicons name="close" size={28} color={"#FFD700"} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.visaScroll} showsVerticalScrollIndicator={true}>
              <Text style={styles.instructionsIntro}>You are an Immigration Officer at Jamaica Passport Control. Decide who gets admitted and who goes to secondary interview.</Text>
              <Text style={styles.instructionsStep}>1. Read each traveler’s details: name, nationality, purpose, length of stay, documents, and story.</Text>
              <Text style={styles.instructionsStep}>2. ADMIT (green) = let them enter. Use when the person is legit: documents in order and story makes sense.</Text>
              <Text style={styles.instructionsStep}>3. SECONDARY (red) = send to interview / deny. Use when: visa missing (if required), no return ticket, inconsistent story, or obvious red flags.</Text>
              <Text style={styles.instructionsStep}>4. Difficulty: your Level rises as you score. Higher levels give less time and bigger penalties for wrong calls.</Text>
              <Text style={styles.instructionsStep}>5. You see 10 travelers per game. Tap "Visa Info" for Jamaica PICA entry visa notes.</Text>
              <Text style={styles.instructionsStep}>6. Have fun! This is satire. Real rules: check PICA.gov.jm.</Text>
            </ScrollView>
            <TouchableOpacity style={styles.modalBtn} onPress={() => setShowInstructions(false)}>
              <Text style={styles.modalBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Visa Info Modal */}
      <Modal visible={showVisaInfo} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.visaModalBox}>
            <View style={styles.visaModalHeader}>
              <Text style={styles.visaModalTitle}>Jamaica Visa Facts</Text>
              <TouchableOpacity onPress={() => setShowVisaInfo(false)}>
                <Ionicons name="close" size={28} color={"#FFD700"} />
              </TouchableOpacity>
            </View>
            <Text style={styles.visaSummary}>{VISA_FACTS.summary}</Text>
            <ScrollView style={styles.visaScroll} showsVerticalScrollIndicator={true}>
              <Text style={styles.visaSectionTitle}>No visa required (sample)</Text>
              <Text style={styles.visaList}>{VISA_FREE_FOR_JAMAICA.slice(0, 20).join(', ')}...</Text>
              <Text style={[styles.visaSectionTitle, { marginTop: 16 }]}>Visa required (sample)</Text>
              <Text style={styles.visaList}>{VISA_REQUIRED_FOR_JAMAICA.slice(0, 20).join(', ')}...</Text>
            </ScrollView>
            <Text style={styles.visaSource}>{VISA_FACTS.source}</Text>
          </View>
        </View>
      </Modal>

      {/* Game Over */}
      <Modal visible={showGameOver} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.gameOverTitle}>Game Over</Text>
            <Text style={styles.gameOverScore}>Final Score: {score} / {TRAVELERS_PER_GAME}</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={handlePlayAgain}>
              <Text style={styles.modalBtnText}>Play Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalBtnAlt} onPress={() => navigation.goBack()}>
              <Text style={styles.modalBtnAltText}>Back to GameHub</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <GameSoundModal visible={showSoundModal} onClose={() => setShowSoundModal(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: "#FFD700",
    fontSize: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    padding: 8,
  },
  topTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: "#FFD700",
  },
  scoreWrap: {
    alignItems: 'flex-end',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '600',
    color: "#FFFFFF",
  },
  travelerCount: {
    fontSize: 12,
    color: "#888888",
  },
  cardWrap: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  passportCard: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#FFD700",
    padding: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: "#FFD700",
    marginLeft: 12,
    letterSpacing: 1,
  },
  cardRow: {
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 12,
    color: "#888888",
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '600',
    color: "#FFFFFF",
  },
  cardValueSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: "#FFFFFF",
    lineHeight: 20,
  },
  cardRowStory: {
    marginTop: 8,
  },
  cardStory: {
    fontSize: 16,
    color: "#CCCCCC",
    fontStyle: 'italic',
    marginTop: 4,
  },
  buttonsRow: {
    flexDirection: 'row',
    padding: 20,
    gap: 16,
  },
  btnAllow: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  btnSearch: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  btnAllowText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: "#FFFFFF",
  },
  btnSearchText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: "#FFFFFF",
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
    maxWidth: 340,
    maxHeight: '80%',
  },
  modalBoxFail: {
    borderWidth: 2,
    borderColor: RED,
  },
  modalScroll: {
    maxHeight: 200,
    marginVertical: 16,
  },
  modalText: {
    fontSize: 16,
    color: "#FFFFFF",
    textAlign: 'center',
    lineHeight: 24,
  },
  modalBtn: {
    backgroundColor: "#FFD700",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: "#000000",
  },
  modalBtnAlt: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalBtnAltText: {
    fontSize: 16,
    color: "#888888",
  },
  gameOverTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: "#FFFFFF",
    textAlign: 'center',
    marginBottom: 12,
  },
  gameOverScore: {
    fontSize: 22,
    color: "#FFD700",
    textAlign: 'center',
    marginBottom: 24,
  },
  instructionsModalBox: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#FFD700",
    padding: 24,
    minWidth: 280,
    maxWidth: 340,
    maxHeight: '85%',
  },
  instructionsIntro: {
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 16,
    lineHeight: 22,
  },
  instructionsStep: {
    fontSize: 15,
    color: "#CCCCCC",
    marginBottom: 12,
    lineHeight: 22,
  },
  visaModalBox: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 24,
    minWidth: 300,
    maxWidth: 360,
    maxHeight: '85%',
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  visaModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  visaModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: "#FFD700",
  },
  visaSummary: {
    fontSize: 14,
    color: "#CCCCCC",
    lineHeight: 22,
    marginBottom: 16,
  },
  visaScroll: {
    maxHeight: 220,
    marginBottom: 12,
  },
  visaSectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: "#FFD700",
    marginBottom: 6,
  },
  visaList: {
    fontSize: 12,
    color: "#AAAAAA",
    lineHeight: 18,
  },
  visaSource: {
    fontSize: 10,
    color: "#666666",
    fontStyle: 'italic',
  },
});