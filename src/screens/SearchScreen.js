import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { searchGlobal } from '../services/DatabaseService';

const SearchScreen = () => {
  const navigation = useNavigation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (text) => {
    setQuery(text);
    if (text.length < 3) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const data = await searchGlobal(text);
      setResults(data);
    } catch (error) {
      console.log('Search Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePress = (item) => {
    if (item.type === 'live') {
      navigation.navigate('Player', {
        stream_id: item.stream_id,
        name: item.name,
        stream_url: item.stream_url ?? null,
        type: item.type,
        cover: item.stream_icon,
      });
    } else {
      navigation.navigate('ContentDetails', { item: { ...item, stream_icon: item.stream_icon } });
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.resultItem} onPress={() => handlePress(item)}>
      <Image
        source={{ uri: item.stream_icon || 'https://via.placeholder.com/100' }}
        style={styles.poster}
      />
      <View style={styles.textContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.typeBadge}>{item.type ? item.type.toUpperCase() : 'UNKNOWN'}</Text>
      </View>
      <Ionicons name="play-circle-outline" size={24} color="#FFD700" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SEARCH ORION</Text>
      </View>

      <View style={styles.inputContainer}>
        <Ionicons name="search" size={20} color="#FFD700" style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder="Find Movies, Channels..."
          placeholderTextColor="#666"
          value={query}
          onChangeText={handleSearch}
          autoFocus={true}
        />
        {loading && <ActivityIndicator color="#FFD700" style={{ marginLeft: 10 }} />}
      </View>

      <FlatList
        data={results}
        renderItem={renderItem}
        keyExtractor={(item, index) => index.toString() + item.type}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          query.length > 2 && !loading ? (
            <Text style={styles.emptyText}>No results found.</Text>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', paddingTop: 40 },
  header: { paddingHorizontal: 20, marginBottom: 10 },
  headerTitle: { color: '#FFD700', fontSize: 22, fontWeight: 'bold' },
  inputContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    marginHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    paddingHorizontal: 15,
    height: 50,
    borderWidth: 1,
    borderColor: '#333',
  },
  input: { flex: 1, color: '#FFFFFF', fontSize: 16, marginLeft: 10 },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  poster: { width: 40, height: 60, borderRadius: 4, marginRight: 15 },
  textContainer: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  typeBadge: { color: '#888', fontSize: 12, marginTop: 4 },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 50 },
  listContent: { paddingBottom: 50 },
});

export default SearchScreen;
