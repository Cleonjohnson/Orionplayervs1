/**
 * Orion Player 2.0 - Movie List by Category
 * Grid/List toggle in header. Tap movie → MovieDetailsScreen (info page).
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
import { getMovies, addToFavorites, removeFromFavorites, checkFavoriteStatus } from '../services/DatabaseService';

const GOLD = '#FFD700';
const COLS = 3;
const { width } = Dimensions.get('window');
const GAP = 8;
const PADDING = 16;
const POSTER_WIDTH_GRID = (width - PADDING * 2 - GAP * (COLS - 1)) / COLS;
const POSTER_HEIGHT_GRID = POSTER_WIDTH_GRID * 1.5;
const LIST_ROW_HEIGHT = 100;

export default function MovieListScreen({ route, navigation }) {
  const { category_id, category_name } = route?.params ?? {};
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [movieFavorites, setMovieFavorites] = useState({});

  useEffect(() => {
    navigation.setOptions({
      title: category_name || 'Movies',
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
      const list = await getMovies(category_id ?? null);
      if (!cancelled) setMovies(list ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [category_id]);

  useEffect(() => {
    if (!movies.length) return;
    const ids = movies.map((m) => m.stream_id).filter((id) => id != null);
    Promise.all(ids.map((sid) => checkFavoriteStatus(sid, 'movie').then((ok) => ({ sid, ok }))))
      .then((results) => {
        const favs = {};
        results.forEach((r) => { favs[r.sid] = r.ok; });
        setMovieFavorites(favs);
      })
      .catch(() => {});
  }, [movies]);

  const handleFavoritePress = async (item, e) => {
    if (e) e.stopPropagation?.();
    const sid = item.stream_id;
    if (sid == null) return;
    const isFav = movieFavorites[sid];
    const favItem = { stream_id: sid, name: item.name, stream_icon: item.stream_icon ?? item.logo ?? item.icon ?? null };
    if (isFav) {
      await removeFromFavorites(sid, 'movie');
      setMovieFavorites((prev) => ({ ...prev, [sid]: false }));
    } else {
      await addToFavorites(favItem, 'movie');
      setMovieFavorites((prev) => ({ ...prev, [sid]: true }));
    }
  };

  const onPressMovie = (item) => {
    navigation.navigate('ContentDetails', { item: { ...item, stream_icon: item.stream_icon ?? item.logo ?? item.icon ?? null } });
  };

  const year = (i) => i.releaseDate ? String(i.releaseDate).slice(0, 4) : (i.year ? String(i.year) : null);

  const renderGridItem = ({ item, index }) => (
    <TouchableOpacity
      style={[styles.gridItem, index % COLS !== COLS - 1 && { marginRight: GAP }]}
      onPress={() => onPressMovie(item)}
      activeOpacity={0.85}
    >
      {item.stream_icon || item.logo || item.icon ? (
        <Image source={{ uri: item.stream_icon || item.logo || item.icon }} style={styles.posterGrid} resizeMode="cover" />
      ) : (
        <View style={styles.posterPlaceholder}>
          <Ionicons name="film-outline" size={32} color="#666" />
        </View>
      )}
      <Text style={styles.titleGrid} numberOfLines={2}>{item.name || 'Movie'}</Text>
      {(item.rating || year(item)) ? (
        <Text style={styles.metaGrid}>{[item.rating, year(item)].filter(Boolean).join(' · ')}</Text>
      ) : null}
    </TouchableOpacity>
  );

  const renderListItem = ({ item }) => {
    const isFav = !!movieFavorites[item.stream_id];
    return (
      <TouchableOpacity style={styles.listRow} onPress={() => onPressMovie(item)} activeOpacity={0.85}>
        {item.stream_icon || item.logo || item.icon ? (
          <Image source={{ uri: item.stream_icon || item.logo || item.icon }} style={styles.listThumb} resizeMode="cover" />
        ) : (
          <View style={[styles.listThumb, styles.posterPlaceholder]}>
            <Ionicons name="film-outline" size={28} color="#666" />
          </View>
        )}
        <View style={styles.listBody}>
          <Text style={styles.listTitle} numberOfLines={2}>{item.name || 'Movie'}</Text>
          <View style={styles.listMetaRow}>
            {item.rating ? <Text style={styles.listRating}>{item.rating}</Text> : null}
            {year(item) ? <Text style={styles.listYear}>{year(item)}</Text> : null}
          </View>
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
        <Text style={styles.hint}>Loading movies...</Text>
      </View>
    );
  }

  if (!movies.length) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No movies in this category.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        key={viewMode}
        data={movies}
        renderItem={viewMode === 'grid' ? renderGridItem : renderListItem}
        keyExtractor={(item, index) => (item.stream_id != null ? String(item.stream_id) + '_' + index : String(index))}
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
  listMetaRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  listRating: { color: GOLD, fontSize: 13 },
  listYear: { color: '#888', fontSize: 13 },
  hint: { color: GOLD, marginTop: 10 },
  emptyText: { color: '#888', fontSize: 16 },
});
