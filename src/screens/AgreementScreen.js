/**
 * Orion Amusement Enterprise - Terms & Liability Agreement
 * User must accept before entering the app. Protects operator from liabilities.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { needsOnboarding } from '../services/PlaylistService';

export const KEY_AGREEMENT_ACCEPTED = 'orion_agreement_accepted';
export const KEY_USER_EMAIL = 'orion_user_email';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AGREEMENT_TEXT = `
ORION AMUSEMENT ENTERPRISE – TERMS OF USE & LIABILITY RELEASE

By tapping "I Agree" below, you acknowledge and accept the following:

1. CONTENT & SERVICE
   This application provides access to streaming media, radio, games, and other digital content ("Content"). Content may be provided by third parties. Orion Amusement Enterprise does not guarantee the availability, accuracy, or legality of any Content.

2. NO WARRANTY
   The app and all Content are provided "AS IS" without warranty of any kind. Orion Amusement Enterprise disclaims all warranties, express or implied, including but not limited to merchantability, fitness for a particular purpose, and non-infringement.

3. LIMITATION OF LIABILITY
   To the fullest extent permitted by law, Orion Amusement Enterprise, its operators, affiliates, and partners shall not be liable for any direct, indirect, incidental, special, consequential, or punitive damages arising from your use of the app or Content, including but not limited to loss of data, revenue, or profits.

4. USER RESPONSIBILITY
   You are solely responsible for your use of the app and Content. You agree to use the app in compliance with all applicable laws. You must have appropriate rights or licenses for any content you access or distribute.

5. GAMES & ENTERTAINMENT
   Games and entertainment features are for fun only. They do not constitute gambling, legal, or official advice. Visa/immigration information in games is satirical or educational and should not be relied upon for real decisions.

6. THIRD-PARTY CONTENT
   Streaming and radio content may be subject to third-party terms. Orion Amusement Enterprise is not responsible for third-party content or services.

7. PRIVACY & DATA
   Use of the app may involve storage of credentials and preferences on your device. You consent to such storage as described in the app's privacy practices.

By proceeding, you release Orion Amusement Enterprise from any claims, damages, or liabilities arising from your use of this application.
`;

export default function AgreementScreen({ navigation, route }) {
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const onScroll = (e) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const isEnd = layoutMeasurement.height + contentOffset.y >= contentSize.height - 80;
    if (isEnd && !scrolledToEnd) setScrolledToEnd(true);
  };

  const handleAgree = async () => {
    try {
      await AsyncStorage.setItem(KEY_AGREEMENT_ACCEPTED, 'true');
    } catch (e) {
      console.warn('[Agreement] save failed:', e);
    }
    // Ask for optional email opt-in before proceeding
    setShowEmailModal(true);
  };

  const finishAfterEmail = async (proceed = true) => {
    // store email if provided
    try {
      const email = (emailInput || '').trim();
      if (email) await AsyncStorage.setItem(KEY_USER_EMAIL, email);
    } catch (e) {
      console.warn('[Agreement] save email failed:', e);
    }
    setShowEmailModal(false);
    if (!proceed) return;
    const onAccept = route.params?.onAccept;
    if (typeof onAccept === 'function') {
      onAccept();
      return;
    }
    try {
      const needsSetup = await needsOnboarding();
      if (needsSetup) navigation.replace('Onboarding');
      else navigation.replace('Hub');
    } catch (e) {
      navigation.replace('Hub');
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a0a2e', "#121212"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.header}>
        <Text style={styles.title}>Orion Amusement Enterprise</Text>
        <Text style={styles.subtitle}>Terms of Use & Liability Release</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        onScroll={onScroll}
        scrollEventThrottle={100}
      >
        <Text style={styles.agreementText}>{AGREEMENT_TEXT.trim()}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.agreeBtn, !scrolledToEnd && styles.agreeBtnDisabled]}
          onPress={handleAgree}
          disabled={!scrolledToEnd}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={scrolledToEnd ? ["#FFD700", "#FFD700"] : ["#444444", "#333333"]}
            style={styles.agreeBtnGrad}
          >
            <Text style={[styles.agreeBtnText, !scrolledToEnd && styles.agreeBtnTextDisabled]}>
              I Agree – Enter
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        {!scrolledToEnd && (
          <Text style={styles.hint}>Scroll to the end to enable "I Agree"</Text>
        )}
      </View>
      {/* Email opt-in modal */}
      <Modal visible={showEmailModal} transparent animationType="slide" onRequestClose={() => finishAfterEmail(true)}>
        <View style={styles.emailOverlay}>
          <View style={styles.emailBox}>
            <Text style={styles.emailTitle}>Stay Updated</Text>
            <Text style={styles.emailSub}>Enter your email to receive updates and premium offers (optional).</Text>
            <TextInput
              value={emailInput}
              onChangeText={setEmailInput}
              placeholder="you@example.com"
              placeholderTextColor="#888"
              keyboardType="email-address"
              style={styles.emailInput}
              autoCapitalize="none"
            />
            <View style={styles.emailBtns}>
              <TouchableOpacity style={[styles.emailBtn, styles.emailSkip]} onPress={() => finishAfterEmail(true)}>
                <Text style={styles.emailSkipText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.emailBtn, styles.emailSave]} onPress={() => finishAfterEmail(true)}>
                <Text style={styles.emailSaveText}>Save & Continue</Text>
              </TouchableOpacity>
            </View>
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
  header: {
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,215,0,0.3)',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: "#FFD700",
    textAlign: 'center',
    marginTop: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#888888",
    textAlign: 'center',
    marginTop: 6,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 140, // leave room for the footer button (prevents overlap)
  },
  agreementText: {
    fontSize: 13,
    color: "#CCCCCC",
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 24,
    paddingBottom: Platform.OS === 'android' ? 40 : 24,
    borderTopWidth: 1,
    borderTopColor: "#333333",
    backgroundColor: 'transparent',
  },
  agreeBtn: {
    overflow: 'hidden',
    borderRadius: 12,
    width: '100%',
  },
  agreeBtnDisabled: {
    opacity: 0.8,
  },
  agreeBtnGrad: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agreeBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: "#000000",
  },
  agreeBtnTextDisabled: {
    color: "#666666",
  },
  hint: {
    fontSize: 12,
    color: "#666666",
    textAlign: 'center',
    marginTop: 12,
  },
  emailOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.65)', padding: 20 },
  emailBox: { width: '100%', maxWidth: 420, backgroundColor: '#1a1a1a', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: 'rgba(255,215,0,0.12)' },
  emailTitle: { color: '#FFD700', fontSize: 18, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  emailSub: { color: '#aaa', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  emailInput: { backgroundColor: '#0f0f0f', borderWidth: 1, borderColor: '#333', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 12 },
  emailBtns: { flexDirection: 'row', justifyContent: 'space-between' },
  emailBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  emailSkip: { backgroundColor: '#333', marginRight: 8 },
  emailSave: { backgroundColor: '#FFD700' },
  emailSkipText: { color: '#fff', fontWeight: '600' },
  emailSaveText: { color: '#000', fontWeight: '700' },
});