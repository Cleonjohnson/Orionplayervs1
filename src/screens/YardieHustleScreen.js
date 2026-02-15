/**
 * Yardie Hustle - Tap to earn, Jobs, Events, Cash Pot
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { JOBS, EVENTS, CASH_POT_NUMBERS, CASH_POT_DRAW } from '../data/HustleData';
import { playSfx } from '../services/SoundService';
import GameSoundModal from '../components/GameSoundModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GREEN = '#4CAF50';
const ORANGE = '#FF8C00';
const START_MONEY = 100;
const START_ENERGY = 100;
const MAX_ENERGY = 100;
const ENERGY_PER_TAP = 2;
const BOX_FOOD_COST = 80;
const BOX_FOOD_ENERGY = 30;
const TAPS_PER_EVENT = 20;
const CASH_POT_MULTIPLIER = 10; // win = bet * 10

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function YardieHustleScreen({ navigation }) {
  const [money, setMoney] = useState(START_MONEY);
  const [jobIndex, setJobIndex] = useState(0);
  const [energy, setEnergy] = useState(START_ENERGY);
  const [karma, setKarma] = useState(50);
  const [inventory, setInventory] = useState([]);
  const [tapCount, setTapCount] = useState(0);
  const [showEvent, setShowEvent] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [eventChoiceResult, setEventChoiceResult] = useState(null);
  const [workBlockedUntil, setWorkBlockedUntil] = useState(0);
  const [activeTab, setActiveTab] = useState('hustle'); // hustle | upgrades | cashpot
  const [showGameOver, setShowGameOver] = useState(false);
  const [cashPotBet, setCashPotBet] = useState(0);
  const [cashPotPick, setCashPotPick] = useState(null);
  const [cashPotResult, setCashPotResult] = useState(null);
  const [showSoundModal, setShowSoundModal] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const job = JOBS[jobIndex];
  const nextJob = JOBS[jobIndex + 1];
  const canPromote = nextJob && money >= nextJob.promoteCost;
  const isBlocked = workBlockedUntil > Date.now();
  const level = 1 + jobIndex;
  const energyPerTap = ENERGY_PER_TAP + Math.min(4, Math.floor((level - 1) / 2)); // drains faster at higher levels
  const tapsPerEvent = Math.max(10, TAPS_PER_EVENT - (level - 1) * 2); // events happen more often

  useEffect(() => {
    if (money < 0) setShowGameOver(true);
  }, [money]);

  useEffect(() => {
    if (!workBlockedUntil || workBlockedUntil <= Date.now()) return;
    const t = setTimeout(() => setWorkBlockedUntil(0), workBlockedUntil - Date.now());
    return () => clearTimeout(t);
  }, [workBlockedUntil]);

  const triggerRandomEvent = useCallback(() => {
    const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    setCurrentEvent(ev);
    setEventChoiceResult(null);
    setShowEvent(true);
    if (ev.blockWorkSeconds) {
      setWorkBlockedUntil(Date.now() + ev.blockWorkSeconds * 1000);
    }
  }, []);

  const onHustlePress = useCallback(() => {
    if (isBlocked || energy <= 0) return;
    playSfx('tap');
    const pay = job?.payRate ?? 10;
    setMoney((m) => m + pay);
    setEnergy((e) => Math.max(0, e - energyPerTap));
    setTapCount((c) => {
      const next = c + 1;
      if (next >= tapsPerEvent) {
        setTimeout(triggerRandomEvent, 300);
        return 0;
      }
      return next;
    });
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.08, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [job, isBlocked, energy, scaleAnim, triggerRandomEvent, energyPerTap, tapsPerEvent]);

  const handleEventChoice = useCallback((choice, eventObj) => {
    if (choice.randomOutcome) {
      const escape = Math.random() < (choice.escapeChance ?? 0.5);
      const effect = escape ? choice.effectEscape : choice.effectCaught;
      setMoney((m) => m + (effect?.money ?? 0));
      setKarma((k) => k + (effect?.karma ?? 0));
      setEventChoiceResult(escape ? 'Yuh escape!' : 'Dem catch yuh! Money gone.');
    } else {
      setMoney((m) => m + (choice.effect?.money ?? 0));
      setKarma((k) => k + (choice.effect?.karma ?? 0));
      setEnergy((e) => Math.min(MAX_ENERGY, e + (choice.effect?.energy ?? 0)));
      setEventChoiceResult(null);
    }
    setShowEvent(false);
    setCurrentEvent(null);
  }, []);

  const handlePromote = useCallback(() => {
    if (!nextJob || money < nextJob.promoteCost) return;
    setMoney((m) => m - nextJob.promoteCost);
    setJobIndex((i) => i + 1);
  }, [nextJob, money]);

  const handleBuyBoxFood = useCallback(() => {
    if (money < BOX_FOOD_COST) return;
    setMoney((m) => m - BOX_FOOD_COST);
    setEnergy((e) => Math.min(MAX_ENERGY, e + BOX_FOOD_ENERGY));
  }, [money]);

  const handleCashPotSpin = useCallback(() => {
    if (cashPotBet <= 0 || money < cashPotBet || cashPotPick == null) return;
    const drawn = CASH_POT_DRAW[Math.floor(Math.random() * CASH_POT_DRAW.length)];
    const win = drawn === cashPotPick;
    if (win) playSfx('success');
    setMoney((m) => (win ? m + cashPotBet * CASH_POT_MULTIPLIER : m - cashPotBet));
    setCashPotResult({ drawn, win, pick: cashPotPick });
  }, [cashPotBet, cashPotPick, money]);

  const restart = useCallback(() => {
    setMoney(START_MONEY);
    setJobIndex(0);
    setEnergy(START_ENERGY);
    setKarma(50);
    setTapCount(0);
    setShowGameOver(false);
    setWorkBlockedUntil(0);
    setCashPotResult(null);
  }, []);

  const getCashPotName = (num) => CASH_POT_NUMBERS.find((c) => c.number === num)?.name ?? `#${num}`;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a2a1a', "#0f0f0f"]} style={StyleSheet.absoluteFill} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFD700" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Net Worth: ${money} JMD · L{level}</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'hustle' && styles.tabActive]}
          onPress={() => setActiveTab('hustle')}
        >
          <Ionicons name="flash" size={20} color={activeTab === 'hustle' ? "#FFD700" : '#888'} />
          <Text style={[styles.tabText, activeTab === 'hustle' && styles.tabTextActive]}>Hustle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upgrades' && styles.tabActive]}
          onPress={() => setActiveTab('upgrades')}
        >
          <Ionicons name="trending-up" size={20} color={activeTab === 'upgrades' ? "#FFD700" : '#888'} />
          <Text style={[styles.tabText, activeTab === 'upgrades' && styles.tabTextActive]}>Upgrades</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'cashpot' && styles.tabActive]}
          onPress={() => setActiveTab('cashpot')}
        >
          <Ionicons name="diamond" size={20} color={activeTab === 'cashpot' ? "#FFD700" : '#888'} />
          <Text style={[styles.tabText, activeTab === 'cashpot' && styles.tabTextActive]}>Cash Pot</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'hustle' && (
        <>
          {/* Job & Energy */}
          <View style={styles.statusBar}>
            <Text style={styles.jobLabel}>{job?.title}</Text>
            <Text style={styles.payLabel}>${job?.payRate} / tap</Text>
            <View style={styles.energyBarBg}>
              <View style={[styles.energyBarFill, { width: `${energy}%` }]} />
            </View>
            <Text style={styles.energyText}>Energy {Math.round(energy)}%</Text>
            {energy < 30 && (
              <TouchableOpacity style={styles.boxFoodBtn} onPress={handleBuyBoxFood} disabled={money < BOX_FOOD_COST}>
                <Text style={styles.boxFoodText}>Box Food $80 (+30 Energy)</Text>
              </TouchableOpacity>
            )}
          </View>
          {/* HUSTLE Button */}
          <View style={styles.hustleWrap}>
            <TouchableOpacity
              activeOpacity={1}
              onPress={onHustlePress}
              disabled={isBlocked || energy <= 0}
              style={styles.hustleBtnWrap}
            >
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <LinearGradient colors={[GREEN, '#2E7D32']} style={styles.hustleBtn}>
                  <Text style={styles.hustleBtnText}>HUSTLE</Text>
                  {isBlocked && <Text style={styles.blockedText}>JPS cut! Wait...</Text>}
                </LinearGradient>
              </Animated.View>
            </TouchableOpacity>
          </View>
          {/* Promote */}
          {canPromote && (
            <TouchableOpacity style={styles.promoteBtn} onPress={handlePromote}>
              <Text style={styles.promoteText}>Promote → {nextJob.title} (${nextJob.promoteCost})</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {activeTab === 'upgrades' && (
        <ScrollView style={styles.upgradesScroll} contentContainerStyle={styles.upgradesContent}>
          <Text style={styles.upgradesTitle}>Jobs</Text>
          {JOBS.map((j, i) => (
            <View key={j.id} style={[styles.jobRow, i <= jobIndex && styles.jobRowUnlocked]}>
              <Text style={styles.jobTitle}>{j.title}</Text>
              <Text style={styles.jobPay}>${j.payRate}/tap</Text>
              {i > jobIndex && (
                <Text style={styles.jobCost}>Unlock: ${j.promoteCost}</Text>
              )}
              {i === jobIndex && <Text style={styles.jobCurrent}>Current</Text>}
            </View>
          ))}
        </ScrollView>
      )}

      {activeTab === 'cashpot' && (
        <ScrollView style={styles.cashPotScroll} contentContainerStyle={styles.cashPotContent}>
          <Text style={styles.cashPotTitle}>Cash Pot (Pick a number)</Text>
          {CASH_POT_NUMBERS.map((c) => (
            <TouchableOpacity
              key={c.number}
              style={[styles.cashPotOption, cashPotPick === c.number && styles.cashPotOptionSelected]}
              onPress={() => setCashPotPick(c.number)}
            >
              <Text style={styles.cashPotNum}>{c.number}</Text>
              <Text style={styles.cashPotName}>{c.name}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.betRow}>
            <Text style={styles.betLabel}>Bet (JMD)</Text>
            <TouchableOpacity style={styles.betBtn} onPress={() => setCashPotBet(Math.max(0, (cashPotBet || 0) - 50))}>
              <Text style={styles.betBtnText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.betValue}>${cashPotBet || 0}</Text>
            <TouchableOpacity style={styles.betBtn} onPress={() => setCashPotBet((cashPotBet || 0) + 50)}>
              <Text style={styles.betBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.spinBtn, (cashPotBet <= 0 || !cashPotPick || money < cashPotBet) && styles.spinBtnDisabled]}
            onPress={handleCashPotSpin}
            disabled={cashPotBet <= 0 || !cashPotPick || money < cashPotBet}
          >
            <Text style={styles.spinBtnText}>Spin (Win = {CASH_POT_MULTIPLIER}x)</Text>
          </TouchableOpacity>
          {cashPotResult && (
            <View style={styles.resultBox}>
              <Text style={styles.resultText}>
                Drew: {cashPotResult.drawn} ({getCashPotName(cashPotResult.drawn)})
              </Text>
              <Text style={[styles.resultText, cashPotResult.win ? styles.resultWin : styles.resultLose]}>
                {cashPotResult.win ? 'Yuh win!' : 'Yuh lose!'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Event Modal */}
      <Modal visible={showEvent} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.eventBox}>
            <Text style={styles.eventTitle}>{currentEvent?.text}</Text>
            {currentEvent?.hint && <Text style={styles.eventHint}>{currentEvent.hint}</Text>}
            {eventChoiceResult && (
              <>
                <Text style={styles.eventResult}>{eventChoiceResult}</Text>
                <TouchableOpacity style={styles.eventChoiceBtn} onPress={() => { setShowEvent(false); setCurrentEvent(null); setEventChoiceResult(null); }}>
                  <Text style={styles.eventChoiceText}>Continue</Text>
                </TouchableOpacity>
              </>
            )}
            {!eventChoiceResult && currentEvent?.choices?.map((choice, i) => (
              <TouchableOpacity
                key={i}
                style={styles.eventChoiceBtn}
                onPress={() => handleEventChoice(choice, currentEvent)}
              >
                <Text style={styles.eventChoiceText}>Choose</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Game Over */}
      <Modal visible={showGameOver} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.gameOverBox}>
            <Text style={styles.gameOverTitle}>Yuh Mash Up!</Text>
            <Text style={styles.gameOverSub}>Bankrupt. Restart.</Text>
            <TouchableOpacity style={styles.restartBtn} onPress={restart}>
              <Text style={styles.restartBtnText}>Restart</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <GameSoundModal visible={showSoundModal} onClose={() => setShowSoundModal(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f0f" },
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
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: "#FFD700" },
  soundBtn: { padding: 8 },
  placeholder: { width: 40 },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#FFD700" },
  tabText: { fontSize: 14, color: '#888' },
  tabTextActive: { color: "#FFD700", fontWeight: '600' },
  statusBar: {
    padding: 20,
    alignItems: 'center',
  },
  jobLabel: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  payLabel: { fontSize: 14, color: "#FFD700", marginTop: 4 },
  energyBarBg: {
    width: '100%',
    height: 12,
    backgroundColor: '#333',
    borderRadius: 6,
    marginTop: 12,
    overflow: 'hidden',
  },
  energyBarFill: {
    height: '100%',
    backgroundColor: GREEN,
    borderRadius: 6,
  },
  energyText: { fontSize: 12, color: '#888', marginTop: 6 },
  boxFoodBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: ORANGE,
    borderRadius: 8,
  },
  boxFoodText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  hustleWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  hustleBtnWrap: { alignItems: 'center', justifyContent: 'center' },
  hustleBtn: {
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hustleBtnText: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  blockedText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 8 },
  promoteBtn: {
    padding: 16,
    margin: 20,
    backgroundColor: "#FFD700",
    borderRadius: 12,
    alignItems: 'center',
  },
  promoteText: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  upgradesScroll: { flex: 1 },
  upgradesContent: { padding: 20, paddingBottom: 40 },
  upgradesTitle: { fontSize: 20, fontWeight: 'bold', color: "#FFD700", marginBottom: 16 },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 12,
    opacity: 0.7,
  },
  jobRowUnlocked: { opacity: 1 },
  jobTitle: { flex: 1, fontSize: 16, color: '#fff', fontWeight: '600' },
  jobPay: { fontSize: 14, color: "#FFD700" },
  jobCost: { fontSize: 12, color: '#888', marginLeft: 8 },
  jobCurrent: { fontSize: 12, color: GREEN, marginLeft: 8 },
  cashPotScroll: { flex: 1 },
  cashPotContent: { padding: 20, paddingBottom: 40 },
  cashPotTitle: { fontSize: 18, fontWeight: 'bold', color: "#FFD700", marginBottom: 16 },
  cashPotOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cashPotOptionSelected: { borderColor: "#FFD700" },
  cashPotNum: { fontSize: 18, fontWeight: 'bold', color: "#FFD700", width: 36 },
  cashPotName: { fontSize: 16, color: '#fff' },
  betRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  betLabel: { fontSize: 16, color: '#fff', marginRight: 12 },
  betBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  betBtnText: { fontSize: 20, color: "#FFD700", fontWeight: 'bold' },
  betValue: { fontSize: 18, color: "#FFD700", marginHorizontal: 16, minWidth: 60, textAlign: 'center' },
  spinBtn: {
    padding: 16,
    backgroundColor: "#FFD700",
    borderRadius: 12,
    alignItems: 'center',
  },
  spinBtnDisabled: { backgroundColor: '#555', opacity: 0.7 },
  spinBtnText: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  resultBox: { marginTop: 20, padding: 16, backgroundColor: '#1a1a1a', borderRadius: 12 },
  resultText: { fontSize: 16, color: '#fff', textAlign: 'center' },
  resultWin: { color: GREEN, fontWeight: 'bold', marginTop: 8 },
  resultLose: { color: '#f44336', fontWeight: 'bold', marginTop: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  eventBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    minWidth: 280,
    maxWidth: 340,
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  eventTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 12 },
  eventHint: { fontSize: 14, color: "#FFD700", textAlign: 'center', marginBottom: 16 },
  eventResult: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 12 },
  eventChoiceBtn: {
    padding: 14,
    backgroundColor: '#333',
    borderRadius: 10,
    marginTop: 8,
    alignItems: 'center',
  },
  eventChoiceText: { fontSize: 16, color: '#fff' },
  gameOverBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 32,
    minWidth: 280,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f44336',
  },
  gameOverTitle: { fontSize: 24, fontWeight: 'bold', color: '#f44336' },
  gameOverSub: { fontSize: 16, color: '#ccc', marginTop: 8 },
  restartBtn: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
    backgroundColor: "#FFD700",
    borderRadius: 12,
  },
  restartBtnText: { fontSize: 18, fontWeight: 'bold', color: '#000' },
});