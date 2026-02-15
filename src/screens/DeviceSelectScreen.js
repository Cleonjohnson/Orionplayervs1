import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { ORION_LOGO } from '../constants/Branding';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KEY_DEVICE, KEY_DEVICE_SELECTED } from '../constants/device';

const DeviceSelectScreen = () => {
  const navigation = useNavigation();

  const selectDevice = async (mode) => {
    try {
      await AsyncStorage.setItem(KEY_DEVICE, mode);
      await AsyncStorage.setItem(KEY_DEVICE_SELECTED, 'true');
    } catch (e) {
      console.warn('[DeviceSelect] AsyncStorage error:', e);
    }
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      {ORION_LOGO ? (
        <Image source={ORION_LOGO} style={styles.logo} resizeMode="contain" />
      ) : (
        <Text style={[styles.title, { marginBottom: 20 }]}>ORION</Text>
      )}
      <Text style={styles.title}>Select Your Device</Text>

      <View style={styles.buttonContainer}>
        {/* Mobile Option */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => selectDevice('mobile')}
        >
          <Ionicons name="phone-portrait-outline" size={50} color="#FFD700" />
          <Text style={styles.cardText}>Mobile / Tablet</Text>
        </TouchableOpacity>

        {/* TV Option */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => selectDevice('tv')}
        >
          <Ionicons name="tv-outline" size={50} color="#FFD700" />
          <Text style={styles.cardText}>Smart TV / Firestick</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 150,
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    color: "#FFFFFF",
    marginBottom: 40,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 20,
  },
  card: {
    width: 140,
    height: 140,
    backgroundColor: "#1E1E1E",
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: "#333333",
  },
  cardText: {
    color: "#FFFFFF",
    marginTop: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default DeviceSelectScreen;