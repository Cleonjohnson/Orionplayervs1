/**
 * EPG (Electronic Program Guide) Screen
 * Shows TV schedule for a live channel
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as SecureStore from 'expo-secure-store';
import { getEpg } from '../services/XtreamService';
import { getCachedEpg, cacheEpgData } from '../services/DatabaseService';

const GOLD = '#FFD700';
const SECURE_KEYS = {
  username: 'orion_xtream_username',
  password: 'orion_xtream_password',
  baseUrl: 'orion_xtream_base_url',
};

function formatEpgTime(ts) {
  if (!ts || typeof ts !== 'number') return '--:--';
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatEpgDate(ts) {
  if (!ts || typeof ts !== 'number') return '';
  const d = new Date(ts * 1000);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function EPGScreen({ route, navigation }) {
  const { stream_id, channel_name = 'EPG' } = route?.params || {};
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadEpg = useCallback(async () => {
    if (stream_id == null) {
      setPrograms([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    
    try {
      // Try cache first (instant load)
      console.log(`[EPG] Checking cache for channel ${stream_id}...`);
      const cached = await getCachedEpg(stream_id);
      
      if (cached && cached.length > 0) {
        console.log(`[EPG] ✅ Using cached EPG (${cached.length} programs)`);
        setPrograms(cached);
        setLoading(false);
        // Still fetch fresh in background
        fetchFreshEpg();
        return;
      }
      
      // Cache miss - fetch from API
      await fetchFreshEpg();
    } catch (e) {
      console.warn('[EPG] loadEpg error:', e);
      setPrograms([]);
      setError(true);
      setLoading(false);
    }
  }, [stream_id]);

  const fetchFreshEpg = async () => {
    try {
      console.log(`[EPG] Fetching fresh EPG for channel ${stream_id}...`);
      const [username, password, baseUrl] = await Promise.all([
        SecureStore.getItemAsync(SECURE_KEYS.username),
        SecureStore.getItemAsync(SECURE_KEYS.password),
        SecureStore.getItemAsync(SECURE_KEYS.baseUrl),
      ]);
      if (!username || !password || !baseUrl) {
        setPrograms([]);
        setError(true);
        setLoading(false);
        return;
      }
      const list = await getEpg({
        baseUrl,
        username,
        password,
        streamId: stream_id,
        limit: 100,
      });
      
      if (Array.isArray(list) && list.length > 0) {
        setPrograms(list);
        // Cache for future
        await cacheEpgData(stream_id, channel_name || '', list);
        console.log(`[EPG] ✅ Cached ${list.length} programs`);
      } else {
        setPrograms([]);
        setError(true);
      }
      setLoading(false);
    } catch (e) {
      console.warn('[EPG] fetchFreshEpg error:', e);
      if (programs.length === 0) {
        setError(true);
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadEpg();
  }, [loadEpg]);

  useEffect(() => {
    navigation?.setOptions?.({ title: channel_name || 'Program Guide' });
  }, [navigation, channel_name]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading program guide...</Text>
      </View>
    );
  }

  if (error && programs.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="calendar-outline" size={64} color="#666666" />
        <Text style={styles.emptyTitle}>No Program Guide</Text>
        <Text style={styles.emptySubtext}>
          This channel does not have EPG data available, or the server could not be reached.
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadEpg}>
          <Ionicons name="refresh" size={20} color="#FFD700" />
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const renderItem = ({ item }) => {
    const dateLabel = formatEpgDate(item.start_timestamp);
    const startTime = formatEpgTime(item.start_timestamp);
    const endTime = formatEpgTime(item.stop_timestamp);
    const hasStarted = now >= (item.start_timestamp || 0);
    const isOnNow = hasStarted && now < (item.stop_timestamp || 0);
    const duration = Math.max(0, (item.stop_timestamp || 0) - (item.start_timestamp || 0));

    const onPressProgram = () => {
      if (isOnNow && duration > 0) {
        navigation.navigate('Player', {
          stream_id,
          channel_name,
          isLive: true,
          catchUpStart: item.start_timestamp,
          catchUpDuration: duration,
        });
      }
    };

    return (
      <TouchableOpacity
        style={styles.programRow}
        onPress={onPressProgram}
        disabled={!isOnNow}
        activeOpacity={isOnNow ? 0.7 : 1}
      >
        <View style={styles.timeCol}>
          {dateLabel ? (
            <Text style={styles.dateLabel}>{dateLabel}</Text>
          ) : null}
          <Text style={styles.timeText}>{startTime} - {endTime}</Text>
        </View>
        <View style={styles.programCol}>
          <Text style={styles.programTitle} numberOfLines={2}>{item.title}</Text>
          {item.description ? (
            <Text style={styles.programDesc} numberOfLines={3}>{item.description}</Text>
          ) : null}
          {isOnNow ? (
            <View style={styles.watchFromStartWrap}>
              <Ionicons name="play-circle" size={18} color="#FFD700" />
              <Text style={styles.watchFromStartText}>Watch from start</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={programs}
        keyExtractor={(item) => String(item.id || item.epg_id || item.start_timestamp || Math.random())}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <Ionicons name="tv-outline" size={24} color="#FFD700" />
            <Text style={styles.headerTitle}>{channel_name}</Text>
            <Text style={styles.headerSub}>{programs.length} programs</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: GOLD,
    marginTop: 12,
    fontSize: 14,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    color: "#888888",
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 8,
  },
  retryText: {
    color: GOLD,
    marginLeft: 8,
    fontSize: 16,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
  },
  headerSub: {
    color: "#888888",
    fontSize: 13,
  },
  programRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  timeCol: {
    width: 100,
  },
  dateLabel: {
    color: "#888888",
    fontSize: 11,
    marginBottom: 2,
  },
  timeText: {
    color: GOLD,
    fontSize: 14,
    fontWeight: '600',
  },
  programCol: {
    flex: 1,
    marginLeft: 16,
  },
  programTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  programDesc: {
    color: "#888888",
    fontSize: 13,
    lineHeight: 18,
  },
  watchFromStartWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  watchFromStartText: {
    color: GOLD,
    fontSize: 13,
    fontWeight: '600',
  },
});