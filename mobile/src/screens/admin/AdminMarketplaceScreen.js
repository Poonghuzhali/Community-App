import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../api/client';
import { Screen, AppHeader, LogoutButton, SearchBar, Card, StatusPill, EmptyState, Loader, Banner, Chip, Badge } from '../../components/ui';
import { colors, spacing, typography, radius } from '../../theme';
import { money, relativeTime } from '../../utils/format';

const STATUS_FILTERS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'sold', label: 'Sold' },
  { key: '', label: 'All' },
];

export default function AdminMarketplaceScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('pending');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api('/api/marketplace/admin', {
        params: { status: status || undefined, q: q || undefined, limit: 60 },
      });
      setItems(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, q]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const t = setTimeout(() => load(), 350);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const moderate = async (item, newStatus) => {
    Alert.alert(
      newStatus === 'approved' ? 'Approve listing' : 'Reject listing',
      `${item.title} — ${newStatus === 'approved' ? 'goes live for all residents' : 'the seller is notified of the rejection'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setBusyId(item.id);
            try {
              await api(`/api/marketplace/admin/${item.id}`, {
                method: 'PATCH',
                body: { status: newStatus, reason: newStatus === 'approved' ? 'Approved from app' : 'Does not meet community guidelines' },
              });
              load();
            } catch (err) {
              setError(err.message);
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <AppHeader title="Marketplace" subtitle="Moderate resident listings" onBack={() => navigation.navigate('Dashboard')} right={<LogoutButton />} />

      <View style={{ paddingHorizontal: spacing.lg }}>
        <SearchBar value={q} onChangeText={setQ} placeholder="Search listings…" />
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
        <Loader label="Loading listings…" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState icon="basket-outline" title="No listings" message={`Nothing with status "${status || 'any'}" right now.`} />
          }
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.navigate('MarketDetail', { id: item.id })}
                style={{ flexDirection: 'row', flex: 1 }}
              >
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Ionicons name="pricetags-outline" size={20} color={colors.primary} />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={typography.body} numberOfLines={1}>{item.title}</Text>
                  <Text style={[typography.small, { color: colors.primary, fontWeight: '700', marginTop: 2 }]}>
                    {money(item.price, item.price_unit)}
                  </Text>
                  <Text style={[typography.tiny, { marginTop: 3 }]}>
                    {item.seller_name} • {item.seller_flat || '—'} • {relativeTime(item.created_at)}
                  </Text>
                  <View style={{ marginTop: 6 }}>
                    <StatusPill status={item.status} />
                  </View>
                </View>
              </TouchableOpacity>

              {item.status === 'pending' ? (
                <View style={styles.actions}>
                  <TouchableOpacity style={[styles.action, styles.approve]} onPress={() => moderate(item, 'approved')} disabled={busyId === item.id}>
                    <Ionicons name="checkmark" size={17} color={colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.action, styles.reject]} onPress={() => moderate(item, 'rejected')} disabled={busyId === item.id}>
                    <Ionicons name="close" size={17} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, padding: spacing.md },
  thumb: { width: 58, height: 58, borderRadius: radius.md, backgroundColor: colors.greyBg },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  actions: { flexDirection: 'column', marginLeft: spacing.sm, gap: 6 },
  action: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  approve: { backgroundColor: colors.successBg },
  reject: { backgroundColor: colors.dangerBg },
});
