/**
 * NotificationService - Push notification permissions, token, and handlers.
 * Requires: npx expo install expo-notifications
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';

const ANDROID_CHANNEL_ID = 'orion-high-priority';

let handlerConfigured = false;
function ensureNotificationHandler() {
  if (handlerConfigured) return;
  // When app is in foreground, show notifications as banner (optional: use custom in-app UI)
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
    }),
  });
  handlerConfigured = true;
}

function getProjectId() {
  // Only enable Expo push token retrieval when a real projectId is configured.
  // This avoids noisy errors in Expo Go / unmanaged setups.
  return (
    process.env.EXPO_PUBLIC_PROJECT_ID ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    process.env.EAS_PROJECT_ID ||
    null
  );
}

/**
 * Request permission, create Android channel, and return Expo push token.
 * Log the token to console for use when sending messages.
 */
export async function registerForPushNotificationsAsync() {
  const projectId = getProjectId();
  if (!projectId) {
    // No projectId configured → skip push to prevent terminal spam.
    return null;
  }

  try {
    ensureNotificationHandler();
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      if (status !== 'granted') {
        console.log('[Notifications] Permission not granted');
        return null;
      }
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Orion High Priority',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFD700',
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const token = tokenData?.data;
    if (token) {
      console.log('[Notifications] Expo push token (use this to send messages):', token);
    }
    return token;
  } catch (e) {
    // Avoid noisy warnings in environments that don't support push tokens.
    return null;
  }
}

/**
 * Set up listeners: foreground notification received (show detailed alert),
 * and notification response (user tapped -> navigate to Movie or Game).
 * @param {React.RefObject} navigationRef - Ref to NavigationContainer (e.g. from createNavigationContainerRef or ref on NavigationContainer)
 */
export function setupNotificationListeners(navigationRef) {
  ensureNotificationHandler();
  const subscriptionReceived = Notifications.addNotificationReceivedListener((notification) => {
    const title = notification.request.content?.title ?? 'Notification';
    const body = notification.request.content?.body ?? '';
    const data = notification.request.content?.data ?? {};
    // Show a detailed in-app alert when notification is received while app is open
    Alert.alert(
      title,
      body || (data?.body ?? 'New update'),
      [{ text: 'OK' }]
    );
  });

  const subscriptionResponse = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content?.data ?? {};
    const type = data?.type; // 'movie' | 'series' | 'game' | etc.
    const id = data?.id ?? data?.stream_id ?? data?.series_id;
    const name = data?.name ?? data?.title ?? '';
    const cover = data?.cover ?? data?.stream_icon ?? null;

    const nav = navigationRef?.current;
    if (!nav?.navigate) return;

    if (type === 'game' || type === 'GameHub') {
      nav.navigate('GameHub', {});
      return;
    }
    if (type === 'series' && id != null) {
      nav.navigate('SeriesDetails', { series_id: id, name, cover });
      return;
    }
    if ((type === 'movie' || type === 'vod') && id != null) {
      nav.navigate('ContentDetails', { stream_id: id, name, cover, type: 'movie' });
      return;
    }
    // Fallback: open Home
    nav.navigate('Home', {});
  });

  return () => {
    subscriptionReceived.remove();
    subscriptionResponse.remove();
  };
}
