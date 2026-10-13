import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from '../api/client';
import { isDev } from '../config';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Asks for permission and registers the native FCM/APNs token with the API.
 * Returns the token (or null when unavailable).
 */
export async function registerForPushNotifications() {
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Community Connect',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1B4D3E',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const asked = await Notifications.requestPermissionsAsync();
    status = asked.status;
  }
  if (status !== 'granted') return null;

  try {
    const push = await Notifications.getDevicePushTokenAsync();
    const token = push?.data || null;
    if (token) {
      await api('/api/auth/device', {
        method: 'POST',
        body: { token, platform: push.type || Platform.OS },
      });
    }
    return token;
  } catch (err) {
    if (isDev) console.log('push token unavailable', err.message);
    return null;
  }
}

export async function getExpoBadgeCount() {
  try {
    return await Notifications.getBadgeCountAsync();
  } catch (err) {
    return 0;
  }
}
