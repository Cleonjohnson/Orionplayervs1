/**
 * Orion Player 2.0 - Live TV Categories
 * Grid/List toggle. Navigates to ChannelList on press.
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
import { isTV, fs } from '../constants/device';
import FocusableButton from '../components/FocusableButton';

const { width } = Dimensions.get('window');
const COLS = 2;
const GAP = 10;
const PADDING = 16;
const CARD_SIZE = (width - PADDING * 2 - GAP * (COLS - 1)) / COLS;

export default function LiveTVScreen() {
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
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => navigation.navigate('TVGuide')}
            style={styles.headerToggle}
          >
            <Ionicons name="calendar-outline" size={24} color="#FFD700" />
          </TouchableOpacity>
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
        </View>
      ),
    });
  }, [navigation, viewMode]);

  const loadCategories = async () => {
    setLoading(true);
    const data = await getCategories('live');
    setCategories(data ?? []);
    setLoading(false);
  };

  const onPressCategory = (item) => {
    navigation.navigate('ChannelList', {
      category_id: item.cat_id,
      category_name: item.cat_name,
    });
  };

  const renderGridItem = ({ item, index }) => {
    const card = (
      <>
        <View style={styles.gridIconWrap}>
          <Ionicons name="tv-outline" size={isTV ? 44 : 36} color="#FFD700" />
        </View>
        <Text style={[styles.gridTitle, isTV && { fontSize: fs(14, 20) }]} numberOfLines={2}>
          {item.cat_name || 'Unknown Category'}
        </Text>
      </>
    );
    if (isTV) {
      return (
        <FocusableButton
          style={[styles.gridCard, index % COLS !== COLS - 1 && { marginRight: GAP }]}
          onPress={() => onPressCategory(item)}
          focusedStyle={styles.gridCardFocused}
        >
          {card}
        </FocusableButton>
      );
    }
    return (
      <TouchableOpacity
        style={[styles.gridCard, index % COLS !== COLS - 1 && { marginRight: GAP }]}
        onPress={() => onPressCategory(item)}
        activeOpacity={0.85}
      >
        {card}
      </TouchableOpacity>
    );
  };

  const renderListItem = ({ item }) => {
    const row = (
      <>
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>dY"�</Text>
        </View>
        <Text style={[styles.categoryName, isTV && { fontSize: fs(16, 26) }]} numberOfLines={1}>
          {item.cat_name || 'Unknown Category'}
        </Text>
        <Ionicons name="chevron-forward" size={isTV ? 28 : 24} color="#FFD700" />
      </>
    );
    if (isTV) {
      return (
        <FocusableButton style={styles.listCard} onPress={() => onPressCategory(item)} focusedStyle={styles.listCardFocused}>
          {row}
        </FocusableButton>
      );
    }
    return (
      <TouchableOpacity style={styles.listCard} onPress={() => onPressCategory(item)} activeOpacity={0.85}>
        {row}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading Categories...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {categories.length === 0 ? (
        <View style={[styles.centerContainer, { backgroundColor: "#121212" }]}>
          <Text style={[styles.emptyText, isTV && { fontSize: fs(18, 28) }]}>No Categories Found.</Text>
          <Text style={[styles.subText, isTV && { fontSize: fs(14, 22) }]}>Please go Home and tap "Sync Live TV".</Text>
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
  container: { flex: 1, backgroundColor: "#121212" },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: "#121212" },
  headerRight: { flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  headerToggle: { marginLeft: 12, padding: 4 },
  listContent: { padding: PADDING, paddingBottom: 24 },
  gridRow: { marginBottom: GAP },
  gridCard: {
    width: CARD_SIZE,
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: "#333333",
  },
  gridIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#333333",
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  gridTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: '600', textAlign: 'center' },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "#1E1E1E",
    marginBottom: 10,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333333",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#333333",
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  iconText: { fontSize: 20 },
  categoryName: { flex: 1, color: "#FFFFFF", fontSize: 16, fontWeight: '600' },
  listCardFocused: { borderColor: "#FFD700", borderWidth: 3, transform: [{ scale: 1.02 }], backgroundColor: "#2A2A2A" },
  loadingText: { color: "#FFD700", marginTop: 10 },
  emptyText: { color: "#FFFFFF", fontSize: 18, fontWeight: 'bold' },
  subText: { color: "#666666", marginTop: 5 },
  radioButton: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "#1E1E1E",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFD700",
    gap: 10,
  },
  radioButtonText: { color: "#FFD700", fontSize: 16, fontWeight: '700' },
});