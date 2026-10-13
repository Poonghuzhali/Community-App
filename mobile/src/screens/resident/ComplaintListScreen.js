import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../api/client';
import { Screen, AppHeader, LogoutButton, HeaderActions, Chip, Card, StatusPill, EmptyState, Loader } from '../../components/ui';
import { colors, spacing, typography, radius, shadow } from '../../theme';
import { relativeTime } from '../../utils/format';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'resolved', label: 'Resolved' },
];

export default function ComplaintListScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api('/api/complaints', { params: { status: filter || undefined, limit: 50 } });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = items.filter((i) => i.status !== 'resolved').length;

  return (
    <Screen>
      <AppHeader
        title="Complaints"
        subtitle={`${open} open • ${total} total`}
        right={
          <HeaderActions>
            <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('ComplaintCreate')} accessibilityLabel="Raise a complaint">
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
        <Loader label="Loading complaints…" />
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
              icon="construct-outline"
              title="No complaints here"
              message="Tap + to report a problem in your flat or common area. You can track it until it is resolved."
              action="Raise a complaint"
              onAction={() => navigation.navigate('ComplaintCreate')}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate('ComplaintDetail', { id: item.id })}
            >
              <Card style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.catIcon}>
                    <Ionicons name={(item.category_icon || 'construct').replace(/-outline$/, '')} size={17} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={typography.body} numberOfLines={1}>{item.title}</Text>
                    <Text style={[typography.tiny, { marginTop: 2 }]}>
                      {item.reference_no} • {item.category_name} • {relativeTime(item.created_at)}
                    </Text>
                  </View>
                  <StatusPill status={item.status} />
                </View>
                {item.status !== 'resolved' ? (
                  <View style={styles.progress}>
                    <Step done label="Submitted" active={true} />
                    <Step done={item.status !== 'submitted'} label="In progress" active={item.status === 'in_progress'} />
                    <Step done={item.status === 'resolved'} label="Resolved" active={false} last />
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

function Step({ label, done, active, last }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flex: last ? 0 : 1 }}>
      <View style={[styles.stepDot, done && { backgroundColor: colors.primary }, active && !done && { backgroundColor: colors.warning }]} />
      <Text style={[styles.stepLabel, done && { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>{label}</Text>
      {!last ? <View style={[styles.stepLine, done && { backgroundColor: colors.primary }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', ...shadow.card,
  },
  filters: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, marginTop: spacing.sm },
  card: { marginBottom: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  catIcon: {
    width: 38, height: 38, borderRadius: 13, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  progress: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border, marginRight: 5 },
  stepLabel: { fontSize: 10.5, color: colors.textMuted, marginRight: 5 },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.border, marginRight: 5 },
});
