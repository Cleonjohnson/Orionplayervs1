/**
 * Orion Player 2.0 - Series List by Category
 * Grid/List toggle in header. Tap series → SeriesDetailsScreen.
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
import { getSeriesList, addToFavorites, removeFromFavorites, checkFavoriteStatus } from '../services/DatabaseService';

const GOLD = '#FFD700';
const COLS = 3;
const { width } = Dimensions.get('window');
const GAP = 8;
const PADDING = 16;
const POSTER_WIDTH_GRID = (width - PADDING * 2 - GAP * (COLS - 1)) / COLS;
const POSTER_HEIGHT_GRID = POSTER_WIDTH_GRID * 1.5;
const LIST_ROW_HEIGHT = 100;

export default function SeriesListScreen({ route, navigation }) {
  const { category_id, category_name } = route?.params ?? {};
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [seriesFavorites, setSeriesFavorites] = useState({});

  useEffect(() => {
    navigation.setOptions({
      title: category_name || 'Series',
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setViewMode((m) => (m === 'grid' ? 'list' : 'grid'))}
          style={styles.headerToggle}
        >
          <Ionicons name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'} size={24} color={GOLD} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, category_name, viewMode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const list = await getSeriesList(category_id ?? null);
      if (!cancelled) setSeries(list ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [category_id]);

  useEffect(() => {
    if (!series.length) return;
    const ids = series.map((s) => s.series_id).filter((id) => id != null);
    Promise.all(ids.map((sid) => checkFavoriteStatus(sid, 'series').then((ok) => ({ sid, ok }))))
      .then((results) => {
        const favs = {};
        results.forEach((r) => { favs[r.sid] = r.ok; });
        setSeriesFavorites(favs);
      })
      .catch(() => {});
  }, [series]);

  const handleFavoritePress = async (item, e) => {
    if (e) e.stopPropagation?.();
    const sid = item.series_id;
    if (sid == null) return;
    const isFav = seriesFavorites[sid];
    const favItem = { series_id: sid, name: item.name, stream_icon: item.cover ?? item.stream_icon };
    if (isFav) {
      await removeFromFavorites(sid, 'series');
      setSeriesFavorites((prev) => ({ ...prev, [sid]: false }));
    } else {
      await addToFavorites(favItem, 'series');
      setSeriesFavorites((prev) => ({ ...prev, [sid]: true }));
    }
  };

  const onPressSeries = (item) => {
    navigation.navigate('SeriesDetails', {
      series_id: item.series_id,
      name: item.name,
      cover: item.cover ?? item.stream_icon,
      plot: item.plot,
    });
  };

  const year = (i) => i.releaseDate ? String(i.releaseDate).slice(0, 4) : (i.year ? String(i.year) : null);

  const renderGridItem = ({ item, index }) => (
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
      <Text style={styles.titleGrid} numberOfLines={2}>{item.name || 'Series'}</Text>
      {year(item) ? <Text style={styles.metaGrid}>{year(item)}</Text> : null}
    </TouchableOpacity>
  );

  const renderListItem = ({ item }) => {
    const isFav = !!seriesFavorites[item.series_id];
    return (
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
          {year(item) ? <Text style={styles.listYear}>{year(item)}</Text> : null}
        </View>
        <TouchableOpacity
          onPress={(e) => handleFavoritePress(item, e)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: 8 }}
        >
          <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={24} color={isFav ? '#e74c3c' : GOLD} />
        </TouchableOpacity>
        <Ionicons name="chevron-forward" size={24} color={GOLD} />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={GOLD} />
        <Text style={styles.hint}>Loading series...</Text>
      </View>
    );
  }

  if (!series.length) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No series in this category.</Text>
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
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f0f' },
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
  titleGrid: { color: '#fff', fontSize: 12, marginTop: 4, fontWeight: '500' },
  metaGrid: { color: GOLD, fontSize: 11, marginTop: 2 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: LIST_ROW_HEIGHT,
    marginBottom: 8,
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 10,
  },
  listThumb: { width: 80, height: 80, borderRadius: 8 },
  listBody: { flex: 1, marginLeft: 12 },
  listTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  listYear: { color: GOLD, fontSize: 13, marginTop: 4 },
  hint: { color: GOLD, marginTop: 10 },
  emptyText: { color: '#888', fontSize: 16 },
});
