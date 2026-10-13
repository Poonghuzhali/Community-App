import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import RootNavigator, { navigationRef } from './src/navigation/RootNavigator';
import { registerForPushNotifications } from './src/utils/notifications';
import { colors } from './src/theme';
import { Loader } from './src/components/ui';

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.primary, card: colors.card, border: colors.border },
};

/** Registers for push after login and routes taps to the right screen. */
function PushBridge() {
  const { isSignedIn, user } = useAuth();
  const responseListener = useRef(null);

  useEffect(() => {
    if (!isSignedIn) return undefined;
    registerForPushNotifications();

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data || {};
      if (!navigationRef.isReady()) return;
      const routesByType = {
        visitor: user?.role === 'resident' ? 'VisitorDetail' : 'Tabs',
        complaint: 'ComplaintDetail',
        booking: 'Tabs',
        announcement: 'Announcements',
        event: 'Announcements',
        marketplace: 'Tabs',
      };
      const name = routesByType[data.type];
      if (name && data.id) {
        navigationRef.navigate(name, data.type === 'visitor' ? { id: data.visitorId || data.id } : { id: data.id });
      }
    });

    return () => {
      responseListener.current?.remove?.();
    };
  }, [isSignedIn, user]);

  return null;
}

function Gate() {
  const { booting } = useAuth();
  if (booting) return <Loader label="Starting Community Connect…" />;
  return <RootNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer ref={navigationRef} theme={navTheme}>
          <StatusBar style="dark" />
          <PushBridge />
          <Gate />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
