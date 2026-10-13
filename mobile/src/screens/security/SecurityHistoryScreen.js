import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../api/client';
import { Screen, AppHeader, LogoutButton, Card, StatusPill, EmptyState, Loader, Banner, Chip } from '../../components/ui';
import { colors, spacing, typography, radius } from '../../theme';
import { formatDateTime } from '../../utils/format';

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'checked_in', label: 'Inside' },
  { key: 'checked_out', label: 'Left' },
  { key: 'rejected', label: 'Rejected' },
];

export default function SecurityHistoryScreen() {
  const [items, setItems] = useState([]);
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
      const data = await api('/api/visitors', {
        params: { scope: 'all', status: status || undefined, q: q || undefined, page: targetPage, limit: 20 },
      });
      setItems(targetPage === 1 ? data.items || [] : (prev) => [...prev, ...(data.items || [])]);
      setTotalPages(data.totalPages || 1);
      setPage(targetPage);
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
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Screen contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <AppHeader title="Visitor history" subtitle="Every gate record in the community" right={<LogoutButton />} />

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={17} color={colors.textMuted} />
        <TextInput
          style={styles.search}
          value={q}
          onChangeText={setQ}
          placeholder="Search name, flat or vehicle"
          placeholderTextColor={colors.grey}
          returnKeyType="search"
        />
        {q ? (
          <TouchableOpacity onPress={() => setQ('')}>
            <Ionicons name="close-circle" size={17} color={colors.grey} />
          </TouchableOpacity>
        ) : null}
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
        <Loader label="Loading history…" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(v) => v.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(1); }} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState icon="file-tray-outline" title="No records" message="No visitor passes match this filter yet." />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (page < totalPages) load(page + 1); }}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.8} onPress={() => undefined} style={{ opacity: 1 }}>
              <Card style={styles.card}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={typography.body}>{item.visitor_name}</Text>
                    <Text style={[typography.tiny, { marginLeft: 6 }]}>• {item.pass_type}</Text>
                  </View>
                  <Text style={[typography.tiny, { marginTop: 3 }]}>
                    {item.host_flat} • {item.host_name || '—'} {item.vehicle_number ? `• ${item.vehicle_number}` : ''}
                  </Text>
                  <Text style={[typography.tiny, { marginTop: 5, color: colors.textMuted }]}>
                    Created {formatDateTime(item.created_at)}
                    {item.entry_at ? ` • In ${formatDateTime(item.entry_at)}` : ''}
                    {item.exit_at ? ` • Out ${formatDateTime(item.exit_at)}` : ''}
                  </Text>
                </View>
                <StatusPill status={item.status} />
              </Card>
            </TouchableOpacity>
          )}
          ListFooterComponent={page < totalPages ? <Text style={styles.more}>Loading more…</Text> : null}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    marginHorizontal: spacing.lg, paddingHorizontal: spacing.md, paddingVertical: 10,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  search: { flex: 1, marginLeft: 8, fontSize: 14.5, color: colors.text },
  filters: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, padding: spacing.md },
  more: { textAlign: 'center', color: colors.textMuted, fontSize: 12.5, paddingVertical: spacing.md },
});
