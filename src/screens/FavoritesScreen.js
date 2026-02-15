import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getFavorites } from '../services/DatabaseService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLS = 3;
const GAP = 10;
const PADDING = 16;
const CARD_W = (SCREEN_WIDTH - PADDING * 2 - GAP * (COLS - 1)) / COLS;
const CARD_H = CARD_W * 1.5;

export default function FavoritesScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('movie');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pressedId, setPressedId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      function fetchFavorites() {
        setLoading(true);
        getFavorites(activeTab)
          .then((favs) => {
            if (isActive) setData(favs ?? []);
          })
          .catch((e) => {
            console.warn('[Favorites] load error:', e);
            if (isActive) setData([]);
          })
          .finally(() => {
            if (isActive) setLoading(false);
          });
      }

      fetchFavorites();

      return () => {
        isActive = false;
      };
    }, [activeTab])
  );

  const handlePress = useCallback(
    (item) => {
      const contentType = item.type ?? activeTab;
      if (contentType === 'live') {
        navigation.navigate('Player', {
          stream_id: item.stream_id ?? item.series_id,
          name: item.name,
          type: contentType,
          stream_url: item.stream_url ?? undefined,
          cover: item.stream_icon ?? item.logo ?? item.cover,
        });
      } else {
        navigation.navigate('ContentDetails', {
          item: {
            ...item,
            stream_icon: item.stream_icon ?? item.logo ?? item.cover,
            type: contentType,
          },
        });
      }
    },
    [navigation, activeTab]
  );

  const renderItem = ({ item, index }) => {
    const itemId = String(item.stream_id ?? item.series_id ?? index);
    const isPressed = pressedId === itemId;
    const poster = item.stream_icon ?? item.logo ?? item.cover;

    return (
      <TouchableOpacity
        style={[styles.card, isPressed && styles.cardActive]}
        onPress={() => handlePress(item)}
        activeOpacity={0.85}
        onPressIn={() => setPressedId(itemId)}
        onPressOut={() => setPressedId(null)}
      >
        {poster ? (
          <Image source={{ uri: poster }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={styles.posterPlaceholder}>
            <Ionicons name="image-outline" size={26} color="#AAAAAA" />
          </View>
        )}
        <View style={styles.titleOverlay}>
          <Text style={styles.titleText} numberOfLines={2}>
            {item.name || 'Untitled'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>MY LIST</Text>

      <View style={styles.tabRow}>
        {[
          { key: 'live', label: 'LIVE TV' },
          { key: 'movie', label: 'MOVIES' },
          { key: 'series', label: 'SERIES' },
        ].map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FFD700" />
        </View>
      ) : data.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="cube-outline" size={64} color="#AAAAAA" />
          <Text style={styles.emptyText}>No Favorites Yet</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.stream_id ?? item.series_id ?? 'fav'}_${index}`}
          numColumns={COLS}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  header: {
    color: "#FFD700",
    fontSize: 26,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  tabRow: {
    height: 50,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  tabBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: "#FFD700" },
  tabText: { color: "#AAAAAA", fontWeight: '600', fontSize: 12 },
  tabTextActive: { color: "#FFD700" },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: "#AAAAAA", fontSize: 16, marginTop: 12 },
  gridContent: { paddingHorizontal: PADDING, paddingBottom: 20 },
  gridRow: { justifyContent: 'space-between', marginBottom: GAP },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardActive: { borderColor: "#FFD700" },
  poster: { width: '100%', height: '100%' },
  posterPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: "#1E1E1E",
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  titleText: { color: "#FFFFFF", fontSize: 11, fontWeight: '600' },
});