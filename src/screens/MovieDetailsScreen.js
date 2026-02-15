/**
 * Orion Player 2.0 - Movie Details (Info page: rating, type, year, etc.)
 * Tap "Play" to open UniversalPlayer.
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  ImageBackground,
  StyleSheet,
  Dimensions,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { IS_TV } from '../constants/device';

const { width } = Dimensions.get('window');
const HERO_HEIGHT = 320;
const GOLD = '#FFD700';

export default function MovieDetailsScreen({ route, navigation }) {
  const item = route?.params ?? {};
  const {
    stream_id,
    name,
    logo,
    rating,
    category_name,
    container_extension,
  } = item;
  const year = item.releaseDate ? String(item.releaseDate).slice(0, 4) : (item.year ? String(item.year) : null);
  const plot = item.plot || item.description || '';
  const cast = item.cast ?? item.actors ?? null;
  const genre = item.genre ?? (category_name ? [category_name] : null);
  const coverUri = (item.stream_icon || logo || item.icon) && typeof (item.stream_icon || logo || item.icon) === 'string'
    ? (item.stream_icon || logo || item.icon)
    : null;

  const onPlay = () => {
    navigation.navigate('UniversalPlayer', {
      stream_id,
      name,
      logo: logo || item.icon,
      type: 'movie',
      extension: container_extension || 'mp4',
      playlist: route.params?.playlist ?? [],
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          {coverUri ? (
            <ImageBackground source={{ uri: coverUri }} style={styles.heroBg} resizeMode="cover">
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(15,15,15,1)']}
                style={styles.heroGradient}
              />
            </ImageBackground>
          ) : (
            <View style={styles.heroPlaceholder}>
              <Ionicons name="film-outline" size={64} color="#444" />
            </View>
          )}
          {IS_TV ? (
            <FocusableButton style={styles.backBtn} onPress={() => navigation.goBack()} focusedStyle={styles.backBtnFocused}>
              <Ionicons name="arrow-back" size={30} color="#fff" />
            </FocusableButton>
          ) : (
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={26} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.title}>{name || 'Movie'}</Text>
          <View style={styles.metaRow}>
            {rating != null && rating !== '' && <Text style={styles.meta}>Rating: {rating}</Text>}
            {year && <Text style={styles.meta}>{year}</Text>}
            {(category_name || (genre && (Array.isArray(genre) ? genre[0] : genre))) && (
              <Text style={styles.meta}>{category_name || (Array.isArray(genre) ? genre.join(' · ') : genre)}</Text>
            )}
          </View>
          {cast ? <Text style={styles.cast}>Cast: {typeof cast === 'string' ? cast : (Array.isArray(cast) ? cast.join(', ') : '')}</Text> : null}
          {plot ? <Text style={styles.plot}>{plot}</Text> : null}

          <TouchableOpacity style={styles.playButton} onPress={onPlay} activeOpacity={0.85}>
            <Ionicons name="play" size={24} color="#000" />
            <Text style={styles.playButtonText}>Play</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },
  heroWrap: { height: HERO_HEIGHT, position: 'relative', marginBottom: 20 },
  heroBg: { width: '100%', height: '100%' },
  heroGradient: { ...StyleSheet.absoluteFillObject },
  heroPlaceholder: { width: '100%', height: '100%', backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  backBtn: { position: 'absolute', top: 48, left: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  backBtnFocused: { borderWidth: 3, borderColor: GOLD, transform: [{ scale: 1.1 }], backgroundColor: 'rgba(0,0,0,0.8)' },
  infoSection: { paddingHorizontal: 20 },
  title: { color: GOLD, fontSize: 26, fontWeight: 'bold', marginBottom: 10 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 6 },
  meta: { color: '#b0b0b0', fontSize: 14 },
  cast: { color: '#b0b0b0', fontSize: 13, marginBottom: 8 },
  plot: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 22, marginBottom: 24 },
  playButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: GOLD, borderRadius: 12, paddingVertical: 16, gap: 8 },
  playButtonFocused: { borderWidth: 3, borderColor: '#fff', transform: [{ scale: 1.1 }], backgroundColor: '#FFC700' },
  playButtonText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
});
