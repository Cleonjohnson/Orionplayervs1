/**
 * PinEntryModal - Child lock PIN verification
 * Shows when user tries to access locked content category
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import TouchableOpacity from './TouchableOpacity';
import Ionicons from '@expo/vector-icons/Ionicons';

const GOLD = '#FFD700';

export default function PinEntryModal({ visible, onVerify, onCancel, onSuccess, category = 'content' }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const categoryLabel = category === 'live' ? 'Live TV' : category === 'movies' ? 'Movies' : category === 'series' ? 'Series' : 'this content';

  const handleVerify = async () => {
    if (!pin.trim()) return;
    setLoading(true);
    setError(false);
    try {
      const ok = await onVerify(pin.trim());
      if (ok) {
        setPin('');
        setLoading(false);
        onSuccess?.();
      } else {
        setError(true);
        setPin('');
        inputRef.current?.focus?.();
      }
    } catch (e) {
      setError(true);
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPin('');
    setError(false);
    onCancel?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.box}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed" size={48} color={GOLD} />
          </View>
          <Text style={styles.title}>Parental Control</Text>
          <Text style={styles.subtitle}>
            Enter PIN to access {categoryLabel}
          </Text>
          <TextInput
            ref={inputRef}
            style={[styles.input, error && styles.inputError]}
            value={pin}
            onChangeText={(t) => { setPin(t); setError(false); }}
            placeholder="Enter PIN"
            placeholderTextColor="#666"
            secureTextEntry
            keyboardType="number-pad"
            maxLength={8}
            editable={!loading}
            onSubmitEditing={handleVerify}
          />
          {error && (
            <Text style={styles.errorText}>Incorrect PIN. Try again.</Text>
          )}
          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.btn, styles.btnCancel]}
              onPress={handleCancel}
              disabled={loading}
            >
              <Text style={styles.btnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnVerify]}
              onPress={handleVerify}
              disabled={loading || !pin.trim()}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.btnVerifyText}>Unlock</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  box: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#0f0f0f',
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  inputError: {
    borderColor: '#dc2626',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: '#333',
  },
  btnCancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  btnVerify: {
    backgroundColor: GOLD,
  },
  btnVerifyText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
