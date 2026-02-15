import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { verifyContentPin } from '../services/SettingsService';

export default function PinPromptModal({ visible, onCancel, onSuccess }) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!/^\d{4}$/.test(pin)) {
      Alert.alert('Invalid PIN', 'Enter a 4-digit numeric PIN.');
      return;
    }
    setLoading(true);
    try {
      const ok = await verifyContentPin(pin);
      if (ok) {
        setPin('');
        onSuccess && onSuccess();
      } else {
        Alert.alert('Incorrect PIN', 'The PIN you entered is invalid.');
      }
    } catch (e) {
      console.warn('[PinPromptModal] verify error:', e);
      Alert.alert('Error', 'Failed to verify PIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>Enter Parental PIN</Text>
          <Text style={styles.subtitle}>Protected content requires PIN to continue.</Text>
          <TextInput
            value={pin}
            onChangeText={(t) => setPin(t.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
            maxLength={4}
            style={styles.input}
            secureTextEntry
            placeholder="1234"
            placeholderTextColor="#888"
          />
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.cancel]} onPress={() => { setPin(''); onCancel && onCancel(); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.save]} onPress={handleSubmit} disabled={loading}>
              <Text style={styles.saveText}>{loading ? 'Checking...' : 'OK'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', padding: 20 },
  box: { width: '100%', maxWidth: 360, backgroundColor: '#1a1a1a', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,215,0,0.15)' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  subtitle: { color: '#aaa', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  input: { backgroundColor: '#0f0f0f', borderWidth: 1, borderColor: '#333', color: '#fff', padding: 12, borderRadius: 8, fontSize: 18, textAlign: 'center', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancel: { backgroundColor: '#333', marginRight: 8 },
  save: { backgroundColor: '#FFD700' },
  cancelText: { color: '#fff', fontWeight: '600' },
  saveText: { color: '#000', fontWeight: '700' },
});

