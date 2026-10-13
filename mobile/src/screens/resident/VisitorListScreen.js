import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../api/client';
import { Screen, AppHeader, LogoutButton, HeaderActions, Chip, Card, StatusPill, EmptyState, Loader, Badge } from '../../components/ui';
import { colors, spacing, typography, radius, shadow } from '../../theme';
import { formatDateTime, relativeTime } from '../../utils/format';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'checked_in', label: 'Inside' },
  { key: 'checked_out', label: 'Exited' },
];

export default function VisitorListScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api('/api/visitors', { params: { status: filter || undefined, limit: 50 } });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const pending = items.filter((i) => i.status === 'pending').length;

  return (
    <Screen>
      <AppHeader
        title="Visitors"
        subtitle={`${total} pass${total === 1 ? '' : 'es'} on record`}
        right={
          <HeaderActions>
            <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('VisitorCreate')} accessibilityLabel="Pre-approve a visitor">
              <Ionicons name="add" size={22} color={colors.textInverse} />
            </TouchableOpacity>
            <LogoutButton />
          </HeaderActions>
        }
      />

      <View style={styles.filters}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(f) => f.key || 'all'}
          renderItem={({ item }) => (
            <Chip label={item.label} active={filter === item.key} onPress={() => setFilter(item.key)} />
          )}
        />
      </View>

      {loading ? (
        <Loader label="Loading visitors…" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="person-add-outline"
              title={filter === 'pending' ? 'No pending visitors' : 'No visitor passes yet'}
              message="Pre-approve your guests before they arrive and security will wave them through with an OTP or QR."
              action="Pre-approve a visitor"
              onAction={() => navigation.navigate('VisitorCreate')}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate('VisitorDetail', { id: item.id })}
            >
              <Card style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.h3} numberOfLines={1}>{item.visitor_name}</Text>
                    <Text style={[typography.small, { marginTop: 2 }]}>
                      {item.pass_type === 'delivery' ? 'Delivery' : item.pass_type === 'walkin' ? 'Walk-in' : 'Guest'} • {item.purpose}
                    </Text>
                  </View>
                  <StatusPill status={item.status} />
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                  <Text style={[typography.tiny, { marginLeft: 4 }]}>
                    {item.entry_at ? `In ${formatDateTime(item.entry_at)}` : `Created ${relativeTime(item.created_at)}`}
                  </Text>
                  {item.vehicle_number ? (
                    <Text style={[typography.tiny, { marginLeft: 10 }]}>🚗 {item.vehicle_number}</Text>
                  ) : null}
                </View>
                {item.status === 'pending' ? (
                  <View style={styles.pendingRow}>
                    <Ionicons name="alert-circle" size={14} color="#9A7100" />
                    <Text style={styles.pendingText}>Awaiting your approval</Text>
                    <Badge count={pending > 0 ? 1 : 0} style={{ backgroundColor: colors.warning }} />
                  </View>
                ) : null}
              </Card>
            </TouchableOpacity>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', ...shadow.card,
  },
  filters: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, marginTop: spacing.sm },
  card: { marginBottom: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  pendingRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: spacing.md,
    backgroundColor: colors.warningBg, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.sm,
  },
  pendingText: { fontSize: 12.5, fontWeight: '700', color: '#9A7100', marginLeft: 6, flex: 1 },
});
