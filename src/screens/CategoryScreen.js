/**
 * Orion Player 2.0 - Live TV Category Grid (LiveTV route)
 * Fetches categories from SQLite; navigates to ChannelList with category_id (string) / category_name.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import * as Database from '../services/DatabaseService';

const NUM_COLUMNS = 3;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAD = 20;
const GAP = 12;
const CARD_SIZE = (SCREEN_WIDTH - PAD * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

const FOLDER_ICON = '📁';

export default function CategoryScreen({ navigation }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      let list = await Database.getCategories();
      if (!list || list.length === 0) {
        const fromChannels = await Database.getChannelCategories();
        list = (fromChannels || []).map((row) => ({
          category_id: String(row.cat_id ?? row.category_id ?? ''),
          category_name: row.category_name || 'Uncategorized',
        }));
      }
      setCategories(list || []);
    } catch (e) {
      console.error('CategoryScreen loadCategories:', e);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadCategories);
    loadCategories();
    return unsubscribe;
  }, [navigation, loadCategories]);

  const onPressCategory = (item) => {
    const categoryId = item.category_id != null ? String(item.category_id) : '';
    const categoryName = item.category_name?.trim()
      ? item.category_name
      : (categoryId ? `Category ${categoryId}` : 'Channels');
    navigation.navigate('ChannelList', {
      category_id: categoryId,
      category_name: categoryName,
    });
  };

  const displayName = (item) => {
    const name = item.category_name?.trim();
    const id = item.category_id != null ? String(item.category_id) : '';
    return name || (id ? `Category ${id}` : 'Uncategorized');
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPressCategory(item)}
      activeOpacity={0.85}
    >
      <Text style={styles.cardIcon}>{FOLDER_ICON}</Text>
      <Text style={styles.cardName} numberOfLines={2}>
        {displayName(item)}
      </Text>
    </TouchableOpacity>
  );

  const keyExtractor = (item) => String(item.category_id ?? '');

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading categories…</Text>
      </View>
    );
  }

  if (categories.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No categories</Text>
        <Text style={styles.emptySubtitle}>Sync Live TV from Home to load categories.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={categories}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      key="grid"
      numColumns={NUM_COLUMNS}
      contentContainerStyle={styles.listContent}
      columnWrapperStyle={styles.row}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: "#AAAAAA",
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: "#FFFFFF",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#AAAAAA",
    textAlign: 'center',
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
    marginBottom: GAP,
  },
  card: {
    width: CARD_SIZE,
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#333333",
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: CARD_SIZE * 0.9,
  },
  cardIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  cardName: {
    fontSize: 13,
    fontWeight: '600',
    color: "#FFFFFF",
    textAlign: 'center',
  },
});
