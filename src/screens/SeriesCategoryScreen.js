/**
 * Orion Player 2.0 - Series Categories
 * Lists series categories from DB; navigates to SeriesList on press.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { getCategories } from '../services/DatabaseService';
import { useNavigation } from '@react-navigation/native';

export default function SeriesCategoryScreen() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    const data = await getCategories('series');
    setCategories(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const onPressCategory = (category_id, category_name) => {
    navigation.navigate('SeriesList', { category_id, category_name });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPressCategory(item.cat_id, item.cat_name)}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.iconText}>📺</Text>
      </View>
      <Text style={styles.categoryName} numberOfLines={1}>
        {item.cat_name || 'Unknown Category'}
      </Text>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading Categories...</Text>
      </View>
    );
  }

  const listData = [{ cat_id: null, cat_name: 'All Series', _all: true }, ...(categories ?? [])];

  return (
    <View style={styles.container}>
      <FlatList
        data={listData}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => onPressCategory(item.cat_id, item.cat_name)}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.iconText}>📺</Text>
            </View>
            <Text style={styles.categoryName} numberOfLines={1}>
              {item.cat_name || 'All Series'}
            </Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item, index) => item._all ? 'all_series' : (item.cat_id != null ? String(item.cat_id) + '_' + index : 'cat_' + index)}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f0f' },
  listContent: { padding: 15 },
  card: {
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
  arrow: { color: '#FFD700', fontSize: 24, fontWeight: 'bold' },
  loadingText: { color: '#FFD700', marginTop: 10 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  subText: { color: '#666', marginTop: 5 },
});
