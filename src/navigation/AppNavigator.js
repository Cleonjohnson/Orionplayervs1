/**
 * Orion Player 2.0 - App Navigator
 * Stack: Home, Radio, LiveTV, ChannelList, Movies, Series, Player (Ultimate Player).
 * FloatingRadioPlayer is shown except on Player/Video/Game screens.
 */

import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import FloatingRadioPlayer from '../components/FloatingRadioPlayer';
import HomeScreen from '../screens/HomeScreen';
import RadioScreen from '../screens/RadioScreen';
import CategoryScreen from '../screens/CategoryScreen';
import ChannelListScreen from '../screens/ChannelListScreen';
import SeriesDetailsScreen from '../screens/SeriesDetailsScreen';
import VodCategoryScreen from '../screens/VodCategoryScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import SearchScreen from '../screens/SearchScreen';
import PlayerScreen from '../screens/PlayerScreen';
import GameHubScreen from '../screens/GameHubScreen';
import CharadesMenuScreen from '../screens/CharadesMenuScreen';
import CharadesGameScreen from '../screens/CharadesGameScreen';
import BorderControlScreen from '../screens/BorderControlScreen';
import PolitricksScreen from '../screens/PolitricksScreen';
import YardieHustleScreen from '../screens/YardieHustleScreen';
import KingTuffheadGameScreen from '../screens/KingTuffheadGameScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ContentDetailsScreen from '../screens/ContentDetailsScreen';
import EPGScreen from '../screens/EPGScreen';
import { COLORS } from '../theme/colors';

const HIDE_RADIO_ROUTES = [
  'Player',
  'UniversalPlayer',
  'VideoPlayer',
  'GameHub',
  'CharadesGame',
  'BorderControl',
  'Politricks',
  'YardieHustle',
  'KingTuffhead',
];

const Stack = createStackNavigator();

const screenOptions = {
  headerStyle: {
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.glassBorder,
    shadowOpacity: 0,
  },
  headerTintColor: COLORS.gold,
  headerTitleStyle: {
    fontWeight: '600',
    fontSize: 18,
  },
  headerBackTitleVisible: false,
  cardStyle: { backgroundColor: COLORS.background },
};

function MoviesPlaceholder() {
  return (
    <View style={placeholderStyles.container}>
      <Text style={placeholderStyles.title}>Movies</Text>
      <Text style={placeholderStyles.subtitle}>Replace with MoviesScreen</Text>
    </View>
  );
}

function SeriesPlaceholder() {
  return (
    <View style={placeholderStyles.container}>
      <Text style={placeholderStyles.title}>Series</Text>
      <Text style={placeholderStyles.subtitle}>Replace with SeriesScreen</Text>
    </View>
  );
}

const placeholderStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default function AppNavigator({ onLogout, initialParams = {} }) {
  const [currentRouteName, setCurrentRouteName] = useState(null);
  const showRadio = !currentRouteName || !HIDE_RADIO_ROUTES.includes(currentRouteName);
  return (
    <View style={{ flex: 1 }}>
    <NavigationContainer onStateChange={(state) => {
      if (!state?.routes?.[state.index]) return;
      const route = state.routes[state.index];
      setCurrentRouteName(route.state?.routes?.[route.state.index]?.name ?? route.name);
    }}>
      <Stack.Navigator screenOptions={screenOptions} initialRouteName="Home">
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          initialParams={{ ...initialParams, onLogout }}
          options={({ route }) => ({
            title: 'Orion Player',
            headerRight: () =>
              route.params?.onLogout ? (
                <TouchableOpacity
                  onPress={route.params.onLogout}
                  style={{ marginRight: 16 }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={{ color: COLORS.gold, fontSize: 16 }}>Log out</Text>
                </TouchableOpacity>
              ) : null,
          })}
        />
        <Stack.Screen name="Radio" component={RadioScreen} options={{ title: 'Radio Tuner' }} />
        <Stack.Screen name="LiveTV" component={CategoryScreen} options={{ title: 'Live TV' }} />
        <Stack.Screen
          name="ChannelList"
          component={ChannelListScreen}
          options={({ route }) => ({ title: route.params?.category_name || 'Channels' })}
        />
        <Stack.Screen name="Movies" component={MoviesPlaceholder} options={{ title: 'Movies' }} />
        <Stack.Screen
          name="VodCategory"
          component={VodCategoryScreen}
          options={{ title: 'Movie Categories' }}
        />
        <Stack.Screen
          name="VodList"
          component={ChannelListScreen}
          options={({ route }) => ({ title: route.params?.category_name || 'Movies' })}
        />
        <Stack.Screen name="Series" component={SeriesPlaceholder} options={{ title: 'Series' }} />
        <Stack.Screen
          name="SeriesDetails"
          component={SeriesDetailsScreen}
          options={({ route }) => ({ title: route.params?.name || 'Series' })}
        />
        <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
        <Stack.Screen name="Favorites" component={FavoritesScreen} options={{ title: 'My List' }} />
        <Stack.Screen name="GameHub" component={GameHubScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CharadesMenu" component={CharadesMenuScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CharadesGame" component={CharadesGameScreen} options={{ headerShown: false }} />
        <Stack.Screen name="BorderControl" component={BorderControlScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Politricks" component={PolitricksScreen} options={{ headerShown: false }} />
        <Stack.Screen name="YardieHustle" component={YardieHustleScreen} options={{ headerShown: false }} />
        <Stack.Screen name="KingTuffhead" component={KingTuffheadGameScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        <Stack.Screen
          name="Player"
          component={PlayerScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ContentDetails"
          component={ContentDetailsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EPG"
          component={EPGScreen}
          options={({ route }) => ({ title: route.params?.channel_name || 'Program Guide' })}
        />
        </Stack.Navigator>
    </NavigationContainer>
    <FloatingRadioPlayer visible={showRadio} />
    </View>
  );
}
