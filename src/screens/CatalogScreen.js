/**
 * Orion Player 2.0 - Catalog Screen (The Library Grid)
 * Browse by Category Folders with Auto-Generated Covers.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import FocusableButton from '../components/FocusableButton';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getMovies, getSeries, getCategoriesWithImages } from '../services/DatabaseService';
import { isTV } from '../constants/device';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Grid settings for items (posters)
const ITEM_COLS = 3;
const ITEM_GAP = 10;
const ITEM_PADDING = 16;
const POSTER_WIDTH = (SCREEN_WIDTH - ITEM_PADDING * 2 - ITEM_GAP * (ITEM_COLS - 1)) / ITEM_COLS;
const POSTER_HEIGHT = POSTER_WIDTH * 1.5; // 2:3 aspect ratio

// Grid settings for folders (landscape cards)
const FOLDER_COLS = 2;
const FOLDER_GAP = 12;
const FOLDER_PADDING = 16;
const FOLDER_WIDTH = (SCREEN_WIDTH - FOLDER_PADDING * 2 - FOLDER_GAP * (FOLDER_COLS - 1)) / FOLDER_COLS;
const FOLDER_HEIGHT = FOLDER_WIDTH * 0.56; // 16:9 aspect ratio

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'movie', label: 'Movies' },
  { key: 'series', label: 'Series' },
];

export default function CatalogScreen({ navigation }) {
  const [activeFilter, setActiveFilter] = useState('movie');
  const [viewMode, setViewMode] = useState('categories'); // 'categories' or 'items'
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load categories with auto-generated covers
  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      if (activeFilter === 'all') {
        // Combine movie and series categories
        const [movieCats, seriesCats] = await Promise.all([
          getCategoriesWithImages('movie'),
          getCategoriesWithImages('series'),
        ]);
        // Tag them with type
        const tagged = [
          ...movieCats.map((c) => ({ ...c, type: 'movie' })),
          ...seriesCats.map((c) => ({ ...c, type: 'series' })),
        ];
        setCategories(tagged);
      } else {
        const cats = await getCategoriesWithImages(activeFilter);
        setCategories(cats.map((c) => ({ ...c, type: activeFilter })));
      }
    } catch (e) {
      console.warn('[Catalog] loadCategories error:', e);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  // Load items for a specific category
  const loadItems = useCallback(async (categoryId, type) => {
    setLoading(true);
    try {
      if (type === 'movie') {
        const movies = await getMovies(categoryId);
        setItems((movies ?? []).map((m) => ({ ...m, _type: 'movie' })));
      } else if (type === 'series') {
        const series = await getSeries(categoryId);
        setItems((series ?? []).map((s) => ({ ...s, _type: 'series' })));
      }
    } catch (e) {
      console.warn('[Catalog] loadItems error:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load - categories
  useEffect(() => {
    if (viewMode === 'categories') {
      loadCategories();
    }
  }, [activeFilter, viewMode, loadCategories]);

  // Handle filter change - reset to categories view
  const handleFilterChange = (key) => {
    setActiveFilter(key);
    setViewMode('categories');
    setSelectedCategory(null);
    setItems([]);
  };

  // Handle category press - drill into items
  const handleCategoryPress = (category) => {
    setSelectedCategory(category);
    setViewMode('items');
    loadItems(category.category_id, category.type);
  };

  // Handle back to categories
  const handleBackToCategories = () => {
    setViewMode('categories');
    setSelectedCategory(null);
    setItems([]);
  };

  // Handle item press - navigate to details
  const handleItemPress = (item) => {
    const type = item._type ?? (item.series_id != null ? 'series' : 'movie');
    navigation.navigate('ContentDetails', {
      item: {
        ...item,
        stream_icon: item.stream_icon ?? item.cover ?? item.logo,
        type,
      },
    });
  };

  // Render a category folder card
  const renderFolderItem = ({ item, index }) => {
    const col = index % FOLDER_COLS;
    const hasRightMargin = col < FOLDER_COLS - 1;

    return (
      <TouchableOpacity
        style={[styles.folderCard, hasRightMargin && { marginRight: FOLDER_GAP }]}
        onPress={() => handleCategoryPress(item)}
        activeOpacity={0.85}
      >
        <ImageBackground
          source={{ uri: item.cover_image || 'https://via.placeholder.com/400x225/1A1A1A/333333?text=' }}
          style={styles.folderBg}
          imageStyle={styles.folderImage}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
            style={styles.folderGradient}
          >
            <Text style={styles.folderName} numberOfLines={2}>
              {item.category_name}
            </Text>
            <View style={styles.folderMeta}>
              <Ionicons
                name={item.type === 'series' ? 'tv-outline' : 'film-outline'}
                size={14}
                color="#AAAAAA"
              />
              <Text style={styles.folderCount}>{item.item_count} items</Text>
            </View>
          </LinearGradient>
        </ImageBackground>
      </TouchableOpacity>
    );
  };

  // Render an item (poster) — FocusableButton on TV for remote navigation
  const renderPosterItem = ({ item, index }) => {
    const poster = item.stream_icon ?? item.cover ?? item.logo ?? item.icon;
    const col = index % ITEM_COLS;
    const hasRightMargin = col < ITEM_COLS - 1;
    const cardStyle = [styles.posterCard, hasRightMargin && { marginRight: ITEM_GAP }];
    const content = (
      <Image
        source={{ uri: poster || 'https://via.placeholder.com/200x300/1A1A1A/444444?text=?' }}
        style={styles.poster}
        resizeMode="cover"
      />
    );
    if (isTV) {
      return (
        <FocusableButton
          style={cardStyle}
          onPress={() => handleItemPress(item)}
          focusedStyle={styles.posterCardFocused}
        >
          {content}
        </FocusableButton>
      );
    }
    return (
      <TouchableOpacity style={cardStyle} onPress={() => handleItemPress(item)} activeOpacity={0.85}>
        {content}
      </TouchableOpacity>
    );
  };

  // Header component
  const renderHeader = () => (
    <View style={styles.header}>
      {viewMode === 'categories' ? (
        <>
          <Text style={styles.headerTitle}>Browse Library</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {FILTERS.map((f, i) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.chip, i > 0 && { marginLeft: 10 }, activeFilter === f.key && styles.chipActive]}
                onPress={() => handleFilterChange(f.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, activeFilter === f.key && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      ) : (
        <>
          {isTV ? (
            <FocusableButton style={styles.backRow} onPress={handleBackToCategories} focusedStyle={styles.backRowFocused}>
              <Ionicons name="arrow-back" size={isTV ? 28 : 24} color="#FFD700" />
              <Text style={[styles.backText, isTV && styles.backTextTV]}>Back to Categories</Text>
            </FocusableButton>
          ) : (
            <TouchableOpacity style={styles.backRow} onPress={handleBackToCategories}>
              <Ionicons name="arrow-back" size={24} color="#FFD700" />
              <Text style={styles.backText}>Back to Categories</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.categoryTitle}>{selectedCategory?.category_name}</Text>
          <Text style={styles.categorySubtitle}>
            {items.length} {selectedCategory?.type === 'series' ? 'series' : 'movies'}
          </Text>
        </>
      )}
    </View>
  );

  const keyExtractor = (item, index) => {
    if (viewMode === 'categories') {
      return `cat-${item.category_id}-${item.type}-${index}`;
    }
    return `item-${item.stream_id ?? item.series_id ?? item.name ?? index}`;
  };

  if (loading && (viewMode === 'categories' ? categories.length === 0 : items.length === 0)) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={viewMode === 'categories' ? categories : items}
        ListHeaderComponent={renderHeader}
        renderItem={viewMode === 'categories' ? renderFolderItem : renderPosterItem}
        keyExtractor={keyExtractor}
        numColumns={viewMode === 'categories' ? FOLDER_COLS : ITEM_COLS}
        key={viewMode} // Force re-render when switching between modes
        initialNumToRender={10}
        maxToRenderPerBatch={15}
        windowSize={5}
        removeClippedSubviews={true}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={60} color="#444444" />
            <Text style={styles.emptyText}>
              {viewMode === 'categories' ? 'No categories found' : 'No items in this category'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: "#FFD700", marginTop: 12, fontSize: 16 },
  header: {
    paddingHorizontal: FOLDER_PADDING,
    paddingTop: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: "#FFD700",
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  headerTitleTV: { fontSize: 32 },
  filterRow: {
    flexDirection: 'row',
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#333333",
  },
  chipActive: {
    backgroundColor: "#FFD700",
    borderColor: "#FFD700",
  },
  chipText: {
    fontSize: 15,
    fontWeight: '600',
    color: "#888888",
  },
  chipTextActive: {
    color: "#000000",
  },
  chipFocused: {
    borderColor: "#FFD700",
    borderWidth: 3,
    backgroundColor: "#2A2A2A",
    transform: [{ scale: 1.1 }],
  },
  chipTextTV: {
    fontSize: 18,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backText: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  categoryTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: "#FFFFFF",
    marginBottom: 4,
  },
  categorySubtitle: {
    fontSize: 14,
    color: "#888888",
  },
  listContent: {
    paddingHorizontal: FOLDER_PADDING,
    paddingBottom: 40,
  },
  row: {
    marginBottom: FOLDER_GAP,
    justifyContent: 'flex-start',
  },
  // Folder card styles
  folderCard: {
    width: FOLDER_WIDTH,
    height: FOLDER_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
  },
  folderBg: {
    flex: 1,
  },
  folderImage: {
    borderRadius: 12,
  },
  folderGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
  },
  folderName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: "#FFFFFF",
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  folderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  folderCount: {
    fontSize: 12,
    color: "#AAAAAA",
    marginLeft: 6,
  },
  folderNameTV: { fontSize: 20 },
  folderCountTV: { fontSize: 16 },
  folderCardFocused: {
    borderColor: "#FFD700",
    borderWidth: 3,
    transform: [{ scale: 1.05 }],
    backgroundColor: "#2A2A2A",
  },
  // Poster card styles
  posterCard: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
  },
  posterCardFocused: {
    borderColor: "#FFD700",
    borderWidth: 3,
    borderRadius: 8,
    transform: [{ scale: 1.1 }],
    backgroundColor: "#2A2A2A",
  },
  poster: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: 8,
    backgroundColor: "#1A1A1A",
  },
  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: "#666666",
    fontSize: 16,
    marginTop: 16,
  },
});