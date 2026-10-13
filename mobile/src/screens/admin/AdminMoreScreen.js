import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import { confirm } from '../../utils/confirm';
import { Screen, AppHeader, LogoutButton, Card, Avatar, StatusPill, Divider } from '../../components/ui';
import { colors, spacing, typography, radius } from '../../theme';

const LINKS = [
  {
    group: 'Operations',
    items: [
      { icon: 'scan-outline', label: 'Visitor management', desc: 'All passes, entries and exits', screen: 'AdminVisitors' },
      { icon: 'construct-outline', label: 'Complaints', desc: 'Review and resolve complaints', tab: 'AdminComplaints' },
      { icon: 'basket-outline', label: 'Marketplace', desc: 'Approve or reject listings', tab: 'AdminMarket' },
      { icon: 'business-outline', label: 'Amenities & slots', desc: 'Generate slots, block time', screen: 'AdminAmenities' },
    ],
  },
  {
    group: 'Community',
    items: [
      { icon: 'megaphone-outline', label: 'Announcements & events', desc: 'Publish notices and events', screen: 'AdminContent' },
      { icon: 'people-circle-outline', label: 'Residents', desc: 'Directory, roles and flats', tab: 'Residents' },
      { icon: 'notifications-outline', label: 'Notifications', desc: 'Your activity feed', screen: 'Notifications' },
    ],
  },
];

export default function AdminMoreScreen({ navigation }) {
  const { user, logout } = useAuth();

  const go = (item) => {
    if (item.screen) navigation.navigate(item.screen);
    else if (item.tab) navigation.navigate(item.tab);
  };

  const confirmLogout = () => {
    confirm('Log out?', 'You will need your mobile OTP to sign back in.', 'Log out', logout);
  };

  return (
    <Screen scroll>
      <AppHeader title="More" subtitle="Admin tools and account" onBack={() => navigation.navigate('Dashboard')} right={<LogoutButton />} />

      <Card style={styles.profile}>
        <Avatar name={user?.fullName} size={56} />
        <View style={{ marginLeft: spacing.md, flex: 1 }}>
          <Text style={typography.h3}>{user?.fullName}</Text>
          <Text style={[typography.small, { marginTop: 2 }]}>{user?.flatLabel || 'Community admin'}</Text>
        </View>
        <StatusPill status="approved" label="ADMIN" />
      </Card>

      {LINKS.map((group) => (
        <View key={group.group} style={{ marginTop: spacing.lg }}>
          <Text style={styles.groupLabel}>{group.group.toUpperCase()}</Text>
          <Card style={{ paddingVertical: spacing.xs }}>
            {group.items.map((item, i) => (
              <View key={item.label}>
                <TouchableOpacity style={styles.row} onPress={() => go(item)} activeOpacity={0.7}>
                  <View style={styles.rowIcon}>
                    <Ionicons name={item.icon} size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.body}>{item.label}</Text>
                    <Text style={[typography.tiny, { marginTop: 1 }]}>{item.desc}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={colors.grey} />
                </TouchableOpacity>
                {i < group.items.length - 1 ? <Divider /> : null}
              </View>
            ))}
          </Card>
        </View>
      ))}

      <ButtonLink icon="log-out-outline" label="Log out" desc="Sign out of this device" onPress={confirmLogout} danger />
      <Text style={styles.version}>Community Connect v1.0.0</Text>
    </Screen>
  );
}

function ButtonLink({ icon, label, desc, onPress, danger }) {
  return (
    <Card style={{ marginTop: spacing.lg }}>
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.rowIcon, danger && { backgroundColor: colors.dangerBg }]}>
          <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.body, danger && { color: colors.danger }]}>{label}</Text>
          <Text style={[typography.tiny, { marginTop: 1 }]}>{desc}</Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors.grey} />
      </TouchableOpacity>
    </Card>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center' },
  groupLabel: { fontSize: 11, fontWeight: '800', color: colors.grey, letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.xs },
  rowIcon: {
    width: 38, height: 38, borderRadius: 13, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  version: { textAlign: 'center', color: colors.grey, fontSize: 11.5, marginTop: spacing.xl },
});
