import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../api/client';
import { Screen, AppHeader, SearchBar, Card, StatusPill, EmptyState, Loader, Banner, Chip } from '../../components/ui';
import { colors, spacing, typography, radius } from '../../theme';
import { formatDateTime, relativeTime } from '../../utils/format';

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'checked_in', label: 'Inside' },
  { key: 'checked_out', label: 'Exited' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function AdminVisitorsScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (targetPage = 1) => {
    try {
      setError(null);
      const [data, s] = await Promise.all([
        api('/api/visitors', { params: { scope: 'all', status: status || undefined, q: q || undefined, page: targetPage, limit: 25 } }),
        api('/api/security/stats').catch(() => null),
      ]);
      setItems(targetPage === 1 ? (data.items || []) : (prev) => [...prev, ...(data.items || [])]);
      setTotalPages(Math.max(1, Math.ceil((data.total || 0) / (data.limit || 25))));
      setPage(targetPage);
      if (s) setStats(s);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, q]);

  useFocusEffect(useCallback(() => { load(1); }, [load]));

  useEffect(() => {
    const t = setTimeout(() => load(1), 350);
    return () => clearTimeout(t);
  }, [q, status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Screen contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <AppHeader title="Visitor management" subtitle="All passes, entries and exits" />

      {stats ? (
        <View style={styles.statRow}>
          <Stat label="Inside now" value={stats.currentlyInside} color={colors.success} />
          <Stat label="Entries today" value={stats.todayEntries} color={colors.primary} />
          <Stat label="30-day passes" value={(stats.byStatus || []).reduce((n, r) => n + (r.count || 0), 0)} color={colors.info} />
        </View>
      ) : null}

      <View style={{ paddingHorizontal: spacing.lg }}>
        <SearchBar value={q} onChangeText={setQ} placeholder="Search visitor, flat or vehicle…" />
      </View>

      <View style={styles.filters}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_FILTERS}
          keyExtractor={(s) => s.key || 'all'}
          renderItem={({ item }) => <Chip label={item.label} active={status === item.key} onPress={() => setStatus(item.key)} />}
        />
      </View>

      <Banner message={error} type="danger" onClose={() => setError(null)} />

      {loading ? (
        <Loader label="Loading visitors…" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(v) => v.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(1); }} tintColor={colors.primary} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (page < totalPages) load(page + 1); }}
          ListEmptyComponent={<EmptyState icon="person-remove-outline" title="No visitor passes" message="Nothing matches this filter." />}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('VisitorDetail', { id: item.id })}>
              <Card style={styles.card}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={typography.body} numberOfLines={1}>{item.visitor_name}</Text>
                    <Text style={[typography.tiny, { marginLeft: 6 }]}>• {item.pass_type}</Text>
                  </View>
                  <Text style={[typography.tiny, { marginTop: 3 }]}>
                    Host {item.host_flat} • {item.host_name}{item.vehicle_number ? ` • ${item.vehicle_number}` : ''}
                  </Text>
                  <Text style={[typography.tiny, { marginTop: 3, color: colors.textMuted }]}>
                    {item.entry_at ? `In ${formatDateTime(item.entry_at)}` : `Created ${relativeTime(item.created_at)}`}
                    {item.exit_at ? ` • Out ${formatDateTime(item.exit_at)}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', marginLeft: spacing.sm }}>
                  <StatusPill status={item.status} />
                  <Ionicons name="chevron-forward" size={16} color={colors.grey} style={{ marginTop: 8 }} />
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}
    </Screen>
  );
}

function Stat({ label, value, color }) {
  return (
    <View style={[styles.stat, { backgroundColor: color + '14' }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  stat: { flex: 1, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  statValue: { fontSize: 19, fontWeight: '800' },
  statLabel: { fontSize: 10.5, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
  filters: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, padding: spacing.md },
});
