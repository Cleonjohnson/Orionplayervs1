/**
 * Orion Player 2.0 - Radio Tuner
 * 2-column grid of Jamaican (and other) radio stations; navigates to Player for audio.
 */

import React from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  Dimensions,
  Linking,
  Alert,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { RADIO_CHANNELS } from '../services/RadioChannels';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ORION_LOGO, BRAND } from '../constants/Branding';

const GOLD = '#FFD700';
const { width } = Dimensions.get('window');
const COLS = 2;
const GAP = 12;
const PADDING = 16;
const CARD_SIZE = (width - PADDING * 2 - GAP * (COLS - 1)) / COLS;

export default function RadioScreen() {
  const navigation = useNavigation();

  const openWebsite = async (url = 'www.culturefmja.com') => {
    if (!url) return;
    const safeUrl = url.startsWith('http') ? url : `https://${url}`;
    try {
      await Linking.openURL(safeUrl);
    } catch (e) {
      console.warn('[RadioScreen] openWebsite error:', e);
      Alert.alert('Cannot open link', safeUrl);
    }
  };

  const onPressStation = (item) => {
    navigation.navigate('Player', {
      type: 'radio',
      url: item.url,
      name: item.name,
      cover: item.logo,
    });
  };

  const renderCard = ({ item, index }) => (
    <TouchableOpacity
      style={[styles.card, index % COLS !== COLS - 1 && { marginRight: GAP }]}
      onPress={() => onPressStation(item)}
      activeOpacity={0.85}
    >
      <View style={styles.logoWrap}>
        {item.logo ? (
          <Image
            source={typeof item.logo === 'number' ? item.logo : { uri: item.logo }}
            style={styles.logo}
            resizeMode="cover"
          />
        ) : (
          <Ionicons name="radio" size={48} color={GOLD} />
        )}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {item.name}
      </Text>
      {item.tag ? (
        <Text style={styles.tag} numberOfLines={1}>
          {item.tag}
        </Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.brandStrip}>
        {ORION_LOGO ? <Image source={ORION_LOGO} style={styles.brandLogo} resizeMode="contain" /> : <Text style={{ color: '#FFD700', fontWeight: '700' }}>ORION</Text>}
        <Text style={styles.brandTagline}>{BRAND.tagline}</Text>
        <TouchableOpacity onPress={() => openWebsite('www.culturefmja.com')} style={{ padding: 6 }}>
          <Ionicons name="earth" size={20} color={GOLD} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={RADIO_CHANNELS}
        renderItem={renderCard}
        keyExtractor={(item) => item.id}
        numColumns={COLS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  brandStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PADDING,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#252525',
  },
  brandLogo: {
    width: 48,
    height: 48,
  },
  brandTagline: {
    flex: 1,
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  content: { padding: PADDING, paddingBottom: 24 },
  row: { marginBottom: GAP },
  card: {
    width: CARD_SIZE,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  logoWrap: {
    width: CARD_SIZE - 32,
    height: CARD_SIZE - 32,
    borderRadius: 12,
    backgroundColor: '#252525',
    overflow: 'hidden',
    marginBottom: 10,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  name: { color: GOLD, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  tag: { color: '#888', fontSize: 11, marginTop: 4 },
});
