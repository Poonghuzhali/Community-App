import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../api/client';
import { Screen, AppHeader, LogoutButton, SearchBar, Card, StatusPill, EmptyState, Loader, Banner, Chip } from '../../components/ui';
import { colors, spacing, typography } from '../../theme';
import { relativeTime } from '../../utils/format';

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'resolved', label: 'Resolved' },
];

export default function AdminComplaintsScreen({ navigation }) {
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
      const data = await api('/api/complaints/all', {
        params: { status: status || undefined, q: q || undefined, page: targetPage, limit: 25 },
      });
      setItems(targetPage === 1 ? (data.items || []) : (prev) => [...prev, ...(data.items || [])]);
      setTotalPages(Math.max(1, Math.ceil((data.total || 0) / (data.limit || 25))));
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
  }, [q, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = {
    submitted: items.filter((i) => i.status === 'submitted').length,
    in_progress: items.filter((i) => i.status === 'in_progress').length,
    resolved: items.filter((i) => i.status === 'resolved').length,
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <AppHeader title="Complaints" subtitle="Review and resolve every complaint" onBack={() => navigation.navigate('Dashboard')} right={<LogoutButton />} />

      <View style={{ paddingHorizontal: spacing.lg }}>
        <SearchBar value={q} onChangeText={setQ} placeholder="Search title, reference or resident…" />
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
        <Loader label="Loading complaints…" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(1); }} tintColor={colors.primary} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (page < totalPages) load(page + 1); }}
          ListEmptyComponent={
            <EmptyState icon="construct-outline" title="Nothing here" message="No complaints match this filter." />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate('ComplaintDetail', { id: item.id })}
            >
              <Card style={styles.card}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.catDot, { backgroundColor: item.priority === 'high' ? colors.danger : item.priority === 'low' ? colors.info : colors.warning }]} />
                    <Text style={[typography.body, { marginLeft: 7, flex: 1 }]} numberOfLines={1}>{item.title}</Text>
                  </View>
                  <Text style={[typography.tiny, { marginTop: 4 }]}>
                    {item.reference_no} • {item.raised_by_name} • {item.raised_by_flat || '—'}
                  </Text>
                  <Text style={[typography.tiny, { marginTop: 3, color: colors.textMuted }]}>
                    {item.category_name} • {item.priority} • {relativeTime(item.created_at)}
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

const styles = StyleSheet.create({
  filters: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, padding: spacing.md },
  catDot: { width: 8, height: 8, borderRadius: 4 },
});
