import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNavigationContainerRef } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { colors, typography } from '../theme';
import { Loader } from '../components/ui';

import LoginScreen from '../screens/auth/LoginScreen';
import OtpScreen from '../screens/auth/OtpScreen';
import ProfileSetupScreen from '../screens/auth/ProfileSetupScreen';

import HomeScreen from '../screens/resident/HomeScreen';
import VisitorListScreen from '../screens/resident/VisitorListScreen';
import VisitorCreateScreen from '../screens/resident/VisitorCreateScreen';
import VisitorDetailScreen from '../screens/resident/VisitorDetailScreen';
import ComplaintListScreen from '../screens/resident/ComplaintListScreen';
import ComplaintCreateScreen from '../screens/resident/ComplaintCreateScreen';
import ComplaintDetailScreen from '../screens/resident/ComplaintDetailScreen';
import BookingScreen from '../screens/resident/BookingScreen';
import BookingHistoryScreen from '../screens/resident/BookingHistoryScreen';
import MarketplaceScreen from '../screens/resident/MarketplaceScreen';
import MarketplaceDetailScreen from '../screens/resident/MarketplaceDetailScreen';
import MarketplaceCreateScreen from '../screens/resident/MarketplaceCreateScreen';
import AnnouncementsScreen from '../screens/resident/AnnouncementsScreen';
import EventDetailScreen from '../screens/resident/EventDetailScreen';
import NotificationsScreen from '../screens/resident/NotificationsScreen';
import ProfileScreen from '../screens/resident/ProfileScreen';

import GateScreen from '../screens/security/GateScreen';
import InsideScreen from '../screens/security/InsideScreen';
import SecurityHistoryScreen from '../screens/security/SecurityHistoryScreen';

import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminResidentsScreen from '../screens/admin/AdminResidentsScreen';
import AdminComplaintsScreen from '../screens/admin/AdminComplaintsScreen';
import AdminMarketplaceScreen from '../screens/admin/AdminMarketplaceScreen';
import AdminVisitorsScreen from '../screens/admin/AdminVisitorsScreen';
import AdminContentScreen from '../screens/admin/AdminContentScreen';
import AdminAmenitiesScreen from '../screens/admin/AdminAmenitiesScreen';
import AdminMoreScreen from '../screens/admin/AdminMoreScreen';

export const navigationRef = createNavigationContainerRef();

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const TAB_ICONS = {
  Home: ['home', 'home-outline'],
  Visitors: ['person-add', 'person-add-outline'],
  Complaints: ['construct', 'construct-outline'],
  Bookings: ['calendar', 'calendar-outline'],
  Market: ['pricetags', 'pricetags-outline'],
  Gate: ['scan', 'scan-outline'],
  Inside: ['people', 'people-outline'],
  History: ['time', 'time-outline'],
  Dashboard: ['grid', 'grid-outline'],
  Residents: ['people-circle', 'people-circle-outline'],
  AdminComplaints: ['alert-circle', 'alert-circle-outline'],
  AdminMarket: ['basket', 'basket-outline'],
  More: ['ellipsis-horizontal', 'ellipsis-horizontal-outline'],
};

function TabBarIcon({ route, focused, color, size }) {
  const [active, inactive] = TAB_ICONS[route.name] || ['circle', 'circle-outline'];
  return <Ionicons name={focused ? active : inactive} size={size ?? 22} color={color} />;
}

function tabScreen(name, component) {
  return (
    <Tabs.Screen
      key={name}
      name={name}
      component={component}
      options={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.grey,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: (props) => <TabBarIcon route={{ name }} {...props} />,
      }}
    />
  );
}

function ResidentTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }}>
      {tabScreen('Home', HomeScreen)}
      {tabScreen('Visitors', VisitorListScreen)}
      {tabScreen('Complaints', ComplaintListScreen)}
      {tabScreen('Bookings', BookingScreen)}
      {tabScreen('Market', MarketplaceScreen)}
    </Tabs.Navigator>
  );
}

function SecurityTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }}>
      {tabScreen('Gate', GateScreen)}
      {tabScreen('Inside', InsideScreen)}
      {tabScreen('History', SecurityHistoryScreen)}
    </Tabs.Navigator>
  );
}

function AdminTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }}>
      {tabScreen('Dashboard', AdminDashboardScreen)}
      {tabScreen('Residents', AdminResidentsScreen)}
      {tabScreen('AdminComplaints', AdminComplaintsScreen)}
      {tabScreen('AdminMarket', AdminMarketplaceScreen)}
      {tabScreen('More', AdminMoreScreen)}
    </Tabs.Navigator>
  );
}

const shared = { headerShown: false, animation: 'slide_from_right' };

function ResidentStack() {
  return (
    <Stack.Navigator screenOptions={shared}>
      <Stack.Screen name="Tabs" component={ResidentTabs} />
      <Stack.Screen name="VisitorCreate" component={VisitorCreateScreen} options={{ title: 'Pre-approve visitor' }} />
      <Stack.Screen name="VisitorDetail" component={VisitorDetailScreen} options={{ title: 'Visitor pass' }} />
      <Stack.Screen name="ComplaintCreate" component={ComplaintCreateScreen} options={{ title: 'New complaint' }} />
      <Stack.Screen name="ComplaintDetail" component={ComplaintDetailScreen} options={{ title: 'Complaint' }} />
      <Stack.Screen name="BookingHistory" component={BookingHistoryScreen} options={{ title: 'My bookings' }} />
      <Stack.Screen name="MarketCreate" component={MarketplaceCreateScreen} options={{ title: 'Add listing' }} />
      <Stack.Screen name="MarketDetail" component={MarketplaceDetailScreen} options={{ title: 'Listing' }} />
      <Stack.Screen name="Announcements" component={AnnouncementsScreen} options={{ title: 'Announcements & events' }} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My profile' }} />
    </Stack.Navigator>
  );
}

function SecurityStack() {
  return (
    <Stack.Navigator screenOptions={shared}>
      <Stack.Screen name="Tabs" component={SecurityTabs} />
      <Stack.Screen name="VisitorDetail" component={VisitorDetailScreen} options={{ title: 'Visitor pass' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My profile' }} />
    </Stack.Navigator>
  );
}

function AdminStack() {
  return (
    <Stack.Navigator screenOptions={shared}>
      <Stack.Screen name="Tabs" component={AdminTabs} />
      <Stack.Screen name="AdminVisitors" component={AdminVisitorsScreen} options={{ title: 'Visitor management' }} />
      <Stack.Screen name="AdminContent" component={AdminContentScreen} options={{ title: 'Announcements & events' }} />
      <Stack.Screen name="AdminAmenities" component={AdminAmenitiesScreen} options={{ title: 'Amenities & slots' }} />
      <Stack.Screen name="ComplaintDetail" component={ComplaintDetailScreen} options={{ title: 'Complaint' }} />
      <Stack.Screen name="MarketDetail" component={MarketplaceDetailScreen} options={{ title: 'Listing' }} />
      <Stack.Screen name="VisitorDetail" component={VisitorDetailScreen} options={{ title: 'Visitor pass' }} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My profile' }} />
    </Stack.Navigator>
  );
}

function AuthStack() {
  const { user, needsProfile } = useAuth();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={user && needsProfile ? 'ProfileSetup' : 'Login'}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const { booting, user, needsProfile } = useAuth();

  if (booting) return <Loader label="Waking up Community Connect…" />;
  if (!user || needsProfile) return <AuthStack />;

  if (user.role === 'security') return <SecurityStack />;
  if (user.role === 'admin') return <AdminStack />;
  return <ResidentStack />;
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 62,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabLabel: { fontSize: 11, fontWeight: '700' },
});
