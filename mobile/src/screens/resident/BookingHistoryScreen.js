import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../api/client';
import { Screen, AppHeader, Card, StatusPill, EmptyState, Loader, Chip } from '../../components/ui';
import { colors, spacing, typography, shadow } from '../../theme';
import { formatDate, shortTime, relativeTime } from '../../utils/format';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'confirmed', label: 'Upcoming' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function BookingHistoryScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api('/api/bookings', { params: { status: filter || undefined, limit: 50 } });
      setItems(data.items || []);
    } catch (err) {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cancel = (booking) => {
    Alert.alert(
      'Cancel booking?',
      `${booking.amenity_name} on ${formatDate(booking.slot_date, { withYear: false })} at ${shortTime(booking.start_time)}`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel booking',
          style: 'destructive',
          onPress: async () => {
            try {
              await api(`/api/bookings/${booking.id}`, { method: 'DELETE' });
              load();
            } catch (err) {
              Alert.alert('Cannot cancel', err.message);
            }
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <AppHeader title="My bookings" subtitle="Past and upcoming amenity reservations" onBack={() => navigation.goBack()} />

      <View style={styles.filters}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(f) => f.key || 'all'}
          renderItem={({ item }) => <Chip label={item.label} active={filter === item.key} onPress={() => setFilter(item.key)} />}
        />
      </View>

      {loading ? (
        <Loader label="Loading bookings…" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState icon="calendar-outline" title="No bookings yet" message="Reserve the gym, hall, court or pool from the Bookings tab." />
          }
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.icon}>
                  <Ionicons name="calendar" size={17} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={typography.body}>{item.amenity_name}</Text>
                  <Text style={[typography.tiny, { marginTop: 2 }]}>
                    {formatDate(item.slot_date)} • {shortTime(item.start_time)}–{shortTime(item.end_time)}
                  </Text>
                  <Text style={[typography.tiny]}>Booked {relativeTime(item.booked_at)}</Text>
                </View>
                <StatusPill status={item.status} />
              </View>

              {item.status === 'confirmed' ? (
                <TouchableOpacity style={styles.cancelBtn} onPress={() => cancel(item)}>
                  <Ionicons name="close-circle-outline" size={15} color={colors.danger} />
                  <Text style={styles.cancelText}>Cancel booking</Text>
                </TouchableOpacity>
              ) : null}
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, marginTop: spacing.sm },
  card: { marginBottom: spacing.md },
  icon: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.md, paddingVertical: 9, borderRadius: 10,
    backgroundColor: colors.dangerBg,
  },
  cancelText: { color: colors.danger, fontWeight: '700', fontSize: 13, marginLeft: 6 },
});
