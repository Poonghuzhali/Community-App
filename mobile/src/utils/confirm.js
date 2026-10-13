import { Alert, Platform } from 'react-native';

/** Web's Alert.alert is a no-op, so confirmations never run in Chrome. */
export function confirm(title, message, confirmLabel, onConfirm) {
  if (Platform.OS === 'web') {
    const ok = typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`);
    if (ok) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
