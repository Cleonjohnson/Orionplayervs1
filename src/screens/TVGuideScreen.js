/**
 * TV Guide (TiviMate-style) – channels with Now & Next programs
 * Tap channel to play live; tap program to open EPG for that channel or play with catch-up.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getChannels } from '../services/DatabaseService';
import { getCachedEpg } from '../services/DatabaseService';
import { useTheme } from '../context/ThemeContext';

function formatTime(ts) {
  if (!ts || typeof ts !== 'number') return '--:--';
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getNowAndNext(programs) {
  const now = Math.floor(Date.now() / 1000);
  if (!Array.isArray(programs) || programs.length === 0) return { now: null, next: null };
  const sorted = [...programs].sort((a, b) => (a.start_timestamp || 0) - (b.start_timestamp || 0));
  let current = null;
  let next = null;
  for (const p of sorted) {
    const start = p.start_timestamp || 0;
    const stop = p.stop_timestamp || start + 3600;
    if (now >= start && now < stop) current = p;
    if (now < start && !next) { next = p; break; }
  }
  if (current && !next) {
    const idx = sorted.findIndex((p) => p === current);
    if (idx >= 0 && idx < sorted.length - 1) next = sorted[idx + 1];
  }
  if (!current && !next && sorted.length > 0) next = sorted[0];
  return { now: current, next };
}

export default function TVGuideScreen({ navigation }) {
  const { accent } = useTheme();
  const [channels, setChannels] = useState([]);
  const [epgByStreamId, setEpgByStreamId] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadChannels = useCallback(async () => {
    const list = await getChannels('', 'live');
    setChannels(list || []);
  }, []);

  const loadEpgForChannels = useCallback(async (channelList) => {
    const map = {};
    await Promise.all(
      (channelList || []).map(async (ch) => {
        const sid = ch.stream_id;
        if (sid == null) return;
        const programs = await getCachedEpg(sid);
        map[sid] = programs;
      })
    );
    setEpgByStreamId((prev) => ({ ...prev, ...map }));
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadChannels();
    setRefreshing(false);
  }, [loadChannels]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadChannels();
      if (cancelled) return;
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadChannels]);

  useEffect(() => {
    if (channels.length === 0) return;
    loadEpgForChannels(channels);
  }, [channels, loadEpgForChannels]);

  const onPressChannel = (channel) => {
    navigation.navigate('Player', {
      stream_id: channel.stream_id,
      channel_name: channel.name,
      stream_icon: channel.stream_icon,
      isLive: true,
    });
  };

  const onPressProgram = (channel, program, isNow) => {
    if (isNow && program?.start_timestamp && program?.stop_timestamp) {
      const idx = channels.findIndex((c) => (c.stream_id ?? c.id) === (channel.stream_id ?? channel.id));
      navigation.navigate('Player', {
        stream_id: channel.stream_id,
        name: channel.name,
        title: channel.name,
        cover: channel.stream_icon,
        stream_icon: channel.stream_icon,
        type: 'live',
        catchUpStart: program.start_timestamp,
        catchUpDuration: (program.stop_timestamp || 0) - program.start_timestamp,
        ...(channels?.length > 0 && { channelList: channels, currentChannelIndex: idx >= 0 ? idx : 0 }),
      });
    } else {
      navigation.navigate('EPG', {
        stream_id: channel.stream_id,
        channel_name: channel.name,
      });
    }
  };

  const renderItem = ({ item: channel }) => {
    const programs = epgByStreamId[channel.stream_id] || [];
    const { now, next } = getNowAndNext(programs);
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => onPressChannel(channel)}
        activeOpacity={0.8}
      >
        <View style={styles.channelCol}>
          {channel.stream_icon ? (
            <Image source={{ uri: channel.stream_icon }} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoPlaceholder]}>
              <Ionicons name="tv-outline" size={20} color="#666" />
            </View>
          )}
          <Text style={styles.channelName} numberOfLines={2}>{channel.name || 'Channel'}</Text>
        </View>
        <View style={styles.programsCol}>
          {now ? (
            <TouchableOpacity
              style={[styles.programSlot, styles.nowSlot]}
              onPress={() => onPressProgram(channel, now, true)}
            >
              <Text style={styles.timeText}>{formatTime(now.start_timestamp)}</Text>
              <Text style={[styles.programTitle, { color: "#FFD700" }]} numberOfLines={1}>{now.title || 'Now'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.programSlot}>
              <Text style={styles.noEpg}>—</Text>
            </View>
          )}
          {next ? (
            <TouchableOpacity
              style={styles.programSlot}
              onPress={() => onPressProgram(channel, next, false)}
            >
              <Text style={styles.timeText}>{formatTime(next.start_timestamp)}</Text>
              <Text style={styles.programTitle} numberOfLines={1}>{next.title || 'Next'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.programSlot}>
              <Text style={styles.noEpg}>—</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={[styles.loadingText, { color: "#FFD700" }]}>Loading TV Guide...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: "#FFD700" }]}>TV Guide</Text>
        <Text style={styles.headerSub}>Now & Next • Tap to watch</Text>
      </View>
      <FlatList
        data={channels}
        keyExtractor={(item) => String(item.stream_id ?? item.id ?? Math.random())}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#FFD700" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color="#555" />
            <Text style={styles.emptyText}>No channels. Sync Live TV in Settings.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f0f" },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14 },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#222' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 12, color: '#888', marginTop: 4 },
  listContent: { paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "#1a1a1a",
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#252525',
  },
  channelCol: { width: 100, alignItems: 'center', marginRight: 12 },
  logo: { width: 48, height: 48, borderRadius: 8 },
  logoPlaceholder: { backgroundColor: '#252525', justifyContent: 'center', alignItems: 'center' },
  channelName: { fontSize: 11, color: '#ccc', marginTop: 4, textAlign: 'center' },
  programsCol: { flex: 1 },
  programSlot: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 10 },
  nowSlot: { borderLeftWidth: 3, borderLeftColor: '#333', paddingLeft: 8 },
  timeText: { fontSize: 12, color: '#888', width: 44 },
  programTitle: { flex: 1, fontSize: 13, color: '#fff' },
  noEpg: { fontSize: 12, color: '#555' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { color: '#888', marginTop: 12, fontSize: 14 },
});