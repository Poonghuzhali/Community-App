import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../api/client';
import { Screen, AppHeader, EmptyState, Loader, Chip } from '../../components/ui';
import { colors, spacing, typography, radius } from '../../theme';
import { relativeTime } from '../../utils/format';

const TYPE_ICONS = {
  visitor: ['person-add', colors.info],
  complaint: ['construct', colors.warning],
  booking: ['calendar', colors.success],
  announcement: ['megaphone', colors.primary],
  event: ['sparkles', colors.accentDark],
  marketplace: ['pricetags', colors.primary],
  system: ['notifications', colors.grey],
};

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'visitor', label: 'Visitors' },
  { key: 'complaint', label: 'Complaints' },
  { key: 'booking', label: 'Bookings' },
  { key: 'announcement', label: 'Notices' },
];

export default function NotificationsScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api('/api/notifications', { params: { type: type || undefined, limit: 100 } });
      setItems(data || []);
    } catch (err) {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [type]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markAll = async () => {
    await api('/api/notifications/read-all', { method: 'POST', body: {} });
    load();
  };

  const markOne = async (n) => {
    if (n.read_at) return;
    try {
      await api(`/api/notifications/${n.id}/read`, { method: 'POST', body: {} });
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read_at: new Date().toISOString() } : i)));
    } catch (err) { /* already read */ }
  };

  const unread = items.filter((i) => !i.read_at).length;

  return (
    <Screen contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <AppHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : 'You are all caught up'}
        onBack={() => navigation.goBack()}
        large={false}
        right={
          unread ? (
            <TouchableOpacity onPress={markAll}>
              <Text style={styles.markAll}>Mark all</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <View style={styles.filters}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(f) => f.key || 'all'}
          renderItem={({ item }) => <Chip label={item.label} active={type === item.key} onPress={() => setType(item.key)} />}
        />
      </View>

      {loading ? (
        <Loader label="Loading notifications…" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => String(n.id)}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState icon="notifications-off-outline" title="No notifications" message="Visitor updates, complaint status, booking confirmations and announcements land here." />
          }
          renderItem={({ item }) => {
            const [icon, color] = TYPE_ICONS[item.type] || TYPE_ICONS.system;
            return (
              <TouchableOpacity activeOpacity={0.8} onPress={() => markOne(item)} style={[styles.row, !item.read_at && styles.rowUnread]}>
                <View style={[styles.icon, { backgroundColor: color + '18' }]}>
                  <Ionicons name={icon} size={17} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, !item.read_at && { fontWeight: '700' }]} numberOfLines={2}>{item.title}</Text>
                  {item.body ? <Text style={[typography.small, { marginTop: 2 }]} numberOfLines={2}>{item.body}</Text> : null}
                  <Text style={[typography.tiny, { marginTop: 4 }]}>{relativeTime(item.created_at)}</Text>
                </View>
                {!item.read_at ? <View style={styles.dot} /> : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  markAll: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  filters: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.card,
    padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  rowUnread: { borderColor: colors.primaryLight, backgroundColor: '#FBFDFC' },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, marginLeft: spacing.sm, marginTop: 6 },
});
