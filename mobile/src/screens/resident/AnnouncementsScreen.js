import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../api/client';
import { Screen, AppHeader, Card, StatusPill, EmptyState, Loader, Banner, Chip, Button } from '../../components/ui';
import { colors, spacing, typography, radius, shadow } from '../../theme';
import { formatDateTime, relativeTime } from '../../utils/format';

const CATEGORIES = [
  { key: '', label: 'All' },
  { key: 'general', label: 'General' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'security', label: 'Security' },
  { key: 'event', label: 'Events' },
  { key: 'emergency', label: 'Emergency' },
];

export default function AnnouncementsScreen({ navigation }) {
  const [tab, setTab] = useState('notices');
  const [notices, setNotices] = useState([]);
  const [events, setEvents] = useState([]);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [a, e] = await Promise.all([
        api('/api/announcements', { params: { category: category || undefined, limit: 50 } }).catch(() => ({ items: [] })),
        api('/api/events').catch(() => ({ items: [] })),
      ]);
      setNotices(a.items || []);
      setEvents(e.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleRegistration = async (event) => {
    try {
      await api(`/api/events/${event.id}/${event.isRegistered ? 'unregister' : 'register'}`, { method: 'POST', body: {} });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <AppHeader title="Announcements & events" subtitle="What's happening in the community" onBack={() => navigation.goBack()} />

      <View style={styles.tabs}>
        {['notices', 'events'].map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && { color: colors.textInverse }]}>
              {t === 'notices' ? `Notices (${notices.length})` : `Events (${events.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Banner message={error} type="danger" onClose={() => setError(null)} />

      {loading ? (
        <Loader label="Loading…" />
      ) : tab === 'notices' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
            {CATEGORIES.map((c) => (
              <Chip key={c.key || 'all'} label={c.label} active={category === c.key} onPress={() => setCategory(c.key)} />
            ))}
          </ScrollView>
          <FlatList
            data={notices}
            keyExtractor={(n) => n.id}
            contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
            ListEmptyComponent={<EmptyState icon="megaphone-outline" title="No announcements" message="Admin notices and community updates will appear here." />}
            renderItem={({ item }) => (
              <Card style={[styles.card, item.is_pinned && { borderColor: colors.accent }]}>
                <View style={styles.cardHead}>
                  <View style={[styles.catPill, item.category === 'emergency' && { backgroundColor: colors.dangerBg }]}>
                    <Text style={[styles.catText, item.category === 'emergency' && { color: colors.danger }]}>
                      {item.category?.toUpperCase()}
                    </Text>
                  </View>
                  {item.is_pinned ? <Ionicons name="pin" size={15} color={colors.accentDark} /> : null}
                  <Text style={[typography.tiny, { marginLeft: 'auto' }]}>{relativeTime(item.published_at)}</Text>
                </View>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={[typography.body, { marginTop: 4 }]}>{item.body}</Text>
                <Text style={[typography.tiny, { marginTop: spacing.sm }]}>— {item.author_name || 'Admin team'}</Text>
              </Card>
            )}
          />
        </>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="calendar-outline" title="No upcoming events" message="Community events, workshops and town halls will show up here." />}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('EventDetail', { id: item.id })}>
                <View style={styles.cardHead}>
                  <StatusPill status={item.status} label={item.status?.toUpperCase()} />
                  <Text style={[typography.tiny, { marginLeft: 'auto' }]}>{formatDateTime(item.starts_at)}</Text>
                </View>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={[typography.small, { marginTop: 4 }]} numberOfLines={2}>
                  {item.venue} • {item.description}
                </Text>
                <View style={styles.eventMeta}>
                  <Ionicons name="people-outline" size={14} color={colors.textMuted} />
                  <Text style={[typography.tiny, { marginLeft: 4 }]}>
                    {item.registered_count} registered{item.spotsLeft !== null ? ` • ${item.spotsLeft} spots left` : ''}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                <Button
                  title={item.isRegistered ? 'Registered ✓' : 'Register'}
                  variant={item.isRegistered ? 'secondary' : 'primary'}
                  small
                  disabled={!item.isRegistered && !item.registrationOpen}
                  onPress={() => toggleRegistration(item)}
                  style={{ flex: 1 }}
                />
                <Button title="Details" variant="outline" small onPress={() => navigation.navigate('EventDetail', { id: item.id })} style={{ flex: 1 }} />
              </View>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: spacing.sm, gap: spacing.sm },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center',
    backgroundColor: colors.greyBg,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  chipScroll: { flexGrow: 0, maxHeight: 60 },
  chipRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignItems: 'center' },
  card: { marginBottom: spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  catPill: { backgroundColor: colors.primaryLight, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill },
  catText: { fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 0.4 },
  title: { fontSize: 16.5, fontWeight: '700', color: colors.text },
  eventMeta: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
});
