/**
 * Orion Player 2.0 - VOD (Movie) Categories
 * Grid/List toggle. Lists movie categories; navigates to MovieList on press.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getCategories } from '../services/DatabaseService';
import { useNavigation } from '@react-navigation/native';

const GOLD = '#FFD700';
const { width } = Dimensions.get('window');
const COLS = 2;
const GAP = 10;
const PADDING = 16;
const CARD_SIZE = (width - PADDING * 2 - GAP * (COLS - 1)) / COLS;

export default function VodCategoryScreen() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const navigation = useNavigation();

  useEffect(() => {
    loadCategories();
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
            color={GOLD}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, viewMode]);

  const loadCategories = async () => {
    setLoading(true);
    const data = await getCategories('movie');
    setCategories(data ?? []);
    setLoading(false);
  };

  const onPressCategory = (item) => {
    navigation.navigate('MovieList', { category_id: item.cat_id, category_name: item.cat_name });
  };

  const renderGridItem = ({ item, index }) => (
    <TouchableOpacity
      style={[styles.gridCard, index % COLS !== COLS - 1 && { marginRight: GAP }]}
      onPress={() => onPressCategory(item)}
      activeOpacity={0.85}
    >
      <View style={styles.gridIconWrap}>
        <Ionicons name="film-outline" size={36} color={GOLD} />
      </View>
      <Text style={styles.gridTitle} numberOfLines={2}>
        {item.cat_name || 'Unknown Category'}
      </Text>
    </TouchableOpacity>
  );

  const renderListItem = ({ item }) => (
    <TouchableOpacity style={styles.listCard} onPress={() => onPressCategory(item)} activeOpacity={0.85}>
      <View style={styles.iconContainer}>
        <Text style={styles.iconText}>🎬</Text>
      </View>
      <Text style={styles.categoryName} numberOfLines={1}>
        {item.cat_name || 'Unknown Category'}
      </Text>
      <Ionicons name="chevron-forward" size={24} color={GOLD} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={GOLD} />
        <Text style={styles.loadingText}>Loading Categories...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {categories.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No Movie Categories Found.</Text>
          <Text style={styles.subText}>Please go Home and tap "Sync Movies".</Text>
        </View>
      ) : (
        <FlatList
          key={viewMode}
          data={categories}
          renderItem={viewMode === 'grid' ? renderGridItem : renderListItem}
          keyExtractor={(item, index) => (item.cat_id != null ? item.cat_id.toString() + '_' + index : String(index))}
          numColumns={viewMode === 'grid' ? COLS : 1}
          columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f0f' },
  headerToggle: { marginRight: 16, padding: 4 },
  listContent: { padding: PADDING, paddingBottom: 24 },
  gridRow: { marginBottom: GAP },
  gridCard: {
    width: CARD_SIZE,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  gridIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  gridTitle: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    marginBottom: 10,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  iconText: { fontSize: 20 },
  categoryName: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '600' },
  loadingText: { color: GOLD, marginTop: 10 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  subText: { color: '#666', marginTop: 5 },
});
