import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * API base URL.
 * Override without touching code:
 *   EXPO_PUBLIC_API_URL=http://10.0.2.2:4000 npx expo start
 * or set `extra.apiUrl` in app.json.
 *
 * The app.json default (10.0.2.2) is the Android emulator's alias for the
 * host machine. A browser cannot reach that address, so web uses the same
 * host the page was opened on, port 4000.
 */
const fromEnv = typeof process !== 'undefined' && process.env ? process.env.EXPO_PUBLIC_API_URL : null;
const fromExtra = Constants?.expoConfig?.extra?.apiUrl;

function webApiUrl() {
  const host = typeof window !== 'undefined' && window.location?.hostname
    ? window.location.hostname
    : 'localhost';
  return `http://${host}:4000`;
}

export const API_URL = (fromEnv || (Platform.OS === 'web' ? webApiUrl() : fromExtra) || 'http://192.168.1.5:4000').replace(/\/$/, '');

export const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : true;

export default { API_URL, isDev };
