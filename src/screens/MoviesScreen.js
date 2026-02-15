/**
 * Orion Player 2.0 - Movies Screen
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
import { getMovies } from '../services/DatabaseService';

const { width } = Dimensions.get('window');
const GAP = 8;
const PADDING = 16;
const COLS = 3;
const POSTER_WIDTH_GRID = (width - PADDING * 2 - GAP * (COLS - 1)) / COLS;
const POSTER_HEIGHT_GRID = POSTER_WIDTH_GRID * 1.5;
const LIST_ROW_HEIGHT = 100;

export default function MoviesScreen({ navigation }) {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [movieFavorites, setMovieFavorites] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const list = await getMovies(null);
      if (!cancelled) setMovies(list ?? []);
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

  const onPressMovie = (item) => {
    navigation.navigate('Player', {
      stream_id: item.stream_id,
      name: item.name,
      type: 'movie',
      cover: item.logo ?? item.icon,
      extension: item.container_extension || 'mp4',
    });
  };

  const year = (item) => item.releaseDate ? String(item.releaseDate).slice(0, 4) : (item.year ? String(item.year) : null);

  const renderGridItem = ({ item, index }) => {
    const isFav = !!movieFavorites[item.stream_id];
    return (
      <TouchableOpacity
        style={[styles.gridItem, index % COLS !== COLS - 1 && { marginRight: GAP }]}
        onPress={() => onPressMovie(item)}
        activeOpacity={0.85}
      >
        {item.logo || item.icon ? (
          <Image source={{ uri: item.logo || item.icon }} style={styles.posterGrid} resizeMode="cover" />
        ) : (
          <View style={styles.posterPlaceholder}>
            <Ionicons name="film-outline" size={32} color="#666666" />
          </View>
        )}
        <TouchableOpacity
          style={styles.favIconGrid}
          onPress={(e) => handleFavoritePress(item, e)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={22} color={isFav ? '#e74c3c' : "#FFFFFF"} />
        </TouchableOpacity>
        <Text style={styles.titleGrid} numberOfLines={2}>{item.name || 'Movie'}</Text>
        {(item.rating || year(item)) ? (
          <Text style={styles.metaGrid}>{[item.rating, year(item)].filter(Boolean).join(' · ')}</Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderListItem = ({ item }) => (
    <TouchableOpacity style={styles.listRow} onPress={() => onPressMovie(item)} activeOpacity={0.85}>
      {item.logo || item.icon ? (
        <Image source={{ uri: item.logo || item.icon }} style={styles.listThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.listThumb, styles.posterPlaceholder]}>
          <Ionicons name="film-outline" size={28} color="#666666" />
        </View>
      )}
      <View style={styles.listBody}>
        <Text style={styles.listTitle} numberOfLines={2}>{item.name || 'Movie'}</Text>
        <View style={styles.listMetaRow}>
          {item.rating ? <Text style={styles.listRating}>{item.rating}</Text> : null}
          {year(item) ? <Text style={styles.listYear}>{year(item)}</Text> : null}
        </View>
      </View>
      <Ionicons name="play-circle" size={28} color="#FFD700" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.hint}>Loading movies...</Text>
      </View>
    );
  }

  if (!movies.length) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No movies found.</Text>
        <Text style={styles.subText}>Sync movies from Home.</Text>
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
  container: { flex: 1, backgroundColor: "#0F0F0F" },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: "#0F0F0F" },
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
    backgroundColor: "#1A1A1A",
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleGrid: { color: "#FFFFFF", fontSize: 12, marginTop: 4, fontWeight: '500' },
  metaGrid: { color: "#FFD700", fontSize: 11, marginTop: 2 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: LIST_ROW_HEIGHT,
    marginBottom: 8,
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 8,
  },
  listThumb: { width: 84, height: 84, borderRadius: 8 },
  listBody: { flex: 1, marginLeft: 12 },
  listTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: '600' },
  listMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
  listRating: { color: "#FFD700", fontSize: 13 },
  listYear: { color: "#888888", fontSize: 13 },
  hint: { color: "#FFD700", marginTop: 10 },
  emptyText: { color: "#888888", fontSize: 16 },
  subText: { color: "#666666", fontSize: 14, marginTop: 8 },
});