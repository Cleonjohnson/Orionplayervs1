/**
 * Orion Player 2.0 - Series Screen
 * Toggle View: Grid (3 cols) or List (1 col). Dark #0f0f0f, Gold #FFD700.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getSeriesList } from '../services/DatabaseService';

const { width } = Dimensions.get('window');
const GAP = 8;
const PADDING = 16;
const COLS = 3;
const POSTER_WIDTH_GRID = (width - PADDING * 2 - GAP * (COLS - 1)) / COLS;
const POSTER_HEIGHT_GRID = POSTER_WIDTH_GRID * 1.5;
const LIST_ROW_HEIGHT = 100;

export default function SeriesScreen({ navigation }) {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [seriesFavorites, setSeriesFavorites] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const list = await getSeriesList(null);
      if (!cancelled) setSeries(list ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setViewMode((m) => (m === 'grid' ? 'list' : 'grid'))}
          style={styles.headerToggle}
        >
          <Ionicons
            name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'}
            size={24}
            color="#FFD700"
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, viewMode]);

  const onPressSeries = (item) => {
    navigation.navigate('SeriesDetails', {
      series_id: item.series_id,
      name: item.name,
      cover: item.cover ?? item.stream_icon,
      cover_image: item.cover ?? item.stream_icon,
    });
  };

  const year = (item) => item.releaseDate ? String(item.releaseDate).slice(0, 4) : (item.year ? String(item.year) : null);

  const renderGridItem = ({ item, index }) => {
    const isFav = !!seriesFavorites[item.series_id];
    return (
      <TouchableOpacity
        style={[styles.gridItem, index % COLS !== COLS - 1 && { marginRight: GAP }]}
        onPress={() => onPressSeries(item)}
        activeOpacity={0.85}
      >
        {item.cover || item.stream_icon ? (
          <Image source={{ uri: item.cover || item.stream_icon }} style={styles.posterGrid} resizeMode="cover" />
        ) : (
          <View style={styles.posterPlaceholder}>
            <Ionicons name="tv-outline" size={32} color="#666" />
          </View>
        )}
        <TouchableOpacity
          style={styles.favIconGrid}
          onPress={(e) => handleFavoritePress(item, e)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={22} color={isFav ? '#e74c3c' : "#FFFFFF"} />
        </TouchableOpacity>
        <Text style={styles.titleGrid} numberOfLines={2}>{item.name || 'Series'}</Text>
      </TouchableOpacity>
    );
  };

  const renderListItem = ({ item }) => (
    <TouchableOpacity style={styles.listRow} onPress={() => onPressSeries(item)} activeOpacity={0.85}>
      {item.cover || item.stream_icon ? (
        <Image source={{ uri: item.cover || item.stream_icon }} style={styles.listThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.listThumb, styles.posterPlaceholder]}>
          <Ionicons name="tv-outline" size={28} color="#666" />
        </View>
      )}
      <View style={styles.listBody}>
        <Text style={styles.listTitle} numberOfLines={2}>{item.name || 'Series'}</Text>
        {year(item) ? <Text style={styles.listMeta}>{year(item)}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={24} color="#FFD700" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.hint}>Loading series...</Text>
      </View>
    );
  }

  if (!series.length) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No series found.</Text>
        <Text style={styles.subText}>Sync series from Home.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        key={viewMode}
        data={series}
        renderItem={viewMode === 'grid' ? renderGridItem : renderListItem}
        keyExtractor={(item, index) => (item.series_id != null ? String(item.series_id) + '_' + index : String(index))}
        numColumns={viewMode === 'grid' ? COLS : 1}
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f0f" },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: "#0f0f0f" },
  headerToggle: { marginRight: 16, padding: 4 },
  listContent: { padding: PADDING, paddingBottom: 40 },
  gridRow: { marginBottom: GAP },
  gridItem: { width: POSTER_WIDTH_GRID },
  posterGrid: { width: POSTER_WIDTH_GRID, height: POSTER_HEIGHT_GRID, borderRadius: 8 },
  favIconGrid: { position: 'absolute', top: 6, right: 6, zIndex: 1, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 14, padding: 4 },
  posterPlaceholder: {
    width: POSTER_WIDTH_GRID,
    height: POSTER_HEIGHT_GRID,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleGrid: { color: "#FFFFFF", fontSize: 12, marginTop: 4, fontWeight: '500' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: LIST_ROW_HEIGHT,
    marginBottom: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 8,
  },
  listThumb: { width: 84, height: 84, borderRadius: 8 },
  listBody: { flex: 1, marginLeft: 12 },
  listTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: '600' },
  listMeta: { color: "#FFD700", fontSize: 13, marginTop: 4 },
  hint: { color: "#FFD700", marginTop: 10 },
  emptyText: { color: '#888', fontSize: 16 },
  subText: { color: '#666', fontSize: 14, marginTop: 8 },
});